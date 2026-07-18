"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { joinTags, parseTags } from "./field-utils";

/**
 * Entrada de múltiplos valores em chips (ex.: várias cidades/estados). O
 * cliente digita e aperta Enter (ou vírgula) pra adicionar; clica no × pra
 * remover. Guarda tudo como string separada por vírgula, então cabe no
 * mesmo valueText do campo TEXT -- sem mudar o banco.
 */
export function TagsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (joined: string) => void;
  placeholder?: string;
}) {
  const tags = parseTags(value);
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim().replace(/,$/, "").trim();
    if (!t || tags.includes(t)) {
      setDraft("");
      return;
    }
    onChange(joinTags([...tags, t]));
    setDraft("");
  }

  function remove(tag: string) {
    onChange(joinTags(tags.filter((t) => t !== tag)));
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remover ${tag}`}
                onClick={() => remove(tag)}
                className="text-primary/70 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        placeholder={placeholder ?? "Digite e aperte Enter para adicionar…"}
        onChange={(e) => {
          const v = e.target.value;
          // vírgula também confirma o item
          if (v.endsWith(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            remove(tags[tags.length - 1]!);
          }
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}
