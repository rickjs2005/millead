import type { SocialPostFormat } from "@/types/api";

export const FORMAT_LABELS: Record<SocialPostFormat, string> = {
  UNCLASSIFIED: "Sem categoria",
  REDESIGN: "Redesign",
  BEFORE_AFTER: "Antes x Depois",
  TIMELAPSE: "Timelapse",
  REVIEW: "Avaliação de site",
  ANIMATION: "Animação",
  CODE_SETUP: "Código/Setup",
  OTHER: "Outro",
};

/** Ordem fixa de exibição (dropdown de formatos, etc.) -- não depender da
 * ordem de inserção do Record, que não é garantida entre runtimes. */
export const FORMAT_ORDER: SocialPostFormat[] = [
  "UNCLASSIFIED",
  "REDESIGN",
  "BEFORE_AFTER",
  "TIMELAPSE",
  "REVIEW",
  "ANIMATION",
  "CODE_SETUP",
  "OTHER",
];

/** "1:23" a partir de ms; "—" pra null. */
export function fmtWatchTime(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Numero compacto pt-BR ("12,3 mil") ; "—" pra null. */
export function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}
