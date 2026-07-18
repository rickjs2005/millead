import { redirect } from "next/navigation";

/** Reuniões viraram uma tab da Agenda (auditoria de UX 07/2026) --
 * bookmarks e links antigos continuam funcionando. */
export default function MeetingsPage() {
  redirect("/agenda?tab=meetings");
}
