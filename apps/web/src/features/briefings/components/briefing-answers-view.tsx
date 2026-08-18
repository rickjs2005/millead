import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idsDosItens, rotuloDoItem } from "@/features/briefings/group-items";
import type { BriefingAnswer, BriefingField, BriefingFile, BriefingSection } from "@/types/api";

/** Nomes clicáveis no lugar de "N arquivo(s)": a pergunta mostra o que o
 *  cliente mandou, sem precisar caçar na aba Arquivos. */
function ArquivosDaResposta({ ids, files }: { ids: string[]; files: BriefingFile[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {ids.map((id) => {
        const file = files.find((f) => f.id === id);
        return (
          <li key={id}>
            {file ? (
              <a
                href={file.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary hover:underline"
              >
                {file.originalName}
              </a>
            ) : (
              <span className="text-muted-foreground">Arquivo indisponível</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function formatValue(
  field: BriefingField,
  answer: BriefingAnswer | undefined,
  files: BriefingFile[],
): ReactNode {
  if (!answer) return "—";
  if (field.type === "MULTI_SELECT" && Array.isArray(answer.valueJson)) {
    return (answer.valueJson as unknown[]).length > 0
      ? (answer.valueJson as string[]).join(", ")
      : "—";
  }
  if (field.type === "FILE") {
    const ids = Array.isArray(answer.valueJson) ? (answer.valueJson as string[]) : [];
    return ids.length > 0 ? <ArquivosDaResposta ids={ids} files={files} /> : "—";
  }
  return answer.valueText?.trim() || "—";
}

function answerFor(answers: BriefingAnswer[], fieldId: string, groupItemId = "") {
  return answers.find((a) => a.fieldId === fieldId && a.groupItemId === groupItemId);
}

function GroupItems({
  field,
  answers,
  files,
}: {
  field: BriefingField;
  answers: BriefingAnswer[];
  files: BriefingFile[];
}) {
  const children = field.children ?? [];
  const itemIds = idsDosItens(field, answers);

  if (itemIds.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {itemIds.map((groupItemId, index) => (
        <div key={groupItemId} className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {rotuloDoItem(field, index)}
          </p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {children.map((child) => (
              <div key={child.id}>
                <dt className="text-xs text-muted-foreground">{child.label}</dt>
                <dd className="text-sm">
                  {formatValue(child, answerFor(answers, child.id, groupItemId), files)}
                </dd>
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
  files,
}: {
  sections: BriefingSection[];
  answers: BriefingAnswer[];
  files: BriefingFile[];
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
                  <GroupItems field={field} answers={answers} files={files} />
                </div>
              ) : (
                <div key={field.id}>
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="text-sm">
                    {formatValue(field, answerFor(answers, field.id), files)}
                  </dd>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
