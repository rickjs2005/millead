import {
  BarChart3,
  Building2,
  Calendar,
  CheckSquare,
  FileSignature,
  Kanban,
  LayoutDashboard,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Users2,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/types/api";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  /** Sem API ainda (Fase 6/7) -- aparece no menu, mas leva pra um estado "em breve". */
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users2, permission: "leads:read" },
  { label: "Empresas", href: "/companies", icon: Building2, permission: "companies:read" },
  { label: "CRM", href: "/crm", icon: Kanban, permission: "leads:read" },
  { label: "Tarefas", href: "/tasks", icon: CheckSquare, permission: "tasks:read" },
  { label: "Agenda", href: "/agenda", icon: Calendar },
  { label: "Propostas", href: "/proposals", icon: BarChart3, permission: "proposals:read" },
  { label: "Contratos", href: "/contracts", icon: FileSignature, permission: "proposals:read" },
  { label: "Auditoria", href: "/audit", icon: ShieldCheck, permission: "audits:read" },
  { label: "Mensagens", href: "/messages", icon: MessageSquare, permission: "messages:read" },
  { label: "Landing pages", href: "/landing-pages", icon: Rocket, permission: "leads:read" },
  { label: "Reuniões", href: "/meetings", icon: Video, permission: "meetings:read" },
];
