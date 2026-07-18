import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BriefingAnswer, BriefingField, BriefingSection } from "@/types/api";

function formatValue(field: BriefingField, answer: BriefingAnswer | undefined): string {
  if (!answer) return "—";
  if (field.type === "MULTI_SELECT" && Array.isArray(answer.valueJson)) {
    return (answer.valueJson as unknown[]).length > 0
      ? (answer.valueJson as string[]).join(", ")
      : "—";
  }
  if (field.type === "FILE") {
    const ids = Array.isArray(answer.valueJson) ? (answer.valueJson as string[]) : [];
    return ids.length > 0 ? `${ids.length} arquivo(s)` : "—";
  }
  return answer.valueText?.trim() || "—";
}

function answerFor(answers: BriefingAnswer[], fieldId: string, groupItemId = "") {
  return answers.find((a) => a.fieldId === fieldId && a.groupItemId === groupItemId);
}

function GroupItems({ field, answers }: { field: BriefingField; answers: BriefingAnswer[] }) {
  const children = field.children ?? [];
  const itemIds = Array.from(
    new Set(
      answers
        .filter((a) => children.some((c) => c.id === a.fieldId) && a.groupItemId !== "")
        .map((a) => a.groupItemId),
    ),
  );

  if (itemIds.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {itemIds.map((groupItemId, index) => (
        <div key={groupItemId} className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {field.config && typeof field.config === "object" && "itemLabel" in field.config
              ? String((field.config as { itemLabel?: string }).itemLabel ?? "Item")
              : "Item"}{" "}
            {index + 1}
          </p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {children.map((child) => (
              <div key={child.id}>
                <dt className="text-xs text-muted-foreground">{child.label}</dt>
                <dd className="text-sm">{formatValue(child, answerFor(answers, child.id, groupItemId))}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function BriefingAnswersView({
  sections,
  answers,
}: {
  sections: BriefingSection[];
  answers: BriefingAnswer[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {section.fields.map((field) =>
              field.type === "GROUP" ? (
                <div key={field.id}>
                  <p className="mb-2 text-sm font-medium">{field.label}</p>
                  <GroupItems field={field} answers={answers} />
                </div>
              ) : (
                <div key={field.id}>
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="text-sm">{formatValue(field, answerFor(answers, field.id))}</dd>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
