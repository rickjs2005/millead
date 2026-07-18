/**
 * Definição declarativa dos templates de briefing (Fase 10). Não é
 * gravado direto -- `seed.ts` faz upsert em cascata (Template -> Section
 * -> Field, campos-filho de GROUP num segundo passe) a partir disto.
 */

export type FieldSeed = {
  key: string;
  label: string;
  type:
    | "TEXT"
    | "TEXTAREA"
    | "EMAIL"
    | "PHONE"
    | "URL"
    | "SELECT"
    | "MULTI_SELECT"
    | "FILE"
    | "GROUP";
  required?: boolean;
  helpText?: string;
  config?: Record<string, unknown>;
  children?: FieldSeed[];
};

export type SectionSeed = {
  key: string;
  title: string;
  description?: string;
  fields: FieldSeed[];
};

const SIM_NAO = { options: ["Sim", "Não"] };

const ARQUIVOS_ACCEPT = {
  accept: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".zip",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".mp4",
    ".mov",
  ],
};

const IMAGEM_ACCEPT = { accept: [".png", ".jpg", ".jpeg", ".webp", ".svg"] };

/** As 10 seções do briefing de Site Institucional, exatamente como pedidas. */
export function institutionalSections(): SectionSeed[] {
  return [
    {
      key: "empresa",
      title: "Dados da empresa",
      fields: [
        { key: "nome", label: "Nome", type: "TEXT", required: true },
        { key: "nomeFantasia", label: "Nome fantasia", type: "TEXT" },
        { key: "cnpj", label: "CNPJ", type: "TEXT", config: { mask: "cnpj" } },
        { key: "telefone", label: "Telefone", type: "PHONE" },
        { key: "whatsapp", label: "WhatsApp", type: "PHONE" },
        { key: "email", label: "E-mail", type: "EMAIL" },
        { key: "cep", label: "CEP", type: "TEXT", config: { mask: "cep" } },
        { key: "cidade", label: "Cidade(s)", type: "TEXT", config: { multi: true } },
        { key: "estado", label: "Estado(s)", type: "TEXT", config: { multi: true } },
        { key: "instagram", label: "Instagram", type: "URL" },
        { key: "facebook", label: "Facebook", type: "URL" },
        { key: "linkedin", label: "LinkedIn", type: "URL" },
        { key: "siteAtual", label: "Site atual", type: "URL" },
        { key: "googleMaps", label: "Google Maps", type: "URL" },
        { key: "horario", label: "Horário de funcionamento", type: "TEXT" },
      ],
    },
    {
      key: "sobre",
      title: "Sobre a empresa",
      fields: [
        { key: "historia", label: "Conte a história da empresa", type: "TEXTAREA" },
        { key: "missao", label: "Missão", type: "TEXTAREA" },
        { key: "visao", label: "Visão", type: "TEXTAREA" },
        { key: "valores", label: "Valores", type: "TEXTAREA" },
        { key: "diferenciais", label: "Diferenciais", type: "TEXTAREA" },
        { key: "tempoDeMercado", label: "Tempo de mercado", type: "TEXT" },
      ],
    },
    {
      key: "objetivos",
      title: "Objetivos",
      fields: [
        {
          key: "objetivos",
          label: "Qual o objetivo do site?",
          type: "MULTI_SELECT",
          required: true,
          config: {
            options: [
              "Gerar contatos",
              "Mostrar portfólio",
              "Fortalecer marca",
              "Receber orçamento",
              "Agendamentos",
              "Outro",
            ],
          },
        },
      ],
    },
    {
      key: "publico",
      title: "Público-alvo",
      fields: [
        { key: "descricaoCliente", label: "Quem é seu cliente?", type: "TEXTAREA" },
        { key: "faixaEtaria", label: "Faixa etária", type: "TEXT" },
        { key: "cidade", label: "Cidade", type: "TEXT" },
        { key: "classeSocial", label: "Classe social", type: "TEXT" },
        { key: "necessidades", label: "Necessidades", type: "TEXTAREA" },
      ],
    },
    {
      key: "servicos",
      title: "Serviços",
      description: "Adicione os serviços que deseja destacar no site.",
      fields: [
        {
          key: "servicos",
          label: "Serviços",
          type: "GROUP",
          config: { minItems: 0, maxItems: 20, itemLabel: "Serviço" },
          children: [
            { key: "nome", label: "Nome", type: "TEXT", required: true },
            { key: "descricao", label: "Descrição", type: "TEXTAREA" },
            { key: "imagem", label: "Imagem", type: "FILE", config: IMAGEM_ACCEPT },
          ],
        },
      ],
    },
    {
      key: "galeria",
      title: "Galeria",
      fields: [
        {
          key: "fotos",
          label: "Fotos",
          type: "FILE",
          config: { ...IMAGEM_ACCEPT, maxFiles: 30 },
        },
        {
          key: "videos",
          label: "Vídeos",
          type: "FILE",
          config: { accept: [".mp4", ".mov", ".webm"], maxFiles: 10 },
        },
        { key: "logo", label: "Logo", type: "FILE", config: IMAGEM_ACCEPT },
        {
          key: "manualMarca",
          label: "Manual da marca",
          type: "FILE",
          config: { accept: [".pdf"] },
        },
      ],
    },
    {
      key: "identidade",
      title: "Identidade visual",
      fields: [
        { key: "possuiLogo", label: "Possui logotipo?", type: "SELECT", config: SIM_NAO },
        { key: "possuiCores", label: "Possui cores definidas?", type: "SELECT", config: SIM_NAO },
        { key: "possuiFonte", label: "Possui fonte definida?", type: "SELECT", config: SIM_NAO },
        {
          key: "arquivos",
          label: "Enviar arquivos de identidade visual",
          type: "FILE",
          config: ARQUIVOS_ACCEPT,
        },
      ],
    },
    {
      key: "referencias",
      title: "Referências",
      fields: [
        { key: "sitesQueGosta", label: "Sites que você gosta", type: "TEXTAREA" },
        { key: "sitesQueNaoGosta", label: "Sites que você não gosta", type: "TEXTAREA" },
        { key: "oQueChamouAtencao", label: "O que chamou sua atenção neles?", type: "TEXTAREA" },
      ],
    },
    {
      key: "funcionalidades",
      title: "Funcionalidades",
      fields: [
        {
          key: "funcionalidades",
          label: "Quais funcionalidades você deseja?",
          type: "MULTI_SELECT",
          config: {
            options: [
              "WhatsApp",
              "Chat",
              "Mapa",
              "Blog",
              "Área do cliente",
              "Formulário",
              "Downloads",
              "Agendamento",
              "Integrações",
            ],
          },
        },
      ],
    },
    {
      key: "observacoes",
      title: "Observações finais",
      fields: [
        { key: "observacoes", label: "Observações finais", type: "TEXTAREA" },
      ],
    },
  ];
}

/** Seção extra do template de Loja Virtual (E-commerce). */
function ecommerceExtraSection(): SectionSeed {
  return {
    key: "ecommerce",
    title: "Loja virtual",
    fields: [
      { key: "produtos", label: "Quais produtos serão vendidos?", type: "TEXTAREA" },
      { key: "categorias", label: "Categorias de produtos", type: "TEXTAREA" },
      { key: "quantidadeMedia", label: "Quantidade média de produtos", type: "TEXT" },
      {
        key: "frete",
        label: "Formas de frete",
        type: "MULTI_SELECT",
        config: { options: ["Correios", "Transportadora"] },
      },
      {
        key: "formasPagamento",
        label: "Formas de pagamento",
        type: "MULTI_SELECT",
        config: { options: ["PIX", "Cartão", "Mercado Pago", "PagSeguro", "Stripe"] },
      },
      { key: "cupons", label: "Terá cupons de desconto?", type: "SELECT", config: SIM_NAO },
      { key: "estoque", label: "Terá controle de estoque?", type: "SELECT", config: SIM_NAO },
      { key: "erp", label: "Integra com algum ERP? Qual?", type: "TEXT" },
      {
        key: "notaFiscal",
        label: "Precisa de emissão de nota fiscal?",
        type: "SELECT",
        config: SIM_NAO,
      },
    ],
  };
}

/** Institucional + a seção extra de e-commerce. */
export function ecommerceSections(): SectionSeed[] {
  return [...institutionalSections(), ecommerceExtraSection()];
}

export const BRIEFING_TEMPLATES = [
  {
    key: "institucional-v1",
    kind: "INSTITUCIONAL" as const,
    name: "Site Institucional",
    description: "Briefing completo para sites institucionais.",
    sections: institutionalSections(),
  },
  {
    key: "ecommerce-v1",
    kind: "ECOMMERCE" as const,
    name: "Loja Virtual (E-commerce)",
    description: "Briefing completo para lojas virtuais.",
    sections: ecommerceSections(),
  },
];
