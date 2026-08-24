# Checklist de projetos (ProjectChecklist) — design

## Contexto

A MilWeb passou a usar um processo de fases padronizado para sites institucionais/landing e sistemas web (16 fases cada, do briefing até indexação/monitoramento), implementado como duas skills do Claude Code (`site-institucional`, `sistema-web`) mais um arquivo `project-state.md` por projeto, gravado em `<projeto>/.claude/project-state.md`.

Esse arquivo funciona, mas é só texto dentro de cada repositório — o Rick não tem uma visão consolidada de todos os projetos ao mesmo tempo, e precisa abrir pasta por pasta pra saber onde cada um está. O pedido é trazer isso pro MilLead (o CRM interno da MilWeb) como uma tela visual, mantendo os `.md` como estão (não é uma migração, é uma segunda forma de ver a mesma informação).

## Fora de escopo (v1)

- Detecção automática de fase por análise estática do código do projeto.
- Notificações/lembretes de fase parada.
- Versionamento/histórico de mudanças de status por fase (só o estado atual).
- Subitens de checklist dentro de cada fase no banco de dados — os subitens (ex. "criar wireframe", "configurar canonical") continuam vivendo só no conteúdo das SKILL.md; o banco rastreia só o status da fase como um todo, exatamente como o `project-state.md` já faz.
- Gerenciamento de múltiplas API keys / rotação automática — v1 usa uma única key estática por organização.
- Kanban/drag-and-drop — a visão é uma lista de projetos + um checklist linear por projeto, não um board.

## Modelo de dados

Segue o padrão do módulo `Lead`/`LeadContact` já existente (`packages/database/prisma/schema.prisma`): entidade pai + filha, `organizationId` em ambas para tenancy, RLS habilitado, timestamps padrão.

```prisma
enum ProjectChecklistType {
  INSTITUTIONAL
  SYSTEM
}

enum ProjectChecklistPhaseStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
  NOT_APPLICABLE
}

model ProjectChecklist {
  id             String   @id @default(cuid())
  organizationId String   @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  type           ProjectChecklistType
  companyId      String?  @map("company_id")
  company        Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  localFolder    String?  @map("local_folder") // nome da pasta em projetos/, usado pra casar com o .md local
  phases         ProjectChecklistPhase[]
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("project_checklists")
}

model ProjectChecklistPhase {
  id                  String   @id @default(cuid())
  organizationId      String   @map("organization_id")
  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectChecklistId  String   @map("project_checklist_id")
  projectChecklist    ProjectChecklist @relation(fields: [projectChecklistId], references: [id], onDelete: Cascade)
  phaseNumber         Int      @map("phase_number") // 1-16
  phaseName           String   @map("phase_name")
  status              ProjectChecklistPhaseStatus @default(NOT_STARTED)
  naNote              String?  @map("na_note") // obrigatório quando status = NOT_APPLICABLE (validado na service, não no schema)
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@index([organizationId])
  @@index([projectChecklistId])
  @@unique([projectChecklistId, phaseNumber])
  @@map("project_checklist_phases")
}
```

Os nomes das 16 fases de cada tipo (`INSTITUTIONAL`/`SYSTEM`) ficam hardcoded em `PHASE_TEMPLATES` no backend (application layer), copiados literalmente das seções `## Fase NN` das SKILL.md `site-institucional`/`sistema-web`. Ao criar um `ProjectChecklist`, a service semeia as 16 linhas de `ProjectChecklistPhase` automaticamente a partir do template do tipo escolhido. **Trade-off aceito**: os nomes de fase existem em dois lugares (SKILL.md e `PHASE_TEMPLATES`) — são papéis diferentes (SKILL.md = conteúdo/processo detalhado; banco = rótulo curto + status), não há um mecanismo de sincronização automática entre eles nesta v1.

`companyId` é opcional porque projetos internos da MilWeb (o próprio site `milweb`, o próprio `millead`) não têm uma `Company` cliente associada.

Migration + inclusão das duas tabelas novas na RLS (mesmo padrão da migration `20260818140000_enable_rls_all_public_tables`).

## Permissões

Adicionar em `packages/database/src/permissions.ts`:
- `PROJECT_CHECKLISTS_READ: "project-checklists:read"`
- `PROJECT_CHECKLISTS_WRITE: "project-checklists:write"`

Incluídas em `ALL_PERMISSIONS` (deriva automaticamente) e nos papéis (`SYSTEM_ROLES`) que já cobrem `ALL_PERMISSIONS` menos billing (Owner/Admin). Re-rodar `pnpm db:seed` aplica.

## Backend — módulo `project-checklist`, espelhando `lead`

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Domain | `apps/api/src/domain/entities/project-checklist.ts` | `ProjectChecklist`, `ProjectChecklistPhase`, `ProjectChecklistDetail` (pai + fases) |
| Domain | `apps/api/src/domain/repositories/project-checklist-repository.ts` | Interface do repositório (porta) |
| Application | `apps/api/src/application/dto/project-checklist.dto.ts` | Schemas Zod: criar, atualizar status de uma fase, listar |
| Application | `apps/api/src/application/services/project-checklist-service.ts` | `create` (semeia as 16 fases pelo `type`), `updatePhaseStatus` (valida `naNote` obrigatório quando `NOT_APPLICABLE`), `list`, `getById` |
| Infrastructure | `apps/api/src/infrastructure/prisma/prisma-project-checklist-repository.ts` | Implementação Prisma, sempre filtrando/escrevendo por `organizationId` |
| Interfaces | `apps/api/src/interfaces/http/routes/project-checklist-routes.ts` | Rotas REST |
| Interfaces | `apps/api/src/interfaces/http/controllers/project-checklist-controller.ts` | Controller fino |

Rotas (`/api/v1/project-checklists`, prefixo registrado em `apps/api/src/main/app.ts`):

- `GET /` — lista (com progresso % calculado: fases `DONE`+`NOT_APPLICABLE` sobre 16)
- `POST /` — cria (`name`, `type`, `companyId?`, `localFolder?`) — semeia as 16 fases
- `GET /:id` — detalhe com as 16 fases
- `PATCH /:id/phases/:phaseNumber` — atualiza status de uma fase (`status`, `naNote?`)
- `DELETE /:id` — remove (cascade nas fases)

Todas exigem `requirePermission(PERMISSIONS.PROJECT_CHECKLISTS_READ)` (GETs) ou `..._WRITE` (POST/PATCH/DELETE), igual ao módulo Leads.

### Autenticação dupla (sessão humana + automação)

Hoje `authenticate` (middleware) só aceita sessão JWT de usuário logado. Para eu (Claude) poder sincronizar automaticamente a partir das skills `site-institucional`/`sistema-web`, adiciono um segundo caminho no mesmo middleware `authenticate`:

1. Se o header `X-Automation-Key: <token>` bater com a env var `AUTOMATION_API_KEY` (configurada no Render), popula `req.auth` com um `organizationId` fixo (o da MilWeb, hardcoded via env var `AUTOMATION_ORGANIZATION_ID`) e permissões fixas `[PROJECT_CHECKLISTS_READ, PROJECT_CHECKLISTS_WRITE]` — não é um usuário real, não aparece em nenhuma tela de "usuários". **Desvio da sugestão original desta seção (que citava `Authorization: Bearer`)**: a implementação usa o header dedicado `X-Automation-Key`, seguindo o precedente já existente no código (`ownerOrSyncKey` do MilSocial, `interfaces/http/routes/social-routes.ts`) em vez de sobrecarregar `Authorization`. Deviação revisada e aprovada durante a implementação (ver ledger `.superpowers/sdd/2026-08-24-project-checklist/progress.md`); o comportamento exigido por esta seção (dupla autenticação sessão/automação) é o mesmo, só o nome do header muda.
2. Se o header `X-Automation-Key` estiver presente mas não bater com a key configurada (ou a key/organizationId não estiverem configurados no ambiente), a request recebe 401 direto — **sem fallback pro fluxo de sessão**, mesmo que o usuário tenha um cookie de sessão válido. Só a AUSÊNCIA do header cai no fluxo JWT normal já existente.

A key fica guardada em `C:\Users\rickj\.claude\millead-api-key` (arquivo texto simples, fora de qualquer repositório git, nunca escrito em memória/markdown do Claude). As skills leem esse arquivo quando forem sincronizar; se o arquivo não existir ou a API não responder, seguem em frente só com o `.md` local — a sincronização é estritamente best-effort, nunca bloqueia o fluxo principal da skill.

## Frontend

- `apps/web/src/services/project-checklists.ts` — `projectChecklistsService`, mesmo padrão de `leads.ts`.
- `apps/web/src/app/(app)/projetos/page.tsx` — lista de `ProjectChecklist`, cada card com nome, tipo, barra de progresso (`components/ui/progress.tsx`, já existe) e link pro detalhe.
- `apps/web/src/app/(app)/projetos/[id]/page.tsx` — as 16 fases em lista vertical, cada uma com um seletor de status (✓ concluída / ◐ em andamento / ○ não iniciada / N/A) e campo de nota (obrigatório só quando N/A) — usa `react-hook-form`/Zod e os componentes já existentes (`select`, `badge`, `textarea` se existir, senão `input`).
- Um botão "Novo projeto" abre um diálogo simples (nome, tipo, empresa opcional, pasta local opcional).

## Sincronização com `.md` (skills + CLAUDE.md)

Atualizo `projetos/CLAUDE.md` e as duas SKILL.md para descrever, na seção de modo `status`:

> Se `C:\Users\rickj\.claude\millead-api-key` existir, tentar sincronizar o `project-state.md` com o MilLead (`GET/POST/PATCH /api/v1/project-checklists`, casando pelo campo `localFolder`). Timeout curto (poucos segundos) — se falhar por qualquer motivo (rede, API dormindo no Render free tier, key ausente), seguir normalmente só com o `.md` local, sem erro visível pro usuário.

Isso é uma mudança de *instrução*, não de código — as skills continuam sendo arquivos markdown; a "sincronização" é uma chamada HTTP feita pelo próprio Claude ao seguir a instrução, usando as ferramentas de shell/HTTP disponíveis na sessão, não um script novo.

## Testes

Seguindo o padrão do repositório (vitest, `*.test.ts` co-localizado):

- `apps/api/src/application/services/project-checklist-service.test.ts` — cobre: criação semeia exatamente 16 fases do tipo certo; `updatePhaseStatus` rejeita `NOT_APPLICABLE` sem `naNote`; cálculo de progresso % trata `NOT_APPLICABLE` como concluída.
- `apps/api/src/interfaces/http/middlewares/api-key-or-session.test.ts` — request com `X-Automation-Key: <AUTOMATION_API_KEY correta>` popula `req.auth` com as permissões fixas `[PROJECT_CHECKLISTS_READ, PROJECT_CHECKLISTS_WRITE]`; com key errada, a request recebe 401 direto (sem fallback pro fluxo de sessão).

## Riscos / trade-offs aceitos

- Duplicação dos nomes de fase entre SKILL.md e `PHASE_TEMPLATES` (ver seção Modelo de dados) — aceito conscientemente.
- Uma única API key estática por organização, sem expiração/rotação — proporcional ao uso (uma pessoa, um agente automatizado). Se isso crescer, revisar.
- `project-state.md` e o MilLead podem divergir se a sincronização falhar silenciosamente por muito tempo — mitigado por ser best-effort e pelo Rick também poder editar manualmente no painel.
