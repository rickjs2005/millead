"use client";

import { FileWarning, Loader2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Área de soltar o arquivo — o primeiro (e único) passo obrigatório.
 *
 * O arquivo é lido **no navegador** e enviado como texto. Ele nunca é gravado:
 * nem aqui, nem no servidor. Ver `decode-file.ts` sobre a decodificação, que
 * precisa entender ISO-8859-1 além de UTF-8 — extrato de banco brasileiro vem
 * dos dois jeitos, e ler o errado corrompe os acentos e, com eles, a chave de
 * deduplicação.
 *
 * ## Validação antes de mandar
 *
 * Extensão e tamanho são conferidos aqui, no navegador, só para dar resposta
 * imediata. **Quem decide de verdade é o servidor**, que olha o conteúdo e não
 * o nome: um `.ofx` que na verdade é a página de "sessão expirada" do banco
 * passa por qualquer checagem de extensão.
 */

/** 12 MB cobre anos de extrato; acima disso é quase certo que não é extrato. */
const TAMANHO_MAXIMO = 12 * 1024 * 1024;
const EXTENSOES = [".ofx", ".csv", ".txt", ".qfx"];

export interface DropzoneProps {
  onFile: (file: File) => void;
  analisando: boolean;
  /** Nome do arquivo já analisado, para a área mostrar o que está em uso. */
  fileName: string | null;
  disabled?: boolean;
}

export function ImportDropzone({ onFile, analisando, fileName, disabled }: DropzoneProps) {
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aceitar = (file: File | undefined) => {
    if (!file) return;
    setErro(null);

    const extensao = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!EXTENSOES.includes(extensao)) {
      setErro(`Extensão ${extensao || "desconhecida"} não é de extrato. Use OFX ou CSV.`);
      return;
    }
    if (file.size > TAMANHO_MAXIMO) {
      setErro("Arquivo maior que 12 MB. Um extrato de anos não chega perto disso.");
      return;
    }
    if (file.size === 0) {
      setErro("O arquivo está vazio — o download do banco pode não ter terminado.");
      return;
    }

    onFile(file);
  };

  const soltar = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setArrastando(false);
    if (disabled || analisando) return;
    aceitar(event.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !analisando) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        onClick={() => !disabled && !analisando && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Escolher arquivo de extrato"
        aria-busy={analisando}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          arrastando && "border-primary bg-accent",
          (disabled || analisando) && "cursor-not-allowed opacity-60",
        )}
      >
        {analisando ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Lendo o arquivo…</span>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName ?? "Arraste o extrato aqui, ou clique para escolher"}
            </span>
            <span className="text-xs text-muted-foreground">
              OFX ou CSV. O arquivo é lido e descartado — nada dele fica guardado.
            </span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={EXTENSOES.join(",")}
        className="hidden"
        onChange={(e) => {
          aceitar(e.target.files?.[0]);
          // Zera para o mesmo arquivo poder ser escolhido de novo depois de um
          // erro — sem isso, o `change` não dispara na segunda vez.
          e.target.value = "";
        }}
      />

      {erro && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}
