import { createHash } from "node:crypto";

export interface FingerprintInput {
  tag: string;
  id?: string;
  text?: string;
  imageSrc?: string;
  siblingIndex: number;
}

function normalizeText(text: string | undefined): string {
  if (!text) return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
}

function imageBasename(src: string | undefined): string {
  if (!src) return "";
  const withoutQuery = src.split("?")[0] ?? "";
  return withoutQuery.split("/").pop() ?? "";
}

/**
 * Identidade de um nó que sobrevive à mudança de classe, de CDN e de
 * formatação. Classes CSS NÃO entram no hash de propósito: markup Tailwind
 * troca de classe a cada refactor sem o conteúdo mudar.
 */
export function fingerprint(input: FingerprintInput): string {
  const parts = [
    input.tag.toLowerCase(),
    input.id ?? "",
    normalizeText(input.text),
    imageBasename(input.imageSrc),
    String(input.siblingIndex),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}
