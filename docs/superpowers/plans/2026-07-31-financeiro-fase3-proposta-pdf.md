# Módulo Financeiro — Fase 3: Orçamento → Proposta em PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Gerar proposta" no orçamento: cria uma `Proposal` (módulo existente) com o preço escolhido, gera PDF profissional pro cliente (sem custos internos), sobe pro Vercel Blob, vincula `estimate.proposalId` e marca `CONVERTED`.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md`, seções "PDF da proposta (cliente)" e endpoint `POST /:id/convert`. Fases 1-2 no ar. **Zero migração** — `PricingEstimate.proposalId` (@unique) e `Proposal.pdfUrl` já existem. PDF **síncrono** no endpoint (pdf-lib é rápido, sem worker), apoiado na camada genérica `apps/api/src/infrastructure/pdf/layout.ts` (a mesma dos contratos). Upload via infra de Blob existente (`BLOB_READ_WRITE_TOKEN` já é obrigatório na API).

**Tech Stack:** pdf-lib 1.17 (desenho manual, sem HTML/headless), @vercel/blob, resto idêntico às fases anteriores.

## Global Constraints

- Mesmas das Fases 1-2 (imports `.js`, `organizationId` de `req.auth`, permissões `PROPOSALS_*`, decimais string no wire, pt-BR, RLS não se aplica — sem tabela nova).
- **O PDF NUNCA imprime custos internos**: nada de rateio, margem, custo/hora, reserva, custo real, preço mínimo/premium. Só o investimento final (e a linha de infraestrutura do cliente quando houver — é custo repassado, não interno).
- Conversão exige `leadId` no orçamento (Proposal é por lead). Orçamento `CONVERTED` não converte de novo nem é editável.
- Reusar o módulo Propostas existente — **conferir antes** `application/services/proposal-service.ts`, `domain/repositories/proposal-repository.ts` e o DTO de create; a Proposal nasce `DRAFT` (o fluxo de envio dela já existe e dispara e-mail no SENT — não mexer).
- Sanitização WinAnsi do layout.ts (`sanitize()`) em todo texto vindo do usuário.

## Verificações de ambiente (antes do Task 1)

- `git checkout main && git checkout -b feat/finance-proposal`. Conferir que `git log --oneline -1` é `fef7dd5` (merge da Fase 2) ou mais novo.

---

### Task 1: Renderer do PDF da proposta + teste

**Files:**

- Create: `apps/api/src/infrastructure/proposals/pdf/render.ts`
- Create: `apps/api/src/infrastructure/proposals/pdf/render.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ProposalPdfData {
  proposalNumber: string; // ex.: "2026-A1B2C3"
  orgName: string; // capa
  clientName: string; // empresa do lead, ou título do lead
  projectTitle: string; // título do orçamento
  productName: string | null; // nome do ProjectProduct, se houver
  scopeItems: string[]; // bullets do escopo
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  finalPrice: number; // preço escolhido na conversão
  infraMonthlyBrl: number; // computed do orçamento (0 = sem linha de infra)
  infraMonths: number;
  createdAt: Date;
}
export async function renderProposalPdf(data: ProposalPdfData): Promise<Uint8Array>;
```

- Consumes: `apps/api/src/infrastructure/pdf/layout.ts` — **ler o arquivo inteiro antes** (COLORS, A4, `sanitize`, `embedFonts`, `wrapText`, `drawHeader`, `addPage`, `ensureSpace`, `drawParagraph`, `drawFooters`) e `infrastructure/contracts/pdf/render.ts` como molde de composição (tem card de resumo financeiro em ~L118 — copiar a técnica, não o conteúdo). `fmtBRL` de `infrastructure/contracts/pdf/format.ts` (conferir export).

- [ ] **Step 1: Teste primeiro** — `render.test.ts` (pdf-lib permite inspecionar):

```ts
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderProposalPdf } from "./render.js";

const DATA = {
  proposalNumber: "2026-ABC123",
  orgName: "MilWeb",
  clientName: "Clínica ABC",
  projectTitle: "Site Institucional Clínica ABC",
  productName: "Site Institucional",
  scopeItems: ["Design exclusivo", "Site responsivo", "SEO básico", "Integração com WhatsApp"],
  deadlineDays: 30,
  paymentTerms: "50% para iniciar, 50% na entrega",
  validDays: 15,
  finalPrice: 9500,
  infraMonthlyBrl: 103.33,
  infraMonths: 12,
  createdAt: new Date("2026-07-31"),
};

describe("renderProposalPdf", () => {
  it("gera PDF válido com ao menos 1 página", async () => {
    const bytes = await renderProposalPdf(DATA);
    expect(bytes.length).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("sem infra não quebra (linha de infraestrutura omitida)", async () => {
    const bytes = await renderProposalPdf({ ...DATA, infraMonthlyBrl: 0 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("escopo longo pagina sem estourar", async () => {
    const many = Array.from(
      { length: 30 },
      (_, i) => `Item de escopo número ${i + 1} com texto razoavelmente longo pra forçar quebra`,
    );
    const bytes = await renderProposalPdf({ ...DATA, scopeItems: many });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar o renderer com as seções, nesta ordem:
  1. **Capa/cabeçalho**: `drawHeader` do layout (marca MilWeb) + título "Proposta Comercial" + `proposalNumber` + data (`fmtData` ou date-fns pt-BR) + "Para: {clientName}".
  2. **Resumo**: card com Projeto ({projectTitle} — {productName quando houver}), Prazo ("{deadlineDays} dias"), Investimento ({fmtBRL(finalPrice)}).
  3. **Escopo**: "O que está incluso" — bullets de `scopeItems` (sanitizados, `ensureSpace` a cada item pra paginar).
  4. **Investimento**: tabela — se `infraMonthlyBrl > 0`: linha "Desenvolvimento e implantação" = `finalPrice - infraMonthlyBrl*infraMonths` e linha "Infraestrutura ({infraMonths} meses)" = `infraMonthlyBrl*infraMonths`; senão linha única. Total destacado = `finalPrice`. (Se a subtração der ≤ 0, mostrar linha única com o total — orçamento estranho não pode gerar PDF com número negativo.)
  5. **Condições**: forma de pagamento ({paymentTerms}), validade ("Proposta válida por {validDays} dias a partir de {data}").
  6. `drawFooters` no final.
- [ ] **Step 4:** rodar → PASS (3 testes). **Step 5 (verificação visual local)**: script rápido gravando `scratch-proposta.pdf` no diretório temp, abrir/inspecionar dimensões via pdf-lib no próprio teste é suficiente — mas gere o arquivo e reporte o caminho no relatório pro controlador olhar. NÃO commitar o PDF.
- [ ] **Step 6:** Commit `feat(api): renderer do PDF de proposta comercial`.

---

### Task 2: Endpoint de conversão + serviço + testes

**Files:**

- Modify: `apps/api/src/application/dto/estimate.dto.ts` (append `convertEstimateSchema`)
- Modify: `apps/api/src/domain/repositories/estimate-repository.ts` + `infrastructure/prisma/prisma-estimate-repository.ts` (método `markConverted`)
- Modify: `apps/api/src/application/services/estimate-service.ts` (+ deps novas) e `estimate-service.test.ts`
- Modify: `apps/api/src/interfaces/http/controllers/estimate-controller.ts`, `interfaces/http/routes/estimate-routes.ts`, `main/container.ts`

**Interfaces:**

- DTO: `convertEstimateSchema = z.object({ price: z.number().min(1).max(9_999_999) })` — o front manda o preço escolhido (mínimo/recomendado/premium/custom são decisão de UI).
- Repo: `markConverted(organizationId: string, id: string, proposalId: string): Promise<void>` — `updateMany` org-scoped setando `{ status: "CONVERTED", proposalId }`.
- Service: `convert(organizationId: string, userId: string, id: string, input: { price: number }): Promise<{ estimate: PricingEstimateWithItems & { computed: EstimateComputed }; proposalId: string; pdfUrl: string }>`:
  1. `findById` org-scoped → 404 se não achou; `ConflictError`/erro apropriado se `status === "CONVERTED"` (conferir a classe de erro 409 real em `domain/errors/app-error.ts`; se só existir NotFound/Validation, usar a de validação com mensagem clara).
  2. `leadId` obrigatório → erro de validação claro ("Vincule um lead ao orçamento antes de gerar a proposta.") se null.
  3. Carregar lead (repo de leads, mesmo método de ownership das fases anteriores) e, se `lead.companyId`, a empresa (CompanyRepository) → `clientName = company?.name ?? lead.title`; `orgName` via repositório de Organization (conferir o existente usado pelo auth/settings).
  4. Criar a **Proposal** pelo caminho existente: conferir `ProposalService.create`/`ProposalRepository.create` e usar o repositório direto (`{ organizationId, leadId, createdById: userId, title: estimate.title, status: "DRAFT", value: input.price, currency: "BRL", validUntil: hoje + validDays }` — conferir shape real do create; NÃO passar pelo fluxo de envio).
  5. `renderProposalPdf` (Task 1) com `proposalNumber = "${ano}-${proposal.id.slice(-6).toUpperCase()}"` e `infraMonthlyBrl` do `computed`.
  6. Upload: conferir a infra real de blob (`infrastructure/blob/vercel-blob-storage.ts` — interface/porta usada pelos briefings) e subir como `proposals/{organizationId}/{proposal.id}.pdf`, `contentType: "application/pdf"` → `pdfUrl`.
  7. Atualizar a proposal com `pdfUrl` (método update do repo de proposals — conferir assinatura).
  8. `markConverted(orgId, id, proposal.id)`.
  9. Registrar Activity na timeline do lead (conferir como `proposal-service.ts` grava Activity e usar o mesmo padrão, type OTHER ou PROPOSAL_SENT — usar OTHER com payload `{ kind: "estimate_converted", estimateId, proposalId }`).
  10. Retornar estimate recarregado + proposalId + pdfUrl.
- Rota: `POST /:id/convert` (write, `validateBody(convertEstimateSchema)`) — registrada DEPOIS de `/products` e antes/junto das outras `/:id`.
- **Ordem de falha segura**: se o upload/PDF falhar DEPOIS de criar a Proposal, apagar a proposal criada (ou envolver em try/catch com cleanup) — nunca deixar Proposal órfã sem pdfUrl + estimate não-convertido. Testar esse caminho.

- [ ] **Step 1: testes primeiro** (fakes, molde `estimate-service.test.ts` atual): converter sem leadId → erro claro e nada criado; já CONVERTED → erro e nada criado; happy path → proposal criada com value = price, pdf gerado (mock do renderer/blob via injeção — o service recebe `renderPdf` e `blobStorage` como deps injetáveis no construtor), estimate marcado; falha no upload → proposal removida (cleanup) e estimate intacto.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS + suíte completa (43+4 novos ≥ 47) + type-check/lint.
- [ ] **Step 5:** Commit `feat(api): conversão de orçamento em proposta com PDF no Blob`.

---

### Task 3: Web — dialog de conversão + integração nas telas

**Files:**

- Modify: `apps/web/src/services/estimates.ts`, `features/estimates/hooks.ts`, `types/api.ts`
- Create: `apps/web/src/features/estimates/components/convert-estimate-dialog.tsx`
- Modify: `apps/web/src/features/estimates/components/estimate-editor.tsx` (botão "Gerar proposta" no header quando status ≠ CONVERTED e leadId presente; banner/estado quando CONVERTED com link)
- Modify: `apps/web/src/features/estimates/components/estimates-list.tsx` (badge CONVERTED já existe; adicionar link "Ver proposta" quando proposalId)
- Modify (conferir antes): página/lista de Propostas — se a UI de propostas ainda não mostra `pdfUrl`, adicionar link/botão "Ver PDF" quando presente (conferir `features/proposals/components/proposals-list.tsx`)

**Interfaces:**

- `estimatesService.convert(id, price)` → `POST /api/v1/estimates/${id}/convert` retorna `{ estimate, proposalId, pdfUrl }`; tipos correspondentes em `types/api.ts` (`ConvertEstimateResult`).
- Hook `useConvertEstimate` — invalida `["estimates"]` E `["proposals"]`; toast com ação/link.

- [ ] **Step 1:** service + tipos + hook.
- [ ] **Step 2:** `convert-estimate-dialog.tsx` — recebe o `computed` atual: radio com **Preço mínimo / Recomendado (default) / Premium** (valores formatados) + opção **Personalizado** (input com vírgula decimal, mesmo preprocess do editor); aviso fixo "Será criada uma proposta em rascunho com PDF para o cliente. Custos internos não aparecem no PDF."; se sem lead → dialog mostra estado explicativo com link pra editar e vincular lead (botão desabilitado). Confirmar → `useConvertEstimate` → sucesso: toast + abrir `pdfUrl` em nova aba + navegar/atualizar.
- [ ] **Step 3:** editor: botão "Gerar proposta" (ícone FileText) no header ao lado de "Marcar como pronto" (esconder quando CONVERTED); quando CONVERTED: form em modo somente-leitura (disabled) + banner com "Convertido em proposta" e links "Ver proposta" (`/proposals`) e "Abrir PDF" (pdfUrl vem de onde? — o estimate da API não tem pdfUrl; adicionar `proposal { id, pdfUrl }` na resposta do GET do estimate NO BACK (Task 2, include leve) OU buscar a proposal pelo proposalId via service de proposals existente — decidir pelo que exigir menos código novo; registrar a escolha no relatório).
- [ ] **Step 4:** lista de estimates: célula de status com link quando CONVERTED. Lista de propostas: link "Ver PDF" quando `pdfUrl` (conferir se já existe antes de adicionar).
- [ ] **Step 5:** `pnpm turbo lint type-check --filter=@millead/web`; dev server compila as rotas tocadas.
- [ ] **Step 6:** Commit `feat(web): gerar proposta em PDF a partir do orçamento`.

---

### Task 4: Suíte completa + checkpoint

- [ ] **Step 1:** `pnpm turbo lint type-check build` + `pnpm --filter @millead/api exec vitest run` (esperado ≥ 50 testes: 43 + renderer 3 + convert ≥ 4). format:check CRLF pré-existente: ignorar se for só isso. Se o type-check acusar race do turbo (visto na Fase 2), re-rodar.
- [ ] **Step 2:** Commit final se houver ajuste.
- [ ] **Step 3 (controlador, NÃO subagente):** checkpoint com o Rick: mostrar o PDF de exemplo gerado no Task 1, merge/push/deploy só com OK dele.

## Self-review do plano

- Cobertura da spec Fase 3: convert endpoint com validações (leadId obrigatório, não re-converter) ✓, Proposal DRAFT com value ✓, PDF com capa/resumo/escopo/investimento/condições sem custos internos ✓, infra como linha própria ✓, Blob upload ✓, proposalId+CONVERTED ✓, Activity ✓, UI com escolha de preço ✓. Sem migração (campos já existem) ✓.
- Sem placeholders: pontos de conferência apontam arquivo exato; código dado onde a lógica é nova (interface do renderer, testes, schema do convert).
- Consistência: `ProposalPdfData` produzido na Task 1 = consumido na Task 2; `ConvertEstimateResult` da Task 3 = retorno da Task 2; cleanup de proposal órfã especificado e testado.
