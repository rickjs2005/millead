import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts as [number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // metadata da nuvem
  if (a >= 224) return true; // multicast e reservados
  return false;
}

/** Desembrulha ::ffff:a.b.c.d (e a forma hex ::ffff:7f00:1) para o IPv4 equivalente. */
function ipv4FromMapped(ip: string): string | null {
  const pontilhado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (pontilhado) return pontilhado[1]!;

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (hex) {
    const alto = parseInt(hex[1]!, 16);
    const baixo = parseInt(hex[2]!, 16);
    return [alto >> 8, alto & 0xff, baixo >> 8, baixo & 0xff].join(".");
  }
  return null;
}

function isPrivateIPv6(ip: string): boolean {
  const normalizado = ip.toLowerCase();

  // IPv4 mapeado é IPv4 disfarçado. Foi por aqui que ::ffff:169.254.169.254
  // passou pela guarda -- o metadata da nuvem entrando vestido de IPv6.
  const mapeado = ipv4FromMapped(normalizado);
  if (mapeado !== null) return isPrivateIPv4(mapeado);

  if (normalizado === "::1" || normalizado === "::") return true;

  // O primeiro HEXTET, não os dois primeiros caracteres: em "::1" o segundo
  // caractere já é ':', e era isso que quebrava a conta antiga.
  const primeiroHextet = normalizado.split(":")[0] ?? "";
  // Endereço que começa em "::" e não caiu nos casos acima: trata como suspeito.
  // IPv6 público de verdade nunca começa assim.
  if (primeiroHextet === "") return true;

  const hextet = parseInt(primeiroHextet, 16);
  if (Number.isNaN(hextet)) return true;
  if (hextet >= 0xfc00 && hextet <= 0xfdff) return true; // unique local, fc00::/7
  if (hextet >= 0xfe80 && hextet <= 0xfebf) return true; // link-local, fe80::/10
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // não resolveu para IP reconhecível: trata como suspeito
}

/**
 * Valida a URL ANTES de qualquer `page.goto`. O Playwright não passa pelo
 * `safe-fetch` da API -- fala direto com a rede --, então a guarda precisa
 * viver aqui.
 */
export async function assertPublicUrl(
  raw: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<URL> {
  const trimmed = raw.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`URL inválida: ${raw}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`protocolo não permitido: ${url.protocol} (use http ou https)`);
  }

  if (opts.allowPrivate) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error(`endereço interno não permitido: ${hostname}`);
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error(`não foi possível resolver o endereço: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`endereço interno não permitido: ${hostname} resolve para ${address}`);
    }
  }

  return url;
}
