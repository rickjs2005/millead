import type { Tag } from "../entities/tag.js";

export interface TagRepository {
  listForOrg(organizationId: string): Promise<Tag[]>;
  create(organizationId: string, name: string, color?: string): Promise<Tag>;
}
