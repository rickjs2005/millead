"use client";

import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { readBankFile } from "@/features/vault/decode-file";
import { useVaultAccounts, useVaultCards } from "@/features/vault/finance-hooks";
import { formatVaultDate, IMPORT_ERROR_LABELS } from "@/features/vault/format";
import {
  useConfirmImport,
  useCreateImportProfile,
  useImportHistory,
  useImportProfiles,
  usePreviewImport,
} from "@/features/vault/import-hooks";
import type { VaultImportPreview, VaultImportSettings } from "@/types/api";
import { formatCurrency } from "@/utils/format";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nova",
  DUPLICATE_FILE: "Repetida no arquivo",
  DUPLICATE_VAULT: "Já no Cofre",
  INVALID: "Recusada",
};

const MAPPING_DEFAULT: VaultImportSettings = {
  delimiter: ";",
  decimalSeparator: ",",
  dateOrder: "DMY",
  hasHeader: true,
  invertSign: false,
  columnMap: { date: "", description: "", amount: "" },
};

/**
 * Importação de extrato, em dois passos.
 *
 * **O arquivo não é guardado em lugar nenhum** — nem aqui, nem no servidor.
 * Ele é lido no navegador, mandado como texto para a pré-visualização, e o que
 * volta são as linhas já interpretadas. A confirmação manda de volta só as que
 * você aceitou; o servidor recalcula tudo e não confia no que recebe.
 */
export default function CofreImportarPage() {
  const accounts = useVaultAccounts();
  const cards = useVaultCards();
  const profiles = useImportProfiles();
  const history = useImportHistory(10);

  const preview = usePreviewImport();
  const confirm = useConfirmImport();
  const createProfile = useCreateImportProfile();

  const [origem, setOrigem] = useState("");
  const [profileId, setProfileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [resultado, setResultado] = useState<VaultImportPreview | null>(null);
  const [mapping, setMapping] = useState<VaultImportSettings>(MAPPING_DEFAULT);
  const [nomeModelo, setNomeModelo] = useState("");

  const [tipo, id] = origem ? origem.split(":") : ["", ""];
  const origemPayload = {
    accountId: tipo === "acc" ? id! : null,
    cardId: tipo === "card" ? id! : null,
  };

  async function escolherArquivo(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    setContent(await readBankFile(file));
  }

  async function analisar(settings?: VaultImportSettings | null) {
    const result = await preview.mutateAsync({
      ...origemPayload,
      fileName,
      content,
      profileId: settings ? null : profileId || null,
      settings: settings ?? null,
    });
    setResultado(result);
    if (result.needsMapping && result.delimiter) {
      setMapping((current) => ({ ...current, delimiter: result.delimiter! }));
    }
  }

  async function confirmar() {
    if (!resultado) return;
    const novas = resultado.rows.filter((row) => row.status === "NEW");
    await confirm.mutateAsync({
      ...origemPayload,
      fileName: resultado.fileName,
      fileHash: resultado.fileHash,
      format: resultado.format,
      rows: novas.map((row) => ({
        line: row.line,
        date: row.date!.slice(0, 10),
        description: row.description,
        amount: row.amount!,
        direction: row.direction!,
        externalId: row.externalId,
      })),
      ignored: resultado.rows
        .filter((row) => row.status === "INVALID")
        .map((row) => ({ line: row.line, code: row.errors[0] ?? "INVALIDA" })),
    });
    setResultado(null);
    setContent("");
    setFileName("");
  }

  const podeAnalisar = origem && content && !preview.isPending;
  const novas = resultado?.rows.filter((row) => row.status === "NEW").length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Escolha a origem e o arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="imp-origem">Conta ou cartão</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger id="imp-origem">
                  <SelectValue placeholder="Escolher" />
                </SelectTrigger>
                <SelectContent>
                  {(accounts.data ?? []).map((account) => (
                    <SelectItem key={account.id} value={`acc:${account.id}`}>
                      {account.name}
                    </SelectItem>
                  ))}
                  {(cards.data ?? []).map((card) => (
                    <SelectItem key={card.id} value={`card:${card.id}`}>
                      {card.name} (cartão)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imp-modelo">Modelo salvo</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger id="imp-modelo">
                  <SelectValue placeholder="Nenhum (OFX não precisa)" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles.data ?? []).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imp-arquivo">Arquivo (.ofx ou .csv)</Label>
              <Input
                id="imp-arquivo"
                type="file"
                accept=".ofx,.csv,.txt,text/csv"
                onChange={(e) => void escolherArquivo(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => void analisar()} disabled={!podeAnalisar}>
              <Upload /> {preview.isPending ? "Lendo…" : "Analisar arquivo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O arquivo não é armazenado — some da memória assim que a importação termina.
            </p>
          </div>
        </CardContent>
      </Card>

      {resultado?.needsMapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Diga onde está cada coluna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              CSV de banco não tem padrão. Colunas encontradas:{" "}
              {resultado.headers.map((h) => (
                <Badge key={h} variant="outline" className="mr-1 font-mono text-[10px]">
                  {h}
                </Badge>
              ))}
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["date", "description", "amount"] as const).map((campo) => (
                <div key={campo} className="space-y-1.5">
                  <Label htmlFor={`map-${campo}`}>
                    {campo === "date" ? "Data" : campo === "description" ? "Descrição" : "Valor"}
                  </Label>
                  <Select
                    value={String(mapping.columnMap[campo] ?? "")}
                    onValueChange={(value) =>
                      setMapping({
                        ...mapping,
                        columnMap: { ...mapping.columnMap, [campo]: value },
                      })
                    }
                  >
                    <SelectTrigger id={`map-${campo}`}>
                      <SelectValue placeholder="Escolher" />
                    </SelectTrigger>
                    <SelectContent>
                      {resultado.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="map-dec">Separador decimal</Label>
                <Select
                  value={mapping.decimalSeparator}
                  onValueChange={(decimalSeparator) => setMapping({ ...mapping, decimalSeparator })}
                >
                  <SelectTrigger id="map-dec">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Vírgula (1.234,56)</SelectItem>
                    <SelectItem value=".">Ponto (1,234.56)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="map-data">Ordem da data</Label>
                <Select
                  value={mapping.dateOrder}
                  onValueChange={(dateOrder) =>
                    setMapping({
                      ...mapping,
                      dateOrder: dateOrder as VaultImportSettings["dateOrder"],
                    })
                  }
                >
                  <SelectTrigger id="map-data">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DMY">Dia/mês/ano</SelectItem>
                    <SelectItem value="MDY">Mês/dia/ano</SelectItem>
                    <SelectItem value="YMD">Ano/mês/dia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="map-sinal">Sinal do valor</Label>
                <Select
                  value={mapping.invertSign ? "invert" : "normal"}
                  onValueChange={(v) => setMapping({ ...mapping, invertSign: v === "invert" })}
                >
                  <SelectTrigger id="map-sinal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Negativo é saída</SelectItem>
                    <SelectItem value="invert">Positivo é saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={() => void analisar(mapping)} disabled={preview.isPending}>
                Aplicar mapeamento
              </Button>

              <div className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="map-nome" className="text-xs">
                    Salvar como modelo
                  </Label>
                  <Input
                    id="map-nome"
                    value={nomeModelo}
                    onChange={(e) => setNomeModelo(e.target.value)}
                    placeholder="Extrato Inter"
                    className="h-9 w-48"
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!nomeModelo.trim() || createProfile.isPending}
                  onClick={() =>
                    createProfile.mutate({
                      ...mapping,
                      name: nomeModelo.trim(),
                      ...origemPayload,
                      format: "CSV",
                    })
                  }
                >
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {resultado && !resultado.needsMapping && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2. Confira antes de confirmar</CardTitle>
            <div className="flex flex-wrap gap-1 text-xs">
              <Badge variant="secondary">{resultado.summary.novas} novas</Badge>
              <Badge variant="outline">{resultado.summary.duplicadas} duplicadas</Badge>
              {resultado.summary.invalidas > 0 && (
                <Badge variant="destructive">{resultado.summary.invalidas} recusadas</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultado.alreadyImported && (
              <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Este mesmo arquivo já foi importado antes. As linhas repetidas aparecem como
                duplicadas e não entram de novo.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Período: {formatVaultDate(resultado.periodStart)} a{" "}
              {formatVaultDate(resultado.periodEnd)} · formato {resultado.format}
            </p>

            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.rows.map((row) => (
                    <TableRow key={`${row.line}-${row.description}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatVaultDate(row.date)}
                      </TableCell>
                      <TableCell className="text-sm">{row.description || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {row.amount ? (
                          <>
                            {row.direction === "IN" ? "+" : "−"}
                            {formatCurrency(row.amount)}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            row.status === "NEW"
                              ? "secondary"
                              : row.status === "INVALID"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {STATUS_LABELS[row.status]}
                        </Badge>
                        {row.errors.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {row.errors.map((e) => IMPORT_ERROR_LABELS[e] ?? e).join(", ")}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => void confirmar()} disabled={novas === 0 || confirm.isPending}>
                <CheckCircle2 />{" "}
                {confirm.isPending
                  ? "Importando…"
                  : novas === 0
                    ? "Nada novo para importar"
                    : `Importar ${novas} ${novas === 1 ? "movimentação" : "movimentações"}`}
              </Button>
              <Button variant="ghost" onClick={() => setResultado(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações anteriores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(history.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">Nenhuma importação ainda.</p>
          )}
          {(history.data ?? []).map((batch) => (
            <div
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
            >
              <div>
                <div className="font-medium">{batch.fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatVaultDate(batch.periodStart)} a {formatVaultDate(batch.periodEnd)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {batch.importedRows} importadas · {batch.duplicateRows} duplicadas ·{" "}
                {batch.ignoredRows} recusadas
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
