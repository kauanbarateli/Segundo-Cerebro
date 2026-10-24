/** Public, isolated host boundary. GoalsPanel owns its REAL channel/controller;
 * binder, client, J2, finance barrier, receivers and transport are real. Owned
 * HTTP/File rows below are synthetic; this is not Provider/Auth/Storage proof. */
import { useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { GoalsPanel } from "@/components/features/financeiro/goals/goals-panel";
import { GoalImageHostBinding, type GoalImageHostCurrent } from "@/components/features/financeiro/goals/goal-image-host-binding";
import { GoalImagePicker } from "@/components/features/financeiro/goals/goal-image-picker";
import type { FinancialGoal, GoalCommandResult } from "@/core/financeiro/goals/goal-types";
import { decodeGoalCommand } from "@/core/financeiro/goals/goal-validation";
import { FinanceGoalsBrowserClient } from "@/lib/finance-goals-client";
import { FinanceGoalsJournal } from "@/lib/finance-goals-journal";
import { GoalImageUploadJournal } from "@/lib/files/goal-image-upload-journal";
import { GOAL_IMAGE_UPLOAD_PHASES, type GoalImageUploadMetadata, type GoalImageUploadPhase } from "@/lib/files/goal-image-upload-contract";
import { createGoalImageUploadTransport } from "@/lib/files/goal-image-upload-transport";
import { LOCAL_STORAGE_ORIGIN } from "@/lib/files/storage-origin";

export interface GoalImageHostFixtureOptions { phase?: GoalImageUploadPhase; sameTarget?: boolean; imagesEnabled?: boolean; hidden?: boolean; existing?: boolean; failJournal?: boolean; lostExecute?: boolean }
interface Trace { kind: "availability" | "page" | "detail" | "preview" | "execute" | "reconcile" | "reserve" | "observe" | "put" | "finalize" | "financial-id" | "host-refresh"; id: string | null }
type FileRow = { id: string; user_id: string; kind: "finance_goal_image"; folder_id: null; name: string; mime: string; bytes: number; sha256: string; width: number; height: number; starred: false; deleted_at: null; deletion_batch_id: null; created_at: string; updated_at: string; modified_at: string };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), at = "2026-10-24T00:00:00Z";
const originalBytes = () => Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMICAj4DwAD1AHw410Q2gAAAABJRU5ErkJggg=="), value => value.charCodeAt(0));
const json = (url: string, value: unknown) => { const response = Response.json(value); Object.defineProperty(response, "url", { value: url }); return response; };
let root: Root | null = null, end: (() => void) | null = null, setHostHidden: ((value: boolean) => void) | null = null;
async function createFixture(options: GoalImageHostFixtureOptions) {
  let alive = true, financialRevision = "7", counter = 100, lost = options.lostExecute === true, journals = 0;
  const trace: Trace[] = [], files = new Map<string, FileRow>(), receipts = new Map<string, GoalCommandResult>(), uploads = new Map<string, string>();
  const storage = { keys: () => Object.keys(localStorage), getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, text: string) => localStorage.setItem(key, text), removeItem: (key: string) => localStorage.removeItem(key) };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => await navigator.locks.request(name, work);
  const financeJournal = new FinanceGoalsJournal(owner, { storage, exclusive, uuid: () => crypto.randomUUID() }); await financeJournal.open();
  let saved: FinancialGoal | null = options.existing ? { version: 1, id: id(11), user_id: owner, name: "Meta existente", target_cents: 10000, deadline: null, image_file_id: null, archived_at: null, revision: "3", created_at: at, updated_at: at } : null;
  const item = (goal: FinancialGoal) => ({ goal, totals: { user_id: owner, goal_id: goal.id, finance_revision: financialRevision, saved_cents: 0 } });
  const client = new FinanceGoalsBrowserClient(owner, financeJournal, { origin: location.origin, isCurrent: () => alive, fetcher: async (path, init) => {
    const url = new URL(path, location.origin), view = url.searchParams.get("view");
    if (init.method === "GET" && path.endsWith("/availability")) { trace.push({ kind: "availability", id: null }); return json(url.href, { ok: true, result: { available: true } }); }
    if (init.method === "GET" && view === "page") { trace.push({ kind: "page", id: null }); return json(url.href, { ok: true, result: { version: 1, finance_revision: financialRevision, items: saved ? [item(saved)] : [], highlight: null, next_cursor: null } }); }
    if (init.method === "GET" && view === "detail") { trace.push({ kind: "detail", id: null }); return json(url.href, { ok: true, result: saved ? { version: 1, finance_revision: financialRevision, ...item(saved), highlight: null } : null }); }
    if (init.method !== "POST" || typeof init.body !== "string") throw Error("Undeclared synthetic Goals request");
    const intent = decodeGoalCommand(JSON.parse(init.body)), binding = { version: 1, command: intent.command, client_id: intent.input.client_id };
    if (intent.command !== "finance.goal.create" && intent.command !== "finance.goal.update") throw Error("Only explicit synthetic create/update");
    if (path.endsWith("/preview")) { trace.push({ kind: "preview", id: intent.input.client_id }); return json(url.href, { ok: true, binding, result: { kind: "review", intent, financeRevision: financialRevision, goalRevision: intent.command === "finance.goal.update" ? saved?.revision ?? null : null, highlightRevision: null, account: null } }); }
    if (path.endsWith("/reconcile")) { trace.push({ kind: "reconcile", id: intent.input.client_id }); const result = receipts.get(intent.input.client_id); return result ? json(url.href, { ok: true, binding, result }) : Response.json({ ok: false, code: "uncertain", message: "Synthetic missing receipt" }, { status: 503 }); }
    if (path !== "/api/finance/goals") throw Error("Undeclared synthetic write path");
    const previous = receipts.get(intent.input.client_id); if (previous) return json(url.href, { ok: true, binding, result: previous });
    const imageId = intent.command === "finance.goal.create" ? intent.input.image_file_id : Object.hasOwn(intent.input.patch, "image_file_id") ? intent.input.patch.image_file_id : saved?.image_file_id ?? null;
    if (imageId === undefined || imageId !== null && !files.has(imageId)) throw Error("No finalized own image");
    const fields = intent.command === "finance.goal.create" ? intent.input : { ...saved, ...intent.input.patch };
    if (typeof fields.name !== "string" || typeof fields.target_cents !== "number") throw Error("Invalid synthetic fields");
    saved = { version: 1, id: intent.command === "finance.goal.create" ? id(11) : intent.input.goal_id, user_id: owner, name: fields.name, target_cents: fields.target_cents, deadline: fields.deadline ?? null, image_file_id: imageId, archived_at: null, revision: intent.command === "finance.goal.create" ? "0" : String(BigInt(intent.input.expected_revision) + 1n), created_at: at, updated_at: at };
    const result: GoalCommandResult = { version: 1, goal: saved }; receipts.set(intent.input.client_id, result); financialRevision = String(BigInt(financialRevision) + 1n); trace.push({ kind: "execute", id: intent.input.client_id });
    if (lost) { lost = false; throw Error("Synthetic lost execute"); } return json(url.href, { ok: true, binding, result });
  } });
  const seed = new GoalImageUploadJournal(owner, client.epoch, { storage, exclusive, isCurrent: () => alive }); await seed.open();
  const bytes = originalBytes(), sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (options.phase) {
    const metadata: GoalImageUploadMetadata = { version: 1, purpose: "finance_goal_image", scope: { ownerId: owner, epoch: client.epoch, editorKey: "original-editor-A", goalId: options.sameTarget ? saved?.id ?? null : id(80), goalRevision: options.sameTarget ? saved?.revision ?? null : "2", baselineFileId: options.sameTarget ? saved?.image_file_id ?? null : id(81) }, selection: { generation: 7, name: "original.png", size: bytes.byteLength, mime: "image/png", sha256 }, uploadClientId: id(82), uploadId: null, phase: "prepared" };
    await seed.exclusive(async lease => { lease.stage(metadata); for (let step = 1; step <= GOAL_IMAGE_UPLOAD_PHASES.indexOf(options.phase!); step++) { const phase = GOAL_IMAGE_UPLOAD_PHASES[step]!; lease.advance(lease.snapshot(), { phase, uploadId: phase === "reserving" ? null : id(83) }); } });
    if (seed.snapshot().attempt?.uploadId) { uploads.set(metadata.uploadClientId, id(83)); if (["put-confirmed", "finalizing", "ready-unbound"].includes(options.phase)) files.set(id(83), { id: id(83), user_id: owner, kind: "finance_goal_image", folder_id: null, name: metadata.selection.name, mime: metadata.selection.mime, bytes: bytes.byteLength, sha256, width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: at, updated_at: at, modified_at: at }); }
  }
  const app = { userId: owner, mode: "connected" as const, closing: false, initializeJournal: async () => undefined, getCommandSnapshot: () => ({ status: "idle" }), executeDomainCommand: async (command: string, raw: unknown) => {
    if (command !== "file.upload.finalize" || !raw || typeof raw !== "object" || !("upload_id" in raw) || !("client_id" in raw) || typeof raw.upload_id !== "string" || typeof raw.client_id !== "string") throw Error("Undeclared synthetic sender command");
    const row = files.get(raw.upload_id); if (!row || uploads.get(raw.client_id) !== row.id) throw Error("No own staged file"); trace.push({ kind: "finalize", id: raw.client_id }); return structuredClone(row);
  } };
  let context: GoalImageHostCurrent = { ownerId: owner, providerEpoch: 0, client, application: app, storageOrigin: LOCAL_STORAGE_ORIGIN, origin: location.origin, hidden: options.hidden === true, imagesEnabled: options.imagesEnabled !== false };
  const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin: location.origin, assertCurrent: () => { if (!alive) throw Error("Synthetic owner closed"); }, fetcher: async (url, init) => {
    if (url.includes("/observe?")) { const upload = new URL(url).searchParams.get("upload"); trace.push({ kind: "observe", id: upload }); return json(url, { version: 1, user_id: owner, upload_id: upload, purpose: "finance_goal_image", state: files.has(upload ?? "") ? "staging" : "missing-observed", file: null }); }
    if (init.method === "POST" && typeof init.body === "string") { const body: { client_id: string } = JSON.parse(init.body), upload = uploads.get(body.client_id) ?? id(++counter); uploads.set(body.client_id, upload); trace.push({ kind: "reserve", id: body.client_id }); return json(url, { id: upload, upload_url: `${LOCAL_STORAGE_ORIGIN}/storage/v1/object/upload/sign/second-brain-staging/${owner}/${upload}?token=public-synthetic`, token: "public-synthetic", expires_at: "2099-01-01T00:00:00Z" }); }
    if (init.method !== "PUT" || !(init.body instanceof FormData)) throw Error("Undeclared storage request"); const file = init.body.get(""); if (!(file instanceof File)) throw Error("Missing File"); const upload = new URL(url).pathname.split("/").at(-1)!;
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(n => n.toString(16).padStart(2, "0")).join(""); files.set(upload, { id: upload, user_id: owner, kind: "finance_goal_image", folder_id: null, name: file.name, mime: file.type, bytes: file.size, sha256: hash, width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: at, updated_at: at, modified_at: at }); trace.push({ kind: "put", id: upload }); return json(url, {});
  } });
  const binding = new GoalImageHostBinding({ current: () => alive, read: () => context, loadPicker: async () => GoalImagePicker, transport, journalFactory: async (boundOwner, epoch, current) => { journals++; if (options.failJournal) throw Error("Synthetic journal refusal"); const journal = new GoalImageUploadJournal(boundOwner, epoch, { storage, exclusive, isCurrent: current }); await journal.open(); return journal; } });
  return { owner, client, binding, trace, context: () => context, setHidden(hidden: boolean) { context = { ...context, hidden }; if (hidden) binding.conceal(); }, snapshot: () => ({ upload: seed.snapshot(), finance: financeJournal.snapshot(), saved: structuredClone(saved), journals }), createId() { const value = id(++counter); trace.push({ kind: "financial-id", id: value }); return value; }, async refresh() { trace.push({ kind: "host-refresh", id: null }); }, close() { binding.dispose(); alive = false; client.dispose(); } };
}
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function Surface({ fixture: f, options }: { fixture: Fixture; options: GoalImageHostFixtureOptions }) {
  const [hidden, setHidden] = useState(options.hidden === true), [visible, setVisible] = useState(true);
  useLayoutEffect(() => {
    const own = (value: boolean) => { f.setHidden(value); setHidden(value); };
    setHostHidden = own;
    return () => { if (setHostHidden === own) setHostHidden = null; };
  }, [f]);
  function mask(value: boolean) { f.setHidden(value); setHidden(value); }
  return <main className="fg-surface"><h1>Host de fotos — cenário isolado</h1><Button onClick={() => mask(!hidden)}>{hidden ? "Exibir no host" : "Ocultar no host"}</Button><Button onClick={() => setVisible(value => !value)}>{visible ? "Desmontar painel" : "Reabrir painel"}</Button>
    {visible && <GoalsPanel ownerId={f.owner} client={f.client} today="2026-10-24" accounts={[]} hidden={hidden} reveal={() => mask(false)} createId={f.createId} imageHost={f.binding} onResolved={f.refresh} />}
  </main>;
}
declare global { interface Window { __mountGoalImageHost(options?: GoalImageHostFixtureOptions): Promise<void>; __goalImageHostTrace(): Trace[]; __goalImageHostState(): ReturnType<Fixture["snapshot"]>; __closeGoalImageHostOwner(): void; __setGoalsHostHidden(value: boolean): void } }
// External host-state transition, not an inert-background click or a Dialog
// bypass. Only the currently mounted Surface owns this finite boolean setter.
window.__setGoalsHostHidden = value => { if (typeof value !== "boolean" || !setHostHidden) throw Error("Invalid host privacy transition"); setHostHidden(value); };
window.__mountGoalImageHost = async options => { root?.unmount(); end?.(); const f = await createFixture(options ?? {}); end = f.close; window.__goalImageHostTrace = () => structuredClone(f.trace); window.__goalImageHostState = f.snapshot; window.__closeGoalImageHostOwner = f.close; root = createRoot(document.getElementById("goal-image-host-root")!); root.render(<Surface fixture={f} options={options ?? {}} />); };
