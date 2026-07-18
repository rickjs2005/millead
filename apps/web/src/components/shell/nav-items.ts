import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  FileSignature,
  Kanban,
  LayoutDashboard,
  LayoutList,
  MessageSquare,
  Rocket,
  Send,
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
  /** Submenu de 1 nível só -- ver SidebarNav, sem componente de árvore genérico. */
  children?: Omit<NavItem, "children">[];
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
  {
    label: "Briefings",
    href: "/briefings",
    icon: ClipboardList,
    permission: "leads:read",
    children: [
      { label: "Templates", href: "/briefings/templates", icon: LayoutList },
      { label: "Enviados", href: "/briefings?status=PENDING", icon: Send },
      { label: "Em andamento", href: "/briefings?status=IN_PROGRESS", icon: Clock },
      { label: "Concluídos", href: "/briefings?status=COMPLETED", icon: CheckCircle2 },
    ],
  },
  { label: "Auditoria", href: "/audit", icon: ShieldCheck, permission: "audits:read" },
  { label: "Mensagens", href: "/messages", icon: MessageSquare, permission: "messages:read" },
  { label: "Landing pages", href: "/landing-pages", icon: Rocket, permission: "leads:read" },
  { label: "Reuniões", href: "/meetings", icon: Video, permission: "meetings:read" },
];
