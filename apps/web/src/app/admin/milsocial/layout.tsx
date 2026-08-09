import type { ReactNode } from "react";
import { ProtectedShell } from "@/components/shell/protected-shell";
import { MilsocialGuard } from "@/features/milsocial/milsocial-guard";

// Mesma razão do layout do grupo (app): a árvore depende de estado client
// (Zustand + /auth/me) e o prerender estático quebra sem force-dynamic.
export const dynamic = "force-dynamic";

export default function MilsocialLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedShell>
      <MilsocialGuard>{children}</MilsocialGuard>
    </ProtectedShell>
  );
}
