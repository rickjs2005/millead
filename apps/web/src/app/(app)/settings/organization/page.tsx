"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsService } from "@/services/settings";
import { useAuthStore } from "@/stores/auth-store";
import type { PermissionKey } from "@/types/api";

const PERMISSION_GROUPS: Record<string, PermissionKey[]> = {
  Leads: ["leads:read", "leads:write", "leads:delete"],
  Empresas: ["companies:read", "companies:write"],
  Pipeline: ["pipelines:manage"],
  Tarefas: ["tasks:read", "tasks:write"],
  Reuniões: ["meetings:read", "meetings:write"],
  Propostas: ["proposals:read", "proposals:write"],
  Auditoria: ["audits:read", "audits:write"],
  Mensagens: ["messages:read", "messages:write"],
  Administração: ["members:manage", "roles:manage", "billing:manage", "settings:manage"],
};

export default function OrganizationSettingsPage() {
  const organization = useAuthStore((s) => s.organization);
  const role = useAuthStore((s) => s.role);
  const patchOrganization = useAuthStore((s) => s.patchOrganization);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission("settings:manage");
  const [name, setName] = useState(organization?.name ?? "");
  const [saving, setSaving] = useState(false);

  if (!organization || !role) return null;

  const dirty = name.trim() !== organization.name && name.trim().length >= 2;

  async function saveName() {
    setSaving(true);
    try {
      const updated = await settingsService.updateOrganization({ name: name.trim() });
      patchOrganization({ name: updated.name });
      toast.success("Nome da empresa atualizado.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>
            {canManage
              ? "O nome aparece em propostas, contratos e e-mails enviados aos clientes."
              : "Somente quem tem permissão de configurações pode editar o nome."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Nome</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Identificador</Label>
              <Input value={organization.slug} disabled />
              <p className="text-xs text-muted-foreground">
                Usado em links públicos (fechamento) — não pode ser trocado.
              </p>
            </div>
          </div>
          {canManage && (
            <div>
              <Button onClick={saveName} disabled={!dirty || saving}>
                {saving ? "Salvando…" : "Salvar nome"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Suas permissões
            <Badge>{role.name}</Badge>
          </CardTitle>
          <CardDescription>O que sua função permite fazer nesta organização.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(PERMISSION_GROUPS).map(([group, keys]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{group}</p>
              <div className="flex flex-col gap-1">
                {keys.map((key) => {
                  const has = role.permissions.includes(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-1.5 text-sm ${has ? "text-foreground" : "text-muted-foreground/40"}`}
                    >
                      <Check className={`h-3.5 w-3.5 ${has ? "text-success" : "opacity-20"}`} />
                      {key}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
