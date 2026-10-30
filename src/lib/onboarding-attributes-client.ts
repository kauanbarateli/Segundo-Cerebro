/** Owner-bound browser port. No SDK, shared cache, storage or automatic retry. */
export type PersonalFocus = "work" | "study" | "personal" | "mixed";
export type ProjectContext = "personal" | "work" | "study";
export type ProfileAttributes = { displayName: string | null; focus: PersonalFocus | null; revision: string };
export type ProjectAttributes = { projectId: string; context: ProjectContext | null; revision: string };
export type AttributeTarget = { kind: "profile" } | { kind: "project"; projectId: string };
export type AttributeSnapshot = ProfileAttributes | ProjectAttributes;
export type AttributeFailure = { ok: false; reason: "session-changed" | "conflict" | "rejected" | "unavailable" | "uncertain"; message: string };
export type AttributeReply = { ok: true; result: AttributeSnapshot } | AttributeFailure;
export type AttributeAttempt = { submit(): Promise<AttributeReply> };
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
const ENDPOINT = "/api/onboarding/attributes", MAX_BYTES = 8192;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const focuses: readonly unknown[] = ["work", "study", "personal", "mixed", null];
const contexts: readonly unknown[] = ["personal", "work", "study", null];
const changed = (): AttributeFailure => ({ ok: false, reason: "session-changed", message: "A sessão mudou. Entre novamente antes de continuar." });
const unavailable = (write: boolean): AttributeFailure => write
  ? { ok: false, reason: "uncertain", message: "O resultado do envio não foi confirmado. Tente o mesmo envio antes de alterar sua escolha." }
  : { ok: false, reason: "unavailable", message: "Não foi possível carregar este dado. Tente novamente." };
function record(value: unknown, keys: string[]): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(descriptors);
    if (own.length !== keys.length || own.some(key => typeof key !== "string" || !keys.includes(key)) || Object.values(descriptors).some(item => !("value" in item))) return null;
    return Object.fromEntries(Object.entries(descriptors).map(([key, item]) => [key, item.value]));
  } catch { return null; }
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && !!value.trim() && [...value].length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
export function decodeAttributeSnapshot(value: unknown, target: AttributeTarget): AttributeSnapshot | null {
  if (target.kind === "profile") {
    const row = record(value, ["displayName", "focus", "revision"]);
    return row && (row.displayName === null || text(row.displayName, 120)) && focuses.includes(row.focus) && text(row.revision, 256)
      ? { displayName: row.displayName as string | null, focus: row.focus as PersonalFocus | null, revision: row.revision } : null;
  }
  const row = record(value, ["projectId", "context", "revision"]);
  return row && typeof row.projectId === "string" && row.projectId.toLowerCase() === target.projectId.toLowerCase() && contexts.includes(row.context) && text(row.revision, 256)
    ? { projectId: target.projectId.toLowerCase(), context: row.context as ProjectContext | null, revision: row.revision } : null;
}
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) throw new Error("FORMAT");
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > MAX_BYTES)) throw new Error("LIMIT");
  if (!response.body) throw new Error("BODY");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const part = await reader.read();
      if (signal.aborted) throw new Error("ABORTED");
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { cancel(); throw new Error("LIMIT"); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}
export type AttributesClient = ReturnType<typeof createAttributesClient>;
export function createAttributesClient(userId: string, fetcher: Fetcher = fetch) {
  let active = UUID.test(userId);
  const controllers = new Set<AbortController>();
  const unresolved = new Map<string, object>();
  function dispose() { active = false; for (const controller of controllers) controller.abort(); controllers.clear(); }
  async function request(target: AttributeTarget, body: string | null, signal?: AbortSignal): Promise<AttributeReply> {
    if (!active || signal?.aborted) return changed();
    const write = body !== null, controller = new AbortController(); controllers.add(controller);
    const abort = () => controller.abort(); let rejectAbort: () => void = () => undefined;
    const interrupted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new Error("ABORTED")); controller.signal.addEventListener("abort", rejectAbort, { once: true }); });
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 20_000);
    try {
      return await Promise.race([interrupted, (async (): Promise<AttributeReply> => {
        const suffix = write ? "" : target.kind === "profile" ? "?kind=profile" : "?kind=project&id=" + encodeURIComponent(target.projectId);
        const response = await fetcher(ENDPOINT + suffix, { method: write ? "PATCH" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal,
          headers: { "X-Expected-User-ID": userId, ...(write ? { "Content-Type": "application/json" } : {}) }, ...(write ? { body } : {}) });
        if (!active) return changed();
        if (controller.signal.aborted) return unavailable(write);
        // The browser supplies Origin on the same-origin PATCH; no credential is sent in a URL.
        if (response.status === 401) { dispose(); return changed(); }
        const raw = await readJson(response, controller.signal);
        if (!active) return changed();
        if (controller.signal.aborted) return unavailable(write);
        if (response.status === 200) {
          const envelope = record(raw, ["ok", "result"]), result = envelope?.ok === true ? decodeAttributeSnapshot(envelope.result, target) : null;
          return result ? { ok: true, result } : unavailable(write);
        }
        const failure = record(raw, ["ok", "code", "message"]);
        if (!failure || failure.ok !== false || !text(failure.message, 600)) return unavailable(write);
        if (response.status === 409 && failure.code === "SESSION_CHANGED") { dispose(); return changed(); }
        if (response.status === 409 && failure.code === "CONFLICT") return { ok: false, reason: "conflict", message: "Este dado mudou em outra tela. Recarregue o valor atual e compare com sua escolha antes de salvar." };
        if (response.status === 400 && failure.code === "VALIDATION" || response.status === 403 && failure.code === "FORBIDDEN") return { ok: false, reason: "rejected", message: "Não foi possível salvar esta escolha. Confira os campos e as permissões da sua conta." };
        return unavailable(write);
      })()]);
    } catch { return active ? unavailable(write) : changed(); }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", rejectAbort); controller.abort(); controllers.delete(controller); }
  }
  function read(target: AttributeTarget, signal?: AbortSignal) {
    if (target.kind === "project" && !UUID.test(target.projectId)) return Promise.resolve(unavailable(false));
    return request(target, null, signal);
  }
  function prepare(target: AttributeTarget, revision: string, value: PersonalFocus | ProjectContext | null, clientId?: string): AttributeAttempt {
    if (!active || !text(revision, 256) || clientId !== undefined && !text(clientId, 200) || target.kind === "project" && !UUID.test(target.projectId) || !(target.kind === "profile" ? focuses : contexts).includes(value)) throw new Error("Revise a escolha antes de salvar.");
    const key = target.kind === "profile" ? "profile" : "project:" + target.projectId.toLowerCase();
    // A later rejection cannot prove that an earlier uncertain PATCH did not
    // commit. Only the original successful receipt releases this target.
    if (unresolved.has(key)) throw new Error("Confirme o envio original antes de preparar outra escolha.");
    const intentionId = clientId ?? crypto.randomUUID();
    const query: AttributeTarget = target.kind === "profile" ? { kind: "profile" } : { kind: "project", projectId: target.projectId.toLowerCase() };
    const body = JSON.stringify(query.kind === "profile" ? { kind: "profile", clientId: intentionId, expectedRevision: revision, patch: { focus: value } } : { ...query, clientId: intentionId, expectedRevision: revision, context: value });
    const token = {};
    let inFlight: Promise<AttributeReply> | null = null, terminal: AttributeReply | null = null, wasUncertain = false;
    return Object.freeze({ submit(): Promise<AttributeReply> {
      if (!active) return Promise.resolve(changed());
      if (unresolved.has(key) && unresolved.get(key) !== token) return Promise.resolve(unavailable(true));
      if (terminal) return Promise.resolve(terminal);
      if (inFlight) return inFlight;
      inFlight = request(query, body).then(reply => {
        if (reply.ok && ("focus" in reply.result ? reply.result.focus : reply.result.context) !== value) reply = unavailable(true);
        if (reply.ok) {
          if (unresolved.get(key) === token) unresolved.delete(key);
          terminal = reply;
        } else if (reply.reason === "uncertain" || wasUncertain && reply.reason !== "session-changed") {
          wasUncertain = true; unresolved.set(key, token); reply = unavailable(true);
        } else terminal = reply;
        return reply;
      }).finally(() => { inFlight = null; });
      return inFlight;
    } });
  }
  return { read, prepare, dispose };
}
