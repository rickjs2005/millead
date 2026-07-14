import type { Metadata } from "next";
import { KanbanBoard } from "@/features/crm/components/kanban-board";

export const metadata: Metadata = { title: "CRM — MilLead" };

export default function CrmPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre as colunas para mover o lead de estágio.
        </p>
      </div>
      <KanbanBoard />
    </div>
  );
}
