import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applySecurityHeaders, contentSecurityPolicy, createNonce, cspStorageOrigin, themeScriptHash } from "../src/lib/security/csp";
import { THEME_INIT_SCRIPT } from "../src/lib/theme";
import { LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN } from "../src/lib/files/storage-origin";

const localApp = "http://127.0.0.1:3117";
const filesCi = { NODE_ENV: "development", APP_MODE: "supabase", APP_URL: localApp, SUPABASE_URL: LOCAL_STORAGE_ORIGIN, CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", SC_FILES_LOCAL_CI_RUN: "1" };

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
});
