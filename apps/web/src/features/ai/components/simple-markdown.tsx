"use client";

import { Fragment } from "react";

/** Renderiza **negrito** dentro de uma linha (suficiente pros relatórios da IA). */
function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/**
 * Mini-renderizador do Markdown que os relatórios da IA usam (títulos ##,
 * negrito, listas com -). Proposital: nada de lib de Markdown completa só
 * pra isso.
 */
export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") return <div key={i} className="h-1" />;
        if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <h3 key={i} className="mt-2 text-sm font-semibold">
              <InlineBold text={trimmed.replace(/^#{1,3}\s+/, "")} />
            </h3>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <p key={i} className="pl-4">
              • <InlineBold text={trimmed.slice(2)} />
            </p>
          );
        }
        return (
          <p key={i}>
            <InlineBold text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}
