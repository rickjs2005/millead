"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Mensagem específica; cai no genérico quando ausente. */
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Estado de erro de carregamento. Diferente do EmptyState: "deu erro, tente
 * de novo" não é "não há dados" -- misturar os dois esconde problema de rede
 * atrás de um "nenhum item encontrado".
 */
export function ErrorState({ description, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/40 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">Não foi possível carregar</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ?? "Algo deu errado ao buscar os dados. Verifique sua conexão."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Tentar de novo
        </Button>
      )}
    </div>
  );
}
