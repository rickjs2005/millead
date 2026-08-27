/**
 * Decodifica o arquivo de extrato para texto.
 *
 * Banco brasileiro exporta CSV em **ISO-8859-1 / Windows-1252** com uma
 * frequência incômoda, e ler isso como UTF-8 transforma todo acento em `�`.
 * O estrago não é só visual: a descrição normalizada entra no fingerprint de
 * deduplicação, então "MERCADINHO S�O JO�O" e "MERCADINHO SAO JOAO" seriam
 * duas movimentações diferentes — a reimportação duplicaria tudo.
 *
 * A heurística é simples e segura na direção certa: tenta UTF-8 estrito; se o
 * decodificador reclamar, cai para Windows-1252, que nunca falha (todo byte é
 * um caractere válido). Arquivo UTF-8 legítimo nunca cai no fallback, porque
 * o modo estrito só lança em sequência inválida.
 */
export function decodeBankFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    // Windows-1252 é o superconjunto do ISO-8859-1 que o Excel do Windows
    // gera — cobre os dois casos com um decodificador só.
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/** Lê o arquivo escolhido como texto, respeitando a codificação. */
export async function readBankFile(file: File): Promise<string> {
  return decodeBankFile(await file.arrayBuffer());
}
