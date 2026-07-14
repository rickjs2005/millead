/**
 * Entrypoint único do processo de workers -- importa cada worker pra
 * registrá-lo na mesma instância Node. Adicionar worker novo (Fase 7
 * mensagens etc.) = adicionar um import aqui.
 */
import "./ping.worker.js";
import "./audit.worker.js";
import "./landing-page.worker.js";
