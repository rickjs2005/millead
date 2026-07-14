"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAddLeadTag, useRemoveLeadTag } from "@/features/leads/hooks";
import { useCreateTag, useTags } from "@/features/tags/hooks";
import type { LeadTagRef } from "@/types/api";

export function LeadTagsCard({ leadId, tags }: { leadId: string; tags: LeadTagRef[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allTags } = useTags();
  const addTag = useAddLeadTag(leadId);
  const removeTag = useRemoveLeadTag(leadId);
  const createTag = useCreateTag();

  const availableTags = (allTags ?? []).filter((t) => !tags.some((lt) => lt.id === t.id));
  const filtered = availableTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const canCreate =
    search.trim().length > 0 &&
    !allTags?.some((t) => t.name.toLowerCase() === search.toLowerCase());

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Etiquetas</CardTitle>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus /> Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <Command>
              <CommandInput
                placeholder="Buscar ou criar…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty className="p-2">
                  {canCreate && (
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={async () => {
                        const tag = await createTag.mutateAsync({ name: search.trim() });
                        await addTag.mutateAsync(tag.id);
                        setSearch("");
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Criar &quot;{search.trim()}&quot;
                    </button>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filtered.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => {
                        addTag.mutate(tag.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etiqueta.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="gap-1 pr-1"
                style={{ borderColor: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => removeTag.mutate(tag.id)}
                  className="rounded-full hover:bg-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
