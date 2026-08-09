"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Tarefas viraram uma tab da Agenda (auditoria de UX 07/2026) --
 * bookmarks e links antigos continuam funcionando. Vira client component
 * (era um `redirect()` de server component) pra poder repassar a query
 * string -- senão `/tasks?overdue=true` (link do dashboard) chegava na
 * Agenda sem o filtro, porque o redirect antigo ignorava searchParams. */
export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", "tasks");
    router.replace(`/agenda?${qs.toString()}`);
  }, [router, searchParams]);

  return null;
}
