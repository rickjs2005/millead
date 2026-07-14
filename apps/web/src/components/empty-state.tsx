import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Marca a seção como funcionalidade futura (Fase 6/7) em vez de "sem dados ainda". */
  comingSoon?: boolean;
  className?: string;
}

/**
 * Usado tanto pra "sem dados ainda" (ex.: nenhum lead cadastrado) quanto
 * pra "funcionalidade ainda não existe" (Auditoria/Mensagens/Equipe --
 * Fases 6/7 do backend). Nunca mostra dado inventado: se não tem API,
 * mostra isso, não um mock.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  comingSoon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {comingSoon && <Badge variant="secondary">Em breve</Badge>}
        </div>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
