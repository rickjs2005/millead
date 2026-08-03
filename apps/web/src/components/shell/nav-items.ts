import {
  BarChart3,
  Building2,
  Calculator,
  Calendar,
  Clapperboard,
  ClipboardList,
  FileSignature,
  HandCoins,
  Instagram,
  LayoutDashboard,
  LayoutList,
  MessageSquare,
  Rocket,
  Settings,
  ShieldCheck,
  Users2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/types/api";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  /** So aparece pro dono (e-mail logado === NEXT_PUBLIC_OWNER_EMAIL). A
   *  protecao real e da API (requireOwner, 404); aqui e so visibilidade. */
  ownerOnly?: boolean;
  /** Sem API ainda (Fase 6/7) -- aparece no menu, mas leva pra um estado "em breve". */
  comingSoon?: boolean;
  /** Submenu de 1 nível só -- ver SidebarNav, sem componente de árvore genérico. */
  children?: Omit<NavItem, "children">[];
}

/** True quando o usuario logado e o dono configurado no build. */
export function isOwnerEmail(email: string | undefined | null): boolean {
  const owner = process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
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
    title: "Financeiro",
    items: [
      { label: "Orçamentos", href: "/estimates", icon: Calculator, permission: "proposals:read" },
      { label: "Centro de Custos", href: "/costs", icon: Wallet, permission: "proposals:read" },
      { label: "A Receber", href: "/receivables", icon: HandCoins, permission: "proposals:read" },
    ],
  },
  {
    title: "Prospecção",
    items: [
      { label: "Auditoria de sites", href: "/audit", icon: ShieldCheck, permission: "audits:read" },
      { label: "Diretor criativo", href: "/landing-pages", icon: Rocket, permission: "leads:read" },
      { label: "Vídeos", href: "/videos", icon: Clapperboard, permission: "leads:read" },
      { label: "Mensagens", href: "/messages", icon: MessageSquare, permission: "messages:read" },
    ],
  },
  {
    title: "Interno",
    items: [
      // Ferramenta pessoal do dono -- invisivel pra qualquer outro usuario.
      { label: "MilSocial", href: "/admin/milsocial", icon: Instagram, ownerOnly: true },
    ],
  },
  {
    items: [{ label: "Configurações", href: "/settings", icon: Settings }],
  },
];

/** Lista plana derivada -- usada pelo command palette e por quem não liga pra seções. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
