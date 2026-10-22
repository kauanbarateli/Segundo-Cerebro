import { isolatedApplicationOrigin, requiresIsolatedDestination, HOMOLOGATION_DATABASE_ORIGIN } from "../environment/application-destination";
import { THEME_INIT_SCRIPT } from "../theme";
import { isStorageOrigin, LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN, type StorageOrigin } from "../files/storage-origin";
import { isLocalFilesEnvironment, LOCAL_FILES_APP_ORIGIN } from "../files/storage-local-policy";

/** Request and environment must both bind to the disposable files CI app.
 * The Node Storage factory retains its independent Linux and credential gates. */
export function cspStorageOrigin(requestOrigin: string, environment: Readonly<Record<string, string | undefined>>): StorageOrigin | null {
  if (requiresIsolatedDestination(environment)) {
    const origin = isolatedApplicationOrigin(environment);
    return origin && requestOrigin === origin ? HOMOLOGATION_DATABASE_ORIGIN : null;
  }
  return requestOrigin === LOCAL_FILES_APP_ORIGIN && isLocalFilesEnvironment({ supabaseUrl: environment.SUPABASE_URL, appOrigin: environment.APP_URL }, environment)
    ? LOCAL_STORAGE_ORIGIN : PERSONAL_STORAGE_ORIGIN;
}

/** NextRequest.nextUrl normalizes loopback hosts. Read the original Web Request
 * URL instead; request properties and forwarded headers cannot select Storage. */
export function cspStorageOriginForRequest(request: Request, environment: Readonly<Record<string, string | undefined>>): StorageOrigin | null {
  const unavailable = () => requiresIsolatedDestination(environment) ? null : PERSONAL_STORAGE_ORIGIN;
  try {
    // Next's Edge runtime subclasses its Web Request. Resolve the getter only
    // along that trusted global constructor's chain, never along the input.
    let prototype: object | null = Request.prototype;
    while (prototype) {
      const getter = Object.getOwnPropertyDescriptor(prototype, "url")?.get;
      if (getter) {
        const value: unknown = getter.call(request);
        if (typeof value !== "string") return unavailable();
        return cspStorageOrigin(new URL(value).origin, environment);
      }
      prototype = Object.getPrototypeOf(prototype);
    }
    return unavailable();
  } catch { return unavailable(); }
}

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

export async function contentSecurityPolicy(nonce: string, options: { development?: boolean; https?: boolean; storageOrigin?: StorageOrigin | null } = {}): Promise<string> {
  if (!/^[A-Za-z0-9+/]{22}==$/.test(nonce)) throw new Error("Nonce inválido.");
  const storageOrigin = options.storageOrigin === undefined ? PERSONAL_STORAGE_ORIGIN : options.storageOrigin;
  if (storageOrigin !== null && (!isStorageOrigin(storageOrigin) || storageOrigin === LOCAL_STORAGE_ORIGIN && (!options.development || options.https))) throw new Error("Origem de Storage inválida.");
  // Argon2id compiles WebAssembly. JavaScript eval remains forbidden in production.
  const script = ["'self'", `'nonce-${nonce}'`, `'${await themeScriptHash()}'`, "'strict-dynamic'", "'wasm-unsafe-eval'"];
  if (options.development) script.push("'unsafe-eval'");
  return [
    "default-src 'none'",
    `script-src ${script.join(" ")}`,
    // Existing charts, popovers and progress indicators use inline style properties.
    // This style permission does not weaken script-src or permit event handlers.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigin ? " " + storageOrigin + "/storage/v1/" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${storageOrigin ? " " + storageOrigin + "/storage/v1/" : ""}${options.development ? " ws: wss:" : ""}`,
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
