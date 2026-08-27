import { normalizeDescription } from "./transaction-text.js";

/**
 * Categorização por palavra-chave — o nível zero da cascata.
 *
 * ## Onde isto entra
 *
 * A cascata de classificação (fase 4) tem cinco níveis, e todos dependem de
 * história: identificador já visto, regra que você criou, alias de fornecedor,
 * assinatura existente, recorrência. **No primeiro extrato importado não há
 * história nenhuma**, e tudo caía em "revisar" — centenas de linhas para
 * classificar à mão antes de o sistema começar a ajudar.
 *
 * Estas palavras-chave existem para esse primeiro dia. Elas rodam DEPOIS de
 * todos os níveis que dependem de você: uma regra sua sempre ganha desta
 * tabela, e corrigir uma sugestão daqui vira regra e não volta a acontecer.
 *
 * ## Por que uma tabela, e não um modelo
 *
 * Porque a resposta precisa ser explicável. "Foi para Inteligência artificial
 * porque a descrição contém ANTHROPIC" é auditável e corrigível numa linha.
 * Um modelo acertaria mais em média e não teria como responder isso — e num
 * módulo de dinheiro, uma classificação que ninguém consegue explicar é uma
 * classificação em que ninguém deveria confiar.
 *
 * ## Confiança
 *
 * - **alta**: o nome é inequívoco (`ANTHROPIC`, `REGISTRO.BR`, `POSTO IPIRANGA`).
 * - **media**: a palavra é indicativa mas ambígua (`MERCADO` pode ser o
 *   supermercado ou "Mercado Livre"; `UBER` pode ser corrida ou Uber Eats).
 * - Sem casar: nada é sugerido. Ficar em branco é melhor que classificar
 *   errado — o número errado some no meio dos certos.
 */

export type KeywordConfidence = "alta" | "media";

export interface CategoryGuess {
  /** Categoria raiz, pelo nome como nasce no Cofre. */
  category: string;
  /** Subcategoria, quando o Cofre tiver uma que sirva. */
  subcategory: string | null;
  confidence: KeywordConfidence;
  /** Sugestão de que a despesa é da MilWeb, não pessoal. */
  business: boolean;
  /** O termo que casou — a tela mostra, e é o que torna a decisão explicável. */
  matched: string;
}

interface Regra {
  termos: readonly string[];
  category: string;
  subcategory?: string;
  confidence?: KeywordConfidence;
  /** Só marca MilWeb quando a natureza do gasto é inequivocamente de trabalho. */
  business?: boolean;
}

/**
 * A ordem importa: a primeira regra que casar vence. O específico vem antes do
 * genérico, pela mesma razão da tabela de fornecedores.
 */
const REGRAS: readonly Regra[] = [
  // ----- Trabalho: ferramentas de IA -----
  {
    termos: [
      "ANTHROPIC",
      "CLAUDE AI",
      "OPENAI",
      "CHATGPT",
      "MIDJOURNEY",
      "PERPLEXITY",
      "ELEVENLABS",
      "CURSOR AI",
      "GITHUB COPILOT",
    ],
    category: "Trabalho",
    subcategory: "IA",
    business: true,
  },
  // ----- Trabalho: infraestrutura -----
  {
    termos: [
      "VERCEL",
      "SUPABASE",
      "RENDER.COM",
      "RENDER COM",
      "CLOUDFLARE",
      "NETLIFY",
      "HEROKU",
      "DIGITALOCEAN",
      "AWS",
      "AMAZON WEB SERVICES",
      "HOSTINGER",
      "HOSTGATOR",
      "LOCAWEB",
      "UPSTASH",
      "RAILWAY",
    ],
    category: "Trabalho",
    subcategory: "Hospedagem",
    business: true,
  },
  // ----- Trabalho: domínios -----
  {
    termos: ["REGISTRO.BR", "REGISTROBR", "GODADDY", "NAMECHEAP", "CLOUDNS"],
    category: "Trabalho",
    subcategory: "Domínios",
    business: true,
  },
  // ----- Trabalho: marketing -----
  {
    termos: ["META ADS", "META PLATFORMS", "FACEBK", "GOOGLE ADS", "LINKEDIN ADS", "TIKTOK ADS"],
    category: "Trabalho",
    business: true,
  },
  // ----- Trabalho: software -----
  {
    termos: ["FIGMA", "NOTION", "GITHUB", "SLACK", "ZAPSIGN", "CANVA", "ADOBE", "JETBRAINS"],
    category: "Trabalho",
    subcategory: "Equipamentos",
    business: true,
  },
  // ----- Assinaturas de consumo -----
  {
    termos: [
      "NETFLIX",
      "SPOTIFY",
      "YOUTUBE",
      "DISNEY",
      "HBO",
      "MAX ",
      "AMAZON PRIME",
      "PARAMOUNT",
      "GLOBOPLAY",
      "DEEZER",
    ],
    category: "Assinaturas",
  },
  // ----- Alimentação -----
  {
    termos: ["IFOOD", "RAPPI", "UBER EATS", "ZE DELIVERY"],
    category: "Alimentação",
    subcategory: "Delivery",
  },
  {
    termos: [
      "RESTAURANTE",
      "CHURRASCARIA",
      "PIZZARIA",
      "BURGER",
      "HAMBURGUERIA",
      "SUSHI",
      "BAR E ",
      "BOTECO",
    ],
    category: "Alimentação",
    subcategory: "Restaurante",
  },
  {
    termos: ["PADARIA", "LANCHONETE", "CAFETERIA", "STARBUCKS", "CAFE ", "SORVETERIA", "ACAI"],
    category: "Alimentação",
    subcategory: "Lanches",
  },
  {
    termos: [
      "SUPERMERCADO",
      "ATACADAO",
      "ASSAI",
      "CARREFOUR",
      "PAO DE ACUCAR",
      "EXTRA ",
      "BIG BOX",
      "HORTIFRUTI",
      "ACOUGUE",
    ],
    category: "Alimentação",
    subcategory: "Mercado",
  },
  // "MERCADO" sozinho é ambíguo: casa com "Mercado Livre" e "Mercado Pago".
  { termos: ["MERCADO"], category: "Alimentação", subcategory: "Mercado", confidence: "media" },
  // ----- Transporte -----
  {
    termos: [
      "POSTO ",
      "IPIRANGA",
      "SHELL",
      "PETROBRAS",
      "BR MANIA",
      "COMBUSTIVEL",
      "GASOLINA",
      "ETANOL",
    ],
    category: "Transporte",
  },
  {
    termos: ["ESTACIONAMENTO", "ZONA AZUL", "PEDAGIO", "SEM PARAR", "CONECTCAR"],
    category: "Transporte",
  },
  // Uber sem "EATS" já foi tratado antes; aqui sobra a corrida.
  {
    termos: ["UBER", "99APP", "99 TAXI", "CABIFY", "BLABLACAR"],
    category: "Transporte",
    confidence: "media",
  },
  // ----- Moradia e contas -----
  {
    termos: ["ALUGUEL", "CONDOMINIO", "IPTU", "IMOBILIARIA"],
    category: "Moradia",
  },
  {
    termos: [
      "ENERGIA",
      "ELETRICA",
      "CEMIG",
      "ENEL",
      "LIGHT ",
      "COPEL",
      "SANEAMENTO",
      "SABESP",
      "COPASA",
      "AGUA E ESGOTO",
      "COMGAS",
      "VIVO",
      "CLARO",
      "TIM ",
      "OI FIBRA",
      "NET ",
      "INTERNET",
    ],
    category: "Contas",
  },
  // ----- Saúde e academia -----
  {
    termos: [
      "FARMACIA",
      "DROGARIA",
      "DROGASIL",
      "PACHECO",
      "RAIA",
      "LABORATORIO",
      "CLINICA",
      "HOSPITAL",
      "UNIMED",
      "AMIL",
      "BRADESCO SAUDE",
      "DENTISTA",
    ],
    category: "Saúde",
  },
  {
    termos: ["ACADEMIA", "SMARTFIT", "SMART FIT", "GYMPASS", "TOTALPASS", "CROSSFIT"],
    category: "Academia",
  },
  // ----- Lazer e educação -----
  {
    termos: [
      "CINEMA",
      "CINEMARK",
      "TEATRO",
      "INGRESSO",
      "SYMPLA",
      "STEAM",
      "PLAYSTATION",
      "XBOX",
      "NINTENDO",
    ],
    category: "Lazer",
  },
  {
    termos: ["UDEMY", "ALURA", "COURSERA", "ROCKETSEAT", "FACULDADE", "UNIVERSIDADE", "CURSO "],
    category: "Educação",
  },
  // ----- Tarifas e impostos -----
  {
    termos: [
      "TARIFA",
      "IOF",
      "JUROS",
      "ANUIDADE",
      "MANUTENCAO DE CONTA",
      "CESTA DE SERVICOS",
      "MULTA",
    ],
    category: "Contas",
  },
  { termos: ["DARF", "DAS ", "SIMPLES NACIONAL", "INSS", "IRPF", "IMPOSTO"], category: "Contas" },
  // ----- Transferências -----
  {
    termos: [
      "TRANSFERENCIA ENTRE CONTAS",
      "APLICACAO",
      "RESGATE",
      "PAGAMENTO DE FATURA",
      "PGTO FATURA",
    ],
    category: "Transferências",
  },
];

/**
 * Sugestão de categoria para uma descrição, ou `null` quando nada casa.
 *
 * `null` é uma resposta legítima e frequente. A alternativa — mandar tudo que
 * sobra para "Outros" — enterraria as linhas que precisam de atenção no meio
 * de um balde que ninguém abre.
 */
export function guessCategory(description: string): CategoryGuess | null {
  const texto = normalizeDescription(description);
  if (!texto) return null;

  for (const regra of REGRAS) {
    const termo = regra.termos.find((t) => texto.includes(t));
    if (!termo) continue;
    return {
      category: regra.category,
      subcategory: regra.subcategory ?? null,
      confidence: regra.confidence ?? "alta",
      business: regra.business ?? false,
      matched: termo.trim(),
    };
  }

  return null;
}

/** As categorias que estas regras podem produzir — usado nos testes e na doc. */
export function categoriesUsedByKeywords(): string[] {
  return [...new Set(REGRAS.map((r) => r.category))].sort();
}
