"use client";

import { Building2, Kanban, Key, Plug, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Perfil", icon: User },
  { href: "/settings/organization", label: "Empresa & Permissões", icon: Shield },
  { href: "/settings/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/settings/team", label: "Equipe", icon: Building2, comingSoon: true },
  { href: "/settings/integrations", label: "Integrações", icon: Plug },
  { href: "/settings/api-keys", label: "API Keys", icon: Key, comingSoon: true },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie sua conta e as preferências do workspace.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible">
          {SETTINGS_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.comingSoon && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    Em breve
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
