"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card/50 transition-[width] duration-200 md:flex",
        collapsed ? "w-[--sidebar-width-collapsed]" : "w-[--sidebar-width]",
      )}
    >
      <div className={cn("flex h-14 items-center px-4", collapsed && "justify-center px-0")}>
        <Logo iconOnly={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn("justify-start gap-2 text-muted-foreground", collapsed && "justify-center")}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && "Recolher"}
        </Button>
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
