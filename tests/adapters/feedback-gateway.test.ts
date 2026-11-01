import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import { decodeFeedbackSubmission } from "../../src/core/feedback/submission";

const state=vi.hoisted(()=>({enabled:true}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/environment/application-destination", () => ({ authDeploymentAllowed: () => true }));
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
vi.mock("../../src/lib/feedback/reconciliation-gate", () => ({feedbackReconciliationReady:()=>state.enabled}));
import { feedbackRpc } from "../../src/adapters/db/feedback-gateway";

const config = { supabaseUrl: "https://database.example.invalid", secretKey: "fixture-secret" } as SupabaseAuthConfig;
const actor = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "20000000-0000-4000-8000-000000000001" } as AuthenticatedIdentity;
afterEach(() => {vi.unstubAllGlobals();state.enabled=true;});

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
  const input = { category: "suggestion" as const, text: "Mensagem válida", clientId: "30000000-0000-4000-8000-000000000001" };
  const result = { id: "40000000-0000-4000-8000-000000000001", category: input.category, text: input.text, status: "received", createdAt: "2026-10-31T12:00:00Z" };
  const receipt = {status:'submitted',clientId:input.clientId,feedbackId:result.id};
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  it("recusa redirecionamentos e mantém a leitura indisponível ou a escrita incerta", async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError("redirect"));
    vi.stubGlobal("fetch", transport);
    await expect(feedbackRpc(config, actor)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await expect(feedbackRpc(config, actor, { category: "suggestion", text: "Mensagem válida", clientId: "30000000-0000-4000-8000-000000000001" })).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    expect(transport).toHaveBeenCalledTimes(2);
    for (const [, options] of transport.mock.calls) expect(options).toMatchObject({ redirect: "error", cache: "no-store" });
  });

  it("recusa escrita antes de qualquer RPC quando o gate está fechado",async()=>{
    state.enabled=false;const transport=vi.fn<typeof fetch>();vi.stubGlobal('fetch',transport);
    await expect(feedbackRpc(config,actor,input)).rejects.toMatchObject({code:'UNAVAILABLE'});expect(transport).not.toHaveBeenCalled();
  });

  it("aceita recibo correlacionado na hipótese de RPC qualificada", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(receipt)); vi.stubGlobal("fetch", transport);
    await expect(feedbackRpc(config, actor, input)).resolves.toEqual(receipt);
    const options = transport.mock.calls[0]?.[1];
    expect(options).toBeDefined();
    expect(JSON.parse(String(options?.body))).toMatchObject({ p_client: input.clientId, p_category: input.category, p_message: input.text });
  });

  it("envia à RPC somente o texto NFC e sem espaços do decoder real", async () => {
    const normalized = decodeFeedbackSubmission({ ...input, text: "  Mensagem va\u0301lida  " });
    expect(normalized.text).toBe(input.text);
    const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(json(receipt));vi.stubGlobal("fetch",transport);
    await expect(feedbackRpc(config, actor, normalized)).resolves.toEqual(receipt);
    expect(JSON.parse(String(transport.mock.calls[0]![1]?.body))).toMatchObject({p_message:input.text});
  });

  it("classifica recibos inesperados ou de outra chave como escrita incerta", async () => {
    for (const value of [{ ...receipt, clientId:result.id }, { ...receipt, feedbackId: "invalid" }, { ...receipt, text: input.text }, {status:'unknown',clientId:input.clientId}, {}, null]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(value)));
      await expect(feedbackRpc(config, actor, input)).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
    }
  });

  it("mantém a leitura de páginas e seu cursor sem exigir igualdade com uma intenção", async () => {
    const other = { ...result, id: "50000000-0000-4000-8000-000000000001", text: "Mensagem histórica diferente", category: "problem" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([result, other])));
    await expect(feedbackRpc(config, actor)).resolves.toEqual({ items: [result, other], next: null });
  });
});
