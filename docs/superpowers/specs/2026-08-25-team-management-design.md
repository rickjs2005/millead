# Gestão de equipe e responsáveis

## Objetivo

Transformar o MilLead de workspace individual em operação multiusuário sem
quebrar o isolamento por organização já adotado no CRM.

## Fluxo

1. Um membro com `members:manage` escolhe e-mail e papel.
2. A API gera um token opaco, grava somente o SHA-256 e envia o link (ou o
   devolve para cópia quando SMTP não está configurado).
3. O convidado abre `/invite/:token`. Se já tem conta, apenas aceita; caso
   contrário informa nome e cria uma senha.
4. A aceitação consome o convite e ativa a `Membership` em uma transação.
5. O novo membro passa a aparecer no diretório de responsáveis.

## Segurança

- Convite único por organização/e-mail, expiração de 7 dias e revogação.
- Token nunca é persistido em claro nem enviado em query/path à API.
- Último Owner ativo não pode ser suspenso ou rebaixado.
- O usuário não altera o próprio papel/status.
- Um ator não cria, edita ou atribui papel com permissões superiores às suas.
- `ownerId` e `assigneeId` só aceitam membro ativo do mesmo tenant.
- Tabela de convites tem RLS habilitada na migration.

## API

- `GET /api/v1/team/directory`
- `GET|PATCH /api/v1/team/members[/:id]`
- `GET|POST|DELETE /api/v1/team/invitations[/:id]`
- `GET|POST|PATCH|DELETE /api/v1/team/roles[/:id]`
- `POST /api/v1/public/team-invitations/preview`
- `POST /api/v1/public/team-invitations/accept`

## Interface

`/settings/team` reúne membros, convites e papéis. Formulários de lead e
tarefa permitem atribuição; as listas mostram nomes reais e oferecem filtros
por responsável, incluindo atalhos “Meus leads” e “Minhas tarefas”.

## Verificação

- Testes unitários de escalada de privilégio, autoproteção, último Owner,
  dados obrigatórios no aceite e atribuição cross-tenant.
- `prisma generate`, type-check, lint, testes e build do monorepo antes do PR.
