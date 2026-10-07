import { NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  cacheId: "segundo-cerebro-public-shell",
  precacheEntries: self.__SW_MANIFEST,
  // Updates wait until old windows close, avoiding mixed-version application assets.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [{
    matcher: ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin,
    handler: new NetworkOnly(),
  }],
  fallbacks: { entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }] },
});

// No API, RSC payload, signed URL or personal page is written to a runtime cache.
serwist.addEventListeners();
