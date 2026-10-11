import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { applySecurityHeaders, contentSecurityPolicy, createNonce, cspStorageOrigin, cspStorageOriginForRequest, themeScriptHash } from "../src/lib/security/csp";
import { THEME_INIT_SCRIPT } from "../src/lib/theme";
import { LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN } from "../src/lib/files/storage-origin";

const localApp = "http://127.0.0.1:3117";
const filesCi = { NODE_ENV: "development", APP_MODE: "supabase", APP_URL: localApp, SUPABASE_URL: LOCAL_STORAGE_ORIGIN, CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", SC_FILES_LOCAL_CI_RUN: "1" };

// Config evaluation only: do not start Serwist, Next or a build in these tests.
vi.mock("@serwist/next", () => ({ default: () => (config: unknown) => config }));

async function middlewareNormalization(environment: Record<string, string | undefined>, platform: NodeJS.Platform) {
  const originalEnvironment = process.env, originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
  process.env = { NODE_ENV: "test", ...environment };
  Object.defineProperty(process, "platform", { ...originalPlatform, value: platform });
  try {
    vi.resetModules();
    return (await import("../next.config")).default.skipMiddlewareUrlNormalize;
  } finally {
    process.env = originalEnvironment;
    Object.defineProperty(process, "platform", originalPlatform);
  }
}

describe("política de conteúdo em bloqueio", () => {
  it("gera nonces independentes de 128 bits e recusa texto injetado", async () => {
    const a = createNonce(), b = createNonce();
    expect(Buffer.from(a, "base64")).toHaveLength(16);
    expect(a).not.toBe(b);
    await expect(contentSecurityPolicy("'; script-src *")).rejects.toThrow();
  });

  it("liga a política aos bytes reais do inicializador de tema", async () => {
    const expected = `sha256-${createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")}`;
    expect(await themeScriptHash()).toBe(expected);
    const policy = await contentSecurityPolicy(createNonce(), { https: true });
    const script = policy.split("; ").find((part) => part.startsWith("script-src "))!;
    expect(script).toContain(`'${expected}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'|https:\/\/\*/);
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("mantém eval somente no desenvolvimento e bloqueia enquadramento", async () => {
    const nonce = createNonce();
    expect(await contentSecurityPolicy(nonce, { development: true })).toContain("'unsafe-eval'");
    const headers = new Headers({ "Content-Security-Policy-Report-Only": "default-src *" });
    applySecurityHeaders(headers, await contentSecurityPolicy(nonce), false);
    expect(headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("permite somente o path Storage literal na aplicação CI de arquivos qualificada", async () => {
    expect(cspStorageOrigin(localApp, filesCi)).toBe(LOCAL_STORAGE_ORIGIN);
    const policy = await contentSecurityPolicy(createNonce(), { development: true, storageOrigin: cspStorageOrigin(localApp, filesCi) });
    for (const directive of ["img-src", "connect-src"]) {
      const value = policy.split("; ").find((part) => part.startsWith(directive + " "))!;
      expect(value).toContain(LOCAL_STORAGE_ORIGIN + "/storage/v1/");
      expect(value).not.toContain(PERSONAL_STORAGE_ORIGIN);
      expect(value.split(" ")).not.toContain("http:");
    }
  });

  it("mantém a origem pessoal quando falta um opt-in, a origem diverge ou há ambiente externo", async () => {
    for (const field of Object.keys(filesCi)) expect(cspStorageOrigin(localApp, { ...filesCi, [field]: undefined })).toBe(PERSONAL_STORAGE_ORIGIN);
    for (const origin of ["http://localhost:3117", "http://127.0.0.1:3118", "https://127.0.0.1:3117", "https://segundo-cerebro-of.vercel.app"]) expect(cspStorageOrigin(origin, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
    for (const field of ["VERCEL", "GOOGLE_CLIENT_ID", "DATABASE_URL", "PGHOST", "SUPABASE_ACCESS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "NEXT_PUBLIC_SUPABASE_URL"]) expect(cspStorageOrigin(localApp, { ...filesCi, [field]: "FOREIGN_CANARY" })).toBe(PERSONAL_STORAGE_ORIGIN);
    expect(cspStorageOrigin(localApp, { ...filesCi, NODE_ENV: "production" })).toBe(PERSONAL_STORAGE_ORIGIN);
    const production = await contentSecurityPolicy(createNonce(), { https: true });
    expect(production).toContain(PERSONAL_STORAGE_ORIGIN + "/storage/v1/");
    expect(production).not.toContain(LOCAL_STORAGE_ORIGIN);
  });

  it("recusa origem arbitrária e loopback em política de produção ou HTTPS", async () => {
    await expect(contentSecurityPolicy(createNonce(), { storageOrigin: "https://foreign.invalid" as never })).rejects.toThrow();
    await expect(contentSecurityPolicy(createNonce(), { storageOrigin: LOCAL_STORAGE_ORIGIN })).rejects.toThrow();
    await expect(contentSecurityPolicy(createNonce(), { development: true, https: true, storageOrigin: LOCAL_STORAGE_ORIGIN })).rejects.toThrow();
  });

  it("usa a URL Web original do NextRequest real sem autorizar a origem normalizada", async () => {
    const request = new NextRequest(localApp + "/drive");
    expect(request.nextUrl.origin).toBe("http://localhost:3117");
    expect(cspStorageOrigin(request.nextUrl.origin, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
    expect(cspStorageOriginForRequest(request, filesCi)).toBe(LOCAL_STORAGE_ORIGIN);
    const policy = await contentSecurityPolicy(createNonce(), { development: true, storageOrigin: cspStorageOriginForRequest(request, filesCi) });
    expect(policy).toContain("connect-src 'self' " + LOCAL_STORAGE_ORIGIN + "/storage/v1/");
    expect(policy).not.toContain(PERSONAL_STORAGE_ORIGIN);
  });

  it("preserva a URL no adapter Next somente no Linux CI de arquivos qualificado", async () => {
    expect(await middlewareNormalization(filesCi, "linux")).toBe(true);
    for (const platform of ["win32", "darwin"] as const) expect(await middlewareNormalization(filesCi, platform)).toBe(false);
    for (const field of Object.keys(filesCi)) expect(await middlewareNormalization({ ...filesCi, [field]: undefined }, "linux")).toBe(false);
    for (const patch of [{ NODE_ENV: "production" }, { APP_URL: "http://localhost:3117" }, { SUPABASE_URL: PERSONAL_STORAGE_ORIGIN }, { APP_URL: "https://segundo-cerebro-of.vercel.app" }, { VERCEL: "1" }, { GITHUB_TOKEN: "FOREIGN_CANARY" }]) expect(await middlewareNormalization({ ...filesCi, ...patch }, "linux")).toBe(false);
  });

  it("mantém os gates de ambiente e ignora headers de origem forjados", () => {
    const request = new NextRequest(localApp + "/drive");
    for (const field of Object.keys(filesCi)) expect(cspStorageOriginForRequest(request, { ...filesCi, [field]: undefined })).toBe(PERSONAL_STORAGE_ORIGIN);
    expect(cspStorageOriginForRequest(request, { ...filesCi, NODE_ENV: "production" })).toBe(PERSONAL_STORAGE_ORIGIN);
    for (const origin of ["http://localhost:3117", "http://127.0.0.1:3118", "https://127.0.0.1:3117", "https://segundo-cerebro-of.vercel.app", "https://foreign.invalid"]) {
      const spoofed = new NextRequest(origin + "/drive", { headers: { host: "127.0.0.1:3117", "x-forwarded-host": "127.0.0.1:3117", "x-forwarded-proto": "http", origin: localApp } });
      expect(cspStorageOriginForRequest(spoofed, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
    }
    for (const field of ["VERCEL", "GOOGLE_CLIENT_ID", "DATABASE_URL", "PGHOST", "SUPABASE_ACCESS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "NEXT_PUBLIC_SUPABASE_URL"]) expect(cspStorageOriginForRequest(request, { ...filesCi, [field]: "FOREIGN_CANARY" })).toBe(PERSONAL_STORAGE_ORIGIN);
  });

  it("resolve o getter herdado do Request Edge real e mantém sua verificação de marca", () => {
    const EdgeRequest = createRequire(import.meta.url)("next/dist/compiled/@edge-runtime/primitives/fetch").Request as typeof Request;
    class SandboxRequest extends EdgeRequest {}
    expect(Object.getOwnPropertyDescriptor(EdgeRequest.prototype, "url")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(SandboxRequest.prototype, "url")).toBeUndefined();
    const request = new SandboxRequest(localApp + "/drive");
    vi.stubGlobal("Request", SandboxRequest);
    try {
      expect(cspStorageOriginForRequest(request, filesCi)).toBe(LOCAL_STORAGE_ORIGIN);
      expect(cspStorageOriginForRequest(new SandboxRequest("http://localhost:3117/drive"), filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
      let reads = 0;
      const forged = { get url() { reads++; return localApp + "/drive"; } } as Request;
      expect(cspStorageOriginForRequest(forged, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
      expect(reads).toBe(0);
    } finally { vi.unstubAllGlobals(); }
  });

  it("falha para origem pessoal sem consultar propriedades ou getters da requisição", () => {
    let reads = 0;
    const forged = Object.create(null);
    for (const name of ["url", "nextUrl", "headers"]) Object.defineProperty(forged, name, { get() { reads++; throw new Error("PRIVATE_CANARY"); } });
    expect(cspStorageOriginForRequest(forged, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN);
    expect(reads).toBe(0);
    const request = new NextRequest(localApp + "/drive");
    const getter = vi.spyOn(Request.prototype, "url", "get").mockImplementation(() => { throw new Error("PRIVATE_CANARY"); });
    try { expect(cspStorageOriginForRequest(request, filesCi)).toBe(PERSONAL_STORAGE_ORIGIN); }
    finally { getter.mockRestore(); }
  });
});
