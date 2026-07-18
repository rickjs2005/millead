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

  /** Confirma um upload já concluído no Blob (o client já tem url/pathname). */
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
