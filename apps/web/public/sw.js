/**
 * Service worker mínimo -- o suficiente pra o app ser "instalável" (Chrome
 * exige um SW com handler de fetch). NÃO faz cache offline de dados do CRM
 * de propósito: o MilLead consome uma API autenticada e cachear respostas
 * poderia mostrar dado velho ou vazar entre sessões. Só deixa a rede passar.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // passthrough: deixa o navegador cuidar da requisição normalmente.
});
