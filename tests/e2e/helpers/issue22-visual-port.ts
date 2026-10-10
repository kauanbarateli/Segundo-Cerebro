/** Strict read-only Git VFS for the historical visual port comparison. No
 * checkout/worktree/fetch, current-source fallback, baseline update or browser
 * execution belongs here. The only fetch is the two pinned CI commits.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { dirname, posix, resolve } from "node:path";
import { rolldown } from "rolldown";
import { compile } from "tailwindcss";
import { Scanner } from "@tailwindcss/oxide";
import type { Page } from "@playwright/test";
import { createLocalCanonicalSql } from "../../helpers/local-canonical-sql";
import type { CaptureTaskOperation, CaptureTaskRpc } from "../../../src/adapters/db/capture-task-gateway";
import type { Captura } from "../../../src/core/capturas";
import type { Tarefa, CamposTarefa } from "../../../src/core/tarefas";
import type { Categoria, Projeto } from "../../../src/core/contracts";

export const VISUAL_REFS = { B: "69025764c00eee56fe56b3b3907cec70487c2bb2", P: "053db2fc6ddc1da2439c6d0a15970167fc5d9862" } as const;
export type VisualTree = "B" | "P" | "C";
export const VISUAL_NOW = "2026-09-23T17:00:00.000Z";
export const VISUAL_ORIGIN = "https://issue22-visual-port.test";
const root = resolve(".");
const entry = resolve("tests/e2e/fixtures/issue22-visual-port-browser.tsx");
const require = createRequire(import.meta.url);
export const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const lockedVersions: Record<string, string> = {
  react: "19.2.8", "react-dom": "19.2.8", next: "15.5.27", geist: "1.7.2",
  tailwindcss: "4.3.3", "@tailwindcss/node": "4.3.3", "@tailwindcss/oxide": "4.3.3",
  "@tailwindcss/postcss": "4.3.3", postcss: "8.5.29", "@playwright/test": "1.63.0",
};
const stableHashes: Record<string, string> = {
  "src/components/features/capturar/capture.css": "1f0a302872753810c5ef73d5a5f57c661804a0362a3cdd204dbca1f4a5dc2b5e",
  "src/components/features/tarefas/tasks.css": "01c80037dcf51ba737b7ad07bc289106f7699b363b826e2a1bc8b0ec3275275c",
  "src/app/globals.css": "e68a51dea6990aa001d95dbc909598153a0ac0e571e0b47c13e45081ab235533",
  "design-system/tokens/tokens.json": "9e75b6a70d442a0e78199c10cddac0e3b2e7bb9535766a479f9b2b3e6f516ded",
  "PRODUCT.md": "286c22f061519355978ac2fe51e99860cf88e551027025b9e8e1c247df17a7cb",
  "DESIGN.md": "f8358b0ffd7fe442ae516eb06a264482018b30605350cbeec671cd07b8c3e1c0",
};
interface Blob { path: string; blob: string; bytes: Buffer }
export interface VisualSourceManifest {
  tree: VisualTree; ref: string; files: { path: string; blob: string; sha256: string; bytes: number }[];
  cssOrder: string[]; versions: Record<string, string>; entrySha256: string; browserSha256: string; cssSha256: string;
  fontSha256: string; candidates: number; inventory: number;
}
export interface VisualBundle { code: string; css: string; manifest: VisualSourceManifest }
function git(args: string[], input?: string) {
  try { return execFileSync("git", args, { cwd: root, input, maxBuffer: 48 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }); }
  catch { throw new Error("VISUAL_GIT_SOURCE_REFUSED"); }
}
export function currentVisualRef() {
  const ref = git(["rev-parse", "HEAD"]).toString().trim();
  if (!/^[0-9a-f]{40}$/.test(ref) || Object.values(VISUAL_REFS).includes(ref as typeof VISUAL_REFS.B)) throw new Error("VISUAL_CURRENT_REF_REFUSED");
  // Product/back-end/CSS changes outside HEAD would make provenance ambiguous.
  git(["diff", "--quiet", "HEAD", "--", "src", "design-system", "supabase/migrations", "package-lock.json"]);
  return ref;
}
function inventory(ref: string) {
  if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error("VISUAL_REF_REFUSED");
  const lines = git(["ls-tree", "-r", "--full-tree", ref, "--", "src", "design-system", "package-lock.json", "package.json", "PRODUCT.md", "DESIGN.md"]).toString().trim().split("\n");
  if (lines.length < 100 || lines.length > 900) throw new Error("VISUAL_INVENTORY_BOUND_REFUSED");
  const names = lines.map(line => {
    const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
    if (!match || match[2]!.split("/").includes("..") || /[:\\\x00\r\n]/.test(match[2]!) || match[2]!.includes("//")) throw new Error("VISUAL_TREE_ENTRY_REFUSED");
    return { blob: match[1]!, path: match[2]! };
  });
  const output = git(["cat-file", "--batch"], names.map(item => ref + ":" + item.path).join("\n") + "\n");
  let offset = 0;
  const files = new Map<string, Blob>();
  for (const item of names) {
    const end = output.indexOf(10, offset), header = output.subarray(offset, end).toString();
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/.exec(header);
    if (end < offset || !match || match[1] !== item.blob) throw new Error("VISUAL_BLOB_HEADER_REFUSED");
    const length = Number(match[2]); offset = end + 1;
    if (!Number.isSafeInteger(length) || length < 0 || length > 2 * 1024 * 1024 || output[offset + length] !== 10) throw new Error("VISUAL_BLOB_BOUND_REFUSED");
    files.set(item.path, { ...item, bytes: output.subarray(offset, offset + length) }); offset += length + 1;
  }
  if (offset !== output.length || files.size !== names.length) throw new Error("VISUAL_BLOB_TRAILING_REFUSED");
  return files;
}

type Product = typeof import("../fixtures/issue23-sql-server.entry");
const backendSources = new WeakMap<Product, string[]>();
export async function loadVisualProduct(): Promise<Product> {
  const modules = new Set<string>();
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue23-sql-server.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] },
    plugins: [{ name: "issue22-backend-source-inventory", transform(_code, id) {
      const base = root.replaceAll("\\", "/") + "/", path = id.replaceAll("\\", "/");
      if (path.startsWith(base + "src/")) modules.add(path.slice(base.length));
    } }] });
  try {
    const { output } = await build.generate({ format: "es", codeSplitting: false });
    if (output.length !== 1 || output[0]?.type !== "chunk" || output[0].imports.length || output[0].dynamicImports.length) throw new Error("VISUAL_SQL_BUNDLE_REFUSED");
    const product = await import("data:text/javascript;base64," + Buffer.from(output[0].code).toString("base64")) as Product;
    if (JSON.stringify(Object.keys(product).sort()) !== JSON.stringify(["activityQuery", "createActivityGateway", "createCaptureTaskGateway", "createCaptureTaskStore", "decodeCaptureTaskRequest", "executeCaptureTaskCommand"])) throw new Error("VISUAL_SQL_EXPORT_REFUSED");
    backendSources.set(product, [...modules].sort());
    return product;
  } finally { await build.close(); }
}
export async function visualBackendManifest(product: Product, ref: string) {
  const sources = backendSources.get(product);
  if (!sources || sources.length < 10 || sources.length > 80 || currentVisualRef() !== ref) throw new Error("VISUAL_BACKEND_MANIFEST_REFUSED");
  const names = (await readdir(resolve(root, "supabase/migrations"))).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  if (names.length !== 17) throw new Error("VISUAL_MIGRATION_INVENTORY_CHANGED");
  async function record(path: string) {
    const bytes = await readFile(resolve(root, path)), reference = git(["show", ref + ":" + path]);
    if (digest(bytes) !== digest(reference)) throw new Error("VISUAL_BACKEND_SOURCE_CHANGED");
    return { path, sha256: digest(bytes), bytes: bytes.length };
  }
  const migrations = [];
  for (const name of names) migrations.push(await record("supabase/migrations/" + name));
  const modules = [];
  for (const path of sources) modules.push(await record(path));
  return { ref, modules, migrations, migrationsCount: names.length,
    entrySha256: digest(await readFile(resolve(root, "tests/e2e/fixtures/issue23-sql-server.entry.ts"))),
    loaderSha256: digest(await readFile(resolve(root, "tests/helpers/local-canonical-sql.ts"))), sqlLoaderSha256: digest(await readFile(resolve(root, "scripts/test-local-sql.mjs"))) };
}
export async function visualBrowserExecutable(path: string) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 1024 * 1024 || info.size > 512 * 1024 * 1024) throw new Error("VISUAL_BROWSER_BINARY_REFUSED");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { sha256: hash.digest("hex"), bytes: info.size, selection: "explicit chromium channel; BrowserType executablePath" };
}
export const VISUAL_OWNER = "49000000-0000-4000-8000-000000000001";
export const VISUAL_SESSION = "49000000-0000-4000-8000-000000000002";
const signatures: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
export async function createVisualData(product: Product) {
  const db = await createLocalCanonicalSql(), calls: { name: Parameters<CaptureTaskRpc>[0]; operation: CaptureTaskOperation }[] = [];
  let sequence = 100;
  const deps = { clock: { now: () => VISUAL_NOW }, ids: { next: () => "49000000-0000-4000-8000-" + String(sequence++).padStart(12, "0") } };
  function gateway(operation: CaptureTaskOperation) {
    const rpc: CaptureTaskRpc = async (name, args) => {
      if (args.p_user !== VISUAL_OWNER || args.p_session !== VISUAL_SESSION || args.p_operation !== operation
        || JSON.stringify(Object.keys(args).sort()) !== JSON.stringify(["p_user", "p_session", "p_operation", ...signatures[name].extra].sort())) throw new Error("VISUAL_SQL_BINDING_REFUSED");
      calls.push({ name, operation });
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role service_role");
          return tx.query<{ data: unknown }>(signatures[name].sql, [args.p_user, args.p_session, args.p_operation,
            ...signatures[name].extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
        });
        return { data: result.rows[0]!.data, error: null };
      } catch (error) { const code = (error as { code?: unknown }).code; if (typeof code !== "string") throw error; return { data: null, error: { code } }; }
    };
    return product.createCaptureTaskGateway(VISUAL_OWNER, VISUAL_SESSION, operation, rpc);
  }
  async function command(value: unknown) {
    const decoded = product.decodeCaptureTaskRequest(value);
    return product.executeCaptureTaskCommand(product.createCaptureTaskStore(gateway(decoded.command), { maxAttempts: 1 }), deps,
      { user_id: VISUAL_OWNER, canal: "web" }, decoded);
  }
  async function independent() {
    const captures = (await db.query<{ payload: Captura }>("select payload from public.captures where user_id=$1 order by created_at,id", [VISUAL_OWNER])).rows.map(row => row.payload);
    const tasks = (await db.query<{ payload: Tarefa }>("select payload from public.tasks where user_id=$1 order by created_at,id", [VISUAL_OWNER])).rows.map(row => row.payload);
    const categories = (await db.query<{ payload: Categoria }>("select payload from public.categories where user_id=$1 order by created_at,id", [VISUAL_OWNER])).rows.map(row => row.payload);
    const projects = (await db.query<{ payload: Projeto }>("select payload from public.projects where user_id=$1 order by created_at,id", [VISUAL_OWNER])).rows.map(row => row.payload);
    return { captures: { items: captures, categories, projects }, tasks: { items: tasks, categories, projects },
      initial: { capture: captures, task: tasks, category: categories, project: projects } };
  }
  async function ledger() {
    return (await db.query<{ data: unknown }>(`select jsonb_build_object(
      'captures',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.captures x where user_id=$1),
      'tasks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.tasks x where user_id=$1),
      'links',(select coalesce(jsonb_agg(to_jsonb(x) order by source_id,target_id),'[]') from public.capture_links x where user_id=$1),
      'events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.domain_events x where user_id=$1),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by command,client_id),'[]') from app_private.command_receipts x where user_id=$1),
      'revision',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from app_private.capture_task_revisions x where user_id=$1),
      'limits',(select coalesce(jsonb_agg(to_jsonb(x) order by scope,subject_hash),'[]') from app_private.rate_limits x where user_id=$1)) as data`, [VISUAL_OWNER])).rows[0]!.data;
  }
  try {
    await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','issue22-visual@example.invalid')", [VISUAL_OWNER]);
    await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [VISUAL_SESSION, VISUAL_OWNER]);
    // Reference metadata fixtures only, not claims of category/project writers.
    const categories: Categoria[] = ["Trabalho", "Pessoal", "Estudos"].map((name, index) => ({ id: "49000000-0000-4000-8000-" + String(10 + index).padStart(12, "0"),
      user_id: VISUAL_OWNER, name, normalized_name: name.toLocaleLowerCase("pt-BR"), color_key: ["work", "personal", "study"][index]!, is_system: true, created_at: VISUAL_NOW, updated_at: VISUAL_NOW }));
    const projects: Projeto[] = ["Segundo Cérebro V2", "Biblioteca pessoal"].map((name, index) => ({ id: "49000000-0000-4000-8000-" + String(20 + index).padStart(12, "0"),
      user_id: VISUAL_OWNER, name, description: "Projeto descartável da comparação visual.", color_key: "work", position: index, deleted_at: null, created_at: VISUAL_NOW, updated_at: VISUAL_NOW }));
    for (const category of categories) await db.query("insert into public.categories(id,user_id,payload,created_at,updated_at) values ($1,$2,$3::jsonb,$4,$4)", [category.id, VISUAL_OWNER, JSON.stringify(category), VISUAL_NOW]);
    for (const project of projects) await db.query("insert into public.projects(id,user_id,payload,deleted_at,created_at,updated_at) values ($1,$2,$3::jsonb,null,$4,$4)", [project.id, VISUAL_OWNER, JSON.stringify(project), VISUAL_NOW]);
    const titles = ["Visão do produto", "Decisões para a próxima etapa", "Diário de bordo", "Uma ideia no caminho", "Ligar para o contador", "Leitura e interfaces", "Nota no arquivo"];
    const captures: Captura[] = [];
    for (const [index, title] of titles.entries()) captures.push(await command({ command: "capture.create", input: { client_id: "visual-capture-" + index, type: index === 3 ? "idea" : "note",
      title, content: index === 1 ? "O Núcleo preserva as regras. As telas guardam a intenção.\n\nUm lugar para pensar com [[Visão do produto]]."
        : index === 2 ? "Revisei [[Decisões para a próxima etapa]] e registrei os próximos passos." : "Texto sintético de " + title + ".",
      category_id: categories[index % 3]!.id, project_id: index < 3 ? projects[0]!.id : null, attachments: [], linked_capture_ids: [] } }) as Captura);
    await command({ command: "capture.update", input: { id: captures[1]!.id, client_id: "visual-link", patch: { linked_capture_ids: [captures[0]!.id] } } });
    await command({ command: "capture.archive", input: { id: captures[6]!.id, client_id: "visual-archive" } });
    const converted = await command({ command: "capture.convert", input: { capture_id: captures[4]!.id, client_id: "visual-convert" } }) as { captura: Captura; tarefa: Tarefa };
    const fields: CamposTarefa = { title: "Revisar o plano da semana", description: "Manter o próximo passo claro.", category_id: categories[0]!.id, project_id: projects[0]!.id,
      status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null, all_day: true, estimated_minutes: null, board_position: 0 };
    const taskTitles = ["Enviar proposta", "Revisar o plano da semana", "Estudar contratos", "Escrever a próxima decisão", "Organizar referências", "Responder a revisão"];
    const tasks: Tarefa[] = [];
    for (const [index, title] of taskTitles.entries()) tasks.push(await command({ command: "task.create", input: { ...fields, client_id: "visual-task-" + index, title,
      status: index >= 4 ? "done" : index === 1 ? "in_progress" : "todo", priority: index === 0 ? "high" : index >= 4 ? "low" : "medium",
      category_id: categories[index % 3]!.id, due_at: index === 0 ? "2026-09-22T03:00:00.000Z" : index === 1 ? "2026-09-23T17:30:00.000Z" : index === 4 ? "2026-09-23T03:00:00.000Z" : null,
      scheduled_start_at: index === 1 ? "2026-09-23T17:00:00.000Z" : null, scheduled_end_at: index === 1 ? "2026-09-23T17:30:00.000Z" : null,
      all_day: index !== 1, estimated_minutes: index === 1 ? 30 : null, board_position: index + 1 } }) as Tarefa);
    const data = await independent();
    if (data.captures.items.length !== 7 || data.tasks.items.length !== 7 || data.tasks.items.filter(task => task.status === "done").length !== 2
      || !data.tasks.items.some(task => task.id === converted.tarefa.id && task.origin_capture_id === captures[4]!.id)) throw new Error("VISUAL_MASS_REFUSED");
    return { db, gateway, calls, data, independent, ledger, selectedNote: data.captures.items.find(note => note.id === captures[1]!.id)!, completedTask: tasks[4]! };
  } catch (error) { await db.close(); throw error; }
}
export async function buildVisualBundle(tree: VisualTree, current: string): Promise<VisualBundle> {
  const ref = tree === "C" ? current : VISUAL_REFS[tree], files = inventory(ref), used = new Set<string>(), cssOrder: string[] = [];
  function blob(path: string) {
    const result = files.get(path);
    if (!result) throw new Error("VISUAL_MISSING_REF_PATH:" + path);
    used.add(path); return result;
  }
  for (const [path, hash] of Object.entries(stableHashes)) if (digest(blob(path).bytes) !== hash) throw new Error("VISUAL_STABLE_SOURCE_CHANGED:" + path);
  const lock = JSON.parse(blob("package-lock.json").bytes.toString()) as { packages: Record<string, { version?: string }> };
  for (const [name, version] of Object.entries(lockedVersions)) {
    if (lock.packages["node_modules/" + name]?.version !== version) throw new Error("VISUAL_REF_DEPENDENCY_DRIFT:" + name);
    const local = JSON.parse(await readFile(resolve(root, "node_modules", name, "package.json"), "utf8")) as { version?: string };
    if (local.version !== version) throw new Error("VISUAL_LOCAL_DEPENDENCY_DRIFT:" + name);
  }
  if ((JSON.parse(await readFile(resolve(root, "node_modules/rolldown/package.json"), "utf8")) as { version?: string }).version !== "1.2.12") throw new Error("VISUAL_TOOL_VERSION_DRIFT");
  // Closed product VFS. Relative paths may normalize within src/design-system,
  // but never to another ref, host path, node_modules, .env or missing fallback.
  const prefix = "\0issue22-ref:" + ref + ":";
  const factory = "\0issue22-factory";
  function sourcePath(id: string) { return id.startsWith(prefix) ? id.slice(prefix.length) : null; }
  function modulePath(path: string) {
    const normalized = posix.normalize(path.replaceAll("\\", "/"));
    if (!/^(src|design-system)\//.test(normalized) || normalized.includes(":") || normalized.split("/").includes("..")) throw new Error("VISUAL_PATH_ESCAPE");
    const candidates = [normalized, ...[".ts", ".tsx", ".js", ".json", "/index.ts", "/index.tsx"].map(extension => normalized + extension)];
    const matches = candidates.filter(candidate => files.has(candidate));
    if (matches.length !== 1) throw new Error("VISUAL_MODULE_PATH_REFUSED:" + normalized);
    return matches[0]!;
  }
  const build = await rolldown({
    input: entry, platform: "browser", tsconfig: false,
    transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{
      name: "issue22-one-ref-product-vfs",
      resolveId(source, importer) {
        if (source === "next/navigation") return "\0issue22-navigation";
        if (source === "next/link") return "\0issue22-link";
        if (source === "next/image") return "\0issue22-image";
        if (source === "issue22-original-application") return prefix + "src/lib/demo/application.ts";
        if (!importer) return;
        let path: string | null = null;
        if (source.startsWith("@/")) path = modulePath("src/" + source.slice(2));
        else if (source.startsWith(".") && sourcePath(importer)) path = modulePath(posix.join(posix.dirname(sourcePath(importer)!), source));
        else if (source.startsWith(".") && importer.replaceAll("\\", "/") === entry.replaceAll("\\", "/")) {
          const physical = resolve(dirname(entry), source).replaceAll("\\", "/"), base = root.replaceAll("\\", "/") + "/";
          if (!physical.startsWith(base + "src/")) throw new Error("VISUAL_ENTRY_IMPORT_REFUSED");
          path = modulePath(physical.slice(base.length));
        }
        if (path) {
          if (tree === "B" && path === "src/lib/demo/application.ts") return factory;
          if (path.endsWith(".css") && !cssOrder.includes(path)) cssOrder.push(path);
          return prefix + path;
        }
        if (sourcePath(importer) && !/^(react|react-dom)(\/|$)/.test(source)) throw new Error("VISUAL_UNDECLARED_DEPENDENCY:" + source);
      },
      load(id) {
        if (id === "\0issue22-navigation") return `export {useRouter,usePathname,useSearchParams} from ${JSON.stringify(entry)};`;
        if (id === "\0issue22-link") return `export {VisualLink as default} from ${JSON.stringify(entry)};`;
        if (id === "\0issue22-image") return `export {VisualImage as default} from ${JSON.stringify(entry)};`;
        if (id === factory) return `import {createDemoApplication as original} from "issue22-original-application";
          export * from "issue22-original-application";
          export function createDemoApplication(options={}) {
            const d=globalThis.__issue22VisualFactoryData;
            if(!d||d.connected)throw new Error("VISUAL_MEMORY_FACTORY_REFUSED");
            return original({...options,userId:d.userId,clock:{now:()=>d.now},initial:d.initial});
          }`;
        const path = sourcePath(id); if (!path) return;
        const data = blob(path).bytes;
        if (path.endsWith(".css")) return { code: "export {};", moduleType: "js" };
        if (path.endsWith(".jpg")) return { code: `export default {src:"data:image/jpeg;base64,${data.toString("base64")}"};`, moduleType: "js" };
        if (!/\.(tsx?|js|json)$/.test(path)) throw new Error("VISUAL_ASSET_REFUSED:" + path);
        return { code: data.toString(), moduleType: path.endsWith(".tsx") ? "tsx" : path.endsWith(".ts") ? "ts" : path.endsWith(".json") ? "json" : "js" };
      },
    }],
  });
  let code: string;
  try {
    const { output } = await build.generate({ format: "iife", name: "__issue22VisualExports", codeSplitting: false });
    if (output.length !== 1 || output[0]?.type !== "chunk" || output[0].imports.length || output[0].dynamicImports.length) throw new Error("VISUAL_NOT_STANDALONE");
    code = output[0].code;
  } finally { await build.close(); }
  const vbase = "/issue22-ref/" + ref;
  const tailwindRoot = dirname(require.resolve("tailwindcss/package.json"));
  const packageBase = "/issue22-package/tailwindcss";
  const compiler = await compile(blob("src/app/globals.css").bytes.toString(), {
    base: vbase + "/src/app", from: vbase + "/src/app/globals.css",
    loadModule: async () => { throw new Error("VISUAL_CSS_MODULE_REFUSED"); },
    loadStylesheet: async (id, base) => {
      if (id === "tailwindcss") return { path: packageBase + "/index.css", base: packageBase, content: await readFile(resolve(tailwindRoot, "index.css"), "utf8") };
      const target = posix.normalize(posix.join(base, id));
      if (base.startsWith(packageBase) && target.startsWith(packageBase + "/") && /\/(theme|preflight|utilities)\.css$/.test(target)) {
        return { path: target, base: posix.dirname(target), content: await readFile(resolve(tailwindRoot, posix.basename(target)), "utf8") };
      }
      if (!id.startsWith(".") || !target.startsWith(vbase + "/")) throw new Error("VISUAL_CSS_IMPORT_REFUSED");
      const path = target.slice(vbase.length + 1);
      if (!path.endsWith(".css")) throw new Error("VISUAL_CSS_PATH_REFUSED");
      return { path: target, base: posix.dirname(target), content: blob(path).bytes.toString() };
    },
  });
  // No host filesystem scan: candidates are content from this Git ref only.
  const candidates = new Scanner({ sources: [] }).scanFiles([...files.values()].filter(file => /\.(tsx?|css)$/.test(file.path)).map(file => ({ content: file.bytes.toString(), extension: posix.extname(file.path).slice(1) })));
  const font = await readFile(resolve(root, "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"));
  // The ordered component CSS closure is recorded separately from the globals.
  // This is a fixture CSS composition, not Next's CSS loader or RSC execution.
  const css = compiler.build(candidates) + "\n" + cssOrder.map(path => blob(path).bytes.toString()).join("\n")
    + `\n@font-face{font-family:Issue22VisualGeist;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");font-weight:100 900;font-style:normal}:root{--font-geist-sans:Issue22VisualGeist}`;
  if (/@import\s/.test(css) || [...css.matchAll(/url\(([^)]*)\)/g)].some(match => !/^data:/.test(match[1]!.replaceAll(/["']/g, "").trim()))) throw new Error("VISUAL_CSS_NETWORK_REFUSED");
  return { code, css, manifest: { tree, ref, files: [...used].sort().map(path => { const value = files.get(path)!; return { path, blob: value.blob, sha256: digest(value.bytes), bytes: value.bytes.length }; }),
    cssOrder, versions: { ...lockedVersions, rolldown: "1.2.12" }, entrySha256: digest(await readFile(entry)), browserSha256: digest(code),
    cssSha256: digest(css), fontSha256: digest(font), candidates: candidates.length, inventory: files.size } };
}

export interface VisualMeasure {
  selector: string; tag: string; text: string; role: string | null; label: string | null; href: string | null; value: string | null;
  rect: { x: number; y: number; width: number; height: number }; styles: Record<string, string>;
}
export interface VisualMeasurements {
  theme: string | null; tokens: Record<string, string>; duplicateIds: string[]; brokenAssociations: string[];
  domainUrl: string; elements: VisualMeasure[];
}
// Finite shared anchors, not whole-region masks. Raw full DOM/screenshots retain
// the copy/status/lifecycle/Chrome differences for independent classification.
export const SHARED_VISUAL_ANCHORS = [
  ".shell-header", ".shell-rail", ".shell-bottom", ".shell-main", ".shell-page-heading", ".shell-page-heading h1",
  ".capture-top", ".capture-layout", ".capture-editor", ".capture-library", ".capture-title",
  ".capture-toolbar", ".capture-body", ".capture-library header", ".capture-library .field__control",
  ".tasks-workspace", ".tasks-toolbar", ".tasks-summary", ".tasks-filters", ".tasks-filters .field__control",
  ".ui-dialog--drawer", ".ui-dialog__header", ".ui-dialog__body", ".ui-dialog__footer", ".tasks-form", ".tasks-form .field__control",
] as const;
const styleNames = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "backgroundColor", "borderRadius", "borderColor", "display", "gridTemplateColumns", "gap"] as const;
export async function measureVisualPort(page: Page): Promise<VisualMeasurements> {
  return page.evaluate(({ selectors, styleNames }) => {
    const round = (n: number) => Math.round(n * 100) / 100;
    const ids = [...document.querySelectorAll("[id]")].map(element => element.id);
    const brokenAssociations = [...document.querySelectorAll("label[for], [aria-labelledby], [aria-describedby]")].flatMap(element => {
      const refs = [element.getAttribute("for"), element.getAttribute("aria-labelledby"), element.getAttribute("aria-describedby")].filter(Boolean).join(" ").split(/\s+/);
      return refs.filter(id => id && !document.getElementById(id));
    });
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      tokens: Object.fromEntries(["--canvas", "--surface", "--ink", "--ink-muted", "--line", "--target", "--font-family", "--radius-md"].map(key => [key, getComputedStyle(document.documentElement).getPropertyValue(key).trim()])),
      duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))], brokenAssociations,
      domainUrl: location.pathname + location.search,
      elements: selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)].map((element, index) => {
        const rect = element.getBoundingClientRect(), computed = getComputedStyle(element);
        return { selector: selector + ":" + index, tag: element.tagName, text: element.textContent?.trim() ?? "", role: element.getAttribute("role"),
          label: element.getAttribute("aria-label"), href: element.getAttribute("href"), value: "value" in element ? String(element.value) : null,
          rect: { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) },
          styles: Object.fromEntries(styleNames.map(key => [key, computed[key]])) };
      })),
    };
  }, { selectors: [...SHARED_VISUAL_ANCHORS], styleNames: [...styleNames] });
}
export interface VisualDelta { selector: string; field: string; before: unknown; after: unknown; disposition: "shared-contract" | "review-required" }
/** Every difference remains in the report. Only immutable language/width
 * contracts are asserted mechanically. Copy/flow height/y deltas are NOT
 * auto-approved as intentional and require raw image/DOM review.
 */
export function compareVisualPort(before: VisualMeasurements, after: VisualMeasurements) {
  const differences: VisualDelta[] = [], violations: VisualDelta[] = [];
  function compare(selector: string, field: string, left: unknown, right: unknown, contract: boolean) {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    const delta: VisualDelta = { selector, field, before: left, after: right, disposition: contract ? "shared-contract" : "review-required" };
    differences.push(delta); if (contract) violations.push(delta);
  }
  compare("html", "theme", before.theme, after.theme, true); compare("html", "tokens", before.tokens, after.tokens, true);
  const b = new Map(before.elements.map(item => [item.selector, item])), a = new Map(after.elements.map(item => [item.selector, item]));
  for (const selector of [...new Set([...b.keys(), ...a.keys()])]) {
    const left = b.get(selector), right = a.get(selector);
    compare(selector, "presence", !!left, !!right, true); if (!left || !right) continue;
    compare(selector, "tag", left.tag, right.tag, true);
    // Chrome copy and later feature hints produce visible raw differences.
    compare(selector, "text", left.text, right.text, false);
    for (const field of ["role", "label", "href", "value"] as const) compare(selector, field, left[field], right[field], true);
    for (const field of ["x", "y", "width", "height"] as const) compare(selector, "rect." + field, left.rect[field], right.rect[field], field === "x" || field === "width");
    for (const field of styleNames) compare(selector, "style." + field, left.styles[field], right.styles[field], true);
  }
  return { differences, violations, visualAcceptance: "INDEPENDENT_REVIEW_REQUIRED" as const };
}
