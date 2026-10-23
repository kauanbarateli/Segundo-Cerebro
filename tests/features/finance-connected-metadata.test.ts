import { describe, expect, it, vi } from "vitest";
import { createConnectedApplication } from "../../src/lib/demo/connected-application";
import { validDomainCommandInput } from "../../src/lib/demo/client-command-specs";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { journalBrowser } from "./helpers/journal-browser";

const userId = "10000000-0000-4000-8000-000000000001";
const initial = createDemoFixture("2026-10-08T01:00:00.000Z", userId).initial;
const bank = initial.finance_account!.find(account => account.kind !== "credit_card")!;
const card = { ...initial.finance_account!.find(account => account.kind === "credit_card")!, last_four: "0042", default_payment_account_id: bank.id };
const body = (account: unknown = card) => ({ accounts: [bank, account], categories: [], transactions: [], budgets: [], tags: [] });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
describe("T052 — fronteira conectada dos metadados", () => {
  it("transporta metadados da conta própria sem consultar ou pagar automaticamente", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(body()));
    const app = createConnectedApplication(userId, { fetch: fetcher, journal: journalBrowser().tab().journal });
    expect(fetcher).not.toHaveBeenCalled();
    await app.load("finance");
    expect(app.getSnapshot("finance")).toMatchObject({ status: "ready", data: { accounts: [bank, card] } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/finance", expect.objectContaining({ method: "GET", credentials: "same-origin" }));
    app.dispose();
  });
  it.each([{ last_four: "12345" }, { last_four: 1234 }, { default_payment_account_id: "missing" }, { default_payment_account_id: card.id }])("DTO inválido %j é erro, não vazio nem valores demonstrativos", async patch => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(body({ ...card, ...patch }))).mockResolvedValueOnce(json(body()));
    const app = createConnectedApplication(userId, { fetch: fetcher, journal: journalBrowser().tab().journal });
    await app.load("finance");
    expect(app.getSnapshot("finance")).toMatchObject({ status: "error", data: null });
    await app.load("finance", true);
    expect(app.getSnapshot("finance")).toMatchObject({ status: "ready", data: { accounts: [bank, card] } });
    app.dispose();
  });
  it("a allowlist do cliente libera apenas os dois metadados e conserva veto a PAN/CVV/dono", () => {
    const input = { id: card.id, client_id: "metadata", patch: { last_four: "0042", default_payment_account_id: bank.id } };
    expect(validDomainCommandInput("finance.account.update", input)).toBe(true);
    for (const patch of [{ pan: "synthetic" }, { cvv: "synthetic" }, { user_id: userId }, { card_number: "synthetic" }]) {
      expect(validDomainCommandInput("finance.account.update", { ...input, patch })).toBe(false);
    }
  });
});
