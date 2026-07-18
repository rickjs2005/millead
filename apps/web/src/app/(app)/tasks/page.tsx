import { redirect } from "next/navigation";

/** Tarefas viraram uma tab da Agenda (auditoria de UX 07/2026) --
 * bookmarks e links antigos continuam funcionando. */
export default function TasksPage() {
  redirect("/agenda?tab=tasks");
}
