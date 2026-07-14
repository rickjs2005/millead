import type { TagRepository } from "../../domain/repositories/tag-repository.js";

export class TagService {
  constructor(private readonly repository: TagRepository) {}

  list(organizationId: string) {
    return this.repository.listForOrg(organizationId);
  }

  create(organizationId: string, name: string, color?: string) {
    return this.repository.create(organizationId, name, color);
  }
}
