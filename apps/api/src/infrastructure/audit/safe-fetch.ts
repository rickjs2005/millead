import dns from "node:dns/promises";
import net from "node:net";

/**
 * Guarda de SSRF pra auditoria de site: a URL vem de dado cadastrado pelo
 * usuário (website da empresa), então antes de buscar precisamos garantir
 * que o alvo NÃO é a rede interna (metadados de nuvem, localhost, IPs
 * privados). Também segue redirects manualmente revalidando cada salto --
 * senão um site público poderia redirecionar pra um IP interno e furar a
 * checagem inicial.
 */

function ipv4ToParts(ip: string): number[] | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts;
}

/** true se o IP (v4 ou v6) é de rede interna/reservada -- nunca acessível de fora. */
export function isPrivateIp(ip: string): boolean {
  const type = net.isIP(ip);

  if (type === 4) {
    const p = ipv4ToParts(ip);
    if (!p) return true; // não parseou -> trata como suspeito
    const a = p[0]!;
    const b = p[1]!;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / metadados de nuvem (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reservado
    return false;
  }

  if (type === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true; // loopback / unspecified
    if (v.startsWith("fe80")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local (ULA)
    // IPv4 mapeado em IPv6 (::ffff:10.0.0.1) -- revalida a parte v4.
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]!);
    return false;
  }

  return true; // não é IP válido -> suspeito
}

async function assertPublicHost(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocolo não permitido.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // tira colchetes de IPv6 literal

  // Se já é um IP literal, checa direto (sem DNS).
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Alvo interno bloqueado.");
    return;
  }

  // Hostname -> resolve TODOS os endereços e recusa se QUALQUER um for interno.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("Não foi possível resolver o domínio.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("Alvo interno bloqueado.");
  }
}

const MAX_REDIRECTS = 4;

/**
 * fetch com guarda de SSRF: valida o host antes de cada requisição e segue
 * redirects manualmente (revalidando o destino). Assinatura compatível com
 * o subconjunto usado pela auditoria.
 */
export async function safeFetch(
  input: string,
  init: { method?: "GET" | "HEAD"; signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<Response> {
  let currentUrl = input;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(currentUrl);
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    // 3xx com Location -> valida o destino e continua manualmente.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error("Muitos redirecionamentos.");
}
