import { THEME_INIT_SCRIPT } from "../theme";

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/** 128 random bits per network response; never trust a nonce supplied by a client. */
export function createNonce(): string {
  return base64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function themeScriptHash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(THEME_INIT_SCRIPT));
  return `sha256-${base64(new Uint8Array(digest))}`;
}

export async function contentSecurityPolicy(nonce: string, options: { development?: boolean; https?: boolean } = {}): Promise<string> {
  if (!/^[A-Za-z0-9+/]{22}==$/.test(nonce)) throw new Error("Nonce inválido.");
  const script = ["'self'", `'nonce-${nonce}'`, `'${await themeScriptHash()}'`, "'strict-dynamic'"];
  if (options.development) script.push("'unsafe-eval'");
  return [
    "default-src 'none'",
    `script-src ${script.join(" ")}`,
    // Existing charts, popovers and progress indicators use inline style properties.
    // This style permission does not weaken script-src or permit event handlers.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${options.development ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function applySecurityHeaders(headers: Headers, policy: string, https: boolean): void {
  headers.set("Content-Security-Policy", policy);
  headers.delete("Content-Security-Policy-Report-Only");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (https) headers.set("Strict-Transport-Security", "max-age=31536000");
}
