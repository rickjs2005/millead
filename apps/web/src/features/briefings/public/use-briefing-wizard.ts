import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { briefingsPublicService } from "@/services/briefings-public";
import type { BriefingFile } from "@/types/api";

export interface LocalAnswer {
  valueText?: string | null;
  valueJson?: unknown;
}

const SAVE_DEBOUNCE_MS = 500;

function answerKey(fieldId: string, groupItemId = ""): string {
  return `${fieldId}::${groupItemId}`;
}

export function useBriefingWizard(token: string) {
  const query = useQuery({
    queryKey: ["public-briefing", token],
    queryFn: () => briefingsPublicService.get(token),
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [groupItems, setGroupItems] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<Record<string, BriefingFile>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const hydrated = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!query.data || hydrated.current) return;
    hydrated.current = true;

    const topFields = query.data.template.sections.flatMap((s) => s.fields);
    const nextAnswers: Record<string, LocalAnswer> = {};
    const nextGroupItems: Record<string, string[]> = {};

    for (const a of query.data.answers) {
      nextAnswers[answerKey(a.fieldId, a.groupItemId)] = {
        valueText: a.valueText,
        valueJson: a.valueJson,
      };
      if (a.groupItemId) {
        const parent = topFields.find(
          (f) => f.type === "GROUP" && f.children?.some((c) => c.id === a.fieldId),
        );
        if (parent) {
          nextGroupItems[parent.id] ??= [];
          if (!nextGroupItems[parent.id]!.includes(a.groupItemId)) {
            nextGroupItems[parent.id]!.push(a.groupItemId);
          }
        }
      }
    }

    setAnswers(nextAnswers);
    setGroupItems(nextGroupItems);
    setFiles(Object.fromEntries(query.data.files.map((f) => [f.id, f])));
  }, [query.data]);

  function getAnswer(fieldId: string, groupItemId = ""): LocalAnswer | undefined {
    return answers[answerKey(fieldId, groupItemId)];
  }

  function saveNow(fieldId: string, groupItemId: string, patch: LocalAnswer) {
    setSaveState("saving");
    briefingsPublicService
      .saveAnswer(token, { fieldId, groupItemId: groupItemId || undefined, ...patch })
      .then(() => {
        setSaveState("saved");
        void query.refetch();
      })
      .catch(() => {
        toast.error("Não foi possível salvar essa resposta. Tente novamente.");
        setSaveState("idle");
      });
  }

  /** `debounce: false` pra campos de escolha única (select/checkbox/arquivo) -- não faz sentido esperar. */
  function setValue(
    fieldId: string,
    groupItemId: string,
    patch: LocalAnswer,
    opts?: { debounce?: boolean },
  ) {
    const key = answerKey(fieldId, groupItemId);
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    if (timers.current[key]) clearTimeout(timers.current[key]);
    if (opts?.debounce === false) {
      saveNow(fieldId, groupItemId, patch);
      return;
    }
    timers.current[key] = setTimeout(() => saveNow(fieldId, groupItemId, patch), SAVE_DEBOUNCE_MS);
  }

  function addGroupItem(groupFieldId: string): string {
    const id = crypto.randomUUID();
    setGroupItems((prev) => ({ ...prev, [groupFieldId]: [...(prev[groupFieldId] ?? []), id] }));
    return id;
  }

  async function removeGroupItem(groupFieldId: string, groupItemId: string) {
    setGroupItems((prev) => ({
      ...prev,
      [groupFieldId]: (prev[groupFieldId] ?? []).filter((i) => i !== groupItemId),
    }));
    try {
      await briefingsPublicService.removeGroupItem(token, groupItemId);
      void query.refetch();
    } catch {
      toast.error("Não foi possível remover o item.");
    }
  }

  function registerFile(file: BriefingFile) {
    setFiles((prev) => ({ ...prev, [file.id]: file }));
  }

  async function complete() {
    return briefingsPublicService.complete(token);
  }

  return {
    query,
    getAnswer,
    setValue,
    groupItems,
    addGroupItem,
    removeGroupItem,
    files,
    registerFile,
    saveState,
    complete,
  };
}
