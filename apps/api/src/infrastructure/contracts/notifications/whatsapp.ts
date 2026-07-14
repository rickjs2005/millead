import { env } from "../../../config/env.js";

// WhatsApp próprio (Meta Cloud API) -- opt-in via WHATSAPP_ENABLED=true.
// Sem configuração, retorna {enviado:false} sem lançar (fluxo nunca quebra).

function normalizarBR(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

export interface WhatsAppResultado {
  enviado: boolean;
  motivo?: string;
}

export async function enviarWhatsApp(
  telefone: string,
  mensagem: string,
): Promise<WhatsAppResultado> {
  if (!env.WHATSAPP_ENABLED) {
    return { enviado: false, motivo: "WhatsApp desabilitado (WHATSAPP_ENABLED != true)" };
  }
  if (!env.WHATSAPP_PHONE_ID || !env.WHATSAPP_TOKEN) {
    return { enviado: false, motivo: "WHATSAPP_PHONE_ID/WHATSAPP_TOKEN ausentes" };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizarBR(telefone),
          type: "text",
          text: { preview_url: true, body: mensagem },
        }),
      },
    );
    if (!res.ok) {
      return { enviado: false, motivo: `Meta API ${res.status}: ${await res.text()}` };
    }
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}
