/**
 * Entrypoint único do processo de workers -- importa cada worker pra
 * registrá-lo na mesma instância Node. Adicionar worker novo (Fase 7
 * mensagens etc.) = adicionar um import aqui.
 */
// ping.worker (fila de exemplo) REMOVIDO em 21/07/2026: cada worker ocioso
// custa milhares de comandos Redis/dia no Upstash — um worker de demo
// ajudou a estourar a cota free e derrubar a API em produção.
import "./audit.worker.js";
import "./landing-page.worker.js";
import "./contract.worker.js";
import "./briefing.worker.js";
