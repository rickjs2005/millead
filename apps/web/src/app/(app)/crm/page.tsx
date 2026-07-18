import { redirect } from "next/navigation";

/** O kanban foi unificado no módulo Leads (auditoria de UX 07/2026) --
 * bookmarks e links antigos pra /crm continuam funcionando. */
export default function CrmPage() {
  redirect("/leads?view=kanban");
}
