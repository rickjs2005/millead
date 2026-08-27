/** Fábrica central de query keys -- evita string mágica duplicada entre hooks e invalidações cruzadas. */
export const queryKeys = {
  me: () => ["me"] as const,
  audits: {
    list: (params: object) => ["audits", "list", params] as const,
    detail: (id: string) => ["audits", "detail", id] as const,
  },
  ai: {
    status: () => ["ai", "status"] as const,
  },
  vault: {
    status: () => ["vault", "status"] as const,
    session: () => ["vault", "session"] as const,
    accounts: (includeInactive: boolean) => ["vault", "accounts", includeInactive] as const,
    cards: (includeInactive: boolean) => ["vault", "cards", includeInactive] as const,
    categories: (includeInactive: boolean) => ["vault", "categories", includeInactive] as const,
    merchants: (includeInactive: boolean) => ["vault", "merchants", includeInactive] as const,
    transactions: (filters: object) => ["vault", "transactions", filters] as const,
    statements: (cardId?: string) => ["vault", "statements", cardId ?? null] as const,
    imports: () => ["vault", "imports"] as const,
    importProfiles: () => ["vault", "import-profiles"] as const,
    rules: (includeInactive: boolean) => ["vault", "rules", includeInactive] as const,
    subscriptions: (status?: string) => ["vault", "subscriptions", status ?? null] as const,
    alerts: () => ["vault", "alerts"] as const,
    alertCount: () => ["vault", "alert-count"] as const,
    contacts: (includeInactive: boolean) => ["vault", "contacts", includeInactive] as const,
    debts: (filters: object) => ["vault", "debts", filters] as const,
    debtSummary: () => ["vault", "debt-summary"] as const,
    bridge: (filters: object) => ["vault", "bridge", filters] as const,
    bridgePlans: () => ["vault", "bridge-plans"] as const,
  },
  settings: {
    integrations: () => ["settings", "integrations"] as const,
    postSaleAutomation: () => ["settings", "post-sale-automation"] as const,
  },
  postSale: {
    execution: (contractId: string) => ["post-sale", "execution", contractId] as const,
    pending: () => ["post-sale", "pending"] as const,
  },
  messages: {
    list: (params: object) => ["messages", "list", params] as const,
    templates: () => ["messages", "templates"] as const,
  },
  contracts: {
    list: (params: object) => ["contracts", "list", params] as const,
    detail: (id: string) => ["contracts", "detail", id] as const,
    kpis: () => ["contracts", "kpis"] as const,
  },
  companies: {
    list: (params: object) => ["companies", "list", params] as const,
    detail: (id: string) => ["companies", "detail", id] as const,
  },
  leads: {
    list: (params: object) => ["leads", "list", params] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
    activities: (id: string) => ["leads", "activities", id] as const,
  },
  pipelines: {
    list: () => ["pipelines", "list"] as const,
    detail: (id: string) => ["pipelines", "detail", id] as const,
  },
  tags: {
    list: () => ["tags", "list"] as const,
  },
  tasks: {
    list: (params: object) => ["tasks", "list", params] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  meetings: {
    list: (params: object) => ["meetings", "list", params] as const,
    detail: (id: string) => ["meetings", "detail", id] as const,
  },
  proposals: {
    list: (params: object) => ["proposals", "list", params] as const,
    detail: (id: string) => ["proposals", "detail", id] as const,
  },
  briefings: {
    list: (params: object) => ["briefings", "list", params] as const,
    detail: (id: string) => ["briefings", "detail", id] as const,
    templates: () => ["briefings", "templates"] as const,
    template: (key: string) => ["briefings", "template", key] as const,
  },
  costs: {
    list: () => ["costs", "list"] as const,
    catalog: () => ["costs", "catalog"] as const,
    settings: () => ["costs", "settings"] as const,
    summary: () => ["costs", "summary"] as const,
    usage: (month: string) => ["costs", "usage", month] as const,
    usageSummary: (month: string) => ["costs", "usageSummary", month] as const,
    usageSeries: (months?: number) => ["costs", "usageSeries", months ?? "default"] as const,
  },
  estimates: {
    list: (params: object) => ["estimates", "list", params] as const,
    detail: (id: string) => ["estimates", "detail", id] as const,
    products: () => ["estimates", "products"] as const,
  },
  milsocial: {
    posts: () => ["milsocial", "posts"] as const,
    comparison: () => ["milsocial", "comparison"] as const,
    series: (postId: string) => ["milsocial", "series", postId] as const,
  },
  receivables: {
    all: () => ["receivables"] as const,
    byContract: (contractId: string) => ["receivables", "byContract", contractId] as const,
    contracts: () => ["receivables", "contracts"] as const,
    summary: (month?: string) => ["receivables", "summary", month ?? "current"] as const,
    series: (months?: number) => ["receivables", "series", months ?? "default"] as const,
    margin: (contractId: string) => ["receivables", "margin", contractId] as const,
    standalone: () => ["receivables", "standalone"] as const,
  },
  projectChecklists: {
    list: () => ["project-checklists", "list"] as const,
    detail: (id: string) => ["project-checklists", "detail", id] as const,
  },
};
