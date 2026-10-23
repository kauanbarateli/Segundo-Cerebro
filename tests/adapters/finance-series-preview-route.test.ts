import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn(), flag: vi.fn(), guard: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/finance-series-runtime", () => ({ financeSeriesGatewayForRequest: seams.gateway }));
vi.mock("../../src/adapters/db/finance-series-availability", () => ({ financeSeriesAvailable: seams.flag, requireFinanceSeriesAvailable: seams.guard }));
import { GET as availability } from "../../src/app/api/finance/series/availability/route";
import { POST as preview } from "../../src/app/api/finance/series/preview/route";
import { GET as page, POST as commit } from "../../src/app/api/finance/series/route";
import { assinatura } from "../../src/core/contracts/base";
import type { FinanceSeriesCommand } from "../../src/core/financeiro/series/series-types";
import { AuthGuardError } from "../../src/lib/auth/types";
import { SeriesGatewayFixture, channelCreate, SERIES_SESSION } from "../fixtures/finance-series-channel";
import { managedSeries, seriesId, SERIES_NOW, SERIES_OWNER } from "../fixtures/finance-series";
const origin = "https://app.example.test";
const actor = { userId: SERIES_OWNER, sessionId: SERIES_SESSION, mustChangePassword: false, role: "user", entitlements: { financeiro: true } };
const read = (owner = SERIES_OWNER) => new Request(origin + "/api/finance/series/availability", { headers: { "X-Expected-User-ID": owner } });
const write = (value: unknown, owner = SERIES_OWNER, requestOrigin = origin) => new Request(origin + "/api/finance/series/preview", { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", "X-Expected-User-ID": owner }, body: JSON.stringify(value) });
let gateway: SeriesGatewayFixture;
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(SERIES_NOW)); gateway = new SeriesGatewayFixture();
  seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(actor) } }); seams.gateway.mockReturnValue(gateway); seams.flag.mockReturnValue(true); seams.guard.mockImplementation(() => { if (!seams.flag()) throw new AuthGuardError("unavailable"); });
});
afterEach(() => vi.useRealTimers());
describe("T053-B3: disponibilidade anterior ao schema e prévia somente leitura", () => {
  it("flag ausente é desativada e somente o texto exato true habilita", async () => {
    const actual = await vi.importActual<{ financeSeriesAvailable(environment: Readonly<Record<string, string | undefined>>): boolean }>("../../src/adapters/db/finance-series-availability");
    expect(actual.financeSeriesAvailable({})).toBe(false); for (const value of ["", "false", "TRUE", "1", "true "]) expect(actual.financeSeriesAvailable({ FINANCE_SERIES_V2_ENABLED: value, FINANCE_SERIES_V2_SCHEMA_STATE: "classified" })).toBe(false);
    expect(actual.financeSeriesAvailable({ FINANCE_SERIES_V2_ENABLED: "true" })).toBe(false); expect(actual.financeSeriesAvailable({ FINANCE_SERIES_V2_ENABLED: "true", FINANCE_SERIES_V2_SCHEMA_STATE: "classified" })).toBe(true);
  });
  it("desativado retorna disponibilidade false sem RPC; page/commit/preview são bloqueados no servidor", async () => {
    seams.flag.mockReturnValue(false); const response = await availability(read()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, result: { version: 2, available: false } });
    expect((await page(new Request(origin + "/api/finance/series", { headers: { "X-Expected-User-ID": SERIES_OWNER } }))).status).toBe(503);
    expect((await commit(write(channelCreate()))).status).toBe(503); expect((await preview(write(channelCreate()))).status).toBe(503);
    expect(seams.gateway).not.toHaveBeenCalled(); expect(gateway.calls).toEqual({ snapshot: 0, commit: 0 });
  });
  it("Auth/dono/Entitlement precedem inclusive o resultado false, sem fallback legado", async () => {
    seams.flag.mockReturnValue(false); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } }); expect((await availability(read())).status).toBe(401); expect(seams.flag).not.toHaveBeenCalled();
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...actor, entitlements: { financeiro: false } }) } }); expect((await availability(read())).status).toBe(403);
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } }); expect((await availability(read(seriesId(9999)))).status).toBe(409); expect(seams.flag).not.toHaveBeenCalled(); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("prévia retorna referências e revisões da mesma snapshot sem escrita/recibo/eventos", async () => {
    const request = channelCreate(), before = structuredClone(gateway.state), spy = vi.spyOn(gateway, "snapshot"), response = await preview(write(request)), value = await response.json();
    expect(response.status).toBe(200); expect(value).toMatchObject({ ok: true, result: { version: 2, kind: "review", command: request.command, client_id: request.input.client_id, consistency: "same", today: "2026-10-23", revisions: { requested_finance: "0", observed_finance: "0", requested_series: null, observed_series: null }, data: { series: null, accounts: before.accounts, categories: before.categories } } });
    expect(spy).toHaveBeenCalledExactlyOnceWith(request); expect(gateway.state).toEqual(before); expect(gateway.receipts).toEqual([]); expect(gateway.calls).toEqual({ snapshot: 1, commit: 0 }); expect(JSON.stringify(value)).not.toMatch(/fingerprint|"receipt"|"events"/);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("revisão alterada exige reconferência sem mudar UUID, corpo, data ou revisão solicitados", async () => {
    const request = channelCreate(), before = structuredClone(request); gateway.state.finance_revision = "9007199254740993"; vi.setSystemTime(new Date("2026-10-24T01:30:00.000Z")); const spy = vi.spyOn(gateway, "snapshot"), value = await (await preview(write(request))).json();
    expect(value.result).toMatchObject({ client_id: request.input.client_id, consistency: "changed", today: "2026-10-23", revisions: { requested_finance: "0", observed_finance: "9007199254740993" } }); expect(spy).toHaveBeenCalledExactlyOnceWith(before); expect(request).toEqual(before); expect(gateway.calls.commit).toBe(0);
  });
  it("revisão da série é comparada independentemente da revisão financeira", async () => {
    const series = managedSeries({ revision: "2" }); gateway.state.series = [series]; const request: FinanceSeriesCommand = { command: "finance.recurring.pause", input: { client_id: seriesId(902), expected_finance_revision: "0", series_id: series.id, expected_revision: "1", from_on: "2026-10-23" } };
    const value = await (await preview(write(request))).json(); expect(value.result).toMatchObject({ consistency: "changed", revisions: { requested_series: "1", observed_series: "2" }, data: { series } }); expect(gateway.calls.commit).toBe(0);
  });
  it("recibo exato retorna só resultado original; não finge uma nova prévia nem retorna recibo bruto", async () => {
    const request = channelCreate(), result = { version: 2 as const, series: managedSeries(), affected: { created: 2, updated: 0, suppressed: 0, restored: 0, skipped: 0 } }; gateway.receipts.push({ user_id: SERIES_OWNER, command: request.command, client_id: request.input.client_id, fingerprint: assinatura(request.input), result });
    const response = await preview(write(request)); expect(response.status).toBe(200); const value = await response.json(); expect(value).toEqual({ ok: true, result: { version: 2, kind: "confirmed", command: request.command, client_id: request.input.client_id, result } }); expect(JSON.stringify(value)).not.toMatch(/fingerprint|"receipt"|"data"/); expect(gateway.calls.commit).toBe(0);
    gateway.receipts[0]!.fingerprint = "{}"; expect((await preview(write(request))).status).toBe(409); expect(gateway.calls.commit).toBe(0);
  });
  it("série não gerida sem recibo retorna404; Auth indisponível não vira legado ou revisão válida", async () => {
    const request: FinanceSeriesCommand = { command: "finance.recurring.pause", input: { client_id: seriesId(902), expected_finance_revision: "0", series_id: seriesId(4), expected_revision: "0", from_on: "2026-10-23" } };
    expect((await preview(write(request))).status).toBe(404); vi.spyOn(gateway, "snapshot").mockRejectedValue(new AuthGuardError("forbidden")); expect((await preview(write(request))).status).toBe(403); expect(gateway.calls.commit).toBe(0);
  });
  it("owner/CSRF/limites e DTO fechado protegem a prévia antes de qualquer RPC", async () => {
    expect((await preview(write(channelCreate(), seriesId(9999)))).status).toBe(409); expect((await preview(write(channelCreate(), SERIES_OWNER, "https://foreign.example.test"))).status).toBe(403);
    const request = channelCreate(); expect((await preview(write({ ...request, input: { ...request.input, user_id: SERIES_OWNER } }))).status).toBe(400);
    const oversized = new Request(origin + "/api/finance/series/preview", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": SERIES_OWNER }, body: " ".repeat(64 * 1024 + 1) }); expect((await preview(oversized)).status).toBe(400); expect(seams.gateway).not.toHaveBeenCalled();
  });
});
