import type { BriefingFile } from "../entities/briefing.js";

export interface CreateBriefingFileInput {
  organizationId: string;
  briefingId: string;
  blobUrl: string;
  pathname: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface BriefingFileRepository {
  create(input: CreateBriefingFileInput): Promise<BriefingFile>;
  listForBriefing(briefingId: string, organizationId: string): Promise<BriefingFile[]>;
  findById(id: string, organizationId: string): Promise<BriefingFile | null>;
  delete(id: string, organizationId: string): Promise<void>;
}
