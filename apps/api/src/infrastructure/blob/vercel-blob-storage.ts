import { del, put } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { env } from "../../config/env.js";
import type { BlobStorage } from "../../domain/services/blob-storage.js";

/**
 * Adapter Vercel Blob. `addRandomSuffix: false` em tudo -- o pathname já
 * chega único (hex aleatório + nome do arquivo, gerado no service que cria
 * o token), e o client precisa que a url/pathname confirmados batam
 * exatamente com o que foi usado pra gerar o token.
 */
export class VercelBlobStorage implements BlobStorage {
  async upload(input: {
    pathname: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ url: string; pathname: string }> {
    const result = await put(input.pathname, input.buffer, {
      access: "public",
      contentType: input.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return { url: result.url, pathname: result.pathname };
  }

  async createClientUploadToken(input: {
    pathname: string;
    contentType: string;
    maxSizeBytes?: number;
  }): Promise<{ clientToken: string }> {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: env.BLOB_READ_WRITE_TOKEN,
      pathname: input.pathname,
      allowedContentTypes: [input.contentType],
      maximumSizeInBytes: input.maxSizeBytes,
      addRandomSuffix: false,
    });
    return { clientToken };
  }

  async delete(pathname: string): Promise<void> {
    await del(pathname, { token: env.BLOB_READ_WRITE_TOKEN });
  }
}
