import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import { teamService, type TeamRolePayload } from "@/services/team";

const teamKeys = {
  all: ["team"] as const,
  directory: ["team", "directory"] as const,
  members: ["team", "members"] as const,
  roles: ["team", "roles"] as const,
  invitations: ["team", "invitations"] as const,
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function useTeamDirectory() {
  return useQuery({ queryKey: teamKeys.directory, queryFn: teamService.directory });
}

export function useTeamMembers(enabled = true) {
  return useQuery({ queryKey: teamKeys.members, queryFn: teamService.members, enabled });
}

export function useTeamRoles() {
  return useQuery({ queryKey: teamKeys.roles, queryFn: teamService.roles });
}

export function useTeamInvitations(enabled = true) {
  return useQuery({
    queryKey: teamKeys.invitations,
    queryFn: teamService.invitations,
    enabled,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teamService.invite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invitations });
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível enviar o convite.")),
  });
}

export function useRevokeTeamInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teamService.revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invitations });
      toast.success("Convite revogado.");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível revogar o convite.")),
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { roleId?: string; status?: "ACTIVE" | "SUSPENDED" };
    }) => teamService.updateMember(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members });
      queryClient.invalidateQueries({ queryKey: teamKeys.directory });
      toast.success("Membro atualizado.");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível atualizar o membro.")),
  });
}

export function useCreateTeamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamRolePayload) => teamService.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.roles });
      toast.success("Papel criado.");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível criar o papel.")),
  });
}

export function useUpdateTeamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TeamRolePayload> }) =>
      teamService.updateRole(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.roles });
      queryClient.invalidateQueries({ queryKey: teamKeys.members });
      toast.success("Papel atualizado.");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível atualizar o papel.")),
  });
}

export function useDeleteTeamRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teamService.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.roles });
      toast.success("Papel excluído.");
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível excluir o papel.")),
  });
}
