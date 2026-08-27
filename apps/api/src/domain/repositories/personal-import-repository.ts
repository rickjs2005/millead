/**
 * Lotes de importação e perfis de mapeamento.
 *
 * O arquivo bancário **não** é persistido em lugar nenhum — nem aqui, nem em
 * storage, nem em fila. O lote guarda hash, nome higienizado, período,
 * contagens e erros por número de linha. Ver o comentário do modelo no schema.
 */

export type PersonalImportFormat = "OFX" | "CSV";
export type PersonalImportStatus = "COMPLETED" | "PARTIAL" | "FAILED";

/** Erro de linha: só código, nunca o conteúdo do extrato. */
export interface SafeImportError {
  line: number;
  code: string;
}

export interface PersonalImportBatch {
  id: string;
  vaultId: string;
  accountId: string | null;
  cardId: string | null;
  format: PersonalImportFormat;
  fileHash: string;
  fileName: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  ignoredRows: number;
  status: PersonalImportStatus;
  errors: SafeImportError[];
  createdAt: Date;
}

export type CreateImportBatchInput = Omit<PersonalImportBatch, "id" | "vaultId" | "createdAt">;

export interface PersonalImportProfile {
  id: string;
  vaultId: string;
  name: string;
  accountId: string | null;
  cardId: string | null;
  format: PersonalImportFormat;
  delimiter: string;
  decimalSeparator: string;
  dateOrder: string;
  hasHeader: boolean;
  columnMap: Record<string, string | number>;
  invertSign: boolean;
}

export type CreateImportProfileInput = Omit<PersonalImportProfile, "id" | "vaultId">;
export type UpdateImportProfileInput = Partial<CreateImportProfileInput>;

export interface PersonalImportRepository {
  createBatch(vaultId: string, input: CreateImportBatchInput): Promise<PersonalImportBatch>;
  /** Grava o resultado depois da inserção. O lote nasce antes (as
   *  movimentações precisam do id dele), mas as contagens só existem depois
   *  de o banco dizer quantas linhas entraram de fato — anotar a intenção em
   *  vez do resultado deixaria o histórico mentindo. */
  updateBatchResult(
    vaultId: string,
    id: string,
    result: {
      importedRows: number;
      duplicateRows: number;
      ignoredRows: number;
      status: PersonalImportStatus;
    },
  ): Promise<PersonalImportBatch | null>;
  listBatches(vaultId: string, limit: number): Promise<PersonalImportBatch[]>;
  findBatch(vaultId: string, id: string): Promise<PersonalImportBatch | null>;
  /** Já importei este mesmo arquivo nesta origem? Alimenta o aviso da
   *  pré-visualização — não bloqueia, porque a deduplicação por linha já
   *  cobre o caso e reimportar um arquivo corrigido é legítimo. */
  findBatchByHash(
    vaultId: string,
    origin: { accountId: string | null; cardId: string | null },
    fileHash: string,
  ): Promise<PersonalImportBatch | null>;

  listProfiles(vaultId: string): Promise<PersonalImportProfile[]>;
  findProfile(vaultId: string, id: string): Promise<PersonalImportProfile | null>;
  createProfile(vaultId: string, input: CreateImportProfileInput): Promise<PersonalImportProfile>;
  updateProfile(
    vaultId: string,
    id: string,
    patch: UpdateImportProfileInput,
  ): Promise<PersonalImportProfile | null>;
  deleteProfile(vaultId: string, id: string): Promise<boolean>;
}
