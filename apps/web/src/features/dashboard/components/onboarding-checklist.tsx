"use client";

import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  label: string;
  description: string;
  href: string;
  done: boolean;
}

/** Primeiros passos para org recém-criada -- substitui o painel de zeros
 * que dava impressão de produto vazio (auditoria de UX 07/2026). Some
 * sozinho quando todos os passos forem concluídos. */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Primeiros passos</h2>
          <p className="text-sm text-muted-foreground">
            {doneCount} de {steps.length} concluídos — complete para destravar todo o painel.
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors",
                  step.done
                    ? "border-transparent opacity-60"
                    : "border-border hover:border-primary/40 hover:bg-accent",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex flex-1 flex-col">
                  <span className={cn("text-sm font-medium", step.done && "line-through")}>
                    {step.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{step.description}</span>
                </span>
                {!step.done && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
