/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
if (typeof window === "undefined") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener("message", (e) => {
    if (e.data === "deregister") {
      self.registration.unregister().then(() => {
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
      });
    }
  });
  self.addEventListener("fetch", function(e) {
    if (e.request.cache === "only-if-cached" && e.request.mode !== "same-origin") return;
    e.respondWith(fetch(e.request).then((r) => {
      if (r.status === 0) return r;
      const headers = new Headers(r.headers);
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
    }).catch((e) => console.error(e)));
  });
} else {
  (() => {
    const scriptURL = window.document.currentScript ? window.document.currentScript.src : "";
    const version = "2026-05-25-01";
    const reloadKey = `coiReloadCount:${version}:${scriptURL}`;
    const controllerReloadKey = `coiControllerReloaded:${version}:${scriptURL}`;

    if (window.crossOriginIsolated) {
      window.sessionStorage.removeItem(reloadKey);
      window.sessionStorage.removeItem(controllerReloadKey);
      return;
    }
    if (!("serviceWorker" in navigator)) {
      console.warn("[COI] Service Worker is unavailable; WebAssembly threads will be disabled.");
      return;
    }

    const reloadForIsolation = () => {
      const count = parseInt(window.sessionStorage.getItem(reloadKey) || "0", 10);
      if (count >= 3) {
        console.warn("[COI] Cross-origin isolation did not become active after retries.");
        return;
      }
      window.sessionStorage.setItem(reloadKey, String(count + 1));
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (window.crossOriginIsolated) return;
      if (window.sessionStorage.getItem(controllerReloadKey) === "1") return;
      window.sessionStorage.setItem(controllerReloadKey, "1");
      window.location.reload();
    });

    const scopeURL = new URL("./", scriptURL).href;
    window.navigator.serviceWorker.register(scriptURL, { scope: scopeURL }).then((registration) => {
      console.log("[COI] Service Worker registered for cross-origin isolation.");
      registration.update().catch((err) => console.warn("[COI] Service Worker update failed:", err));
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reloadForIsolation);
        return;
      }
      if (!window.crossOriginIsolated) reloadForIsolation();

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "activated" && !window.crossOriginIsolated) reloadForIsolation();
        });
      });
    }, (err) => console.error("[COI] Service Worker register error:", err));
  })();
}
