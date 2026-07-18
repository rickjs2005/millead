"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_SECTIONS, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col px-2">
      {sections.map((section, i) => (
        <div key={section.title ?? `sec-${i}`} className={cn("flex flex-col gap-1", i > 0 && "mt-4")}>
          {section.title && !collapsed ? (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </span>
          ) : null}
          {section.title && collapsed ? <span className="mx-2 border-t border-border" aria-hidden /> : null}
          {section.items.map((item) =>
            item.children?.length ? (
              <NavItemWithChildren
                key={item.href}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                currentSearch={searchParams.toString()}
                onNavigate={onNavigate}
              />
            ) : (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
  indent,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  indent?: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-2",
        indent && !collapsed && "py-1.5 pl-9 text-[13px]",
      )}
    >
      {active && (
        <motion.span
          layoutId={indent ? undefined : "sidebar-active-pill"}
          className="absolute inset-0 rounded-lg bg-primary/10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon className={cn("relative z-10 shrink-0", indent ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {!collapsed && (
        <span className="relative z-10 flex flex-1 items-center justify-between gap-2 truncate">
          {item.label}
          {item.comingSoon && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Em breve
            </Badge>
          )}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function NavItemWithChildren({
  item,
  collapsed,
  pathname,
  currentSearch,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  pathname: string;
  currentSearch: string;
  onNavigate?: () => void;
}) {
  const parentActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const [expanded, setExpanded] = useState(parentActive);
  const Icon = item.icon;

  if (collapsed) {
    // Sem espaço pra submenu no modo colapsado -- leva direto pro pai, mesmo
    // comportamento de um NavLink comum.
    return <NavLink item={item} active={parentActive} collapsed onNavigate={onNavigate} />;
  }

  return (
    <div>
      {/* O pai NAVEGA (é a lista principal do módulo); o chevron só expande.
          Antes o pai era um botão de expandir puro -- funcionava porque os
          filhos incluíam a própria lista filtrada, o que deixou de ser o caso. */}
      <div
        className={cn(
          "flex w-full items-center rounded-lg text-sm font-medium transition-colors",
          parentActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          className="flex flex-1 items-center gap-3 truncate px-3 py-2"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{item.label}</span>
        </Link>
        <button
          type="button"
          aria-label={expanded ? `Recolher ${item.label}` : `Expandir ${item.label}`}
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-2"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>
      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5">
          {item.children!.map((child) => {
            const [childPath, childQuery] = child.href.split("?");
            const active = childQuery
              ? pathname === childPath && currentSearch === childQuery
              : pathname === childPath;
            return (
              <NavLink key={child.href} item={child} active={active} onNavigate={onNavigate} indent />
            );
          })}
        </div>
      )}
    </div>
  );
}
