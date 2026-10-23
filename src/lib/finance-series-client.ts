import { assinatura } from "../core/contracts/base";
import { decodeFinanceSeriesCommand } from "../core/financeiro/series/series-validation";
import { decodeSeriesAvailability, decodeSeriesDetail, decodeSeriesPage, decodeSeriesPreview, decodeSeriesResult, type FinanceSeriesDetailView } from "../core/financeiro/series/series-public-validation";
import type { FinanceSeriesAvailability, FinanceSeriesPreview } from "../core/financeiro/series/series-preview-types";
import type { FinanceSeriesCommand, FinanceSeriesPage, FinanceSeriesResult } from "../core/financeiro/series/series-types";
import { browserFinanceSeriesJournal, FinanceSeriesJournal, SeriesJournalError, type SeriesJournalSnapshot } from "./finance-series-journal";

export type SeriesClientCode = "unavailable" | "disabled" | "unauthenticated" | "forbidden" | "validation" | "conflict" | "not-found" | "rate-limited" | "uncertain" | "session-changed" | "journal-unavailable" | "pending" | "reconfirm";
export type SeriesClientFailure = { ok: false; code: SeriesClientCode; message: string };
export type SeriesClientReply<T> = { ok: true; result: T } | SeriesClientFailure;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export interface FinanceSeriesClientOptions { fetcher?: Fetcher; isCurrent?: () => boolean; timeoutMs?: number; origin?: string }
const ENDPOINT = "/api/finance/series", UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const messages: Record<SeriesClientCode, string> = {
  unavailable: "Não foi possível carregar as séries agora. Tente novamente.", disabled: "A gestão de séries ainda não está disponível neste ambiente.",
  unauthenticated: "Entre novamente para continuar. Uma tentativa incerta permanece pendente.", forbidden: "Esta operação não está disponível para sua conta.",
  validation: "Revise os campos e as datas antes de confirmar.", conflict: "Os dados mudaram. Recarregue a prévia e confira datas, contas e fechamento antes de preparar outro envio.",
  "not-found": "Esta série não está disponível.", "rate-limited": "Aguarde um pouco antes de tentar novamente.",
  uncertain: "O resultado ainda não foi confirmado. Consulte a tentativa original ou reenvie exatamente o mesmo conteúdo; não prepare outra.",
  "session-changed": "A sessão mudou. O corpo local foi removido quando houve saída ou troca confirmada de conta; isso não desfaz uma operação já enviada.",
  "journal-unavailable": "Não foi possível registrar a tentativa com segurança neste navegador. Nenhum novo envio deve ser iniciado.",
  pending: "Há uma tentativa pendente. Consulte ou reenvie o mesmo conteúdo antes de preparar outra.", reconfirm: "Houve uma saída ou troca de conta com tentativa pendente. Confira seus dados atuais antes de preparar outra; remover o registro local não desfez um possível envio.",
};
const failure = (code: SeriesClientCode): SeriesClientFailure => ({ ok: false, code, message: messages[code] });
class ClientFailure extends Error { constructor(readonly code: SeriesClientCode, readonly knownRejection = false) { super(code); } }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function closedFailure(status: number, value: unknown): ClientFailure {
  if (!record(value) || !exact(value, ["ok", "code", "message"]) || value.ok !== false || typeof value.message !== "string" || value.message.length > 600) return new ClientFailure("unavailable");
  if (status === 409 && value.code === "SESSION_CHANGED") return new ClientFailure("session-changed");
  if (status === 400 && value.code === "VALIDATION") return new ClientFailure("validation", true);
  if (status === 409 && value.code === "CONFLICT") return new ClientFailure("conflict", true);
  if (status === 404 && value.code === "NOT_FOUND") return new ClientFailure("not-found", true);
  if (status === 401 && value.code === "UNAUTHENTICATED") return new ClientFailure("unauthenticated", true);
  if (status === 403 && value.code === "FORBIDDEN") return new ClientFailure("forbidden", true);
  if (status === 429 && value.code === "RATE_LIMITED") return new ClientFailure("rate-limited", true);
  return new ClientFailure(value.code === "COMMIT_UNKNOWN" ? "uncertain" : "unavailable");
}

/** All public methods require a human action. Constructing/restoring never fetches or sends. */
export class FinanceSeriesClient {
  private active = true;
  private initialized = false;
  private readonly controllers = new Set<AbortController>();
  private readonly fetcher: Fetcher;
  constructor(readonly ownerId: string, private readonly journal: FinanceSeriesJournal, private readonly options: FinanceSeriesClientOptions = {}) {
    // A browser's Web IDL fetch must not receive this client as its receiver.
    const fetcher = options.fetcher ?? fetch;
    this.fetcher = (path, init) => fetcher(path, init); if (!UUID.test(ownerId) || journal.ownerId !== ownerId) this.active = false;
  }
  private guard() { if (!this.active || this.options.isCurrent?.() === false) throw new ClientFailure("session-changed"); if (this.initialized) this.journal.assertSession(); }
  /** Component unmount/old service: fence and abort, but do not infer logout. */
  dispose() { this.active = false; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  /** Only an explicit logout or the server's closed SESSION_CHANGED reply calls this. */
  revokeIdentity() { this.dispose(); return this.journal.revoke(); }
  subscribe(listener: () => void) { return this.journal.subscribe(listener); }
  private error(error: unknown): SeriesClientFailure {
    if (error instanceof ClientFailure) return failure(error.code);
    if (error instanceof SeriesJournalError) return failure(error.code === "SESSION_CHANGED" || error.code === "CLOSED" ? "session-changed" : error.code === "PENDING" ? "pending" : error.code === "RECONFIRM" ? "reconfirm" : error.code === "UNCERTAIN" ? "uncertain" : "journal-unavailable");
    return failure("unavailable");
  }
  private async readJson(response: Response, signal: AbortSignal, guard: () => void) {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) throw new ClientFailure("unavailable");
    const size = response.headers.get("content-length");
    if (size !== null && (!/^\d+$/.test(size) || !Number.isSafeInteger(Number(size)) || Number(size) > 4 * 1024 * 1024)) throw new ClientFailure("unavailable");
    if (!response.body) throw new ClientFailure("unavailable");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
    const cancel = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) { const next = await reader.read(); guard(); if (signal.aborted) throw new ClientFailure("unavailable"); if (next.done) break; length += next.value.byteLength; if (length > 4 * 1024 * 1024) { cancel(); throw new ClientFailure("unavailable"); } chunks.push(next.value); }
      const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      guard(); return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  }
  private async request<T>(path: string, decode: (value: unknown) => T, body?: FinanceSeriesCommand): Promise<T> {
    this.guard(); const fence = this.journal.captureFence(), guard = () => { this.guard(); fence(); }; guard(); const text = body === undefined ? undefined : JSON.stringify(body); if (text !== undefined && new TextEncoder().encode(text).length > 64 * 1024) throw new ClientFailure("validation", true);
    const controller = new AbortController(); this.controllers.add(controller);
    let abortReject: () => void = () => undefined;
    const aborted = new Promise<never>((_, reject) => { abortReject = () => reject(new ClientFailure("unavailable")); controller.signal.addEventListener("abort", abortReject, { once: true }); });
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const result = await Promise.race([aborted, (async () => {
        guard(); const response = await this.fetcher(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal, headers: { "X-Expected-User-ID": this.ownerId, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(text === undefined ? {} : { body: text }) });
        guard(); if (controller.signal.aborted || response.redirected) throw new ClientFailure("unavailable");
        if (response.url && this.options.origin && response.url !== new URL(path, this.options.origin).href) throw new ClientFailure("unavailable");
        const raw = await this.readJson(response, controller.signal, guard); guard(); if (controller.signal.aborted) throw new ClientFailure("unavailable");
        if (response.status !== 200) { const error = closedFailure(response.status, raw); if (error.code === "session-changed") this.revokeIdentity(); throw error; }
        if (!record(raw) || !exact(raw, ["ok", "result"]) || raw.ok !== true) throw new ClientFailure("unavailable");
        const decoded = decode(raw.result); guard(); return decoded;
      })()]);
      guard(); return result;
    } catch (error) { guard(); throw error; }
    finally { clearTimeout(timer); controller.signal.removeEventListener("abort", abortReject); controller.abort(); this.controllers.delete(controller); }
  }
  private async read<T>(work: () => Promise<T>, captureReadFence = false): Promise<SeriesClientReply<T>> {
    let fence = () => undefined as void;
    try { this.guard(); if (captureReadFence) { if (!this.initialized) throw new ClientFailure("journal-unavailable"); fence = this.journal.captureFence(); } fence(); const result = await work(); this.guard(); fence(); return { ok: true, result }; }
    catch (error) { try { this.guard(); fence(); } catch (changed) { return this.error(changed); } return this.error(error); }
  }
  availability(): Promise<SeriesClientReply<FinanceSeriesAvailability>> { return this.read(() => this.request(ENDPOINT + "/availability", decodeSeriesAvailability), true); }
  page(query: { cursor: string | null; limit: number }): Promise<SeriesClientReply<FinanceSeriesPage>> {
    return this.read(async () => { if (query.cursor !== null && !UUID.test(query.cursor) || !Number.isInteger(query.limit) || query.limit < 1 || query.limit > 50) throw new ClientFailure("validation"); const suffix = "?limit=" + query.limit + (query.cursor === null ? "" : "&cursor=" + encodeURIComponent(query.cursor)); return this.request(ENDPOINT + suffix, value => decodeSeriesPage(value, this.ownerId, query)); }, true);
  }
  detail(seriesId: string): Promise<SeriesClientReply<FinanceSeriesDetailView>> { return this.read(async () => { if (!UUID.test(seriesId)) throw new ClientFailure("validation"); return this.request(ENDPOINT + "?series_id=" + encodeURIComponent(seriesId), value => decodeSeriesDetail(value, this.ownerId, seriesId)); }, true); }
  loadPending(): Promise<SeriesClientReply<SeriesJournalSnapshot>> {
    return this.read(async () => { const result = await this.journal.exclusive(async lease => { this.guard(); this.initialized = true; return lease.snapshot(); }); this.guard(); return result; });
  }
  preview(input: FinanceSeriesCommand): Promise<SeriesClientReply<FinanceSeriesPreview>> {
    return this.read(async () => {
      const request = decodeFinanceSeriesCommand(input), pending = this.journal.inspect().pending; if (pending && assinatura(pending.request) !== assinatura(request)) throw new ClientFailure("pending");
      return this.request(ENDPOINT + "/preview", value => decodeSeriesPreview(value, this.ownerId, request), request);
    }, true);
  }
  acknowledgeReconfirmation(): Promise<SeriesClientReply<SeriesJournalSnapshot>> {
    return this.read(async () => { const result = await this.journal.exclusive(async lease => { this.guard(); this.initialized = true; lease.acknowledgeReconfirmation(); return lease.snapshot(); }); this.guard(); return result; });
  }
  execute(input: FinanceSeriesCommand): Promise<SeriesClientReply<FinanceSeriesResult>> {
    return this.read(async () => {
      const request = decodeFinanceSeriesCommand(input);
      const result = await this.journal.exclusive(async lease => {
        this.guard(); this.initialized = true;
        const existing = lease.snapshot().pending; if (existing && assinatura(existing.request) !== assinatura(request)) throw new ClientFailure("pending");
        // A disabled/forbidden read never erases an earlier uncertain intention.
        let available: FinanceSeriesAvailability;
        try { available = await this.request(ENDPOINT + "/availability", decodeSeriesAvailability); this.guard(); }
        catch (error) { this.guard(); if (existing) throw new ClientFailure("uncertain"); throw error; }
        if (!available.available) throw new ClientFailure(existing ? "uncertain" : "disabled");
        this.guard(); const { created } = lease.stage(request); this.guard();
        try {
          const committed = await this.request(ENDPOINT, value => decodeSeriesResult(value, this.ownerId, request), request); this.guard(); lease.confirmed(request); this.guard(); return committed;
        } catch (error) {
          this.guard();
          if (created && error instanceof ClientFailure && error.knownRejection) { lease.rejected(request); throw error; }
          lease.unknown(request); throw new ClientFailure("uncertain");
        }
      });
      this.guard(); return result;
    });
  }
  retryPending(): Promise<SeriesClientReply<FinanceSeriesResult>> {
    return this.read(async () => { const opened = await this.loadPending(); this.guard(); if (!opened.ok) throw new ClientFailure(opened.code); if (!opened.result.pending) throw new ClientFailure("pending"); const reply = await this.execute(opened.result.pending.request); this.guard(); if (!reply.ok) throw new ClientFailure(reply.code); return reply.result; });
  }
  /** Human-only read of the exact original intention; absence is not a rollback. */
  reconcilePending(): Promise<SeriesClientReply<FinanceSeriesPreview>> {
    return this.read(async () => {
      const result = await this.journal.exclusive(async lease => {
        this.guard(); this.initialized = true; const pending = lease.snapshot().pending; if (!pending) throw new ClientFailure("pending");
        let review: FinanceSeriesPreview;
        try { review = await this.request(ENDPOINT + "/preview", value => decodeSeriesPreview(value, this.ownerId, pending.request), pending.request); this.guard(); }
        catch { this.guard(); throw new ClientFailure("uncertain"); }
        if (review.kind === "confirmed") { lease.confirmed(pending.request); this.guard(); } return review;
      }); this.guard(); return result;
    });
  }
}

// The privacy guardian survives a finance component unmount. It retains only a
// journal handle; no request body or server data is held in this registry.
const browserJournals = new Map<string, FinanceSeriesJournal>();
let browserOwner: string | null = null, browserListener = false;
export function browserFinanceSeriesClient(ownerId: string, isCurrent: () => boolean) {
  if (typeof window === "undefined" || !UUID.test(ownerId)) throw new SeriesJournalError("UNAVAILABLE");
  // ownerId is supplied by the authenticated application provider, never a form.
  if (browserOwner !== null && browserOwner !== ownerId) { browserJournals.get(browserOwner)?.revoke(); browserJournals.delete(browserOwner); }
  browserOwner = ownerId;
  // A new component/service gets a fresh handle over the same durable epoch.
  // This also avoids reusing an in-memory handle revoked by SESSION_CHANGED.
  const journal = browserFinanceSeriesJournal(ownerId); browserJournals.set(ownerId, journal);
  if (!browserListener) {
    browserListener = true;
    // Same event emitted by demo-provider's existing explicit logout/change flow.
    window.addEventListener("segundo-cerebro:demo-logout", event => {
      const owner = (event as CustomEvent<{ userId?: unknown }>).detail?.userId; if (typeof owner !== "string") return;
      const previous = browserJournals.get(owner); if (previous) { try { previous.revoke(); } catch { /* Explicit logout must continue; the handle remains revoked. */ } finally { browserJournals.delete(owner); } }
      if (browserOwner === owner) browserOwner = null;
    });
  }
  return new FinanceSeriesClient(ownerId, journal, { isCurrent, origin: window.location.origin });
}
