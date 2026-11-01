import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/environment/application-destination", () => ({ authDeploymentAllowed: () => true }));
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
import { feedbackRpc } from "../../src/adapters/db/feedback-gateway";

const config = { supabaseUrl: "https://database.example.invalid", secretKey: "fixture-secret" } as SupabaseAuthConfig;
const actor = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001" } as AuthenticatedIdentity;
afterEach(() => vi.unstubAllGlobals());

describe("transporte privilegiado de feedback", () => {
  it("envia cursores nulos na primeira página e ambos os valores na página seguinte", async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json([]));
    vi.stubGlobal("fetch", transport);
    await expect(feedbackRpc(config, actor)).resolves.toEqual({ items: [], next: null });
    expect(JSON.parse(String((transport.mock.calls[0]![1] as RequestInit).body))).toEqual({
      p_user: actor.userId, p_session: actor.sessionId, p_before: null, p_before_id: null,
    });
    const cursor = { before: "2026-10-17T10:00:00.000Z", id: "30000000-0000-4000-8000-000000000001" };
    await feedbackRpc(config, actor, undefined, cursor);
    expect(JSON.parse(String((transport.mock.calls[1]![1] as RequestInit).body))).toEqual({
      p_user: actor.userId, p_session: actor.sessionId, p_before: cursor.before, p_before_id: cursor.id,
    });
  });
  it("recusa redirecionamentos e mantém a leitura indisponível ou a escrita incerta", async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError("redirect"));
    vi.stubGlobal("fetch", transport);
    await expect(feedbackRpc(config, actor)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(feedbackRpc(config, actor, { category: "suggestion", text: "Mensagem válida", clientId: "30000000-0000-4000-8000-000000000001" })).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(transport).toHaveBeenCalledTimes(2);
    for (const [, options] of transport.mock.calls) expect(options).toMatchObject({ redirect: "error", cache: "no-store" });
  });
});
