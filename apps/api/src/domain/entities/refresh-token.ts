export interface RefreshToken {
  id: string;
  userId: string;
  organizationId: string | null;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

export interface NewRefreshToken {
  userId: string;
  organizationId: string | null;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}
