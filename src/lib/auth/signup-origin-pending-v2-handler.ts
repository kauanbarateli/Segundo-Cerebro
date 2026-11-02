/** Versioned provisional-session adapter. It never receives campaign values. */
type Actor = Readonly<{ userId: string; sessionId: string }>;
type Ports = Readonly<{
  allowedOrigin(origin: string | null): boolean;
  verifiedActor(): Promise<Actor | null>;
  status(actor: Actor): Promise<unknown>;
  withdraw(actor: Actor, revision: string): Promise<unknown>;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Type": "application/json; charset=utf-8" };
function reply(status: number, value: object): Response { return new Response(JSON.stringify(value), { status, headers }); }
async function revisionBody(request: Request): Promise<string | null> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 1024) { await reader.cancel(); return null; } chunks.push(part.value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join(",") !== "revision") return null;
    const revision = (value as Record<string, unknown>).revision;
    return typeof revision === "string" && UUID.test(revision) ? revision.toLowerCase() : null;
  } catch { return null; } finally { reader.releaseLock(); }
}
export async function pendingOriginV2(request: Request, ports: Ports): Promise<Response> {
  const failure = () => reply(503, { ok: false, status: "unknown" });
  try {
    const write = request.method === "POST";
    if (request.method !== "GET" && !write) return reply(405, { ok: false, status: "refused" });
    if (write && !ports.allowedOrigin(request.headers.get("origin"))) return reply(403, { ok: false, status: "refused" });
    if (!write && new URL(request.url).search) return reply(400, { ok: false, status: "refused" });
    const expected = request.headers.get("x-expected-user-id");
    if (!expected || !UUID.test(expected)) return reply(400, { ok: false, status: "refused" });
    const revision = write ? await revisionBody(request) : null;
    if (write && !revision) return reply(400, { ok: false, status: "refused" });
    const actor = await ports.verifiedActor(); if (!actor) return reply(401, { ok: false, status: "unauthenticated" });
    if (!UUID.test(actor.userId) || !UUID.test(actor.sessionId)) return failure();
    if (actor.userId.toLowerCase() !== expected.toLowerCase()) return reply(409, { ok: false, status: "account_changed" });
    const verified = Object.freeze({ userId: actor.userId, sessionId: actor.sessionId });
    const value = write ? await ports.withdraw(verified, revision!) : await ports.status(verified);
    if (!value || typeof value !== "object" || Array.isArray(value)) return failure();
    const row = value as Record<string, unknown>;
    if (write) {
      if (Object.keys(row).join(",") !== "status" || !["withdrawn", "absent", "stale"].includes(String(row.status))) return failure();
    } else {
      if (Object.keys(row).sort().join(",") !== "revision,status" || (row.status !== "active" && row.status !== "absent") || (row.status === "absent" ? row.revision !== null : typeof row.revision !== "string" || !UUID.test(row.revision))) return failure();
    }
    return reply(200, { ok: true, result: row });
  } catch { return failure(); }
}
