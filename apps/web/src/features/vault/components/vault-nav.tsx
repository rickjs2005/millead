"use client";

import {
  Bell,
  CreditCard,
  FolderTree,
  Landmark,
  HandCoins,
  ListFilter,
  Receipt,
  RefreshCw,
  Repeat,
  Store,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useVaultAlertCount } from "@/features/vault/subscription-hooks";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Bell;
  /** Só a visão geral casa por igualdade — as outras casam por prefixo. */
  exact?: boolean;
  badge?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { href: "/cofre", label: "Visão geral", icon: RefreshCw, exact: true },
  { href: "/cofre/movimentacoes", label: "Movimentações", icon: Receipt },
  { href: "/cofre/importar", label: "Importar", icon: Upload },
  { href: "/cofre/assinaturas", label: "Assinaturas", icon: Repeat },
  { href: "/cofre/alertas", label: "Alertas", icon: Bell, badge: true },
  { href: "/cofre/dividas", label: "Dívidas", icon: HandCoins },
  { href: "/cofre/contas", label: "Contas", icon: Landmark },
  { href: "/cofre/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/cofre/categorias", label: "Categorias", icon: FolderTree },
  { href: "/cofre/fornecedores", label: "Fornecedores", icon: Store },
  { href: "/cofre/pessoas", label: "Pessoas", icon: Users },
  { href: "/cofre/regras", label: "Regras", icon: ListFilter },
];

/**
 * Navegação interna do Cofre.
 *
 * Vive aqui, e não na barra lateral do app, porque o Cofre não faz parte do
 * CRM — ele é uma área à parte, atrás de outra porta. Rola na horizontal no
 * celular em vez de virar menu sanfonado: são doze destinos curtos, e esconder
 * atrás de um toque a mais atrapalharia mais que ocupar espaço.
 */
export function VaultNav() {
  const pathname = usePathname();
  const alertCount = useVaultAlertCount();
  const pendentes = alertCount.data?.count ?? 0;

  return (
    <nav className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-1 border-b border-border pb-2">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent font-medium text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.badge && pendentes > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                    {pendentes}
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
