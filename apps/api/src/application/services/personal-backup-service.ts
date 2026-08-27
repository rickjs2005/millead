import { ConflictError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  PersonalBackupRepository,
  RestoreCounts,
} from "../../domain/repositories/personal-backup-repository.js";
import type {
  ReauthContext,
  VaultReauthenticator,
} from "../../domain/services/vault-reauthenticator.js";
import type { AuditContext, AuditLogger } from "./audit-logger.js";
import {
  backupFileName,
  buildBackup,
  buildCsvNames,
  rejectBackup,
  toCsv,
  type VaultBackup,
} from "./vault-export.js";

/**
 * Levar o Cofre embora, e trazer de volta.
 *
 * ## Por que a senha de novo
 *
 * A sessão elevada já dá leitura tela a tela. A exportação é diferente em
 * grau, e o grau importa: ela transforma "alguém pegou o notebook destravado
 * por três minutos" em "alguém tem o histórico financeiro inteiro num
 * arquivo". Pedir a senha custa um campo e fecha essa janela.
 *
 * A confirmação usa o **mesmo balde de tentativas** do desbloqueio (ver
 * `VaultReauthenticator`). Um contador próprio faria da exportação um oráculo
 * de senha sem penalidade.
 *
 * Confirmar a senha aqui **não renova a sessão**: quem exporta não ganha mais
 * 15 minutos de Cofre aberto de brinde.
 *
 * ## Auditoria sem dados
 *
 * O evento registra que houve exportação e **quantas linhas**, nunca valores,
 * descrições ou nomes. A trilha precisa provar que a exportação aconteceu — se
 * ela carregasse o conteúdo, ela mesma viraria uma segunda cópia do Cofre,
 * numa tabela sem sessão elevada nenhuma na frente.
 */

export interface ExportResult {
  fileName: string;
  contentType: string;
  body: string;
  /** Contagens, pra tela mostrar o que saiu sem reabrir o arquivo. */
  resumo: Record<string, number>;
}

export class PersonalBackupService {
  constructor(
    private readonly backups: PersonalBackupRepository,
    private readonly reauth: VaultReauthenticator,
    private readonly audit: AuditLogger,
  ) {}

  /** `organizationId` sempre null: o Cofre não pertence à organização, e
   *  carimbar uma aqui colocaria atividade pessoal na trilha da empresa. */
  private auditContext(context: ReauthContext): AuditContext {
    return {
      organizationId: null,
      userId: context.userId,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    };
  }

  async export(
    context: ReauthContext,
    password: string,
    formato: "json" | "csv",
    agora = new Date(),
  ): Promise<ExportResult> {
    const vaultId = await this.reauth.confirmPassword(context, password, "vault.export");
    const dump = await this.backups.dump(vaultId);
    const backup = buildBackup(dump, agora);

    await this.audit.log(this.auditContext(context), "vault.exported", {
      entityType: "personal_vault",
      entityId: vaultId,
      // Só o formato e as contagens. Nenhum valor, descrição ou nome.
      metadata: { formato, ...backup.resumo },
    });

    if (formato === "csv") {
      return {
        fileName: backupFileName(agora, "csv"),
        contentType: "text/csv; charset=utf-8",
        body: toCsv(dump, buildCsvNames(dump)),
        resumo: backup.resumo,
      };
    }

    return {
      fileName: backupFileName(agora, "json"),
      contentType: "application/json; charset=utf-8",
      // Indentado: um backup é para ser lido por gente também, e num arquivo
      // que a pessoa vai guardar por anos a legibilidade vale os bytes.
      body: JSON.stringify(backup, null, 2),
      resumo: backup.resumo,
    };
  }

  /**
   * Restaura **só num Cofre vazio**.
   *
   * Não existe mesclar nem sobrescrever, e isso é a decisão central desta
   * fase. Mesclar duas histórias financeiras duplica dinheiro em silêncio (a
   * mesma compra entra duas vezes, com ids diferentes, e nenhum fingerprint
   * pega porque o backup traz os originais). Sobrescrever destrói o que está
   * lá. Recusar é a única resposta que não perde nem inventa dado — e ela diz
   * o que fazer.
   */
  async restore(
    context: ReauthContext,
    password: string,
    arquivo: unknown,
  ): Promise<RestoreCounts> {
    const vaultId = await this.reauth.confirmPassword(context, password, "vault.restore");

    // A validação de formato vem ANTES da checagem de vazio: quem tenta
    // restaurar o arquivo errado merece saber que é o arquivo errado, não que
    // o Cofre está cheio.
    const motivo = rejectBackup(arquivo);
    if (motivo) throw new ValidationError(motivo);

    const vazio = await this.backups.isEmpty(vaultId);
    if (!vazio) {
      throw new ConflictError(
        "Este Cofre já tem dados. A restauração só entra num Cofre vazio — misturar dois " +
          "históricos duplicaria movimentações sem nada denunciando, e sobrescrever apagaria " +
          "o que está aqui. Exporte o que existe hoje e apague antes de restaurar.",
      );
    }

    const conteudo = (arquivo as VaultBackup).conteudo;
    const contagens = await this.backups.restore(vaultId, reviveDates(conteudo));

    await this.audit.log(this.auditContext(context), "vault.restored", {
      entityType: "personal_vault",
      entityId: vaultId,
      metadata: { ...contagens },
    });

    return contagens;
  }
}

/**
 * JSON não tem tipo data: tudo que era `Date` volta como string ISO.
 *
 * O Prisma recusa string onde espera `DateTime`, então a conversão tem de
 * acontecer em algum lugar. Aqui, e por reconhecimento de formato — não por
 * lista de campos: a lista teria de crescer junto com o schema, e é exatamente
 * o tipo de manutenção que o `omit` do dump foi feito pra evitar.
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function reviveDates<T>(value: T): T {
  if (typeof value === "string") {
    return (ISO.test(value) ? new Date(value) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(reviveDates) as T;
  }
  if (value !== null && typeof value === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(value)) {
      saida[chave] = reviveDates(item);
    }
    return saida as T;
  }
  return value;
}

export { reviveDates };
