/**
 * Seed do módulo Financeiro (Fase 1 -- Centro de Custos). Não é gravado
 * direto -- `seed.ts` chama `seedFinance(prisma)` no final do fluxo
 * existente. Idempotente: upsert por `key` (catálogo), upsert manual por
 * `name` (produtos) e bootstrap só para orgs sem NENHUMA assinatura
 * (assinaturas).
 */

import type { PrismaClient } from "../../src/generated/client/index.js";

/** Preços de tabela levantados em 31/07/2026 (spec do módulo Financeiro). */
const CATALOG = [
  {
    key: "claude-pro",
    name: "Claude Pro",
    category: "AI" as const,
    defaultAmount: 20,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    bestFor: "IA para código e conteúdo (inclui Claude Code)",
    billingNotes: "US$ 20/mês (US$ 17 no anual)",
  },
  {
    key: "claude-max-5x",
    name: "Claude Max 5x",
    category: "AI" as const,
    defaultAmount: 100,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    bestFor: "Uso pesado de Claude Code",
    billingNotes: "A partir de US$ 100/mês",
  },
  {
    key: "higgsfield-starter",
    name: "Higgsfield Starter",
    category: "AI" as const,
    defaultAmount: 15,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    bestFor: "Geração de imagem/vídeo (200 créditos/mês)",
    billingNotes:
      "US$ 15/mês no plano anual -- créditos mensais rastreados por assinatura (ver `creditsIncluded`)",
  },
  {
    key: "higgsfield-ultra",
    name: "Higgsfield Ultra",
    category: "AI" as const,
    defaultAmount: 99,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    bestFor: "Geração pesada (≈3.000 créditos/mês)",
    billingNotes: "US$ 99/mês no plano anual",
  },
  {
    key: "vercel-hobby",
    name: "Vercel Hobby",
    category: "HOSTING" as const,
    defaultAmount: 0,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    defaultCapacityLimit: 10,
    bestFor: "Sites pessoais/demonstração (sem uso comercial)",
    billingNotes: "Grátis: 100 GB banda, 1M invocações; sem excedentes",
  },
  {
    key: "vercel-pro",
    name: "Vercel Pro",
    category: "HOSTING" as const,
    defaultAmount: 20,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "CLIENT" as const,
    defaultCapacityLimit: 30,
    bestFor: "Next.js com SSR/ISR/APIs",
    billingNotes: "US$ 20/membro/mês + US$ 20 de crédito de uso; banda 1 TB, depois US$ 0,15/GB",
  },
  {
    key: "supabase-free",
    name: "Supabase Free",
    category: "DATABASE" as const,
    defaultAmount: 0,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    defaultCapacityLimit: 2,
    bestFor: "Protótipos (pausa após 1 semana inativo)",
    billingNotes: "2 projetos, 500 MB banco, 50k MAUs",
  },
  {
    key: "supabase-pro",
    name: "Supabase Pro",
    category: "DATABASE" as const,
    defaultAmount: 25,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "CLIENT" as const,
    defaultCapacityLimit: 6,
    bestFor: "Auth + Postgres de produção",
    billingNotes:
      "US$ 25/mês: 8 GB banco, 100 GB storage; compute Micro US$ 10/projeto (1 crédito incluso)",
  },
  {
    key: "render-free",
    name: "Render Free",
    category: "HOSTING" as const,
    defaultAmount: 0,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    defaultCapacityLimit: 1,
    bestFor: "APIs de teste (dorme após 15 min)",
    billingNotes: "750 h de instância/mês; Postgres free expira em 30 dias",
  },
  {
    key: "render-starter",
    name: "Render Web Starter",
    category: "HOSTING" as const,
    defaultAmount: 7,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "CLIENT" as const,
    defaultCapacityLimit: 1,
    bestFor: "Backend/API pequeno sempre no ar",
    billingNotes: "US$ 7/mês por serviço (512 MB RAM)",
  },
  {
    key: "render-postgres-basic",
    name: "Render Postgres Basic",
    category: "DATABASE" as const,
    defaultAmount: 6,
    currency: "USD" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "CLIENT" as const,
    bestFor: "Postgres gerenciado pequeno",
    billingNotes: "US$ 6/mês (256 MB RAM)",
  },
  {
    key: "cloudflare-pages",
    name: "Cloudflare Pages",
    category: "HOSTING" as const,
    defaultAmount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "CLIENT" as const,
    defaultCapacityLimit: 20,
    bestFor: "Landing pages e sites estáticos",
    billingNotes: "Plano gratuito generoso; padrão para LP sem backend",
  },
  {
    key: "registrobr-domain",
    name: "Domínio .br (Registro.br)",
    category: "DOMAIN" as const,
    defaultAmount: 40,
    currency: "BRL" as const,
    billingCycle: "YEARLY" as const,
    defaultScope: "CLIENT" as const,
    bestFor: "Domínio nacional do cliente",
    billingNotes: "R$ 40/ano por domínio",
  },
  {
    key: "github-free",
    name: "GitHub Free",
    category: "OTHER" as const,
    defaultAmount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    defaultScope: "AGENCY" as const,
    bestFor: "Repositórios privados ilimitados",
    billingNotes: "Grátis para o uso atual",
  },
];

const PRODUCTS = [
  {
    name: "Landing Page Essencial",
    priceMin: 2000,
    priceMax: 3500,
    baseHours: 24,
    description: "1 página, foco em conversão, CTA WhatsApp",
    order: 1,
  },
  {
    name: "Landing Page Premium",
    priceMin: 3500,
    priceMax: 6000,
    baseHours: 40,
    description: "Animações, vídeo, SEO, scroll cinematográfico",
    order: 2,
  },
  {
    name: "Site Institucional",
    priceMin: 5000,
    priceMax: 8000,
    baseHours: 60,
    description: "5–8 páginas, credibilidade e autoridade",
    order: 3,
  },
  {
    name: "Site Institucional Premium",
    priceMin: 8000,
    priceMax: 15000,
    baseHours: 90,
    description: "Design exclusivo, CMS, animações",
    order: 4,
  },
  {
    name: "Sistema Web / SaaS",
    priceMin: 15000,
    priceMax: 40000,
    baseHours: 150,
    description: "Aplicação sob medida com backend",
    order: 5,
  },
];

/**
 * Assinaturas reais do Rick (valores declarados em 31/07/2026, fatura em
 * BRL). `capacityUsed` é estimativa inicial -- tudo editável na UI depois.
 */
const RICK_SUBSCRIPTIONS = [
  {
    serviceKey: "claude-max-5x",
    name: "Claude Max 5x",
    scope: "AGENCY" as const,
    amount: 550,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    notes: "Valor real no cartão (US$ 100 + câmbio/IOF)",
  },
  {
    serviceKey: "higgsfield-starter",
    name: "Higgsfield",
    scope: "AGENCY" as const,
    amount: 239,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    creditsIncluded: 1000,
    notes: "Plano mais barato, valor real no cartão",
  },
  {
    serviceKey: "vercel-hobby",
    name: "Vercel Hobby",
    scope: "AGENCY" as const,
    amount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    capacityLimit: 15,
    capacityUsed: 12,
    notes: "Sites da MilWeb e demos no ar (estimativa, ajustar)",
  },
  {
    serviceKey: "supabase-free",
    name: "Supabase Free",
    scope: "AGENCY" as const,
    amount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    capacityLimit: 2,
    capacityUsed: 1,
    notes: "Banco da MilLead",
  },
  {
    serviceKey: "render-free",
    name: "Render Free",
    scope: "AGENCY" as const,
    amount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    capacityLimit: 1,
    capacityUsed: 1,
    notes: "millead-api",
  },
  {
    serviceKey: "registrobr-domain",
    name: "Domínio milweb.com.br",
    scope: "AGENCY" as const,
    amount: 40,
    currency: "BRL" as const,
    billingCycle: "YEARLY" as const,
    notes: "Registro.br",
  },
];

export async function seedFinance(prisma: PrismaClient): Promise<void> {
  console.log("Seed: catálogo de serviços (custos)...");
  for (const item of CATALOG) {
    await prisma.costServiceCatalog.upsert({
      where: { key: item.key },
      update: { ...item },
      create: { ...item },
    });
  }

  // Produtos globais (organizationId NULL): sem unique constraint em `name`,
  // então o upsert é feito manualmente (findFirst + update/create).
  console.log("Seed: catálogo de produtos...");
  for (const product of PRODUCTS) {
    const existing = await prisma.projectProduct.findFirst({
      where: { organizationId: null, name: product.name },
    });
    if (existing) {
      await prisma.projectProduct.update({ where: { id: existing.id }, data: { ...product } });
    } else {
      await prisma.projectProduct.create({ data: { ...product } });
    }
  }

  // Bootstrap: orgs sem NENHUMA assinatura ganham as assinaturas reais do
  // Rick como ponto de partida (na prática só existe a org da MilWeb em
  // produção). Orgs que já têm assinaturas (de uso real da feature) nunca
  // são tocadas por este seed -- estritamente aditivo.
  console.log("Seed: assinaturas de custo (bootstrap por organização)...");
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    const count = await prisma.costSubscription.count({ where: { organizationId: org.id } });
    if (count > 0) continue;
    await prisma.costSubscription.createMany({
      data: RICK_SUBSCRIPTIONS.map((s) => ({ ...s, organizationId: org.id })),
    });
    await prisma.financeSettings.upsert({
      where: { organizationId: org.id },
      update: {},
      create: { organizationId: org.id },
    });
  }
}
