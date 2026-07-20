import { randomBytes } from "node:crypto";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingFileRepository } from "../../domain/repositories/briefing-file-repository.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";
import type { BlobStorage } from "../../domain/services/blob-storage.js";

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".zip",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
  ".mov",
  ".webm",
]);

const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB (galeria aceita vídeo)

/**
 * Upload direto do browser pro Vercel Blob (ver domain/services/blob-storage
 * e o plano do módulo pro motivo de não fazer proxy pela API Express).
 * A API só participa gerando o token escopado e confirmando o registro.
 */
export class BriefingFileService {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly files: BriefingFileRepository,
    private readonly blob: BlobStorage,
  ) {}

  private async resolveBriefing(token: string) {
    const briefing = await this.briefings.findByToken(token);
    if (!briefing) throw new NotFoundError("Link inválido ou expirado.");
    if (briefing.status === "ARCHIVED") {
      throw new ValidationError("Este briefing foi arquivado e não aceita mais anexos.");
    }
    if (briefing.status === "COMPLETED") {
      throw new ValidationError("Este briefing já foi concluído e não aceita mais anexos.");
    }
    return briefing;
  }

  async createUploadToken(
    token: string,
    input: { filename: string; contentType: string; sizeBytes: number },
  ) {
    const briefing = await this.resolveBriefing(token);

    const ext = input.filename.slice(input.filename.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new ValidationError(`Tipo de arquivo não permitido: ${ext}`);
    }
    if (input.sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationError("Arquivo maior que o limite de 200MB.");
    }

    const unique = randomBytes(6).toString("hex");
    const safeName = input.filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const pathname = `briefings/${briefing.organizationId}/${briefing.id}/${unique}-${safeName}`;

    const { clientToken } = await this.blob.createClientUploadToken({
      pathname,
      contentType: input.contentType,
      maxSizeBytes: MAX_SIZE_BYTES,
    });

    return { clientToken, pathname };
  }

  /**
   * Confirma um upload já concluído no Blob (o client já tem url/pathname).
   * O `pathname`/`blobUrl` vêm do client, então precisam ser re-validados
   * contra o que foi realmente tokenizado pra este briefing -- senão o
   * allowlist de extensão/tamanho do `createUploadToken` seria contornável:
   * bastaria confirmar um registro apontando pra uma URL arbitrária, um tipo
   * fora da lista ou o path de outra organização (o arquivo acaba embutido
   * no PDF do briefing e exibido no admin).
   */
  async confirmFile(
    token: string,
    input: {
      blobUrl: string;
      pathname: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    const briefing = await this.resolveBriefing(token);

    // 1. O pathname tem que estar no prefixo escopado deste briefing.
    const expectedPrefix = `briefings/${briefing.organizationId}/${briefing.id}/`;
    if (!input.pathname.startsWith(expectedPrefix) || input.pathname.includes("..")) {
      throw new ValidationError("Caminho de arquivo inválido para este briefing.");
    }

    // 2. A extensão tem que estar no allowlist (só era checada na emissão do token).
    const ext = input.pathname.slice(input.pathname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new ValidationError(`Tipo de arquivo não permitido: ${ext}`);
    }

    // 3. O tamanho declarado tem que respeitar o limite.
    if (input.sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationError("Arquivo maior que o limite de 200MB.");
    }

    // 4. A URL do Blob tem que ser um host REAL do Vercel Blob E ter exatamente
    //    o pathname escopado. `endsWith` sozinho não valida o host: aceitaria
    //    https://atacante.interno/briefings/<org>/<id>/x.png (o arquivo depois
    //    entra no PDF/admin -- vetor de SSRF/injeção). Aqui o host tem que ser
    //    *.public.blob.vercel-storage.com e o caminho == input.pathname.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.blobUrl);
    } catch {
      throw new ValidationError("URL do arquivo inválida.");
    }
    const isBlobHost =
      parsedUrl.protocol === "https:" &&
      parsedUrl.hostname.endsWith(".public.blob.vercel-storage.com");
    const urlPath = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");
    if (!isBlobHost || urlPath !== input.pathname) {
      throw new ValidationError("URL do arquivo não corresponde ao caminho enviado.");
    }

    return this.files.create({
      organizationId: briefing.organizationId,
      briefingId: briefing.id,
      blobUrl: input.blobUrl,
      pathname: input.pathname,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
  }
}
