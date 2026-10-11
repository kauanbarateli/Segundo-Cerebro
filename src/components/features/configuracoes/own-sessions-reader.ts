import { ownSessionId, validOwnSessionsView } from "../../../core/configuracoes/own-sessions";
import type { OwnSessionsReader, OwnSessionsReadResult } from "./own-sessions-types";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
const MAX_BYTES = 64 * 1024;
const unavailable = (): OwnSessionsReadResult => ({ ok: false, reason: "unavailable" });

/** One owner's fixed read. No storage, shared snapshot or automatic retry. */
export function createOwnSessionsReader(userId: string, fetcher: Fetcher = fetch): OwnSessionsReader {
  return async signal => {
    if (signal.aborted || !ownSessionId(userId)) return unavailable();
    const controller = new AbortController(), abort = () => controller.abort();
    let rejectAbort: () => void = () => undefined;
    const interrupted = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error("OWN_SESSIONS_INTERRUPTED"));
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
    });
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 20_000);
    try {
      return await Promise.race([interrupted, (async (): Promise<OwnSessionsReadResult> => {
        const response = await fetcher("/api/settings/sessions", { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal, headers: { "X-Expected-User-ID": userId } });
        if (controller.signal.aborted) return unavailable();
        if (response.status !== 200) return [401, 409].includes(response.status) ? { ok: false, reason: "session-changed" } : unavailable();
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) return unavailable();
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > MAX_BYTES)) return unavailable();
        if (!response.body) return unavailable();
        const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
        const cancelRead = () => { void reader.cancel().catch(() => undefined); };
        controller.signal.addEventListener("abort", cancelRead, { once: true });
        try {
          while (true) {
            const chunk = await reader.read();
            if (controller.signal.aborted) return unavailable();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_BYTES) { void reader.cancel().catch(() => undefined); return unavailable(); }
            chunks.push(chunk.value);
          }
        } finally { controller.signal.removeEventListener("abort", cancelRead); reader.releaseLock(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (controller.signal.aborted || !validOwnSessionsView(value)) return unavailable();
        return { ok: true, snapshot: value };
      })()]);
    } catch { return unavailable(); }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", rejectAbort); controller.abort(); }
  };
}
