import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ iconOnly, className }: { iconOnly?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <Target className="h-4 w-4" strokeWidth={2.25} />
      </div>
      {!iconOnly && <span className="text-base font-semibold tracking-tight">MilLead</span>}
    </div>
  );
}
