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

/* ===== Web Push =====
 * O payload vem da API (title/body/url). Clique foca uma janela já aberta
 * do app (navegando pra rota) ou abre uma nova. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MilLead", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "MilLead", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ("focus" in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
