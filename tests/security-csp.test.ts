import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applySecurityHeaders, contentSecurityPolicy, createNonce, themeScriptHash } from "../src/lib/security/csp";
import { THEME_INIT_SCRIPT } from "../src/lib/theme";

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
});
