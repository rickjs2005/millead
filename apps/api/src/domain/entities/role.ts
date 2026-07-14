import type { PermissionKey } from "@millead/database/permissions";

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionKey[];
}
