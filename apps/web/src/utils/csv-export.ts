/** Exporta um array de objetos como CSV e dispara o download -- roda 100% no client, sobre dados já carregados (sem endpoint de exportação no backend). */
export function exportToCsv(
  filename: string,
  rows: Record<string, string | number | null>[],
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  // BOM UTF-8 gerado por código (0xfeff), evitando um caractere
  // invisível literal no arquivo-fonte -- sem ele o Excel abre acentos
  // como lixo ao importar o CSV.
  const byteOrderMark = String.fromCharCode(0xfeff);
  const blob = new Blob([byteOrderMark + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
