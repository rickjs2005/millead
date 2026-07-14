import type { MessageChannel } from "@millead/database";

/**
 * Contexto que a aplicação monta sobre um lead pra alimentar a IA --
 * dados já filtrados por organização (nunca montar isso com dados de
 * outro tenant).
 */
export interface LeadAiContext {
  lead: {
    title: string;
    status: string;
    stageName: string | null;
    value: string | null;
    currency: string;
    source: string;
    createdAt: Date;
    contacts: Array<{ name: string; role: string | null; email: string | null }>;
    tags: string[];
    recentNotes: string[];
  };
  company: {
    name: string;
    segment: string | null;
    sizeEstimate: string | null;
    city: string | null;
    state: string | null;
    websites: string[];
    socials: Array<{ platform: string; handleOrUrl: string }>;
    notes: string | null;
  } | null;
  audit: {
    summary: string | null;
    completedAt: Date | null;
    scores: Array<{ category: string; score: number }>;
  } | null;
  recentActivities: Array<{ type: string; createdAt: Date }>;
  organizationName: string;
}

export interface LeadScoreResult {
  /** 0-100 */
  score: number;
  rationale: string;
}

export interface MessageDraftInput {
  channel: MessageChannel;
  /** Instruções livres do usuário ("tom informal", "focar no site lento"...). */
  instructions?: string;
  /** Corpo de um template como ponto de partida, se o usuário escolheu um. */
  templateBody?: string;
}

export interface LeadAi {
  scoreLead(context: LeadAiContext): Promise<LeadScoreResult>;
  draftMessage(context: LeadAiContext, input: MessageDraftInput): Promise<string>;
  reportLead(context: LeadAiContext): Promise<string>;
}
