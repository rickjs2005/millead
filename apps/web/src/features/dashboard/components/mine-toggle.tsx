"use client";

import { cn } from "@/lib/utils";

/**
 * Alterna entre "tudo da equipe" e "só as minhas" nos cards de tarefa.
 *
 * Só faz sentido desde que a gestão de equipe existe -- com uma pessoa na
 * organização os dois modos mostram exatamente a mesma coisa, então quem
 * monta o card esconde o toggle nesse caso (ver `showMineToggle`).
 */
export function MineToggle({
  mine,
  onChange,
}: {
  mine: boolean;
  onChange: (mine: boolean) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrar por responsável"
      className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {[
        { label: "Equipe", value: false },
        { label: "Minhas", value: true },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={mine === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
            mine === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
