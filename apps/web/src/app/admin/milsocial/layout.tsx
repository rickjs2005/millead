import type { ReactNode } from "react";
import { MilsocialGuard } from "@/features/milsocial/milsocial-guard";

export default function MilsocialLayout({ children }: { children: ReactNode }) {
  return <MilsocialGuard>{children}</MilsocialGuard>;
}
