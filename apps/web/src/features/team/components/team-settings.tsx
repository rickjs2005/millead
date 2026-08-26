"use client";

import { Copy, MailPlus, Pencil, Plus, Shield, Trash2, UserRoundCheck, Users2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTeamRole,
  useDeleteTeamRole,
  useInviteTeamMember,
  useRevokeTeamInvitation,
  useTeamDirectory,
  useTeamInvitations,
  useTeamMembers,
  useTeamRoles,
  useUpdateTeamMember,
  useUpdateTeamRole,
} from "@/features/team/hooks";
import { useAuthStore } from "@/stores/auth-store";
import type { PermissionKey, TeamMember, TeamRole } from "@/types/api";
import { formatDate, getInitials } from "@/utils/format";

const PERMISSION_GROUPS: { label: string; items: { key: PermissionKey; label: string }[] }[] = [
  {
    label: "Comercial",
    items: [
      { key: "leads:read", label: "Ver leads" },
      { key: "leads:write", label: "Editar leads" },
      { key: "leads:delete", label: "Excluir leads" },
      { key: "companies:read", label: "Ver empresas" },
      { key: "companies:write", label: "Editar empresas" },
      { key: "pipelines:manage", label: "Gerenciar pipeline" },
    ],
  },
  {
    label: "Operação",
    items: [
      { key: "tasks:read", label: "Ver tarefas" },
      { key: "tasks:write", label: "Editar tarefas" },
      { key: "meetings:read", label: "Ver reuniões" },
      { key: "meetings:write", label: "Editar reuniões" },
      { key: "project-checklists:read", label: "Ver projetos" },
      { key: "project-checklists:write", label: "Editar projetos" },
    ],
  },
  {
    label: "Vendas e comunicação",
    items: [
      { key: "proposals:read", label: "Ver propostas" },
      { key: "proposals:write", label: "Editar propostas" },
      { key: "audits:read", label: "Ver auditorias" },
      { key: "audits:write", label: "Criar auditorias" },
      { key: "messages:read", label: "Ver mensagens" },
      { key: "messages:write", label: "Enviar mensagens" },
    ],
  },
  {
    label: "Administração",
    items: [
      { key: "members:manage", label: "Gerenciar membros" },
      { key: "roles:manage", label: "Gerenciar papéis" },
      { key: "billing:manage", label: "Gerenciar cobrança" },
      { key: "settings:manage", label: "Gerenciar configurações" },
    ],
  },
];

function InviteMemberDialog({ roles }: { roles: TeamRole[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles.find((role) => role.name === "Sales")?.id ?? "");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const invite = useInviteTeamMember();

  async function submit() {
    const result = await invite.mutateAsync({ email: email.trim().toLowerCase(), roleId });
    setInviteUrl(result.inviteUrl);
    toast.success(
      result.emailSent
        ? "Convite enviado por e-mail."
        : "Convite criado. Copie o link para enviar.",
    );
  }

  function resetDialog(next: boolean) {
    setOpen(next);
    if (!next) {
      setEmail("");
      setInviteUrl(null);
      invite.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetDialog}>
      <DialogTrigger asChild>
        <Button>
          <MailPlus /> Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar para a equipe</DialogTitle>
          <DialogDescription>O convite expira em 7 dias e pode ser revogado.</DialogDescription>
        </DialogHeader>
        {inviteUrl ? (
          <div className="flex flex-col gap-3 py-3">
            <p className="text-sm text-muted-foreground">
              Convite criado. Guarde este link agora; por segurança ele não será exibido novamente.
            </p>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteUrl);
                  toast.success("Link copiado.");
                }}
              >
                <Copy />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Papel</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          {inviteUrl ? (
            <Button onClick={() => resetDialog(false)}>Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => resetDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={!email.includes("@") || !roleId || invite.isPending}
              >
                {invite.isPending ? "Criando…" : "Enviar convite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  roles,
  canManage,
}: {
  member: TeamMember;
  roles: TeamRole[];
  canManage: boolean;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const update = useUpdateTeamMember();
  const isSelf = currentUserId === member.userId;

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center">
      <Avatar className="h-10 w-10">
        <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{member.name}</p>
          {isSelf && <Badge variant="secondary">Você</Badge>}
          {member.status === "SUSPENDED" && <Badge variant="destructive">Suspenso</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      {canManage ? (
        <Select
          value={member.role.id}
          onValueChange={(roleId) => update.mutate({ id: member.membershipId, patch: { roleId } })}
          disabled={isSelf || update.isPending}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="outline">{member.role.name}</Badge>
      )}
      {canManage && !isSelf && (
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              id: member.membershipId,
              patch: { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
            })
          }
        >
          {member.status === "ACTIVE" ? "Suspender" : "Reativar"}
        </Button>
      )}
    </div>
  );
}

function RoleDialog({ role }: { role?: TeamRole }) {
  const actorPermissions = useAuthStore((state) => state.role?.permissions ?? []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<PermissionKey[]>(role?.permissions ?? []);
  const createRole = useCreateTeamRole();
  const updateRole = useUpdateTeamRole();
  const pending = createRole.isPending || updateRole.isPending;

  function toggle(permission: PermissionKey, checked: boolean) {
    setPermissions((current) =>
      checked
        ? Array.from(new Set([...current, permission]))
        : current.filter((item) => item !== permission),
    );
  }

  async function save() {
    const payload = { name: name.trim(), description: description.trim() || null, permissions };
    if (role) await updateRole.mutateAsync({ id: role.id, patch: payload });
    else await createRole.mutateAsync(payload);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {role ? (
          <Button variant="ghost" size="icon">
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline">
            <Plus /> Novo papel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Editar papel" : "Novo papel"}</DialogTitle>
          <DialogDescription>
            Escolha apenas os acessos necessários para esta função.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Nome</Label>
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Descrição</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{group.label}</p>
              {group.items.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Checkbox
                    checked={permissions.includes(item.key)}
                    disabled={!actorPermissions.includes(item.key)}
                    onCheckedChange={(checked) => toggle(item.key, checked === true)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={name.trim().length < 2 || permissions.length === 0 || pending}
          >
            {pending ? "Salvando…" : "Salvar papel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamSettings() {
  const role = useAuthStore((state) => state.role);
  const canManageMembers = role?.permissions.includes("members:manage") ?? false;
  const canManageRoles = role?.permissions.includes("roles:manage") ?? false;
  const membersQuery = useTeamMembers(canManageMembers);
  const directoryQuery = useTeamDirectory();
  const rolesQuery = useTeamRoles();
  const invitationsQuery = useTeamInvitations(canManageMembers);
  const revoke = useRevokeTeamInvitation();
  const deleteRole = useDeleteTeamRole();
  const members = canManageMembers ? membersQuery.data : directoryQuery.data;
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const grantableRoles = useMemo(
    () =>
      roles.filter((candidate) =>
        candidate.permissions.every((permission) => role?.permissions.includes(permission)),
      ),
    [role?.permissions, roles],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" /> Membros
            </CardTitle>
            <CardDescription>
              Responsáveis disponíveis para leads, tarefas e projetos.
            </CardDescription>
          </div>
          {canManageMembers && grantableRoles.length > 0 && (
            <InviteMemberDialog roles={grantableRoles} />
          )}
        </CardHeader>
        <CardContent>
          {!members ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </p>
          ) : (
            members.map((member) => (
              <MemberRow
                key={member.membershipId}
                member={member}
                roles={grantableRoles}
                canManage={
                  canManageMembers &&
                  member.role.permissions.every((permission) =>
                    role?.permissions.includes(permission),
                  )
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {canManageMembers && (invitationsQuery.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailPlus className="h-5 w-5" /> Convites pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitationsQuery.data?.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.role.name} · expira em {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke.mutate(invitation.id)}
                  disabled={revoke.isPending}
                >
                  <Trash2 /> Revogar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Papéis e permissões
            </CardTitle>
            <CardDescription>
              Os papéis padrão são protegidos; papéis personalizados podem ser ajustados.
            </CardDescription>
          </div>
          {canManageRoles && <RoleDialog />}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {roles.map((teamRole) => {
            const canEdit =
              canManageRoles &&
              !teamRole.isSystem &&
              teamRole.permissions.every((permission) => role?.permissions.includes(permission));
            return (
              <div key={teamRole.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{teamRole.name}</p>
                      {teamRole.isSystem && <Badge variant="secondary">Padrão</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {teamRole.description ?? "Sem descrição"}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex">
                      <RoleDialog role={teamRole} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`Excluir o papel ${teamRole.name}?`))
                            deleteRole.mutate(teamRole.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {teamRole.permissions.slice(0, 5).map((permission) => (
                    <Badge key={permission} variant="outline">
                      {permission}
                    </Badge>
                  ))}
                  {teamRole.permissions.length > 5 && (
                    <Badge variant="outline">+{teamRole.permissions.length - 5}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!canManageMembers && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <UserRoundCheck className="h-4 w-4" /> Você pode consultar a equipe, mas não alterar
          membros ou papéis.
        </div>
      )}
    </div>
  );
}
