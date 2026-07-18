"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, type NavItem } from "./nav-items";
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

  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) =>
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
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          parentActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
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
