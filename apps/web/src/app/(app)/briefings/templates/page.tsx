"use client";

import { ChevronDown, LayoutList } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BRIEFING_TEMPLATE_KIND_LABELS } from "@/features/briefings/briefing-labels";
import { useBriefingTemplate, useBriefingTemplates } from "@/features/briefings/hooks";
import { cn } from "@/lib/utils";

function TemplateCard({ templateKey }: { templateKey: string }) {
  const { data: template, isLoading } = useBriefingTemplate(templateKey);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (isLoading || !template) return <Skeleton className="h-24 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{template.name}</CardTitle>
          <Badge variant="secondary">{BRIEFING_TEMPLATE_KIND_LABELS[template.kind]}</Badge>
        </div>
        {template.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {template.sections.map((section) => {
          const expanded = expandedSection === section.id;
          return (
            <div key={section.id} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setExpandedSection(expanded ? null : section.id)}
                className="flex w-full items-center justify-between p-3 text-left text-sm font-medium"
              >
                <span>
                  {section.title}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {section.fields.length} campo(s)
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
              {expanded && (
                <ul className="flex flex-col gap-1 border-t border-border p-3 text-sm text-muted-foreground">
                  {section.fields.map((field) => (
                    <li key={field.id} className="flex items-center justify-between">
                      <span>
                        {field.label}
                        {field.required && <span className="ml-1 text-destructive">*</span>}
                      </span>
                      <span className="text-xs">
                        {field.type}
                        {field.type === "GROUP" && field.children?.length
                          ? ` · ${field.children.length} subcampo(s)`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function BriefingTemplatesPage() {
  const { data: templates, isLoading } = useBriefingTemplates();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates de briefing</h1>
        <p className="text-sm text-muted-foreground">
          Estrutura das perguntas enviadas ao cliente — somente leitura nesta versão.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !templates || templates.length === 0 ? (
        <EmptyState icon={LayoutList} title="Nenhum template cadastrado" className="py-20" />
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.key} templateKey={t.key} />
          ))}
        </div>
      )}
    </div>
  );
}
