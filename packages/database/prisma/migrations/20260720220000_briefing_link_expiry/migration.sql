-- Link público de briefing passa a expirar (24h após a criação, setado pela
-- aplicação). NULL = sem expiração -- links antigos continuam válidos.
ALTER TABLE "briefing_links" ADD COLUMN "expires_at" TIMESTAMP(3);
