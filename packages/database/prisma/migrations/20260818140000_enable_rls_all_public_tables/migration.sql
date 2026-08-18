-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
--
-- Alerta do Supabase Advisor em 17/08/2026 (rls_disabled_in_public,
-- sensitive_columns_exposed): só as tabelas do módulo Financeiro tinham RLS
-- habilitado (migrations de 31/07/2026); toda tabela criada antes ou depois
-- disso ficou sem RLS, incluindo receivables e SocialConfig (que guarda o
-- access token do Instagram). Este bloco fecha o gap habilitando RLS em toda
-- tabela do schema public que ainda não tiver. É idempotente: tabelas que já
-- têm RLS (ex.: cost_subscriptions) são ignoradas pelo filtro rowsecurity = false.
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
