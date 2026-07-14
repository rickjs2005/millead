/**
 * Catálogo global de permissões e papéis padrão. Fonte única de verdade
 * usada tanto pelo seed (popula o banco) quanto pelo middleware de RBAC
 * da API (`requirePermission`) -- evita permissão referenciada no código
 * que não existe no banco, ou vice-versa.
 */
export const PERMISSIONS = {
  LEADS_READ: "leads:read",
  LEADS_WRITE: "leads:write",
  LEADS_DELETE: "leads:delete",
  COMPANIES_READ: "companies:read",
  COMPANIES_WRITE: "companies:write",
  PIPELINES_MANAGE: "pipelines:manage",
  TASKS_READ: "tasks:read",
  TASKS_WRITE: "tasks:write",
  MEETINGS_READ: "meetings:read",
  MEETINGS_WRITE: "meetings:write",
  PROPOSALS_READ: "proposals:read",
  PROPOSALS_WRITE: "proposals:write",
  AUDITS_READ: "audits:read",
  AUDITS_WRITE: "audits:write",
  MESSAGES_READ: "messages:read",
  MESSAGES_WRITE: "messages:write",
  MEMBERS_MANAGE: "members:manage",
  ROLES_MANAGE: "roles:manage",
  BILLING_MANAGE: "billing:manage",
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);

const READ_ONLY_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.COMPANIES_READ,
  PERMISSIONS.TASKS_READ,
  PERMISSIONS.MEETINGS_READ,
  PERMISSIONS.PROPOSALS_READ,
  PERMISSIONS.AUDITS_READ,
  PERMISSIONS.MESSAGES_READ,
];

const SALES_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.LEADS_WRITE,
  PERMISSIONS.COMPANIES_READ,
  PERMISSIONS.COMPANIES_WRITE,
  PERMISSIONS.TASKS_READ,
  PERMISSIONS.TASKS_WRITE,
  PERMISSIONS.MEETINGS_READ,
  PERMISSIONS.MEETINGS_WRITE,
  PERMISSIONS.PROPOSALS_READ,
  PERMISSIONS.PROPOSALS_WRITE,
  PERMISSIONS.AUDITS_READ,
  PERMISSIONS.MESSAGES_READ,
  PERMISSIONS.MESSAGES_WRITE,
];

const ADMIN_PERMISSIONS: readonly PermissionKey[] = ALL_PERMISSIONS.filter(
  (key) => key !== PERMISSIONS.BILLING_MANAGE,
);

/** Papéis padrão criados automaticamente para toda organização nova. */
export const SYSTEM_ROLES = [
  { name: "Owner", description: "Acesso total, incluindo cobrança.", permissions: ALL_PERMISSIONS },
  { name: "Admin", description: "Acesso total, exceto cobrança.", permissions: ADMIN_PERMISSIONS },
  { name: "Sales", description: "Opera o CRM no dia a dia.", permissions: SALES_PERMISSIONS },
  { name: "Viewer", description: "Somente leitura.", permissions: READ_ONLY_PERMISSIONS },
] as const;
