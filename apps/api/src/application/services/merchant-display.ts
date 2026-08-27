import { extractInstallment, normalizeDescription, type Installment } from "./transaction-text.js";

/**
 * Nome legível a partir da linha do extrato.
 *
 * `OPENAI *CHATGPT` vira `OpenAI / ChatGPT`; `IFOOD*RESTAURANTE X` vira
 * `iFood`; `PIX RECEBIDO JOAO SILVA` vira `João Silva`.
 *
 * ## Isto NÃO substitui `normalizeDescription`
 *
 * E a distinção é a coisa mais importante deste arquivo. A normalização
 * conservadora alimenta o **fingerprint de deduplicação**: mudar como ela
 * limpa o texto muda a chave de toda movimentação já importada sem FITID, e
 * uma reimportação inteira passaria a parecer nova. Por isso ela continua
 * intocada.
 *
 * O que sai daqui é **só para exibir e para sugerir fornecedor**. Erra? A
 * pessoa corrige na tela e a descrição original continua guardada, palavra por
 * palavra. Nenhuma decisão de dinheiro depende deste texto.
 *
 * ## Nada é inventado
 *
 * Toda transformação é remoção de ruído conhecido (prefixo de adquirente,
 * código de estabelecimento, parcela) ou tradução por tabela explícita. Não há
 * geração de texto: quando não dá para reconhecer, o retorno é a própria
 * descrição em caixa de título — e a confiança vem marcada como baixa.
 */

export type DisplayConfidence = "alta" | "media" | "baixa";

export interface MerchantDisplay {
  /** Nome para mostrar. Nunca vazio. */
  name: string;
  /** Sugestão de fornecedor a cadastrar, quando reconhecido com segurança. */
  merchantHint: string | null;
  /** Pessoa envolvida num Pix/TED, quando o extrato a nomeia. */
  personHint: string | null;
  installment: Installment | null;
  confidence: DisplayConfidence;
}

/**
 * Serviços reconhecidos. `padrao` casa contra a descrição normalizada.
 *
 * A tabela é explícita de propósito: cada linha foi decidida por alguém, e
 * acrescentar um serviço é acrescentar uma linha — não treinar nada. Quando um
 * nome não está aqui, o sistema não chuta: mostra o texto limpo e pede
 * revisão.
 *
 * **A ordem importa**: a primeira que casar vence. O específico vem antes do
 * genérico — `CHATGPT` antes de `OPENAI`, `UBER EATS` antes de `UBER`,
 * `GOOGLE ADS` antes de `GOOGLE`. Invertido, `OPENAI *CHATGPT` viraria só
 * "OpenAI" e a distinção entre a API e a assinatura se perderia.
 */
const CONHECIDOS: ReadonlyArray<{ padrao: RegExp; nome: string }> = [
  // Inteligência artificial
  { padrao: /\bCHATGPT\b/, nome: "OpenAI / ChatGPT" },
  { padrao: /\bOPENAI\b/, nome: "OpenAI" },
  { padrao: /\bANTHROPIC\b|\bCLAUDE\s?AI\b/, nome: "Anthropic / Claude" },
  { padrao: /\bMIDJOURNEY\b/, nome: "Midjourney" },
  { padrao: /\bPERPLEXITY\b/, nome: "Perplexity" },
  { padrao: /\bELEVENLABS\b/, nome: "ElevenLabs" },
  // Infraestrutura e software
  { padrao: /\bVERCEL\b/, nome: "Vercel" },
  { padrao: /\bSUPABASE\b/, nome: "Supabase" },
  { padrao: /\bRENDER(\.COM)?\b/, nome: "Render" },
  { padrao: /\bCLOUDFLARE\b/, nome: "Cloudflare" },
  { padrao: /\bGITHUB\b/, nome: "GitHub" },
  { padrao: /\bFIGMA\b/, nome: "Figma" },
  { padrao: /\bNOTION\b/, nome: "Notion" },
  { padrao: /\bREGISTRO\.?BR\b|\bREGISTROBR\b/, nome: "Registro.br" },
  { padrao: /\bHOSTINGER\b/, nome: "Hostinger" },
  { padrao: /\bGODADDY\b/, nome: "GoDaddy" },
  { padrao: /\bAWS\b|\bAMAZON WEB SERVICES\b/, nome: "Amazon Web Services" },
  // Marketing
  { padrao: /\bMETA\s?(ADS|PLATFORMS)\b|\bFACEBK\b|\bFACEBOOK\b/, nome: "Meta Ads" },
  { padrao: /\bGOOGLE\s?ADS\b|\bGOOGLE\*ADS\b/, nome: "Google Ads" },
  // Assinaturas de consumo
  { padrao: /\bNETFLIX\b/, nome: "Netflix" },
  { padrao: /\bSPOTIFY\b/, nome: "Spotify" },
  { padrao: /\bYOUTUBE(PREMIUM)?\b/, nome: "YouTube" },
  { padrao: /\bDISNEY\b/, nome: "Disney+" },
  { padrao: /\bAMAZON PRIME\b|\bPRIMEVIDEO\b/, nome: "Amazon Prime" },
  { padrao: /\bAPPLE\.?COM\b|\bAPPLE\s?BR\b/, nome: "Apple" },
  { padrao: /\bMICROSOFT\b|\bMSFT\b/, nome: "Microsoft" },
  { padrao: /\bGOOGLE\b/, nome: "Google" },
  // Delivery e transporte
  { padrao: /\bIFOOD\b|\bIFD\*/, nome: "iFood" },
  { padrao: /\bRAPPI\b/, nome: "Rappi" },
  { padrao: /\bUBER\s?EATS\b/, nome: "Uber Eats" },
  { padrao: /\bUBER\b/, nome: "Uber" },
  { padrao: /\b99APP\b|\b99\s?TAXI\b/, nome: "99" },
];

/**
 * Prefixos de adquirente e de meio de pagamento.
 *
 * `PG *`, `PAG*`, `MP*`, `PAYPAL *` — são de quem processou a cobrança, não de
 * quem vendeu. Removê-los deixa aparecer o nome do estabelecimento, que é o
 * que a pessoa reconhece.
 */
const PREFIXOS =
  /^(PG|PAG|PAGSEGURO|PAGS|MP|MERCADOPAGO|MERCPAGO|PAYPAL|PP|EBANX|STRIPE|SUMUP|CIELO|REDE|STONE|GETNET|IUGU|ASAAS|APPLE PAY|GOOGLE PAY|GPAY|APAY)\s*\*+\s*/;

/** Ruído que os bancos anexam e que não identifica ninguém. */
const RUIDOS: readonly RegExp[] = [
  /\bCOMPRA\s+(NO\s+)?(CARTAO|DEBITO|CREDITO)\b/g,
  /\bCARTAO\s+(DE\s+)?(CREDITO|DEBITO)\b/g,
  /\bPARC(ELA)?\.?\s*\d{1,2}\s*\/\s*\d{1,2}\b/g,
  /\bPARCELA\s+\d{1,2}\s+DE\s+\d{1,2}\b/g,
  /\b\d{1,2}\s*\/\s*\d{1,2}\b/g,
  /\bBRA?SIL\b/g,
  /\bBR\b/g,
  /\s+-\s+\d{2}\/\d{2}\b/g,
  /\b\d{6,}\b/g, // códigos de autorização e afins
];

/**
 * Extração do nome numa transferência.
 *
 * ## Por que não é uma regex só
 *
 * A primeira versão era, e quebrou no formato real do Nubank. Ela tinha `REC`
 * como alternativa de verbo, e `REC` casou DENTRO de "RECEBIDA": "Transferência
 * recebida pelo Pix - JOAO SILVA" virava "Ebida Pelo Pix - Joao Silva". Duas
 * lições numa: alternativa curta sem fronteira de palavra come o começo da
 * palavra seguinte, e minha lista só tinha as formas masculinas — o Nubank
 * escreve "recebida".
 *
 * Os formatos que aparecem de verdade:
 *
 * - `PIX RECEBIDO JOAO SILVA`
 * - `Transferência recebida pelo Pix - JOAO SILVA`   (Nubank)
 * - `Transferência enviada pelo Pix - JOAO SILVA`
 * - `TED RECEBIDA - JOAO`
 * - `PIX ENVIADO PARA JOAO`
 *
 * Duas regras cobrem todos: quando há ` - `, o nome é o que vem depois do
 * último; sem hífen, é o que sobra depois de tirar as palavras de serviço da
 * frente.
 */
const TEM_TRANSFERENCIA = /\b(PIX|TED|DOC|TRANSFERENCIA|TRANSF)\b/;

/** Palavras de serviço que antecedem o nome. Removidas da frente, em ordem. */
const PALAVRAS_DE_SERVICO = new Set([
  "PIX",
  "TED",
  "DOC",
  "TRANSFERENCIA",
  "TRANSF",
  "RECEBIDO",
  "RECEBIDA",
  "ENVIADO",
  "ENVIADA",
  "CREDITO",
  "DEBITO",
  "PAGAMENTO",
  "PELO",
  "PELA",
  "POR",
  "DE",
  "DA",
  "DO",
  "PARA",
  "P/",
  "EM",
  "NA",
  "NO",
]);

function extrairPessoa(normalizada: string): string | null {
  if (!TEM_TRANSFERENCIA.test(normalizada)) return null;

  // Com hífen, o nome é o que vem depois do último -- é onde os bancos o põem.
  const hifen = normalizada.lastIndexOf(" - ");
  if (hifen >= 0) {
    const depois = limpar(normalizada.slice(hifen + 3));
    return depois && /[A-Z]{3}/.test(depois) ? depois : null;
  }

  // Sem hífen, tira as palavras de serviço da frente, uma a uma. Comparação
  // por palavra INTEIRA -- foi o casamento parcial que produziu "Ebida".
  const palavras = normalizada.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < palavras.length && PALAVRAS_DE_SERVICO.has(palavras[i]!)) i++;

  const resto = limpar(palavras.slice(i).join(" "));
  return resto && /[A-Z]{3}/.test(resto) ? resto : null;
}

export function describeMerchant(raw: string): MerchantDisplay {
  const normalizada = normalizeDescription(raw);
  const installment = extractInstallment(raw);

  if (!normalizada) {
    return {
      name: raw.trim() || "Sem descrição",
      merchantHint: null,
      personHint: null,
      installment,
      confidence: "baixa",
    };
  }

  // 1. Serviço conhecido ganha de tudo: é a tradução mais confiável que existe.
  const conhecido = CONHECIDOS.find((c) => c.padrao.test(normalizada));
  if (conhecido) {
    return {
      name: conhecido.nome,
      merchantHint: conhecido.nome,
      personHint: null,
      installment,
      confidence: "alta",
    };
  }

  // 2. Pix/TED com nome: vira sugestão de PESSOA, não de fornecedor -- pessoa
  //    entra em dívidas, fornecedor entra no catálogo, e confundir os dois
  //    encheria o catálogo com nomes de gente.
  const pessoa = extrairPessoa(normalizada);
  if (pessoa) {
    return {
      name: titleCase(pessoa),
      merchantHint: null,
      personHint: titleCase(pessoa),
      // Média: o extrato nomeia, mas "PIX ENVIADO MERCADO X" também casa aqui
      // e não é pessoa. Quem confirma é a tela.
      confidence: "media",
      installment,
    };
  }

  // 3. Sem reconhecer: limpa o ruído e devolve legível, com confiança baixa.
  const limpa = limpar(normalizada.replace(PREFIXOS, ""));
  const nome = limpa || normalizada;
  return {
    name: titleCase(nome),
    merchantHint: null,
    personHint: null,
    installment,
    confidence: "baixa",
  };
}

function limpar(texto: string): string {
  let saida = texto;
  for (const ruido of RUIDOS) saida = saida.replace(ruido, " ");
  return saida
    .replace(/[*_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * `JOAO DA SILVA` → `Joao da Silva`.
 *
 * Sem acentuar nada: o extrato já veio sem acento, e adivinhar acento é
 * inventar — "JOSE" viraria "José" e "MENDES" não muda, mas "ANDRE" e "ANDRÉ"
 * dependem da pessoa.
 *
 * Preposições ficam em minúscula (é o que diferencia um nome de um grito) e as
 * siglas conhecidas ficam em caixa alta. A lista de siglas é EXPLÍCITA porque
 * a primeira versão usava o tamanho da palavra como pista — e transformava
 * "ANA" em "ANA" e "LTDA" em "Ltda". Nome de três letras é comum; sigla de
 * quatro também.
 */
const MINUSCULAS = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
const SIGLAS = new Set([
  "LTDA",
  "ME",
  "EPP",
  "SA",
  "CIA",
  "EIRELI",
  "MEI",
  "TED",
  "DOC",
  "PIX",
  "IOF",
  "CNPJ",
  "CPF",
  "II",
  "III",
  "IV",
]);

export function titleCase(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) => {
      const upper = palavra.toUpperCase();
      if (i > 0 && MINUSCULAS.has(upper)) return palavra;
      if (SIGLAS.has(upper)) return upper;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}
