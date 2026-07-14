"use client";

import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { useRequireAuth } from "@/features/auth/use-require-auth";
import { AppShell } from "./app-shell";

export function ProtectedShell({ children }: { children: ReactNode }) {
  const { ready } = useRequireAuth();

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
