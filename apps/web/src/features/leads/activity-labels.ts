import {
  CheckSquare,
  MessageSquareText,
  Phone,
  Handshake,
  Mail,
  StickyNote,
  Video,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Activity, ActivityType } from "@/types/api";

export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  STATUS_CHANGE: Sparkles,
  TASK_CREATED: CheckSquare,
  MEETING_SCHEDULED: Video,
  MESSAGE_SENT: MessageSquareText,
  PROPOSAL_SENT: Handshake,
  OTHER: Sparkles,
};

export function describeActivity(activity: Activity): string {
  const payload = activity.payload ?? {};
  switch (activity.type) {
    case "STATUS_CHANGE":
      return `Movido para "${payload.toStageName ?? "novo estágio"}"`;
    case "NOTE":
      return "Nota adicionada";
    case "PROPOSAL_SENT":
      return `Proposta "${payload.title ?? ""}" enviada`;
    case "TASK_CREATED":
      return "Tarefa criada";
    case "MEETING_SCHEDULED":
      return "Reunião agendada";
    case "MESSAGE_SENT":
      return "Mensagem enviada";
    case "CALL":
      return "Ligação registrada";
    case "EMAIL":
      return "E-mail registrado";
    default:
      return payload.event === "lead_created" ? "Lead criado" : "Atividade registrada";
  }
}
