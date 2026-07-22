"use client";

import { Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUiStore } from "@/stores/ui-store";
import { Breadcrumb } from "./breadcrumb";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "./notifications-bell";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:h-14">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      <div className="hidden md:block">
        <Breadcrumb />
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="ml-auto flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-base text-muted-foreground transition-colors hover:bg-muted md:ml-4 md:py-1.5 md:text-sm"
      >
        <Search className="h-5 w-5 md:h-3.5 md:w-3.5" />
        <span className="sm:hidden">Buscar…</span>
        <span className="hidden sm:inline">Buscar leads, empresas…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <NotificationsBell />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle asChild>
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="border-t border-border p-2">
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
