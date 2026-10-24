/** Public synthetic transport only. Journals, Web Locks, coordinator, financial
 * client, decoders and controller are real; no fixture mints a nominal proof. */
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GoalEditor } from "@/components/features/financeiro/goals/goal-editor";
import { GoalImagePicker } from "@/components/features/financeiro/goals/goal-image-picker";
import type { GoalImageEditorCapability } from "@/components/features/financeiro/goals/goal-image-editor-session";
import { createGoalsController } from "@/components/features/financeiro/goals/goals-ui-model";
import type { FinancialGoal, GoalCommand, GoalCommandResult } from "@/core/financeiro/goals/goal-types";
import { decodeGoalCommand } from "@/core/financeiro/goals/goal-validation";
import { FinanceGoalsBrowserClient } from "@/lib/finance-goals-client";
import { FinanceGoalsJournal } from "@/lib/finance-goals-journal";
import { GoalImageUploadCoordinator } from "@/lib/files/goal-image-upload";
import { GoalImageUploadJournal } from "@/lib/files/goal-image-upload-journal";
import type { GoalImageUploadScope } from "@/lib/files/goal-image-upload-contract";
import { createGoalImageUploadTransport } from "@/lib/files/goal-image-upload-transport";
import { LOCAL_STORAGE_ORIGIN } from "@/lib/files/storage-origin";
import "@/components/features/financeiro/goals/goals.css";

export interface GoalImageFixtureOptions { withoutCapability?: boolean; hidden?: boolean; lostFinalize?: boolean; lostExecute?: boolean; noReceipt?: boolean; existing?: boolean }
interface Trace { kind: "availability" | "reserve" | "put" | "observe" | "finalize" | "preview" | "execute" | "reconcile" | "financial-id"; clientId: string | null; imageId: string | null }
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), at = "2026-10-24T00:00:00Z";
const json = (url: string, value: unknown) => { const response = Response.json(value); Object.defineProperty(response, "url", { value: url }); return response; };
type FileRow = { id: string; user_id: string; kind: "finance_goal_image"; folder_id: null; name: string; mime: string; bytes: number; sha256: string; width: number; height: number; starred: false; deleted_at: null; deletion_batch_id: null; created_at: string; updated_at: string; modified_at: string };
let root: Root | null = null, end: (() => void) | null = null;
async function createFixture(options: GoalImageFixtureOptions) {
  let alive = true, lostFinalize = options.lostFinalize === true, lostExecute = options.lostExecute === true, counter = 20;
  const trace: Trace[] = [], receipts = new Map<string, GoalCommandResult>(), files = new Map<string, FileRow>(), uploadClients = new Map<string, string>();
  const storage = { keys: () => Object.keys(localStorage), getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key) };
  const exclusive = async <T,>(name: string, work: () => Promise<T>): Promise<T> => await navigator.locks.request(name, work);
  const financialJournal = new FinanceGoalsJournal(owner, { storage, exclusive, uuid: () => crypto.randomUUID() }); await financialJournal.open();
  const initialFinanceRevision = options.existing ? "7" : "0";
  let financeRevision = initialFinanceRevision;
  const initialGoal: FinancialGoal | null = options.existing ? { version: 1, id: id(11), user_id: owner, name: "Meta existente", target_cents: 10000, deadline: "2027-07-01", image_file_id: id(12), archived_at: null, revision: "3", created_at: at, updated_at: at } : null;
  let saved: FinancialGoal | null = structuredClone(initialGoal);
  if (initialGoal?.image_file_id) files.set(initialGoal.image_file_id, { id: initialGoal.image_file_id, user_id: owner, kind: "finance_goal_image", folder_id: null, name: "existing.png", mime: "image/png", bytes: 1, sha256: "a".repeat(64), width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: at, updated_at: at, modified_at: at });
  const finance = new FinanceGoalsBrowserClient(owner, financialJournal, { origin: location.origin, isCurrent: () => alive, fetcher: async (path, init) => {
    const url = new URL(path, location.origin).href;
    if (init.method === "GET" && path.endsWith("/availability")) { trace.push({ kind: "availability", clientId: null, imageId: null }); return json(url, { ok: true, result: { available: true } }); }
    if (init.method !== "POST" || typeof init.body !== "string") throw Error("Undeclared synthetic financial request");
    const intent = decodeGoalCommand(JSON.parse(init.body)), binding = { version: 1, command: intent.command, client_id: intent.input.client_id };
    if (intent.command !== "finance.goal.create" && intent.command !== "finance.goal.update") throw Error("Only synthetic create/update");
    let imageId: string | null;
    if (intent.command === "finance.goal.create") imageId = intent.input.image_file_id;
    else if (Object.hasOwn(intent.input.patch, "image_file_id")) { const requested = intent.input.patch.image_file_id; if (requested === undefined) throw Error("Invalid synthetic image patch"); imageId = requested; }
    else imageId = saved?.image_file_id ?? null;
    if (path.endsWith("/preview")) { trace.push({ kind: "preview", clientId: intent.input.client_id, imageId }); if (intent.input.expected_finance_revision !== financeRevision || intent.command === "finance.goal.update" && intent.input.expected_revision !== saved?.revision) return Response.json({ ok: false, code: "conflict", message: "Synthetic stale revision" }, { status: 409 }); return json(url, { ok: true, binding, result: { kind: "review", intent, financeRevision, goalRevision: intent.command === "finance.goal.update" ? saved!.revision : null, highlightRevision: null, account: null } }); }
    if (path.endsWith("/reconcile")) { trace.push({ kind: "reconcile", clientId: intent.input.client_id, imageId }); const result = options.noReceipt ? null : receipts.get(intent.input.client_id); return result ? json(url, { ok: true, binding, result }) : Response.json({ ok: false, code: "uncertain", message: "Synthetic missing receipt" }, { status: 503 }); }
    if (path !== "/api/finance/goals") throw Error("Undeclared synthetic financial path");
    trace.push({ kind: "execute", clientId: intent.input.client_id, imageId });
    if (imageId !== null && !files.has(imageId)) throw Error("Image not finalized by own sender");
    const input = intent.command === "finance.goal.create" ? intent.input : { ...saved, ...intent.input.patch };
    if (typeof input.name !== "string" || typeof input.target_cents !== "number") throw Error("Invalid synthetic fields");
    saved = { version: 1, id: intent.command === "finance.goal.create" ? id(11) : intent.input.goal_id, user_id: owner, name: input.name, target_cents: input.target_cents, deadline: input.deadline ?? null, image_file_id: imageId, archived_at: null, revision: intent.command === "finance.goal.create" ? "0" : String(BigInt(intent.input.expected_revision) + 1n), created_at: at, updated_at: at };
    const result: GoalCommandResult = { version: 1, goal: saved }; receipts.set(intent.input.client_id, result); financeRevision = String(BigInt(financeRevision) + 1n);
    if (lostExecute) { lostExecute = false; throw Error("Synthetic lost response"); }
    return json(url, { ok: true, binding, result });
  } });
  const controller = createGoalsController(owner, finance); const opened = await controller.open(); if (!opened.ok) throw Error("Synthetic client could not open");
  const scope: GoalImageUploadScope = { ownerId: owner, epoch: finance.epoch, editorKey: "public-editor", goalId: initialGoal?.id ?? null, goalRevision: initialGoal?.revision ?? null, baselineFileId: initialGoal?.image_file_id ?? null };
  const uploadJournal = new GoalImageUploadJournal(owner, finance.epoch, { storage, exclusive, isCurrent: () => alive });
  const transport = createGoalImageUploadTransport(owner, LOCAL_STORAGE_ORIGIN, { origin: location.origin, assertCurrent: () => { if (!alive) throw Error("Fixture closed"); }, fetcher: async (url, init) => {
    if (url.includes("/observe?")) { const upload = new URL(url).searchParams.get("upload"); trace.push({ kind: "observe", clientId: null, imageId: upload }); return json(url, { version: 1, user_id: owner, upload_id: upload, purpose: "finance_goal_image", state: files.has(upload ?? "") ? "staging" : "missing-observed", file: null }); }
    if (init.method === "POST" && typeof init.body === "string") {
      const body: { client_id: string } = JSON.parse(init.body), upload = uploadClients.get(body.client_id) ?? id(++counter); uploadClients.set(body.client_id, upload); trace.push({ kind: "reserve", clientId: body.client_id, imageId: upload });
      return json(url, { id: upload, upload_url: LOCAL_STORAGE_ORIGIN + `/storage/v1/object/upload/sign/second-brain-staging/${owner}/${upload}?token=public-synthetic`, token: "public-synthetic", expires_at: "2099-01-01T00:00:00Z" });
    }
    if (init.method !== "PUT" || !(init.body instanceof FormData)) throw Error("Undeclared synthetic storage request");
    const source = init.body.get(""); if (!(source instanceof File)) throw Error("Missing synthetic File");
    const upload = new URL(url).pathname.split("/").at(-1)!; trace.push({ kind: "put", clientId: null, imageId: upload });
    const bytes = new Uint8Array(await source.arrayBuffer()), hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    files.set(upload, { id: upload, user_id: owner, kind: "finance_goal_image", folder_id: null, name: source.name, mime: source.type, bytes: source.size, sha256: hash, width: 1, height: 1, starred: false, deleted_at: null, deletion_batch_id: null, created_at: at, updated_at: at, modified_at: at }); return json(url, {});
  } });
  const app = { userId: owner, mode: "connected" as const, initializeJournal: async () => undefined, getCommandSnapshot: () => ({ status: "idle" }), executeDomainCommand: async (command: string, raw: unknown) => {
    if (command !== "file.upload.finalize" || !raw || typeof raw !== "object") throw Error("Undeclared synthetic command");
    const input = raw as { upload_id: string; client_id: string }, row = files.get(input.upload_id); trace.push({ kind: "finalize", clientId: input.client_id, imageId: input.upload_id });
    if (!row || uploadClients.get(input.client_id) !== row.id) throw Error("No own staged file"); if (lostFinalize) { lostFinalize = false; throw Error("Synthetic lost finalize"); } return structuredClone(row);
  } };
  const capability: GoalImageEditorCapability = { scope, Picker: GoalImagePicker, isCurrent: () => alive && finance.isCurrent(), linked: () => finance.imageUploadLinks.current(),
    open: captured => GoalImageUploadCoordinator.open({ scope: captured, journal: uploadJournal, finance, financeBarrier: finance.imageUploadBarrier, controller: () => controller, application: () => app, currentScope: () => scope, isCurrent: () => alive, origin: location.origin, storageOrigin: LOCAL_STORAGE_ORIGIN, transport, createId: () => id(++counter) }) };
  return { capability, controller, finance, trace, uploadJournal, financialJournal, initialGoal, initialFinanceRevision, saved: () => saved, createId: () => { const next = id(++counter); trace.push({ kind: "financial-id", clientId: next, imageId: null }); return next; }, close: () => { alive = false; controller.close(); finance.dispose(); } };
}
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function Surface({ fixture: f, options }: { fixture: Fixture; options: GoalImageFixtureOptions }) {
  const [open, setOpen] = useState(false), [hidden, setHidden] = useState(options.hidden === true), [round, setRound] = useState(0), [review, setReview] = useState(false), [message, setMessage] = useState("");
  async function prepare(intent: GoalCommand) { const reply = await f.controller.prepare(structuredClone(intent)); if (!reply.ok) throw Error("Synthetic prepare refused"); setReview(reply.result.kind === "review"); }
  async function confirm() { const reply = await f.controller.confirm(); setReview(false); setMessage(reply.ok ? "Meta confirmada" : "Resultado financeiro incerto"); }
  async function reconcile() { const reply = await f.controller.reconcile(); setMessage(reply.ok ? "Meta confirmada" : "Resultado financeiro incerto"); }
  return <main className="fg-surface"><h1>Foto da meta — teste isolado</h1><Button onClick={() => { setRound(value => value + 1); setOpen(true); }}>{options.existing ? "Editar meta com foto" : "Nova meta com foto"}</Button>
    <p role="status">{message}</p><Button onClick={() => { f.close(); setOpen(false); setMessage("Sessão encerrada; os corpos locais não foram usados por outra conta."); }}>Encerrar fixture</Button>
    <Dialog open={open} onClose={() => setOpen(false)} title={options.existing ? "Editar meta financeira" : "Nova meta financeira"}>
      <GoalEditor key={round} goal={f.initialGoal} financeRevision={f.initialFinanceRevision} hidden={hidden} reveal={() => setHidden(false)} blocked={false} busy={false} createId={f.createId} prepare={prepare} cancel={() => setOpen(false)} imageUpload={options.withoutCapability ? undefined : f.capability}>
        {review && <section aria-label="Confirmação financeira"><p>Confira a intenção preparada. Enviar a foto não criou a meta.</p><Button onClick={() => void confirm()}>Confirmar meta financeira</Button></section>}
        {message === "Resultado financeiro incerto" && <Button onClick={() => void reconcile()}>Consultar tentativa financeira original</Button>}
      </GoalEditor>
    </Dialog></main>;
}
declare global { interface Window { __mountGoalImage(options?: GoalImageFixtureOptions): Promise<void>; __goalImageTrace(): Trace[]; __goalImageState(): { upload: unknown; finance: unknown; saved: FinancialGoal | null } } }
window.__mountGoalImage = async options => {
  root?.unmount(); end?.(); const f = await createFixture(options ?? {}); end = f.close;
  window.__goalImageTrace = () => structuredClone(f.trace);
  window.__goalImageState = () => ({ upload: f.uploadJournal.snapshot(), finance: f.financialJournal.snapshot(), saved: structuredClone(f.saved()) });
  root = createRoot(document.getElementById("goal-image-root")!); root.render(<Surface fixture={f} options={options ?? {}} />);
};
