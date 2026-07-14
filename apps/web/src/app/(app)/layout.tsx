import type { ReactNode } from "react";
import { ProtectedShell } from "@/components/shell/protected-shell";

// Toda essa árvore depende de estado client-side (Zustand + localStorage,
// já que a API usa Bearer token, não cookie/sessão de servidor) --
// prerender estático quebra (`persist.hasHydrated` não existe em build
// time). `force-dynamic` só é respeitado num Server Component, por isso
// esse layout continua sem "use client" e delega a lógica pro
// ProtectedShell.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
