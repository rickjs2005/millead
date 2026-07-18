/**
 * Porta de storage de arquivo (impl Vercel Blob em infrastructure/blob).
 * Duas formas de escrita: upload direto (server->Blob, usado pro PDF
 * gerado pelo worker) e token de upload pro CLIENTE subir direto pro Blob
 * sem passar pela API (arquivos da galeria, potencialmente grandes/vídeo --
 * ver README/plano pro motivo de não fazer proxy pela API Express).
 */
export interface BlobStorage {
  upload(input: {
    pathname: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ url: string; pathname: string }>;

  createClientUploadToken(input: {
    pathname: string;
    contentType: string;
    maxSizeBytes?: number;
  }): Promise<{ clientToken: string }>;

  delete(pathname: string): Promise<void>;
}
