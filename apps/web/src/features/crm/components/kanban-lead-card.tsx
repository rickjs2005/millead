"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, GripVertical } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/features/leads/lead-labels";
import { formatCurrency } from "@/utils/format";
import type { Lead } from "@/types/api";

export function KanbanLeadCard({ lead, companyName }: { lead: Lead; companyName?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow",
        isDragging && "z-10 opacity-50 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium hover:text-primary">{lead.title}</p>
        </Link>
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab touch-none text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      {companyName && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" /> {companyName}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {lead.value ? (
          <span className="text-xs font-medium text-foreground">
            {formatCurrency(lead.value, lead.currency)}
          </span>
        ) : (
          <span />
        )}
        <Badge variant="outline" className="text-[10px]">
          {LEAD_SOURCE_LABELS[lead.source]}
        </Badge>
      </div>
    </div>
  );
}
