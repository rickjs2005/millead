"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Landmark,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportDropzone } from "@/features/vault/components/import-dropzone";
import { readBankFile } from "@/features/vault/decode-file";
import { useVaultAccounts, useVaultCards } from "@/features/vault/finance-hooks";
import { formatVaultDate, IMPORT_ERROR_LABELS } from "@/features/vault/format";
import {
  useAnalyzeImport,
  useConfirmImport,
  useImportHistory,
} from "@/features/vault/import-hooks";
import type { VaultAnalyzedRow, VaultImportAnalysis } from "@/types/api";
import { formatCurrency } from "@/utils/format";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nova",
  DUPLICATE_FILE: "Repetida no arquivo",
  DUPLICATE_VAULT: "Já no Cofre",
  INVALID: "Recusada",
};

const KIND_LABELS: Record<string, string> = {
  COMPRA: "Compra",
  TRANSFERENCIA: "Transferência",
  PAGAMENTO_FATURA: "Pagamento de fatura",
  ESTORNO: "Estorno",
  SAQUE: "Saque",
  DEPOSITO: "Depósito",
  TARIFA: "Tarifa",
  JUROS: "Juros",
  BOLETO: "Boleto",
};

/**
 * Importação de extrato — o arquivo primeiro, a conta depois.
 *
 * ## Por que esta ordem
 *
 * A conta está escrita dentro do OFX. Pedir que você a escolha antes de o
 * sistema olhar o arquivo era trabalho que o código faz — e um lugar a mais
 * para errar: escolher a conta errada num seletor associa o extrato ao lugar
 * errado, e isso só aparece meses depois num saldo que não fecha.
 *
 * Agora: você solta o arquivo, o sistema lê quem ele é, e só pergunta o que
 * não conseguiu determinar sozinho.
 *
 * ## O arquivo não é guardado
 *
 * Nem aqui, nem no servidor. Ele é lido no navegador, mandado como texto, e o
 * que volta são as linhas já interpretadas. A confirmação manda de volta só as
 * que você aceitou; o servidor recalcula tudo e não confia no que recebe.
 */
export default function CofreImportarPage() {
  const [analise, setAnalise] = useState<VaultImportAnalysis | null>(null);
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [origemEscolhida, setOrigemEscolhida] = useState<string>("");

  const accounts = useVaultAccounts();
  const cards = useVaultCards();
  const analyze = useAnalyzeImport();
  const confirm = useConfirmImport();
  const history = useImportHistory();

  const analisar = async (file: File, origem?: { accountId?: string; cardId?: string }) => {
    const texto = conteudo ?? (await readBankFile(file));
    setConteudo(texto);
    analyze.mutate({ fileName: file.name, content: texto, ...origem }, { onSuccess: setAnalise });
  };

  const reanalisar = (valor: string) => {
    setOrigemEscolhida(valor);
    if (!conteudo || !analise) return;
    const [tipo, id] = valor.split(":");
    analyze.mutate(
      {
        fileName: analise.fileName,
        content: conteudo,
        accountId: tipo === "account" ? id : null,
        cardId: tipo === "card" ? id : null,
        settings: analise.detection?.settings ?? null,
      },
      { onSuccess: setAnalise },
    );
  };

  const recomecar = () => {
    setAnalise(null);
    setConteudo(null);
    setOrigemEscolhida("");
  };

  const origemId = analise?.match.selectedId ?? null;
  const origemKind = analise?.match.kind ?? null;
  const podeImportar = Boolean(origemId) && (analise?.totals.novas ?? 0) > 0;

  const importar = () => {
    if (!analise || !origemId) return;
    const novas = analise.rows.filter((r) => r.status === "NEW");

    confirm.mutate(
      {
        accountId: origemKind === "account" ? origemId : null,
        cardId: origemKind === "card" ? origemId : null,
        fileName: analise.fileName,
        fileHash: analise.fileHash,
        format: analise.format,
        rows: novas.map((r) => ({
          line: r.line,
          date: r.date!,
          description: r.description,
          amount: r.amount!,
          direction: r.direction!,
          externalId: r.externalId,
        })),
        ignored: analise.rows
          .filter((r) => r.status === "INVALID")
          .map((r) => ({ line: r.line, code: r.errors[0] ?? "DESCONHECIDO" })),
      },
      { onSuccess: recomecar },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar extrato</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solte o arquivo e o sistema lê o resto: banco, conta, período e o que cada linha é. Só
            pergunta o que não conseguir determinar sozinho.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImportDropzone
            onFile={analisar}
            analisando={analyze.isPending}
            fileName={analise?.fileName ?? null}
            disabled={confirm.isPending}
          />

          {analise && (
            <>
              <IdentidadeDetectada analise={analise} />

              <SeletorDeOrigem
                analise={analise}
                valor={origemEscolhida}
                onChange={reanalisar}
                contas={(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
                cartoes={(cards.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
              />

              {analise.detection && analise.detection.pendencias.length > 0 && (
                <Aviso tom="atencao">
                  {analise.detection.pendencias.join(" ")}{" "}
                  <span className="text-muted-foreground">
                    Confira as datas e os valores na tabela antes de importar.
                  </span>
                </Aviso>
              )}

              {analise.alreadyImported && (
                <Aviso tom="atencao">
                  Este mesmo arquivo já foi importado nesta origem. As linhas repetidas aparecem
                  como &ldquo;Já no Cofre&rdquo; e ficam de fora.
                </Aviso>
              )}

              <Totais analise={analise} />

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={importar} disabled={!podeImportar || confirm.isPending}>
                  {confirm.isPending
                    ? "Importando…"
                    : `Importar ${analise.totals.novas} ${analise.totals.novas === 1 ? "movimentação" : "movimentações"}`}
                </Button>
                <Button variant="ghost" onClick={recomecar} disabled={confirm.isPending}>
                  Cancelar
                </Button>
                {!origemId && (
                  <span className="text-sm text-muted-foreground">
                    Escolha a conta ou o cartão acima para continuar.
                  </span>
                )}
                {origemId && analise.totals.novas === 0 && (
                  <span className="text-sm text-muted-foreground">Nada novo neste arquivo.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {analise && analise.rows.length > 0 && <TabelaPrevia rows={analise.rows} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações anteriores</CardTitle>
        </CardHeader>
        <CardContent>
          {(history.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>
          )}
          <div className="space-y-2">
            {(history.data ?? []).map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{batch.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVaultDate(batch.createdAt)} · {batch.format} · {batch.importedRows} de{" "}
                    {batch.totalRows} importadas
                    {batch.duplicateRows > 0 && ` · ${batch.duplicateRows} duplicadas`}
                    {batch.ignoredRows > 0 && ` · ${batch.ignoredRows} recusadas`}
                  </div>
                </div>
                <Link
                  href={`/cofre/movimentacoes?importBatchId=${batch.id}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Ver movimentações
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** O que o arquivo declarou sobre si. Nada aqui foi inferido. */
function IdentidadeDetectada({ analise }: { analise: VaultImportAnalysis }) {
  const { identity, format } = analise;
  const nada = !identity.institution && !identity.last4 && !analise.periodStart && format === "CSV";

  if (nada) {
    return (
      <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        CSV não traz identificação de banco nem de conta — só as linhas. Escolha a origem abaixo.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {identity.kind === "card" ? (
          <Building2 className="h-3.5 w-3.5" />
        ) : (
          <Landmark className="h-3.5 w-3.5" />
        )}
        O arquivo diz
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo="Instituição" valor={identity.institution} />
        <Campo
          rotulo={identity.kind === "card" ? "Cartão" : "Conta"}
          valor={identity.last4 ? `final ${identity.last4}` : null}
        />
        <Campo rotulo="Moeda" valor={identity.currency} />
        <Campo
          rotulo="Período"
          valor={
            analise.periodStart
              ? `${formatVaultDate(analise.periodStart)} a ${formatVaultDate(analise.periodEnd)}`
              : null
          }
        />
        <Campo
          rotulo="Saldo informado"
          valor={identity.balance ? formatCurrency(identity.balance) : null}
        />
        <Campo rotulo="Formato" valor={format} />
      </dl>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{rotulo}:</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

/**
 * A conta de destino.
 *
 * Quando o casamento é exato, vem preenchido e o texto explica por quê. Nos
 * outros casos a pergunta é explícita — **nunca associar em silêncio a uma
 * conta errada** é a regra que organiza esta tela.
 */
function SeletorDeOrigem({
  analise,
  valor,
  onChange,
  contas,
  cartoes,
}: {
  analise: VaultImportAnalysis;
  valor: string;
  onChange: (valor: string) => void;
  contas: Array<{ id: string; name: string }>;
  cartoes: Array<{ id: string; name: string }>;
}) {
  const { match, suggestion } = analise;
  const selecionado = valor || (match.selectedId ? `${match.kind}:${match.selectedId}` : "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor="origem">Conta ou cartão</Label>
      <Select value={selecionado} onValueChange={onChange}>
        <SelectTrigger id="origem">
          <SelectValue placeholder="Escolha a origem" />
        </SelectTrigger>
        <SelectContent>
          {contas.map((c) => (
            <SelectItem key={c.id} value={`account:${c.id}`}>
              {c.name}
            </SelectItem>
          ))}
          {cartoes.map((c) => (
            <SelectItem key={c.id} value={`card:${c.id}`}>
              {c.name} (cartão)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p
        className={`flex items-start gap-1.5 text-xs ${
          match.level === "exata" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500"
        }`}
      >
        {match.level === "exata" ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        {match.reason}
      </p>

      {suggestion && (
        <p className="text-xs text-muted-foreground">
          Nenhuma corresponde.{" "}
          <Link
            href={suggestion.kind === "card" ? "/cofre/cartoes" : "/cofre/contas"}
            className="underline"
          >
            Cadastre {suggestion.kind === "card" ? "o cartão" : "a conta"} &ldquo;
            {suggestion.name}&rdquo;
          </Link>{" "}
          e solte o arquivo de novo.
        </p>
      )}
    </div>
  );
}

function Totais({ analise }: { analise: VaultImportAnalysis }) {
  const t = analise.totals;
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Numero rotulo="Linhas" valor={String(t.linhas)} />
      <Numero rotulo="Entradas" valor={formatCurrency(t.entradas)} />
      <Numero rotulo="Saídas" valor={formatCurrency(t.saidas)} />
      <Numero rotulo="Novas" valor={String(t.novas)} destaque />
      <Numero
        rotulo="Já no Cofre"
        valor={String(t.jaImportadas + t.duplicadas)}
        nota={t.duplicadas > 0 ? `${t.duplicadas} repetidas no arquivo` : undefined}
      />
      <Numero
        rotulo="A revisar"
        valor={String(t.revisar)}
        nota={t.milweb > 0 ? `${t.milweb} da MilWeb` : undefined}
      />
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={`text-lg font-semibold tabular-nums ${destaque ? "text-primary" : ""}`}>
        {valor}
      </div>
      {nota && <div className="text-[11px] text-muted-foreground">{nota}</div>}
    </div>
  );
}

function Aviso({ tom, children }: { tom: "atencao"; children: React.ReactNode }) {
  return (
    <p
      className={`flex items-start gap-1.5 rounded-md border p-3 text-sm ${
        tom === "atencao"
          ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          : ""
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const CONFIANCA: Record<string, { rotulo: string; classe: string }> = {
  alta: { rotulo: "Alta", classe: "text-muted-foreground" },
  media: { rotulo: "Média", classe: "text-amber-600 dark:text-amber-500" },
  baixa: { rotulo: "Revisar", classe: "text-destructive" },
};

function TabelaPrevia({ rows }: { rows: VaultAnalyzedRow[] }) {
  const [soRevisar, setSoRevisar] = useState(false);
  const visiveis = soRevisar ? rows.filter((r) => r.confidence === "baixa") : rows;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Prévia
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            nada foi gravado ainda
          </span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setSoRevisar((v) => !v)}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {soRevisar ? "Mostrar todas" : "Só as que precisam de revisão"}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((row) => (
                <TableRow key={row.line} className={row.status === "INVALID" ? "opacity-60" : ""}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.date ? formatVaultDate(row.date) : "—"}
                  </TableCell>
                  <TableCell className="max-w-72">
                    <div className="truncate text-sm font-medium">{row.displayName}</div>
                    {/* A descrição original nunca é perdida — fica sempre à vista. */}
                    <div className="truncate text-xs text-muted-foreground">{row.description}</div>
                    {row.installmentTotal && (
                      <Badge variant="outline" className="mt-0.5 text-[10px]">
                        parcela {row.installmentNumber}/{row.installmentTotal}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={row.neutral ? "text-muted-foreground" : ""}>
                      {KIND_LABELS[row.kind] ?? row.kind}
                    </span>
                    {row.neutral && (
                      <div className="text-[11px] text-muted-foreground">
                        fora de receita e despesa
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                    {row.amount ? (
                      <span className={row.direction === "IN" ? "text-emerald-600" : ""}>
                        {row.direction === "IN" ? "+" : "−"}
                        {formatCurrency(row.amount)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.categoryHint ? (
                      <>
                        {row.categoryHint}
                        {row.subcategoryHint && ` / ${row.subcategoryHint}`}
                        {row.businessHint && (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            MilWeb
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{STATUS_LABELS[row.status] ?? row.status}</div>
                    <div className={`text-[11px] ${CONFIANCA[row.confidence]?.classe ?? ""}`}>
                      {CONFIANCA[row.confidence]?.rotulo}
                    </div>
                    {row.errors.length > 0 && (
                      <div className="text-[11px] text-destructive">
                        {row.errors.map((e) => IMPORT_ERROR_LABELS[e] ?? e).join(", ")}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
