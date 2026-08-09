import { redirect } from "next/navigation";

/** Tarefas viraram uma tab da Agenda (auditoria de UX 07/2026) --
 * bookmarks e links antigos continuam funcionando. Server Component (não
 * client) igual aos outros redirects de módulo absorvido (`/crm`,
 * `/meetings`, `/settings`) -- evita o flash + round-trip extra de um
 * redirect client-side. Em Next 15 `searchParams` chega como Promise; lemos
 * pra preservar a query string (ex.: `?overdue=true`, usado pelo link "Ver
 * todas" do card de tarefas atrasadas no dashboard). */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "tasks");
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  redirect(`/agenda?${qs.toString()}`);
}
