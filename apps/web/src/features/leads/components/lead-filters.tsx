"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-labels";
import type { LeadStatus, PipelineWithStages } from "@/types/api";

interface LeadFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: LeadStatus | "ALL";
  onStatusChange: (value: LeadStatus | "ALL") => void;
  stageId: string | "ALL";
  onStageChange: (value: string) => void;
  pipeline: PipelineWithStages | undefined;
}

export function LeadFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  stageId,
  onStageChange,
  pipeline,
}: LeadFiltersProps) {
  const hasFilters = search !== "" || status !== "ALL" || stageId !== "ALL";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por título…"
          className="pl-8"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Select value={status} onValueChange={(v) => onStatusChange(v as LeadStatus | "ALL")}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pipeline && (
        <Select value={stageId} onValueChange={onStageChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os estágios</SelectItem>
            {pipeline.stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            onStatusChange("ALL");
            onStageChange("ALL");
          }}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
