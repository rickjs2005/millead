import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  loading?: boolean;
  comingSoon?: boolean;
  accent?: "default" | "success" | "warning" | "destructive";
  /** Nota curta abaixo do valor, pra avisar quando o número não segue a
   * mesma regra implícita no label (ex.: um total que ignora o filtro de mês). */
  sublabel?: string;
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  comingSoon,
  accent = "default",
  sublabel,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            {comingSoon && (
              <Badge variant="secondary" className="text-[10px]">
                Em breve
              </Badge>
            )}
          </div>
          {comingSoon ? (
            <p className="text-2xl font-semibold tracking-tight text-muted-foreground/40">—</p>
          ) : loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          {sublabel && !loading && !comingSoon && (
            <p className="text-[11px] text-muted-foreground/70">{sublabel}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            ACCENT_CLASSES[accent],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
