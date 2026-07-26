-- Remove o módulo dormente de geração de landing page por IA (Fase 8).
-- O diretor criativo o substituiu: ele não persiste nada, então a tabela
-- ficou sem leitor. Conferido antes de dropar: 0 linhas, 0 publicadas.

-- DropTable
DROP TABLE "landing_pages";

-- DropEnum
DROP TYPE "landing_page_kind";

-- DropEnum
DROP TYPE "landing_page_status";
