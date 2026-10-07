import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";
import withSerwistInit from "@serwist/next";
import pwaAssets from "./design-system/pwa-assets.json";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: false,
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    { url: "/offline", revision: randomUUID() },
    ...pwaAssets.assets.map(({ path, sha256 }) => ({ url: path.replace(/^public/, ""), revision: sha256 })),
  ],
  // The offline document and immutable public shell are the only cached data.
  // Do not inherit the broad defaultCache policy when identity is introduced.
  manifestTransforms: [async (entries) => ({
    manifest: entries.filter(({ url }) => url === "/offline" || url.startsWith("/_next/static/") || url.startsWith("/icons/") || url.startsWith("/splash/")),
    warnings: [],
  })],
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }];
  },
};

export default withSerwist(nextConfig);
