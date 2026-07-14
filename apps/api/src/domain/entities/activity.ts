import type { ActivityType } from "@millead/database";

export interface Activity {
  id: string;
  organizationId: string;
  leadId: string | null;
  userId: string | null;
  type: ActivityType;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface NewActivity {
  organizationId: string;
  leadId: string | null;
  userId: string | null;
  type: ActivityType;
  payload?: Record<string, unknown> | null;
}
