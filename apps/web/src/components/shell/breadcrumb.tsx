"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  crm: "CRM",
  tasks: "Tarefas",
  agenda: "Agenda",
  proposals: "Propostas",
  audit: "Auditoria",
  messages: "Mensagens",
  meetings: "Reuniões",
  settings: "Configurações",
  profile: "Perfil",
  organization: "Empresa & Permissões",
  team: "Equipe",
  integrations: "Integrações",
  "api-keys": "API Keys",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {segments.map((segment, i) => {
        const href = `/${segments.slice(0, i + 1).join("/")}`;
        const isLast = i === segments.length - 1;
        const label = LABELS[segment] ?? decodeURIComponent(segment);

        return (
          <Fragment key={href}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
