import { randomInt } from "node:crypto";

// Sem O/0/I/1 -- evita confusão caso o cliente precise ler o código.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Token do link público (/b/:token). 20 chars sobre alfabeto de 32 ≈ 100
 * bits de entropia -- o link protege PII do lead/empresa e permite gerar
 * tokens de upload no escopo da org, então precisa ser imprevisível, não só
 * "único". Antes eram 6 chars (~1bi), enumerável. O link é enviado por
 * WhatsApp/e-mail (copiado, não digitado), então o comprimento não atrapalha.
 */
export function generatePublicToken(length = 20): string {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  }
  return token;
}

export { TOKEN_ALPHABET };
