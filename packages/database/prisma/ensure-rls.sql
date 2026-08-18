-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
--
-- Este script roda depois de todo "prisma migrate deploy" (ver script
-- migrate:deploy em packages/database/package.json) e garante RLS em toda
-- tabela do schema public, mesmo que a migration que criou a tabela tenha
-- esquecido o ALTER TABLE ... ENABLE ROW LEVEL SECURITY. É idempotente:
-- tabelas que já têm RLS habilitado são ignoradas.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', 'public', r.tablename);
  END LOOP;
END $$;
