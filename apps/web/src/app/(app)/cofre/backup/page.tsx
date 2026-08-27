"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api-client";
import { vaultBackupService, type RestoreCounts } from "@/services/vault-backup";

/**
 * Backup do Cofre.
 *
 * A senha é pedida de novo aqui mesmo com o Cofre aberto: a sessão elevada dá
 * leitura tela a tela, e estas duas ações entregam (ou gravam) tudo de uma vez.
 *
 * A senha vive só no `useState` desta tela e é apagada assim que a ação
 * termina — não entra em cache de query, não vai para `localStorage`, não
 * sobrevive à navegação.
 */
export default function CofreBackupPage() {
  const [password, setPassword] = useState("");
  const [resumo, setResumo] = useState<Record<string, number> | null>(null);
  const [restaurado, setRestaurado] = useState<RestoreCounts | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const exportar = useMutation({
    mutationFn: (format: "json" | "csv") => vaultBackupService.exportar(password, format),
    onSuccess: (r) => {
      setResumo(r.resumo);
      setPassword("");
      toast.success(`${r.fileName} baixado.`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível exportar.");
    },
  });

  const restaurar = useMutation({
    mutationFn: async (arquivo: File) => {
      const texto = await arquivo.text();
      let conteudo: unknown;
      try {
        conteudo = JSON.parse(texto);
      } catch {
        throw new ApiError(400, "INVALID_FILE", "Este arquivo não é um JSON válido.");
      }
      return vaultBackupService.restaurar(password, conteudo);
    },
    onSuccess: async (contagens) => {
      setRestaurado(contagens);
      setPassword("");
      if (arquivoRef.current) arquivoRef.current.value = "";
      // Tudo mudou de uma vez: limpar o cache inteiro do Cofre é mais honesto
      // que invalidar chave por chave e esquecer uma.
      await queryClient.invalidateQueries({ queryKey: ["vault"] });
      toast.success("Cofre restaurado.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível restaurar.");
    },
  });

  const ocupado = exportar.isPending || restaurar.isPending;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="backup-senha">Confirme sua senha</Label>
        <Input
          id="backup-senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Sua senha do MilLead"
        />
        <p className="text-xs text-muted-foreground">
          O Cofre já está aberto, mas exportar entrega tudo de uma vez num arquivo — e restaurar
          grava tudo. As duas coisas pedem a senha de novo.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium">Exportar</h2>
          <p className="text-sm text-muted-foreground">
            O <strong>JSON</strong> é o backup: leva tudo, com as ligações, e é o único formato que
            a restauração aceita. O <strong>CSV</strong> traz só as movimentações, para abrir numa
            planilha — ele não volta para dentro do sistema.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportar.mutate("json")} disabled={!password || ocupado}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar backup (JSON)
          </Button>
          <Button
            variant="outline"
            onClick={() => exportar.mutate("csv")}
            disabled={!password || ocupado}
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            Baixar planilha (CSV)
          </Button>
        </div>

        {resumo && Object.keys(resumo).length > 0 && (
          <Contagens titulo="Saiu no arquivo" valores={resumo} />
        )}

        <p className="text-xs text-muted-foreground">
          O arquivo sai sem senha e sem criptografia — quem abrir, lê. Guarde num lugar que só você
          alcança, e evite anexo de e-mail e pasta compartilhada.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium">Restaurar</h2>
          <p className="text-sm text-muted-foreground">
            Só entra num Cofre <strong>vazio</strong>. Misturar dois históricos duplicaria
            movimentações sem nada denunciando, e sobrescrever apagaria o que está aqui — então a
            restauração recusa em vez de escolher por você.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="backup-arquivo">Arquivo de backup (JSON)</Label>
          <Input
            id="backup-arquivo"
            ref={arquivoRef}
            type="file"
            accept="application/json,.json"
            disabled={!password || ocupado}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) restaurar.mutate(arquivo);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Os envios ao financeiro da MilWeb não são recriados: a despesa do outro lado é dado da
            empresa e não faz parte deste arquivo.
          </p>
        </div>

        {restaurado && <Contagens titulo="Restaurado" valores={{ ...restaurado }} />}
      </section>

      <section className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">
          <Upload className="mr-1.5 inline h-3.5 w-3.5" />O que não vai no arquivo
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Os extratos que você importou — eles nunca foram guardados, só o registro deles.</li>
          <li>As despesas lançadas na MilWeb: são dado da empresa, não do Cofre.</li>
          <li>Sua senha, e o estado de bloqueio do Cofre.</li>
        </ul>
      </section>
    </div>
  );
}

function Contagens({ titulo, valores }: { titulo: string; valores: Record<string, number> }) {
  const linhas = Object.entries(valores).filter(([, v]) => v > 0);
  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">{titulo}: nada — o Cofre está vazio.</p>;
  }
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1 text-xs font-medium">{titulo}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {linhas.map(([chave, valor]) => (
          <span key={chave}>
            <span className="tabular-nums text-foreground">{valor}</span> {rotulo(chave)}
          </span>
        ))}
      </div>
    </div>
  );
}

const ROTULOS: Record<string, string> = {
  categorias: "categorias",
  contas: "contas",
  cartoes: "cartões",
  fornecedores: "fornecedores",
  faturas: "faturas",
  importacoes: "importações",
  assinaturas: "assinaturas",
  movimentacoes: "movimentações",
  rateios: "rateios",
  regras: "regras",
  alertas: "alertas",
  pessoas: "pessoas",
  dividas: "dívidas",
  baixas: "baixas",
  enviosAoFinanceiro: "envios ao financeiro",
  enviosIgnorados: "envios não recriados",
};

function rotulo(chave: string): string {
  return ROTULOS[chave] ?? chave;
}
