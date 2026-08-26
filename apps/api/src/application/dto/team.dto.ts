import { ALL_PERMISSIONS, type PermissionKey } from "@millead/database/permissions";
import { z } from "zod";

const permissionSchema = z.enum([...ALL_PERMISSIONS] as [PermissionKey, ...PermissionKey[]]);

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  roleId: z.string().min(1),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

export const updateTeamMemberSchema = z
  .object({
    roleId: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((value) => value.roleId !== undefined || value.status !== undefined, {
    message: "Informe o papel ou o status a alterar.",
  });
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

export const createTeamRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  permissions: z.array(permissionSchema).min(1),
});
export type CreateTeamRoleInput = z.infer<typeof createTeamRoleSchema>;

export const updateTeamRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    permissions: z.array(permissionSchema).min(1).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos um campo para alterar.",
  });
export type UpdateTeamRoleInput = z.infer<typeof updateTeamRoleSchema>;

export const invitationTokenSchema = z.object({
  token: z.string().min(32).max(256),
});

export const acceptTeamInvitationSchema = invitationTokenSchema.extend({
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(72).optional(),
});
export type AcceptTeamInvitationInput = z.infer<typeof acceptTeamInvitationSchema>;
