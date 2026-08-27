import type { Request, Response } from "express";
import type {
  ExportVaultBody,
  RestoreVaultBody,
} from "../../../application/dto/personal-backup.dto.js";
import type { PersonalBackupService } from "../../../application/services/personal-backup-service.js";
import { requireAuth } from "../require-auth.js";
import { requireVaultContext } from "../require-vault-context.js";

/**
 * Backup do Cofre.
 *
 * Duas decisoes de HTTP que valem registro:
 *
 * - **POST, nao GET**, mesmo pra exportar. A senha vai no corpo, e um GET a
 *   carregaria na URL -- que vai parar em log de servidor, historico do
 *   navegador e cabecalho Referer.
 * - **`Cache-Control: no-store`** na resposta. Sem isso, o arquivo com o Cofre
 *   inteiro pode ficar em cache de disco do navegador ou de um proxy pelo
 *   caminho, sobrevivendo ao "Bloquear agora".
 */
export class PersonalBackupController {
  constructor(private readonly backups: PersonalBackupService) {}

  export = async (req: Request, res: Response): Promise<void> => {
    // `requireVaultContext` primeiro: sem sessao elevada a resposta e 404, e
    // nem chega a ter senha pra conferir.
    requireVaultContext(req);
    const auth = requireAuth(req);
    const { password, format } = req.body as ExportVaultBody;

    const resultado = await this.backups.export(
      { userId: auth.userId, ipAddress: req.ip, userAgent: req.get("user-agent") },
      password,
      format,
    );

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", resultado.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${resultado.fileName}"`);
    // O resumo tambem vai num cabecalho pra tela conseguir mostrar o que saiu
    // sem precisar reabrir o arquivo que acabou de baixar.
    res.setHeader("X-Vault-Export-Summary", JSON.stringify(resultado.resumo));
    res.send(resultado.body);
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    requireVaultContext(req);
    const auth = requireAuth(req);
    const { password, backup } = req.body as RestoreVaultBody;

    const contagens = await this.backups.restore(
      { userId: auth.userId, ipAddress: req.ip, userAgent: req.get("user-agent") },
      password,
      backup,
    );

    res.setHeader("Cache-Control", "no-store");
    res.json(contagens);
  };
}
