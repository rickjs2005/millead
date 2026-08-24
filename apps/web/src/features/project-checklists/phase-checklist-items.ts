import type { ProjectChecklistType } from "@/types/api";

/**
 * Texto de referência por fase — copiado literalmente das SKILL.md
 * `site-institucional`/`sistema-web` (mesma fonte do `PHASE_TEMPLATES` no
 * backend). Só pra contexto na tela: não é rastreado por item, o status
 * continua sendo por fase inteira. Se as SKILL.md mudarem, atualizar aqui
 * também — mesmo trade-off de duplicação já aceito pros nomes das fases.
 */
const INSTITUTIONAL_PHASE_ITEMS: string[][] = [
  [
    "Objetivo principal do site, público-alvo, produto/serviço principal",
    "Conversão desejada, CTA principal, CTA secundário",
    "Diferenciais, concorrentes, sites de referência, tom visual, posicionamento",
    "Textos, fotos, vídeos, logotipo e manual da marca existentes",
    "Contato, endereço, redes sociais, WhatsApp",
    "Domínio, hospedagem, prazo, escopo fechado",
  ],
  [
    "Páginas, navegação, header, footer, hierarquia de conteúdo",
    "Sitemap, URLs amigáveis, breadcrumbs quando necessário",
    "CTAs, fluxo de conversão, estratégia de SEO por página",
  ],
  [
    "Wireframe, hierarquia visual, mobile e desktop",
    "Estados de interação, navegação mobile, comportamento do menu",
    "Formulários, mensagens de erro, loading, sucesso",
    "Acessibilidade básica, reduced motion, conexões lentas",
  ],
  [
    "Grid, spacing, tipografia e escala tipográfica, cores, bordas, sombras",
    "Botões, cards, inputs, componentes, estados hover/active/focus/disabled",
    "Design system básico — mobile, tablet, desktop",
  ],
  [
    "Textos revisados, H1, H2/H3, textos comerciais, CTAs, microcopy",
    "Alt text das imagens, ortografia, contato validado com o cliente",
  ],
  [
    "Projeto, framework, TypeScript, CSS, lint, formatter, estrutura de pastas",
    "Componentes reutilizáveis, layout, header, footer, páginas",
    "Responsividade, animações, navegação, formulários com validação",
    "WhatsApp, links sociais, mapa, vídeos, lazy loading, otimização de imagem",
    "Página 404 com identidade visual do projeto (obrigatória, sempre)",
    "Página/estado 500 ou fallback quando a arquitetura permitir",
    "Fallback de imagem quebrada e de vídeo que não carregou",
    "Estados de erro e sucesso de formulário",
  ],
  [
    "Animação do hero, entrada das seções, scroll, hover, parallax quando fizer sentido",
    "Transições entre páginas; Lenis/GSAP/Framer Motion quando necessário",
    "Fallback para reduced motion; impacto no desempenho verificado",
  ],
  [
    "Palavra-chave principal e secundárias, title, meta description, canonical",
    "H1 e hierarquia de headings, URLs e imagens otimizadas, alt",
    "Open Graph, Twitter/X Cards, favicon, manifest quando necessário",
    "sitemap.xml, robots.txt, JSON-LD (Organization, LocalBusiness, Service/Product quando aplicável), validado",
    "Links internos e links quebrados verificados",
  ],
  [
    "Imagens comprimidas (WebP/AVIF), vídeos otimizados com poster, lazy load",
    "JS/CSS reduzido, fontes e preload verificados",
    "LCP, CLS, INP medidos; Lighthouse mobile e desktop; conexão lenta testada",
  ],
  [
    "Contraste, navegação por teclado, foco, labels, alt",
    "Hierarquia de headings, elementos semânticos, aria-label quando necessário",
    "Tamanho de texto, reduced motion; leitor de tela quando necessário",
  ],
  [
    "Google Analytics 4, Google Tag Manager quando necessário",
    "Eventos: WhatsApp, envio de formulário, clique em telefone, clique em CTA",
    "Search Console configurado; eventos e funil testados",
  ],
  [
    "Formulário validado e sanitizado, sem secret exposto no frontend",
    "Variáveis de ambiente, headers de segurança, HTTPS, CORS quando aplicável",
    "`npm audit` (ou equivalente) executado",
  ],
  [
    "Chrome, Firefox, Safari, Edge; Android, iPhone, tablet; várias resoluções",
    "Todos os links, formulários, WhatsApp, menu mobile, animações, imagens, vídeos",
    "URL inexistente → 404 testada (desktop e mobile); noindex da 404 verificado",
    "Bugs corrigidos, revisão final feita",
  ],
  [
    "Repositório git, ambiente de produção, hosting, domínio, DNS, SSL",
    "Variáveis de ambiente configuradas, build verificado",
    "HTTPS, redirects, www/non-www, página 404 em produção verificados",
  ],
  [
    "Google Search Console: propriedade adicionada, domínio validado, sitemap enviado",
    "Indexação da Home e páginas principais solicitada",
    "Cobertura, canonical, robots.txt, sitemap e dados estruturados verificados",
  ],
  [
    "Revisão final com o cliente, conteúdo e links validados",
    "Domínio e acessos entregues; hospedagem, analytics, Search Console e repositório documentados",
    "Backup feito, versão entregue registrada, manutenção futura definida",
  ],
];

const SYSTEM_PHASE_ITEMS: string[][] = [
  [
    "Problema de negócio, usuários, papéis/roles, permissões",
    "Funcionalidades, regras de negócio, fluxos, user stories, MVP",
    "Requisitos funcionais e não funcionais, stack, infraestrutura, estratégia de deploy",
  ],
  [
    "Sitemap/app map, wireframes, fluxo de autenticação, dashboard, telas CRUD",
    "Estados vazio/loading/erro/sucesso, confirmação de ações, modais, formulários",
    "Responsividade e design system",
  ],
  [
    "Entidades, ERD, tabelas, PKs, FKs, índices, constraints, enums",
    "Timestamps, soft delete quando necessário, auditoria, relacionamentos",
    "Normalização, performance de queries revisada",
    "Migrations, seeds, estratégia de backup",
  ],
  [
    "Projeto, TypeScript, ORM/query builder, conexão com banco, env vars",
    "Models, repositories, services, controllers, routes, middlewares",
    "Validação, tratamento de erros, logging, documentação da API, health check",
    "Rate limiting, CORS, paginação, filtros, ordenação, upload quando necessário",
  ],
  [
    "Cadastro, login, logout, recuperação e alteração de senha",
    "Sessão, JWT/session strategy, refresh token quando necessário",
    "RBAC, permissões, endpoints e páginas frontend protegidos",
    "Ownership dos recursos validado, privilege escalation impedido",
    "Auditoria de ações críticas",
  ],
  [
    "Projeto, TypeScript, framework, routing, estado global quando necessário",
    "API client, autenticação, layout, dashboard, componentes",
    "Formulários com validação, tabelas, filtros, paginação, modais, notificações",
    "Loading/error/empty states, responsive layout, integração com a API",
    "Optimistic updates quando adequado",
  ],
  [
    "Email, WhatsApp, pagamentos, storage, maps, analytics conforme o escopo",
    "Webhooks, APIs externas, OAuth quando necessário",
    "Filas/background jobs, retry strategy, idempotência, logs de integração",
  ],
  [
    "Todas as entradas validadas e sanitizadas",
    "Proteção contra SQL injection, XSS, CSRF quando aplicável",
    "Rate limiting, hash de senhas, secrets configurados, headers revisados",
    "CORS, permissões, uploads e exposição de dados revisados",
    "Dependency audit executado, logs de segurança criados",
  ],
  [
    "Unitários: services, regras de negócio, utilities, validações",
    "Integração: API, banco, autenticação, permissões, integrações, webhooks",
    "E2E: cadastro, login/logout, CRUD principal, fluxos críticos, pagamentos, recuperação de senha, permissões",
  ],
  [
    "Queries analisadas, índices criados, N+1 verificado, cache quando necessário",
    "API e payloads otimizados, paginação implementada",
    "Imagens, bundle, lazy loading e code splitting do frontend otimizados",
    "Core Web Vitals, teste de carga e de concorrência",
  ],
  [
    "Logs, error tracking, uptime monitoring, health checks",
    "Monitoramento de API, banco, jobs, integrações",
    "Alertas, métricas, dashboards",
  ],
  [
    "Ambientes de development, staging e production",
    "Banco, storage, Redis e filas quando necessário",
    "Domínio, DNS, SSL, secrets, CI/CD",
    "Migrations automáticas com segurança, backups configurados e restauração testada",
  ],
  [
    "Frontend, backend, banco, autenticação e autorização testados",
    "Mobile, desktop, navegadores, erros, limites, concorrência",
    "Segurança, performance, integrações testadas",
    "Bugs críticos corrigidos, regression testing feito",
  ],
  [
    "Merge para production, CI, testes e build executados, migrations rodadas",
    "Deploy backend e frontend, domínio, SSL, env vars configurados",
    "Banco, API e frontend verificados em produção, smoke tests executados",
  ],
  [
    "Title, description, canonical, sitemap, robots.txt para as rotas públicas",
    "Open Graph, JSON-LD, Search Console configurado, indexação solicitada",
    "noindex confirmado em toda área privada/autenticada",
  ],
  [
    "Erros, uptime, performance, banco e custos de infraestrutura monitorados",
    "Conversões e comportamento dos usuários monitorados",
    "Logs e backups revisados, dependências e vulnerabilidades atualizadas",
    "Manutenção preventiva feita, novas demandas registradas, próximas versões planejadas",
  ],
];

const PHASE_ITEMS_BY_TYPE: Record<ProjectChecklistType, string[][]> = {
  INSTITUTIONAL: INSTITUTIONAL_PHASE_ITEMS,
  SYSTEM: SYSTEM_PHASE_ITEMS,
};

export function getPhaseChecklistItems(type: ProjectChecklistType, phaseNumber: number): string[] {
  return PHASE_ITEMS_BY_TYPE[type][phaseNumber - 1] ?? [];
}
