/** Local composition, not hosted Auth/Storage, PostgREST or a mounted browser.
 * The canonical SQL computes usage; the real SDK/runtime/Store/GET/client carry
 * it to the real Drive/ProgressBar markup. HTTP, Auth identity and hook state
 * are explicit seams. No object bytes or component effects are executed.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { Arquivo, DriveDTO, SnapshotDrive } from "../../src/core/drive";
import { beginPrivacyRender, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";

const seams = vi.hoisted(() => ({ rendering: false, hooks: null as unknown as PrivacyHooks,
  params: new URLSearchParams(), userId: "", config: null as unknown as SupabaseAuthConfig,
  actor: null as unknown as AuthenticatedIdentity, executeDomainCommand: vi.fn(), replace: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: () => seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: async () => seams.actor } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: seams.replace }), useSearchParams: () => seams.params }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../src/lib/demo/demo-provider", () => ({ useDemoApplication: () => ({ userId: seams.userId, executeDomainCommand: seams.executeDomainCommand }) }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react,
    useState: ((...args: Parameters<ReturnType<typeof privacyHookMocks>["useState"]>) => seams.rendering ? privacyHookMocks(seams.hooks).useState(...args) : react.useState(...args)) as typeof react.useState,
    useRef: ((...args: Parameters<ReturnType<typeof privacyHookMocks>["useRef"]>) => seams.rendering ? privacyHookMocks(seams.hooks).useRef(...args) : react.useRef(...args)) as typeof react.useRef,
    useMemo: ((...args: Parameters<typeof react.useMemo>) => seams.rendering ? privacyHookMocks(seams.hooks).useMemo(...args) : react.useMemo(...args)) as typeof react.useMemo,
    useCallback: ((...args: Parameters<typeof react.useCallback>) => seams.rendering ? privacyHookMocks(seams.hooks).useCallback(...args) : react.useCallback(...args)) as typeof react.useCallback,
    useEffect: ((...args: Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>) => seams.rendering ? privacyHookMocks(seams.hooks).useEffect(...args) : react.useEffect(...args)) as typeof react.useEffect,
  };
});
import { GET } from "../../src/app/api/files/route";
import { createDriveClient } from "../../src/components/features/drive/drive-client";
import { ConnectedDriveWorkspace } from "../../src/components/features/drive/drive-connected-workspace";

const root = fileURLToPath(new URL("../../", import.meta.url));
const owner = "39000000-0000-4000-8000-000000000001", foreign = "39000000-0000-4000-8000-000000000002";
const session = "39000000-0000-4000-8000-000000000003", batch = "39000000-0000-4000-8000-000000000004";
const now = "2026-10-10T12:00:00Z", capacity = 65536;
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  // Reuse the existing loader's DECLARATIVE infrastructure fixture. Do not
  // import its top-level runner, evaluate JS, copy DDL or extract SQL functions.
  const loader = (await readFile(resolve(root, "scripts/test-local-sql.mjs"), "utf8")).replaceAll("\r\n", "\n");
  const start = "  await db.exec(`\n", end = "\n  `);\n  const files =";
  const begin = loader.indexOf(start), finish = loader.indexOf(end, begin);
  if (begin < 0 || finish < 0 || loader.indexOf(start, begin + start.length) !== -1 || loader.indexOf(end, finish + end.length) !== -1) throw new Error("Local SQL bootstrap boundary changed; inspect the canonical loader.");
  const bootstrap = loader.slice(begin + start.length, finish);
  if (bootstrap.includes("${") || bootstrap.includes("`") || bootstrap.includes("\\")) throw new Error("Only literal, unescaped SQL bootstrap is supported; JS is never executed.");
  await db.exec(bootstrap);
  const migrations = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  for (const file of migrations) await db.exec(await readFile(resolve(root, "supabase/migrations", file), "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });
afterEach(() => { seams.rendering = false; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function fixture(id: number, kind: Arquivo["kind"], bytes: number, name: string, userId = owner, trash = false): Arquivo {
  return { id: `39000000-0000-4000-8000-${String(id).padStart(12, "0")}`, user_id: userId, kind, folder_id: null,
    name, mime: kind === "drive" ? "text/plain" : "image/png", bytes, sha256: "a".repeat(64),
    width: kind === "drive" ? null : 20, height: kind === "drive" ? null : 20, starred: false,
    deleted_at: trash ? now : null, deletion_batch_id: trash ? batch : null,
    created_at: now, updated_at: now, modified_at: now };
}
function renderUsage(dto: DriveDTO, trash: boolean) {
  // Seed only the parent state. Real children (including ProgressBar/useId)
  // use React's SSR hooks. Queued parent effects are deliberately never flushed.
  seams.params = new URLSearchParams(trash ? "view=trash" : "");
  seams.hooks = { states: [dto, false], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 };
  beginPrivacyRender(seams.hooks); seams.rendering = true;
  let tree: ReturnType<typeof ConnectedDriveWorkspace>;
  try { tree = ConnectedDriveWorkspace(); } finally { seams.rendering = false; }
  return renderToStaticMarkup(tree);
}

it("carries SQL SUM for all owner bytes, including trash and hidden image/avatar metadata, through GET/client to visible and ARIA usage", async () => {
  seams.userId = owner;
  seams.actor = { userId: owner, sessionId: session, role: "user", mustChangePassword: false, entitlements: {} };
  seams.config = { mode: "supabase", appOrigin: "https://example.invalid", supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co",
    publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
  vi.stubEnv("DRIVE_QUOTA_BYTES", String(capacity));
  vi.stubEnv("DRIVE_MAX_FILE_BYTES", "26214400");
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','usage-owner@example.invalid'),($2,'authenticated','authenticated','usage-foreign@example.invalid')", [owner, foreign]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session, owner]);
  const live = fixture(20, "drive", 1024, "Live.txt"), trash = fixture(21, "drive", 2048, "Trash.txt", owner, true);
  const image = fixture(22, "capture_image", 4096, "PRIVATE_CAPTURE_IMAGE.png"), avatar = fixture(23, "avatar", 8192, "PRIVATE_AVATAR.png");
  const foreignFile = fixture(24, "drive", 32768, "FOREIGN_FILE.txt", foreign), purged = fixture(25, "drive", 65536, "PURGED_FILE.txt", owner, true);
  for (const file of [live, trash, image, avatar, foreignFile, purged]) {
    // Metadata fixture inserted as local postgres. Neither upload completion nor
    // Storage purge acknowledgement is exercised or certified by these rows.
    await db.query("insert into public.drive_files(id,user_id,payload,storage_path,purged_at) values ($1,$2,$3::jsonb,$4,$5::timestamptz)",
      [file.id, file.user_id, JSON.stringify(file), `${file.user_id}/${file.id}`, file === purged ? now : null]);
  }
  let snapshot: SnapshotDrive | undefined, responseDTO: unknown;
  const rpc = vi.fn<typeof fetch>(async (input, options) => {
    if (String(input) !== `${seams.config.supabaseUrl}/rest/v1/rpc/drive_snapshot`) throw new Error("No other transport or network target is permitted.");
    expect(options?.method).toBe("POST"); expect(options?.cache).toBe("no-store");
    const args: unknown = JSON.parse(String(options?.body));
    expect(args).toEqual({ p_user: owner, p_session: session, p_operation: "read.drive", p_quota: capacity, p_max_bytes: 26214400 });
    const reply = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ snapshot: SnapshotDrive }>("select public.drive_snapshot($1::uuid,$2::uuid,$3::text,$4::bigint,$5::bigint) as snapshot", [owner, session, "read.drive", capacity, 26214400]);
    });
    snapshot = reply.rows[0]!.snapshot;
    return Response.json(snapshot);
  });
  vi.stubGlobal("fetch", rpc);
  const channel = vi.fn<typeof fetch>(async (input, options) => {
    expect(input).toBe("/api/files"); expect(options?.credentials).toBe("same-origin"); expect(options?.cache).toBe("no-store");
    const response = await GET(new Request(`${seams.config.appOrigin}/api/files`, { headers: options?.headers }));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    responseDTO = await response.clone().json(); return response;
  });
  const dto = await createDriveClient(owner, channel).load();
  // Explicit independently known sum: 1 KiB live + 2 KiB trash + 4 KiB
  // capture image + 8 KiB avatar; foreign 32 KiB and purged 64 KiB excluded.
  expect(snapshot?.usage_bytes).toBe(15360);
  expect(snapshot?.files.map(file => file.id)).toEqual([live.id, trash.id, image.id, avatar.id]);
  expect(dto.usage_bytes).toBe(15360); expect(dto.capacity_bytes).toBe(capacity);
  expect(dto.files).toEqual([live, trash]);
  expect(Object.keys(responseDTO as DriveDTO).sort()).toEqual(["capacity_bytes", "files", "folders", "max_file_bytes", "projects", "usage_bytes"]);
  expect(JSON.stringify(responseDTO)).not.toMatch(/PRIVATE_CAPTURE_IMAGE|PRIVATE_AVATAR|FOREIGN_FILE|PURGED_FILE|storage_path|receipts/);
  expect(rpc).toHaveBeenCalledTimes(1); expect(channel).toHaveBeenCalledTimes(1);
  for (const view of [false, true]) {
    const markup = renderUsage(dto, view);
    expect(markup).toContain("<strong>15 KB</strong> de 64 KB");
    expect(markup).toContain("Inclui arquivos, lixeira, anexos das capturas e avatar.");
    const progress = markup.match(/<div[^>]*role="progressbar"[^>]*>/)?.[0];
    expect(progress).toBeDefined();
    expect(progress).toContain('aria-valuemin="0"'); expect(progress).toContain('aria-valuemax="65536"');
    expect(progress).toContain('aria-valuenow="15360"'); expect(progress).toContain('aria-valuetext="15 KB de 64 KB"');
    const label = progress!.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(label).toBeTruthy(); expect(markup).toContain(`<span id="${label}">Espaço usado</span>`);
    expect(markup).toContain("transform:scaleX(0.234375)");
    expect(markup).toContain(view ? trash.name : live.name); expect(markup).not.toContain(view ? live.name : trash.name);
    expect(markup).not.toMatch(/PRIVATE_CAPTURE_IMAGE|PRIVATE_AVATAR|FOREIGN_FILE|PURGED_FILE/);
  }
  // SSR seeding never ran the component's fetch effect or commands.
  expect(rpc).toHaveBeenCalledTimes(1); expect(seams.executeDomainCommand).not.toHaveBeenCalled();
});
