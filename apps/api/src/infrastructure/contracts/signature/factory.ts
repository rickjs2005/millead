import { env } from "../../../config/env.js";
import type { ContractSignatureGateway } from "../../../domain/services/contract-signature.js";
import { MockSignatureGateway } from "./mock.js";
import { ZapSignGateway } from "./zapsign.js";

/** Resolve o gateway de assinatura a partir da env SIGNATURE_PROVIDER. */
export function createSignatureGateway(): ContractSignatureGateway {
  if (env.SIGNATURE_PROVIDER === "zapsign") {
    if (!env.ZAPSIGN_API_TOKEN) {
      throw new Error("SIGNATURE_PROVIDER=zapsign exige ZAPSIGN_API_TOKEN no .env");
    }
    return new ZapSignGateway({
      apiToken: env.ZAPSIGN_API_TOKEN,
      webhookSecret: env.ZAPSIGN_WEBHOOK_SECRET,
      sandbox: env.ZAPSIGN_SANDBOX,
      sendWhatsapp: env.ZAPSIGN_SEND_WHATSAPP,
      isProduction: env.NODE_ENV === "production",
    });
  }

  // Fail-closed em produção: o mock não valida HMAC, então em prod ele
  // RECUSA webhooks (senão dá pra forjar "contrato assinado" só sabendo o
  // id do contrato). A API sobe normal; contratos só são "assináveis" de
  // verdade com o ZapSign configurado. Em dev o mock segue aceitando.
  return new MockSignatureGateway(env.NODE_ENV === "production");
}
