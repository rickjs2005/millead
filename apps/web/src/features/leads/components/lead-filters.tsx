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
import type { LeadStatus, PipelineWithStages, TeamMember } from "@/types/api";
import { useAuthStore } from "@/stores/auth-store";

interface LeadFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: LeadStatus | "ALL";
  onStatusChange: (value: LeadStatus | "ALL") => void;
  stageId: string | "ALL";
  onStageChange: (value: string) => void;
  pipeline: PipelineWithStages | undefined;
  ownerId: string | "ALL";
  onOwnerChange: (value: string) => void;
  members: TeamMember[];
}

export function LeadFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  stageId,
  onStageChange,
  pipeline,
  ownerId,
  onOwnerChange,
  members,
}: LeadFiltersProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const hasFilters = search !== "" || status !== "ALL" || stageId !== "ALL" || ownerId !== "ALL";

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

      <Select value={ownerId} onValueChange={onOwnerChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os responsáveis</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.userId === currentUserId ? "Meus leads (Você)" : member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            onStatusChange("ALL");
            onStageChange("ALL");
            onOwnerChange("ALL");
          }}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
