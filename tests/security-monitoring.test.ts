import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NodeClient } from "@sentry/node";
import type { Envelope } from "@sentry/core";
import { privateTransport, privacyOptions } from "../src/adapters/observability/sentry";
import { safeMonitoringEvent, safeMonitoringTransaction } from "../src/core/observabilidade";
const canary = "PRIVATE_canary_content_and_secret_123";
const planting = { user: { id: canary, email: canary, ip_address: canary }, request: { url: canary, headers: { authorization: canary }, data: canary }, extra: { vault: canary }, contexts: { private: { content: canary } }, breadcrumbs: [{ message: canary }], tags: { area: "cofre", custom: canary }, message: canary, exception: { values: [{ type: canary, value: canary, stacktrace: { frames: [{ filename: canary, vars: { secret: canary } }] } }] } };
describe("Sentry allowlist final para eventos e transações", () => {
  it("reconstrói o evento sem nenhum conteúdo ou campo fora da allowlist", () => {
    const safe = safeMonitoringEvent({ ...planting, event_id: "a".repeat(32), timestamp: 1780000000 });
    expect(Object.keys(safe!)).toEqual(["event_id", "timestamp", "platform", "level", "tags", "exception"]);
    expect(safe?.tags.area).toBe("cofre"); expect(JSON.stringify(safe)).not.toContain(canary);
  });
  it("remove nomes de transação, URLs, argumentos, amostras, spans e dados financeiros", () => {
    const safe = safeMonitoringTransaction({ ...planting, type: "transaction", transaction: canary, start_timestamp: 1780000000, timestamp: 1780000001, contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: { amount: canary }, op: canary }, private: canary }, spans: [{ description: canary, data: planting }], measurements: { private: canary } });
    expect(safe?.transaction).toBe("workspace"); expect(safe?.spans).toEqual([]); expect(JSON.stringify(safe)).not.toContain(canary);
    expect(safeMonitoringTransaction({ contexts: { trace: {} } })).toBeNull();
  });
  it("filtra o envelope final, descartando anexos, logs, sessões e sampling headers", async () => {
    const send = vi.fn().mockResolvedValue({ statusCode: 200 });
    const wire = privateTransport({ send, flush: () => Promise.resolve(true) });
    // Deliberately malformed SDK envelope: no arbitrary item may reach the wire.
    await wire.send([{ trace: { user_id: canary }, sent_at: canary }, [[{ type: "event" }, planting], [{ type: "attachment" }, canary], [{ type: "session" }, { user: canary }], [{ type: "log" }, { message: canary }]]] as unknown as Envelope);
    const envelope = send.mock.calls[0]![0]; expect(envelope[1]).toHaveLength(1); expect(JSON.stringify(envelope)).not.toContain(canary); expect(Object.keys(envelope[0])).toEqual(["event_id", "sent_at"]);
  });
  it("o SDK real chama o hook e o filtro do transporte antes de enviar", async () => {
    const send = vi.fn().mockResolvedValue({ statusCode: 200 });
    const client = new NodeClient({ ...privacyOptions, integrations: [], stackParser: () => [], dsn: "https://" + "a".repeat(32) + "@o123.ingest.sentry.io/123", transport: () => privateTransport({ send, flush: () => Promise.resolve(true) }) });
    client.init(); client.captureEvent(planting); await client.flush(1000);
    expect(send).toHaveBeenCalled(); expect(JSON.stringify(send.mock.calls)).not.toContain(canary);
    await client.close(1000);
  });
  it("o SDK real filtra também a transação estática no envelope final", async () => {
    const send = vi.fn().mockResolvedValue({ statusCode: 200 }), hook = vi.fn(safeMonitoringTransaction);
    const client = new NodeClient({ ...privacyOptions, beforeSendTransaction: hook, integrations: [], stackParser: () => [], dsn: "https://" + "a".repeat(32) + "@o123.ingest.sentry.io/123", transport: () => privateTransport({ send, flush: () => Promise.resolve(true) }) });
    client.init(); client.captureEvent({ ...planting, type: "transaction", transaction: canary, start_timestamp: 1780000000, timestamp: 1780000001, contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), op: canary }, private: { canary } }, spans: [{ trace_id: "a".repeat(32), span_id: "c".repeat(16), start_timestamp: 1780000000, timestamp: 1780000001, status: "ok", description: canary, data: { canary } }] });
    await client.flush(1000); expect(hook).toHaveBeenCalled(); expect(send).toHaveBeenCalled();
    expect(JSON.stringify(send.mock.calls)).not.toContain(canary); await client.close(1000);
  });
  it("desliga todas as categorias de coleta automática e usa ciclo static", () => {
    expect(privacyOptions.defaultIntegrations).toBe(false); expect(privacyOptions.traceLifecycle).toBe("static");
    expect(privacyOptions.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false, frameContextLines: 0 });
  });
});
