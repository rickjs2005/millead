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

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80")) return true; // link-local
  const head = parseInt(normalized.slice(0, 2), 16);
  return head >= 0xfc && head <= 0xfd; // unique local (fc00::/7)
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
