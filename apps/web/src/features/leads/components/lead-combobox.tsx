"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { leadsService } from "@/services/leads";

interface LeadComboboxProps {
  value: string | undefined;
  onChange: (leadId: string | undefined, leadTitle?: string) => void;
  placeholder?: string;
}

export function LeadCombobox({
  value,
  onChange,
  placeholder = "Selecionar lead",
}: LeadComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["combobox", "leads", debouncedSearch],
    queryFn: () => leadsService.list({ search: debouncedSearch || undefined, pageSize: 8 }),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? (selectedLabel ?? "Lead selecionado") : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar lead…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Buscando…" : "Nenhum lead encontrado."}</CommandEmpty>
            <CommandGroup>
              {data?.items.map((lead) => (
                <CommandItem
                  key={lead.id}
                  onSelect={() => {
                    onChange(lead.id, lead.title);
                    setSelectedLabel(lead.title);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", value === lead.id ? "opacity-100" : "opacity-0")}
                  />
                  {lead.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
