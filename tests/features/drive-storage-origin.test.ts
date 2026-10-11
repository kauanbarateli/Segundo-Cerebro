import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
const create = vi.hoisted(() => vi.fn(() => ({ rpc: vi.fn() })));
vi.mock("../../src/lib/auth/clients", () => ({ createPrivilegedClient: create }));
import { filesServicesForRequest } from "../../src/adapters/db/files-runtime";
import { resolveStorageOrigin } from "../../src/lib/files/storage-origin-server";
import { LOCAL_STORAGE_ORIGIN, PERSONAL_STORAGE_ORIGIN } from "../../src/lib/files/storage-origin";

const local = { supabaseUrl: LOCAL_STORAGE_ORIGIN, appOrigin: "http://127.0.0.1:3117" };
const ci = { NODE_ENV: "development", APP_MODE: "supabase", APP_URL: local.appOrigin, SUPABASE_URL: local.supabaseUrl, CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", SC_FILES_LOCAL_CI_RUN: "1" };
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Origem de Storage resolvida somente no servidor", () => {
  it("mantém o projeto pessoal em produção e recusa qualquer outro destino hospedado", () => {
    expect(resolveStorageOrigin({ ...local, supabaseUrl: PERSONAL_STORAGE_ORIGIN }, { NODE_ENV: "production" }, "win32")).toBe(PERSONAL_STORAGE_ORIGIN);
    for (const supabaseUrl of ["https://foreign.supabase.co", "http://localhost:54321", "http://2130706433:54321", PERSONAL_STORAGE_ORIGIN + "/", PERSONAL_STORAGE_ORIGIN + "?token=ignored"]) expect(resolveStorageOrigin({ ...local, supabaseUrl }, ci, "linux")).toBeUndefined();
  });
  it("qualifica apenas loopback literal em Linux CI isolado com os dois opt-ins", () => {
    expect(resolveStorageOrigin(local, ci, "linux")).toBe(LOCAL_STORAGE_ORIGIN);
    expect(resolveStorageOrigin(local, ci, "win32")).toBeUndefined();
    for (const field of ["CI", "GITHUB_ACTIONS", "SC_AUTH_LOCAL_CI_RUN", "SC_FILES_LOCAL_CI_RUN"]) expect(resolveStorageOrigin(local, { ...ci, [field]: undefined }, "linux")).toBeUndefined();
    expect(resolveStorageOrigin(local, { ...ci, NODE_ENV: "production" }, "linux")).toBeUndefined();
    expect(resolveStorageOrigin(local, { ...ci, APP_URL: "http://127.0.0.1:3118" }, "linux")).toBeUndefined();
    expect(resolveStorageOrigin({ ...local, appOrigin: "http://localhost:3117" }, ci, "linux")).toBeUndefined();
  });
  it("recusa ambiente misturado com credenciais/conexões externas", () => {
    for (const field of ["VERCEL", "GOOGLE_CLIENT_ID", "DATABASE_URL", "PGHOST", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "GH_TOKEN", "GITHUB_TOKEN", "NEXT_PUBLIC_SUPABASE_URL"]) expect(resolveStorageOrigin(local, { ...ci, [field]: "CANARY_FOREIGN" }, "linux")).toBeUndefined();
  });
  it("preserva páginas de Auth sem opt-in de arquivos e recusa a factory antes do SDK", () => {
    expect(resolveStorageOrigin(local, { ...ci, SC_FILES_LOCAL_CI_RUN: undefined }, "linux")).toBeUndefined();
    for (const key of Object.keys(ci)) vi.stubEnv(key, "");
    expect(() => filesServicesForRequest(local as never, { userId: "fixture", sessionId: "fixture" } as never)).toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("o módulo público não carrega resolvedor, SDK, ambiente ou segredo do servidor", async () => {
    const publicSource = await readFile(new URL("../../src/lib/files/storage-origin.ts", import.meta.url), "utf8"), uploader = await readFile(new URL("../../src/components/layout/file-upload.ts", import.meta.url), "utf8"), provider = await readFile(new URL("../../src/lib/demo/demo-provider.tsx", import.meta.url), "utf8");
    expect(publicSource).not.toMatch(/server-only|node:|process\.env|SUPABASE_SECRET_KEY|createPrivilegedClient|@supabase/);
    expect(uploader).not.toMatch(/storage-origin-server|SUPABASE_SECRET_KEY|createPrivilegedClient|@supabase/);
    expect(provider).not.toMatch(/storage-origin-server|SUPABASE_SECRET_KEY|createPrivilegedClient|@supabase/);
  });
});
