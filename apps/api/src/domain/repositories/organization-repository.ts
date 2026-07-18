import type { Organization } from "../entities/organization.js";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: string): Promise<Organization | null>;
  create(input: CreateOrganizationInput): Promise<Organization>;
  updateName(id: string, name: string): Promise<Organization>;
}
