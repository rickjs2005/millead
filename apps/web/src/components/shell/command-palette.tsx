"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Users2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { companiesService } from "@/services/companies";
import { leadsService } from "@/services/leads";
import { useUiStore } from "@/stores/ui-store";
import { NAV_ITEMS } from "./nav-items";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const { data: leadResults } = useQuery({
    queryKey: ["command", "leads", debouncedSearch],
    queryFn: () => leadsService.list({ search: debouncedSearch, pageSize: 5 }),
    enabled: open && debouncedSearch.length > 1,
  });

  const { data: companyResults } = useQuery({
    queryKey: ["command", "companies", debouncedSearch],
    queryFn: () => companiesService.list({ search: debouncedSearch, pageSize: 5 }),
    enabled: open && debouncedSearch.length > 1,
  });

  function go(href: string) {
    setOpen(false);
    setSearch("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar leads, empresas ou navegar…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {leadResults && leadResults.items.length > 0 && (
          <CommandGroup heading="Leads">
            {leadResults.items.map((lead) => (
              <CommandItem key={lead.id} onSelect={() => go(`/leads/${lead.id}`)}>
                <Users2 /> {lead.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {companyResults && companyResults.items.length > 0 && (
          <CommandGroup heading="Empresas">
            {companyResults.items.map((company) => (
              <CommandItem key={company.id} onSelect={() => go(`/leads?companyId=${company.id}`)}>
                <Building2 /> {company.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navegar">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
