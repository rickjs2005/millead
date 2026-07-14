"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useCreateCompany } from "@/features/companies/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { companiesService } from "@/services/companies";

interface CompanyComboboxProps {
  value: string | undefined;
  onChange: (companyId: string | undefined, companyName?: string) => void;
  /** Nome da empresa já selecionada (modo edição) -- evita o fallback genérico. */
  initialLabel?: string;
}

export function CompanyCombobox({ value, onChange, initialLabel }: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(initialLabel);

  const { data, isLoading } = useQuery({
    queryKey: ["combobox", "companies", debouncedSearch],
    queryFn: () => companiesService.list({ search: debouncedSearch || undefined, pageSize: 8 }),
    enabled: open,
  });

  const createCompany = useCreateCompany();
  const trimmedSearch = search.trim();
  // Só oferece "criar" quando não existe empresa com esse nome exato nos resultados.
  const canCreate =
    trimmedSearch.length > 0 &&
    !createCompany.isPending &&
    !data?.items.some((c) => c.name.toLowerCase() === trimmedSearch.toLowerCase());

  async function handleCreate() {
    const company = await createCompany.mutateAsync({ name: trimmedSearch });
    onChange(company.id, company.name);
    setSelectedLabel(company.name);
    setSearch("");
    setOpen(false);
  }

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
            {value ? (selectedLabel ?? "Empresa selecionada") : "Nenhuma empresa (opcional)"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar empresa…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Buscando…" : "Nenhuma empresa encontrada."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(undefined);
                  setSelectedLabel(undefined);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                Nenhuma empresa
              </CommandItem>
              {data?.items.map((company) => (
                <CommandItem
                  key={company.id}
                  onSelect={() => {
                    onChange(company.id, company.name);
                    setSelectedLabel(company.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", value === company.id ? "opacity-100" : "opacity-0")}
                  />
                  {company.name}
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem onSelect={handleCreate} className="text-primary">
                  <Plus className="h-4 w-4" />
                  Criar empresa “{trimmedSearch}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
