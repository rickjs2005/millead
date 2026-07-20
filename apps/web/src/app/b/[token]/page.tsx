"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FieldRenderer } from "@/features/briefings/public/field-renderer";
import { RepeatableGroupField } from "@/features/briefings/public/repeatable-group-field";
import { useBriefingWizard } from "@/features/briefings/public/use-briefing-wizard";
import { PublicBriefingError } from "@/services/briefings-public";

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  return (
    <AnimatePresence mode="wait">
      {state !== "idle" && (
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {state === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" /> Salvo
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PublicBriefingPage() {
  const { token } = useParams<{ token: string }>();
  const wizard = useBriefingWizard(token);
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const { query } = wizard;

  if (query.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const message =
      query.error instanceof PublicBriefingError
        ? query.error.message
        : "Não foi possível carregar este formulário.";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <CloudOff className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const briefing = query.data;
  const sections = briefing.template.sections;
  const alreadyDone = completed || briefing.status === "COMPLETED";

  if (alreadyDone) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-success" />
          <h1 className="text-xl font-semibold">Briefing enviado com sucesso!</h1>
          <p className="text-sm text-muted-foreground">
            Recebemos todas as informações. Nossa equipe já vai começar a analisar seu projeto —
            qualquer dúvida, é só chamar no WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  const currentSection = sections[step]!;
  const isLastStep = step === sections.length - 1;
  // Heurística de máscara/chips por nome do campo: só nos templates do seed;
  // no personalizado (CUSTOM) a key vem do label do admin e não é confiável.
  const keyHeuristics = briefing.template.kind !== "CUSTOM";

  async function handleComplete() {
    setCompleting(true);
    try {
      await wizard.complete();
      setCompleted(true);
    } catch (err) {
      toast.error(
        err instanceof PublicBriefingError
          ? err.message
          : "Não foi possível concluir. Verifique os campos obrigatórios.",
      );
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold tracking-tight">{briefing.template.name}</h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Suas respostas são salvas automaticamente — pode fechar e voltar para continuar de onde
            parou. O link fica disponível por 24 horas.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Etapa {step + 1} de {sections.length} · {currentSection.title}
            </span>
            <SaveIndicator state={wizard.saveState} />
          </div>
          <Progress value={briefing.progressPercent} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-5 p-6">
            {currentSection.description && (
              <p className="text-sm text-muted-foreground">{currentSection.description}</p>
            )}
            {currentSection.fields.map((field) =>
              field.type === "GROUP" ? (
                <div key={field.id} className="flex flex-col gap-2">
                  <Label>{field.label}</Label>
                  <RepeatableGroupField
                    field={field}
                    groupItemIds={wizard.groupItems[field.id] ?? []}
                    getAnswer={wizard.getAnswer}
                    setValue={wizard.setValue}
                    addItem={wizard.addGroupItem}
                    removeItem={wizard.removeGroupItem}
                    files={wizard.files}
                    registerFile={wizard.registerFile}
                    token={token}
                    keyHeuristics={keyHeuristics}
                  />
                </div>
              ) : (
                <div key={field.id} className="flex flex-col gap-1.5">
                  <Label>
                    {field.label}
                    {field.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground">{field.helpText}</p>
                  )}
                  <FieldRenderer
                    field={field}
                    value={wizard.getAnswer(field.id)}
                    onChange={(patch, opts) => wizard.setValue(field.id, "", patch, opts)}
                    token={token}
                    files={wizard.files}
                    onFileRegistered={wizard.registerFile}
                    keyHeuristics={keyHeuristics}
                  />
                </div>
              ),
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {isLastStep ? (
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? "Enviando…" : "Finalizar briefing"}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
