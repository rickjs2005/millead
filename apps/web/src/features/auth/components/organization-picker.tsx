"use client";

import { Building2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface OrganizationPickerProps {
  organizations: { id: string; name: string; slug: string; roleName: string }[];
  onSelect: (slug: string) => void;
  loading: boolean;
}

export function OrganizationPicker({ organizations, onSelect, loading }: OrganizationPickerProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Escolha o workspace</CardTitle>
        <CardDescription>Sua conta tem acesso a mais de uma organização.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {organizations.map((org) => (
          <button
            key={org.id}
            type="button"
            disabled={loading}
            onClick={() => onSelect(org.slug)}
            className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-xs text-muted-foreground">{org.roleName}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
