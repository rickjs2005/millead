"use client";

import { SnapshotSchema, type Snapshot } from "@millead/video-contracts";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface LoadedSnapshot {
  snapshot: Snapshot;
  /** `sections/top.jpg` (o mesmo caminho usado em `screenshot`) -> `blob:` URL local. */
  thumbs: Map<string, string>;
}

interface SnapshotInputProps {
  onLoaded: (loaded: LoadedSnapshot) => void;
}

const EXTENSAO_DE_IMAGEM = /\.(jpe?g|png|webp)$/i;

/**
 * Caminho do arquivo relativo à pasta da captura -- o mesmo "sections/top.jpg"
 * que o próprio Snapshot usa em `screenshot`. `webkitRelativePath` inclui o
 * nome da pasta escolhida na frente ("milweb.com.br-.../sections/top.jpg"),
 * então cortamos o prefixo até (e incluindo) o nome da pasta do snapshot.json.
 */
function caminhoRelativo(file: File, prefixo: string): string {
  return file.webkitRelativePath.startsWith(prefixo)
    ? file.webkitRelativePath.slice(prefixo.length)
    : file.webkitRelativePath || file.name;
}

/** Mensagem legível a partir dos issues do zod -- nunca um "erro" genérico. */
function mensagemDeErro(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}

export function SnapshotInput({ onLoaded }: SnapshotInputProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  // URLs blob: criadas pela captura ATUAL -- revogadas assim que uma nova
  // captura é carregada (ou no unmount), senão cada troca vaza memória.
  const urlsCriadas = useRef<string[]>([]);

  function revogarAnteriores() {
    for (const url of urlsCriadas.current) URL.revokeObjectURL(url);
    urlsCriadas.current = [];
  }

  // Revoga também ao desmontar (navegar para outra tela) -- não só ao trocar
  // de captura dentro desta mesma sessão do componente.
  useEffect(() => () => revogarAnteriores(), []);

  function processarTexto(texto: string, thumbs: Map<string, string>, origem: string) {
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      for (const url of thumbs.values()) URL.revokeObjectURL(url);
      setResumo(null);
      setErro("O snapshot.json não é um JSON válido.");
      return;
    }

    const parsed = SnapshotSchema.safeParse(json);
    if (!parsed.success) {
      for (const url of thumbs.values()) URL.revokeObjectURL(url);
      setResumo(null);
      setErro(mensagemDeErro(parsed.error.issues));
      return;
    }

    revogarAnteriores();
    urlsCriadas.current = [...thumbs.values()];
    setErro(null);
    setResumo(`Captura carregada de "${origem}" · ${thumbs.size} miniatura(s)`);
    toast.success("Captura carregada");
    onLoaded({ snapshot: parsed.data, thumbs });
  }

  async function onEscolherPasta(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite escolher a mesma pasta de novo, se necessário
    if (arquivos.length === 0) return;

    setCarregando(true);
    try {
      const arquivoSnapshot = arquivos.find((f) => f.name === "snapshot.json");
      if (!arquivoSnapshot) {
        setErro('A pasta escolhida não tem um "snapshot.json" na raiz.');
        setResumo(null);
        return;
      }

      const caminhoCompleto = arquivoSnapshot.webkitRelativePath || arquivoSnapshot.name;
      const prefixo = caminhoCompleto.slice(0, caminhoCompleto.length - "snapshot.json".length);

      const thumbs = new Map<string, string>();
      for (const file of arquivos) {
        if (file === arquivoSnapshot || !EXTENSAO_DE_IMAGEM.test(file.name)) continue;
        const relativo = caminhoRelativo(file, prefixo);
        if (!relativo.startsWith("sections/")) continue;
        thumbs.set(relativo, URL.createObjectURL(file));
      }

      const texto = await arquivoSnapshot.text();
      processarTexto(texto, thumbs, "pasta escolhida");
    } finally {
      setCarregando(false);
    }
  }

  async function onEscolherJson(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    setCarregando(true);
    try {
      const texto = await arquivo.text();
      processarTexto(texto, new Map(), arquivo.name);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>Captura do crawler</Label>
      <div className="flex flex-wrap gap-2">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer",
            carregando && "pointer-events-none opacity-50",
          )}
        >
          Escolher a pasta da captura
          <input
            type="file"
            className="hidden"
            onChange={onEscolherPasta}
            disabled={carregando}
            // `webkitdirectory` não faz parte do tipo de <input> do React --
            // é um atributo não padronizado (suportado por Chromium/Firefox)
            // que o pacote @types/react não modela. O spread injeta o
            // atributo no DOM sem precisar de `@ts-expect-error` na linha
            // inteira do JSX.
            {...{ webkitdirectory: "" }}
          />
        </label>
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer",
            carregando && "pointer-events-none opacity-50",
          )}
        >
          ou só o snapshot.json
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={onEscolherJson}
            disabled={carregando}
          />
        </label>
      </div>
      {erro && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {!erro && resumo && <p className="text-sm text-muted-foreground">{resumo}</p>}
    </div>
  );
}
