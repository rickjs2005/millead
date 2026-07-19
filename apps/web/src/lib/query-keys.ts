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
  settings: {
    integrations: () => ["settings", "integrations"] as const,
  },
  messages: {
    list: (params: object) => ["messages", "list", params] as const,
    templates: () => ["messages", "templates"] as const,
  },
  landingPages: {
    list: (params: object) => ["landing-pages", "list", params] as const,
    detail: (id: string) => ["landing-pages", "detail", id] as const,
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
};
