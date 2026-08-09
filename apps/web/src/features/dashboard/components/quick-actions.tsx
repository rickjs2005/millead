"use client";

import { FilePlus2, ListPlus, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Atalhos do topo do dashboard. "+ Lead" e "+ Tarefa" não têm rota de
 * criação dedicada -- o diálogo mora dentro da tela (CreateLeadDialog em
 * /leads, CreateTaskDialog na tab Tarefas da Agenda), então linkar pra tela
 * base já resolve. "+ Orçamento" tem rota própria (/estimates/new, usada
 * também pelo botão "Novo orçamento" a partir do detalhe de um lead).
 */
export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/leads">
          <UserPlus /> Lead
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/tasks">
          <ListPlus /> Tarefa
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/estimates/new">
          <FilePlus2 /> Orçamento
        </Link>
      </Button>
    </div>
  );
}
