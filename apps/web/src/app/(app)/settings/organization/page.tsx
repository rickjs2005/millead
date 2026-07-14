"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  if (!organization || !role) return null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>
            Edição da organização ainda não está disponível na API -- somente leitura por enquanto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input value={organization.name} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Identificador</Label>
            <Input value={organization.slug} disabled />
          </div>
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
