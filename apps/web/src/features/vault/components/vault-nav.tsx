"use client";

import {
  Bell,
  Building2,
  CreditCard,
  FolderTree,
  HandCoins,
  HardDriveDownload,
  Landmark,
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
import { useEffect, useRef } from "react";
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
  { href: "/cofre/milweb", label: "MilWeb", icon: Building2 },
  { href: "/cofre/contas", label: "Contas", icon: Landmark },
  { href: "/cofre/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/cofre/categorias", label: "Categorias", icon: FolderTree },
  { href: "/cofre/fornecedores", label: "Fornecedores", icon: Store },
  { href: "/cofre/pessoas", label: "Pessoas", icon: Users },
  { href: "/cofre/regras", label: "Regras", icon: ListFilter },
  { href: "/cofre/backup", label: "Backup", icon: HardDriveDownload },
];

/**
 * Navegação interna do Cofre.
 *
 * Vive aqui, e não na barra lateral do app, porque o Cofre não faz parte do
 * CRM — é uma área à parte, atrás de outra porta.
 *
 * ## Como as catorze abas cabem na tela
 *
 * **No desktop elas quebram em linhas** (`flex-wrap`), e não rolam. Rolagem
 * horizontal em tela grande esconde metade dos destinos atrás de um gesto que
 * ninguém faz com mouse — a pessoa não descobre que existe mais coisa. Duas
 * linhas de abas ocupam 30px a mais e mostram tudo.
 *
 * **No celular elas rolam**, porque quebrar catorze itens num telefone
 * consumiria meia tela. A barra de rolagem fica escondida (`scrollbar-none`):
 * a nativa do Windows é grossa e, atravessada sob a linha de abas, parece
 * defeito. A rolagem em si continua inteira — toque, roda do mouse e teclado.
 *
 * **A aba ativa é trazida para a vista** ao entrar na página. Sem isso, abrir
 * "Backup" no celular mostraria a faixa começando em "Visão geral", com a aba
 * atual fora da tela — e a pessoa não saberia onde está.
 */
export function VaultNav() {
  const pathname = usePathname();
  const alertCount = useVaultAlertCount();
  const pendentes = alertCount.data?.count ?? 0;
  const ativaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // `nearest` no bloco: rolar a faixa na horizontal sem arrastar a página
    // inteira para cima, que é o que `center` faria.
    ativaRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav
      aria-label="Seções do Cofre"
      className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0"
    >
      <ul className="flex min-w-max items-center gap-1 border-b border-border pb-2 sm:min-w-0 sm:flex-wrap">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                ref={active ? ativaRef : undefined}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  // Foco visível: a faixa rola, e sem anel a navegação por
                  // teclado ficaria invisível ao passar por um item fora da vista.
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
