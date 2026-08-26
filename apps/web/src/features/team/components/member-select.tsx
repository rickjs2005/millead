"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamDirectory } from "@/features/team/hooks";

const NONE = "__none__";

export function MemberSelect({
  value,
  onChange,
  allowUnassigned = true,
  placeholder = "Selecione um responsável",
}: {
  value?: string | null;
  onChange: (userId: string | undefined) => void;
  allowUnassigned?: boolean;
  placeholder?: string;
}) {
  const { data: members, isLoading } = useTeamDirectory();

  return (
    <Select
      value={value ?? (allowUnassigned ? NONE : undefined)}
      onValueChange={(next) => onChange(next === NONE ? undefined : next)}
      disabled={isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando equipe…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned && <SelectItem value={NONE}>Sem responsável</SelectItem>}
        {members?.map((member) => (
          <SelectItem key={member.userId} value={member.userId}>
            {member.name} · {member.role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
