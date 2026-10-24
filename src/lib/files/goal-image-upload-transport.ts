import { nomeSeguroArquivo } from "../../core/drive/rules";
import { parseGoalJson } from "../finance-goals-json";
import { decodeGoalImageUploadMetadata, goalImageUploadRecord, goalImageUploadUuid, serializeGoalImageUploadMetadata, type GoalImageUploadMetadata } from "./goal-image-upload-contract";
import { decodeImageUploadObservation, isImageUploadInstant, type ImageUploadObservation } from "./image-upload-observation";
import { isStorageOrigin, signedUploadUrl, type StorageOrigin } from "./storage-origin";

export class GoalImageUploadTransportError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "INVALID_RESPONSE" | "INVALID" | "SESSION_CHANGED") { super(code); this.name = "GoalImageUploadTransportError"; }
}
const CAPABILITY = Symbol("GoalImageStorageCapability");
export interface GoalImageStorageCapability { readonly [CAPABILITY]: true }
export interface GoalImageUploadTransport {
  reserve(metadata: GoalImageUploadMetadata, knownUploadId: string | null, signal: AbortSignal): Promise<{ uploadId: string; capability: GoalImageStorageCapability }>;
  observe(metadata: GoalImageUploadMetadata, signal: AbortSignal): Promise<ImageUploadObservation>;
  put(capability: GoalImageStorageCapability, metadata: GoalImageUploadMetadata, file: File, signal: AbortSignal): Promise<void>;
}
type ImageFetcher = (input: string, init: RequestInit) => Promise<Response>;
const RESPONSE_BYTES = 64 * 1024;
interface Options { origin: string; assertCurrent(): void; fetcher?: ImageFetcher; now?: () => number }

/** Goal-only transport. Credentials/URLs remain inside this instance, in RAM;
 * never import a component or change the shared Avatar/Capturar uploader. */
export function createGoalImageUploadTransport(owner: string, storageOrigin: StorageOrigin, options: Options): GoalImageUploadTransport {
  const ownerId = goalImageUploadUuid(owner), base = new URL(options.origin);
  if (!isStorageOrigin(storageOrigin) || base.origin !== options.origin || base.username || base.password || base.search || base.hash || !["https:", "http:"].includes(base.protocol)) throw new GoalImageUploadTransportError("INVALID");
  const fetcher: ImageFetcher = options.fetcher ?? ((input, init) => fetch(input, init)), now = options.now ?? Date.now;
  const assertCurrent = options.assertCurrent;
  const identity = (metadata: GoalImageUploadMetadata) => serializeGoalImageUploadMetadata({ ...metadata, phase: "prepared", uploadId: null });
  const capabilities = new WeakMap<GoalImageStorageCapability, { uploadId: string; url: string; expires: number; identity: string }>();
  function guard(signal: AbortSignal) { try { assertCurrent(); } catch { throw new GoalImageUploadTransportError("SESSION_CHANGED"); } if (signal.aborted) throw new GoalImageUploadTransportError("UNAVAILABLE"); }
  function source(value: GoalImageUploadMetadata) { const result = decodeGoalImageUploadMetadata(value); if (result.scope.ownerId !== ownerId) throw new GoalImageUploadTransportError("SESSION_CHANGED"); return result; }
  async function request(url: string, init: RequestInit, deadline: number, signal: AbortSignal, json: boolean): Promise<{ response: Response; text: string }> {
    guard(signal); const controller = new AbortController(); let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, pendingBody: ReadableStream<Uint8Array> | null = null, eof = false;
    let rejectAbort!: (error: Error) => void; const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const onAbort = () => { controller.abort(); rejectAbort(new GoalImageUploadTransportError("UNAVAILABLE")); };
    signal.addEventListener("abort", onAbort, { once: true }); const timer = setTimeout(onAbort, deadline);
    try {
      const response = await Promise.race([fetcher(url, { ...init, signal: controller.signal }), aborted]); pendingBody = response.body; guard(signal);
      if (response.redirected || response.type === "opaqueredirect" || response.url !== url) throw new GoalImageUploadTransportError("INVALID_RESPONSE");
      const declared = response.headers.get("content-length");
      if (declared !== null && (!/^(?:0|[1-9][0-9]*)$/.test(declared) || Number(declared) > RESPONSE_BYTES)) throw new GoalImageUploadTransportError("INVALID_RESPONSE");
      if (json && response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw new GoalImageUploadTransportError("INVALID_RESPONSE");
      const chunks: Uint8Array[] = []; let total = 0;
      if (response.body) {
        reader = response.body.getReader();
        while (true) {
          const item = await Promise.race([reader.read(), aborted]); guard(signal);
          if (item.done) { eof = true; break; }
          total += item.value.byteLength; if (total > RESPONSE_BYTES) throw new GoalImageUploadTransportError("INVALID_RESPONSE"); chunks.push(item.value.slice());
        }
      } else eof = true;
      guard(signal); const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let text: string; try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new GoalImageUploadTransportError("INVALID_RESPONSE"); }
      return { response, text };
    } catch (error) {
      if (error instanceof GoalImageUploadTransportError) throw error;
      try { assertCurrent(); } catch { throw new GoalImageUploadTransportError("SESSION_CHANGED"); }
      throw new GoalImageUploadTransportError("UNAVAILABLE");
    } finally {
      clearTimeout(timer); signal.removeEventListener("abort", onAbort);
      if (!eof) controller.abort();
      if (reader) { if (!eof) void reader.cancel().catch(() => undefined); try { reader.releaseLock(); } catch { /* Pending read remains cancelled; never await cleanup indefinitely. */ } }
      else if (!eof && pendingBody) void pendingBody.cancel().catch(() => undefined);
    }
  }
  function parsed(text: string): unknown { try { return parseGoalJson(text, { maxDepth: 3, maxProperties: 32 }); } catch { throw new GoalImageUploadTransportError("INVALID_RESPONSE"); } }
  return {
    async reserve(value, knownUploadId, signal) {
      const metadata = source(value); guard(signal); if (knownUploadId !== null) goalImageUploadUuid(knownUploadId);
      const url = base.origin + "/api/files/uploads";
      const { response, text } = await request(url, { method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Expected-User-ID": ownerId }, body: JSON.stringify({ kind: "finance_goal_image", name: metadata.selection.name, folder_id: null, client_id: metadata.uploadClientId }) }, 15_000, signal, true);
      if (response.status !== 200 && response.status !== 201) throw new GoalImageUploadTransportError("UNAVAILABLE");
      let row: Record<string, unknown>; try { row = goalImageUploadRecord(parsed(text), ["expires_at", "id", "token", "upload_url"]); } catch { throw new GoalImageUploadTransportError("INVALID_RESPONSE"); }
      let uploadId: string; try { uploadId = goalImageUploadUuid(row.id); } catch { throw new GoalImageUploadTransportError("INVALID_RESPONSE"); }
      const signed = signedUploadUrl(row.upload_url, storageOrigin, ownerId, uploadId, row.token), at = now();
      if (row.id !== uploadId || knownUploadId !== null && uploadId !== knownUploadId || !signed || !isImageUploadInstant(row.expires_at) || !Number.isFinite(at) || Date.parse(row.expires_at) <= at) throw new GoalImageUploadTransportError("INVALID_RESPONSE");
      const capability: GoalImageStorageCapability = Object.freeze({ [CAPABILITY]: true as const });
      capabilities.set(capability, { uploadId, url: signed, expires: Date.parse(row.expires_at), identity: identity(metadata) }); guard(signal); return { uploadId, capability };
    },
    async observe(value, signal) {
      const metadata = source(value); if (!metadata.uploadId) throw new GoalImageUploadTransportError("INVALID");
      const params = new URLSearchParams({ version: "1", purpose: "finance_goal_image", upload: metadata.uploadId, client_id: metadata.uploadClientId });
      const { response, text } = await request(base.origin + "/api/files/uploads/observe?" + params, { method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { Accept: "application/json", "X-Expected-User-ID": ownerId } }, 15_000, signal, true);
      if (response.status !== 200) throw new GoalImageUploadTransportError("UNAVAILABLE");
      try { const result = decodeImageUploadObservation(parsed(text), ownerId, metadata.uploadId, "finance_goal_image"); guard(signal); return result; } catch (error) { if (error instanceof GoalImageUploadTransportError) throw error; throw new GoalImageUploadTransportError("INVALID_RESPONSE"); }
    },
    async put(capability, value, file, signal) {
      const metadata = source(value), retained = capabilities.get(capability), at = now(); guard(signal);
      if (!retained || retained.identity !== identity(metadata) || retained.uploadId !== metadata.uploadId || !Number.isFinite(at) || retained.expires <= at || file.size !== metadata.selection.size || file.type !== metadata.selection.mime || nomeSeguroArquivo(file.name) !== metadata.selection.name) throw new GoalImageUploadTransportError("INVALID");
      capabilities.delete(capability); const body = new FormData(); body.append("cacheControl", "0"); body.append("", file);
      const { response } = await request(retained.url, { method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" }, body }, 60_000, signal, false);
      if (response.status !== 200 && response.status !== 201 && response.status !== 204) throw new GoalImageUploadTransportError("UNAVAILABLE"); guard(signal);
    },
  };
}
