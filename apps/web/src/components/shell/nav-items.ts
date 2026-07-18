import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  FileSignature,
  LayoutDashboard,
  LayoutList,
  MessageSquare,
  Rocket,
  Settings,
  ShieldCheck,
  Users2,
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

export interface NavSection {
  /** Sem título = sem cabeçalho (usado no topo/rodapé do menu). */
  title?: string;
  items: NavItem[];
}

/**
 * Menu agrupado por área de trabalho (auditoria de UX 07/2026): antes eram
 * 13 itens numa lista plana. Leads absorveu o kanban (ex-item "CRM", toggle
 * na própria página) e Agenda absorveu Tarefas/Reuniões (tabs). As rotas
 * antigas continuam vivas -- só saíram do menu.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Vendas",
    items: [
      { label: "Leads", href: "/leads", icon: Users2, permission: "leads:read" },
      { label: "Empresas", href: "/companies", icon: Building2, permission: "companies:read" },
      { label: "Agenda", href: "/agenda", icon: Calendar },
    ],
  },
  {
    title: "Fechamento",
    items: [
      { label: "Propostas", href: "/proposals", icon: BarChart3, permission: "proposals:read" },
      { label: "Contratos", href: "/contracts", icon: FileSignature, permission: "proposals:read" },
      {
        label: "Briefings",
        href: "/briefings",
        icon: ClipboardList,
        permission: "leads:read",
        children: [{ label: "Templates", href: "/briefings/templates", icon: LayoutList }],
      },
    ],
  },
  {
    title: "Prospecção",
    items: [
      { label: "Auditoria de sites", href: "/audit", icon: ShieldCheck, permission: "audits:read" },
      { label: "Landing pages", href: "/landing-pages", icon: Rocket, permission: "leads:read" },
      { label: "Mensagens", href: "/messages", icon: MessageSquare, permission: "messages:read" },
    ],
  },
  {
    items: [{ label: "Configurações", href: "/settings", icon: Settings }],
  },
];

/** Lista plana derivada -- usada pelo command palette e por quem não liga pra seções. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
