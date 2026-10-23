import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { assinatura } from "../../src/core/contracts/base";
import type { FinanceSeriesTransaction } from "../../src/core/financeiro/series/series-ports";
import type { FinanceSeriesCommand } from "../../src/core/financeiro/series/series-types";
import { executeFinanceSeriesCommand } from "../../src/core/financeiro/series/series-use-cases";
import { createFinanceSeriesStore } from "../../src/adapters/db/finance-series-store";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import { AuthGuardError } from "../../src/lib/auth/types";
import { SeriesGatewayFixture, channelCreate } from "../fixtures/finance-series-channel";
import { managedSeries, seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";

const context = { user_id: SERIES_OWNER, canal: "web" as const };
function harness() {
  const gateway = new SeriesGatewayFixture(), request = channelCreate(); let id = 10000;
  const store = createFinanceSeriesStore(gateway, request), run = () => executeFinanceSeriesCommand(store, { clock: { now: () => SERIES_NOW }, ids: { next: () => seriesId(++id) } }, context, request);
  return { gateway, request, store, run };
}
describe("T053-B3: adapter de uma intenção v2, sem repetição automática", () => {
  it("confirma somente alterações/eventos/recibo exatos e replay não envia outro commit", async () => {
    const h = harness(), result = await h.run(); expect(result.affected.created).toBe(2);
    expect(h.gateway.lastCommit?.changes).toHaveLength(5); expect(h.gateway.lastCommit?.events).toHaveLength(5);
    expect(h.gateway.lastCommit?.request).toEqual(h.request); expect(h.gateway.lastCommit?.expected_finance_revision).toBe("0");
    expect(await h.run()).toEqual(result); expect(h.gateway.calls).toEqual({ snapshot: 2, commit: 1 });
  });
  it("replay existing funciona com agregado inteiramente vazio e recibo próprio antes de CAS", async () => {
    const h = harness(), created = await h.run(), occurrence = h.gateway.state.occurrences[0]!;
    const request: FinanceSeriesCommand = { command: "finance.recurring.occurrence.update", input: { client_id: seriesId(902), expected_finance_revision: h.gateway.state.finance_revision, series_id: created.series.id, expected_revision: created.series.revision, occurrence_id: occurrence.id, patch: { status: "confirmed", paid_cents: 10000 } } };
    let id = 15000; const deps = { clock: { now: () => SERIES_NOW }, ids: { next: () => seriesId(++id) } }, store = createFinanceSeriesStore(h.gateway, request), first = await executeFinanceSeriesCommand(store, deps, context, request);
    const receipt = structuredClone(h.gateway.receipts[1]!), commits = h.gateway.calls.commit;
    vi.spyOn(h.gateway, "snapshot").mockResolvedValue({ version: 2, finance_revision: "999", series: [], occurrences: [], transactions: [], accounts: [], categories: [], tags: [], receipt });
    expect(await executeFinanceSeriesCommand(store, deps, context, request)).toEqual(first); expect(h.gateway.calls.commit).toBe(commits);
  });
  it("desfecho incerto com recibo exato é reconciliado somente pela mesma snapshot", async () => {
    const h = harness(); h.gateway.mode = "unknown_after"; const result = await h.run();
    expect(result.affected.created).toBe(2); expect(h.gateway.calls).toEqual({ snapshot: 2, commit: 1 }); expect(h.gateway.receipts).toHaveLength(1); expect(h.gateway.state.transactions).toHaveLength(2);
  });
  it.each([false, true])("corrida same-client devolve IDs do recibo original, inclusive resposta perdida=%s", async lost => {
    const h = harness(), realCommit = h.gateway.commit.bind(h.gateway); let original: unknown;
    vi.spyOn(h.gateway, "commit").mockImplementation(async request => {
      // Independent winner generated distinct entity/event identities for this same public intent.
      const winner = structuredClone(request), remap = new Map(winner.changes.map((change, index) => [change.after.id, seriesId(16000 + index)]));
      const replace = (value: unknown): unknown => typeof value === "string" ? remap.get(value) ?? value : Array.isArray(value) ? value.map(replace) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, part]) => [key, replace(part)])) : value;
      const competing = replace(winner) as typeof winner; await realCommit(competing); original = competing.receipt.result;
      if (lost) { const error = new CommitOutcomeUnknown(); throw error; }
      return { status: "replayed" as const, result: structuredClone(competing.receipt.result) as Awaited<ReturnType<typeof h.run>> };
    });
    const result = await h.run(); expect(result).toEqual(original); expect(result.series.id).toBe(seriesId(16000)); expect(h.gateway.receipts).toHaveLength(1); expect(h.gateway.state.transactions).toHaveLength(2); expect(h.gateway.calls.commit).toBe(1);
  });
  it.each(["absent", "forbidden", "unavailable", "fingerprint", "result"] as const)("incerteza seguida de %s permanece incerta sem outro commit", async next => {
    const h = harness(); h.gateway.mode = next === "absent" ? "unknown_before" : "unknown_after";
    h.gateway.failSnapshot = () => {
      if (h.gateway.calls.snapshot !== 2) return;
      if (next === "forbidden" || next === "unavailable") throw new AuthGuardError(next);
      if (next === "fingerprint") h.gateway.receipts[0]!.fingerprint = "{}";
      if (next === "result") h.gateway.receipts[0]!.result = { malformed: true };
    };
    await expect(h.run()).rejects.toBeInstanceOf(CommitOutcomeUnknown); expect(h.gateway.calls).toEqual({ snapshot: 2, commit: 1 });
  });
  it("conflito do banco não repete callback, gera novos IDs ou reenvia", async () => {
    const h = harness(); h.gateway.mode = "stale"; const before = structuredClone(h.gateway.state);
    await expect(h.run()).rejects.toMatchObject({ code: "CONFLICT" }); expect(h.gateway.calls).toEqual({ snapshot: 1, commit: 1 }); expect(h.gateway.state).toEqual(before); expect(h.gateway.receipts).toEqual([]);
  });
  it("CAS financeiro já antigo e ator alheio não chegam ao commit", async () => {
    const h = harness(); h.gateway.state.finance_revision = "1";
    await expect(h.run()).rejects.toMatchObject({ code: "CONFLICT" }); expect(h.gateway.calls.commit).toBe(0);
    await expect(h.store.transaction({ ...context, user_id: seriesId(9999) }, async () => null)).rejects.toThrow(); expect(h.gateway.calls.snapshot).toBe(1);
    expect(() => h.store.read(seriesId(9999))).toThrow();
  });
  it("rejeição SQL conhecida não é reenviada nem afirmada como sucesso", async () => {
    const h = harness(); h.gateway.mode = "validation"; await expect(h.run()).rejects.toMatchObject({ code: "VALIDATION" }); expect(h.gateway.calls).toEqual({ snapshot: 1, commit: 1 }); expect(h.gateway.state.series).toEqual([]);
  });
  it("falha no callback preserva o banco e fecha todos os ports de escrita", async () => {
    const h = harness(); let escaped: FinanceSeriesTransaction | null = null;
    await expect(h.store.transaction(context, async tx => { escaped = tx; await tx.series.insert(managedSeries()); throw new Error("SYNTHETIC_AFTER_WRITE"); })).rejects.toThrow("SYNTHETIC_AFTER_WRITE");
    expect(h.gateway.calls.commit).toBe(0); expect(h.gateway.state.series).toEqual([]);
    const late = escaped as FinanceSeriesTransaction | null; expect(late).not.toBeNull(); await expect(late!.series.insert(managedSeries())).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" }); await expect(late!.accounts.get(seriesId(2))).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
  });
  it("linha sem evento exato é recusada antes do envio, sem retirar a pós-condição do recibo", async () => {
    const h = harness(), series = managedSeries(), result = { version: 2 as const, series, affected: { created: 0, updated: 0, restored: 0, suppressed: 0, skipped: 0 } };
    await expect(h.store.transaction(context, async tx => { await tx.series.insert(series); await tx.receipts.insert({ user_id: SERIES_OWNER, command: h.request.command, client_id: h.request.input.client_id, fingerprint: assinatura(h.request.input), result }); return result; })).rejects.toThrow("Escrita sem evento");
    expect(h.gateway.calls.commit).toBe(0); expect(h.gateway.receipts).toEqual([]);
  });
});
