import { decodeSeriesGroupClassification, type SeriesGroupClassification } from "./finance-series-classification-contract";
import type { SeriesClientReply, SeriesClientCode } from "./finance-series-client";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const text: Partial<Record<SeriesClientCode, string>> = {
  "session-changed": "A sessão mudou. Recarregue esta área para continuar na sua conta.",
  forbidden: "Esta operação não está disponível para sua conta.",
  unauthenticated: "Entre novamente para conferir esta recorrência.",
  "not-found": "Este grupo não está disponível. Recarregue seus lançamentos.",
};
const failure = (code: SeriesClientCode): SeriesClientReply<never> => ({ ok: false, code, message: text[code] ?? "Não foi possível conferir esta recorrência. Tente novamente; nenhum encerramento foi enviado." });
class ClassificationFailure extends Error { constructor(readonly code: SeriesClientCode) { super(code); } }
/** Human-triggered GET only. No fallback, journal writes or command dispatch. */
export function createSeriesClassificationClient(ownerId: string, options: { isCurrent(): boolean; fetcher?: typeof fetch; timeoutMs?: number }) {
  let active = true;
  const controllers = new Set<AbortController>(), fetcher = options.fetcher ?? fetch;
  const guard = () => { if (!active || !options.isCurrent()) throw new ClassificationFailure("session-changed"); };
  return {
    dispose() { active = false; controllers.forEach(controller => controller.abort()); controllers.clear(); },
    async read(groupId: string): Promise<SeriesClientReply<SeriesGroupClassification>> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController(); controllers.add(controller);
      try {
        guard(); if (!uuid.test(ownerId) || !uuid.test(groupId)) return failure("validation");
        const request = async () => {
          const response = await fetcher("/api/finance/series/classification?group_id=" + groupId, { method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-Expected-User-ID": ownerId }, signal: controller.signal }); guard();
          if (response.redirected || response.type === "opaqueredirect" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) throw new ClassificationFailure("unavailable");
          const length = response.headers.get("content-length"); if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new ClassificationFailure("unavailable");
          const reader = response.body?.getReader(); if (!reader) throw new ClassificationFailure("unavailable");
          let bytes = new Uint8Array(0);
          try {
            while (true) { const next = await reader.read(); guard(); if (controller.signal.aborted) throw new ClassificationFailure("unavailable"); if (next.done) break;
              if (bytes.length + next.value.length > 4096) { await reader.cancel(); guard(); throw new ClassificationFailure("unavailable"); }
              const joined = new Uint8Array(bytes.length + next.value.length); joined.set(bytes); joined.set(next.value, bytes.length); bytes = joined;
            }
          } finally { reader.releaseLock(); }
          guard(); const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
          if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassificationFailure("unavailable");
          const envelope = value as Record<string, unknown>;
          if (response.status === 200 && Object.keys(envelope).length === 2 && envelope.ok === true && Object.hasOwn(envelope, "result")) return decodeSeriesGroupClassification(envelope.result, groupId);
          if (Object.keys(envelope).length !== 3 || envelope.ok !== false || typeof envelope.message !== "string" || envelope.message.length > 600) throw new ClassificationFailure("unavailable");
          if (response.status === 409 && envelope.code === "SESSION_CHANGED") throw new ClassificationFailure("session-changed");
          if (response.status === 401 && envelope.code === "UNAUTHENTICATED") throw new ClassificationFailure("unauthenticated");
          if (response.status === 403 && envelope.code === "FORBIDDEN") throw new ClassificationFailure("forbidden");
          if (response.status === 404 && envelope.code === "NOT_FOUND") throw new ClassificationFailure("not-found");
          throw new ClassificationFailure("unavailable");
        };
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ClassificationFailure("unavailable")); }, options.timeoutMs ?? 15_000); });
        const result = await Promise.race([request(), timeout]); guard(); return { ok: true, result };
      } catch (error) { try { guard(); } catch { return failure("session-changed"); } return failure(error instanceof ClassificationFailure ? error.code : "unavailable"); }
      finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); controllers.delete(controller); }
    },
  };
}
