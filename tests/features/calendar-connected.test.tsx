import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const seams = vi.hoisted(() => ({ mode: "connected", view: "month", policy: { entitlements: {} as Record<string, boolean>, preferences: {}, isAdmin: false }, data: {} as unknown, queried: [] as string[] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams({ date: "2026-10-10", view: seams.view }) }));
vi.mock("../../src/lib/demo/demo-provider", () => ({ useDemoApplication: () => ({ mode: seams.mode, userId: "25000000-0000-4000-8000-000000000001", today: () => "2026-10-09", executeDomainCommand: vi.fn(), refreshActive: vi.fn(), commands: { captures: { create: vi.fn() } } }), useDemoQuery: (key: string, enabled = true) => { if (enabled) seams.queried.push(key); return enabled ? { status: "ready", data: key === "agenda" ? seams.data : { items: [] }, retry: vi.fn() } : { status: "idle", data: null, retry: vi.fn() }; }, DEMO_LOGOUT_EVENT: "demo-logout" }));
vi.mock("../../src/lib/navigation/demo-access-provider", () => ({ useDemoAccess: () => ({ policy: seams.policy }) }));
vi.mock("../../src/components/layout/related-panel", () => ({ RelatedPanel: () => null }));
import { CalendarWorkspace } from "../../src/components/features/calendario/calendar-workspace";
import { CalendarIntegrations } from "../../src/components/features/calendario/calendar-integrations";
const owner = "25000000-0000-4000-8000-000000000001", account = "25000000-0000-4000-8000-000000000002", source = "25000000-0000-4000-8000-000000000003";
beforeEach(() => { seams.mode = "connected"; seams.view = "month"; seams.policy.entitlements = {}; seams.queried = []; seams.data = { accounts: [{ id: account, user_id: owner, email: "calendar@example.invalid", status: "connected", scopes: [], last_synced_at: null }], calendars: [{ id: source, account_id: account, user_id: owner, name: "Equipe", color_key: "calendar", selected: true }], items: [{ id: "event", title: "Retiro de três dias", starts_at: "2026-10-09T03:00:00Z", ends_at: "2026-10-12T03:00:00Z", all_day: true, location: null, linked_capture_id: null, habit_id: null }], preferences: { default_calendar_view: "month", meeting_reminders_enabled: true, meeting_reminder_minutes: 10 }, window: { start_day: "2026-10-01", end_day: "2026-11-01" } }; });
describe("Calendar actual static UI, no browser or OAuth transport", () => {
 // Layout Codex: sources moved from Switch to the "Meus calendários" checkbox list (spec §6).
 it("connected controls expose real accounts, sources and reading-only status", () => { const html = renderToStaticMarkup(<CalendarWorkspace />); expect(html).toContain("calendar@example.invalid"); expect(html).toContain("Conectar Google"); expect(html).toContain("Sincronizar período"); expect(html).toMatch(/role="checkbox" aria-checked="true"[^>]*>(?:(?!<\/button>).)*Equipe/); expect(html).toContain("Agenda Google em modo de leitura"); expect(html).not.toContain("Agenda de exemplo"); });
 // Layout Codex: the agenda (data-day) replaces the month list cards; titles are counted
 // in their visible <strong>, since accessible names now repeat them.
 it.each(["month", "week", "day", "list"])("three-day event appears on %s view without false exclusive-end day", view => {
  seams.view = view; const html = renderToStaticMarkup(<CalendarWorkspace />);
  expect(html).toContain("Retiro de três dias"); expect(html).toContain("Dia inteiro");
  const agendaDays = [...html.matchAll(/class="calendar-agenda-day" data-day="([^"]+)"/g)].map(match => match[1]);
  if (view === "month") {
   expect(html).toContain('aria-label="Mês em lista"');
   expect(agendaDays.slice(-3)).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  } else if (view === "list") {
   expect(html).toContain("Próximos eventos"); expect(html).toContain("Em andamento");
   expect(html.match(/class="calendar-list-event"/g)).toHaveLength(1);
   expect(html).not.toContain('class="calendar-agenda-day"');
   expect(html).toContain('data-day="2026-10-10"');
  } else expect(agendaDays).not.toContain("2026-10-12");
 });
 it("an unsynchronized window is partial, never a confirmed empty result", () => {
  seams.view = "list"; seams.data = { ...(seams.data as object), window: null, items: [] };
  const html = renderToStaticMarkup(<CalendarWorkspace />);
  expect(html).toContain("cache disponível"); expect(html).toContain("no cache parcial");
  expect(html).not.toContain("Nenhum compromisso neste período");
 });
 it("all-day bar spans only the included days in the week grid", () => { seams.view = "week"; const html = renderToStaticMarkup(<CalendarWorkspace />); const bars = html.match(/<button[^>]*calendar-all-day-event[^>]*>/g) ?? []; expect(bars).toHaveLength(1); expect(bars[0]).toContain("grid-column:6 / span 3"); expect(html).toContain('<span class="calendar-all-day-range">9 de outubro – 11 de outubro</span>'); });
 it("all sources hidden explain the state and offer recovery", () => { seams.data = { ...(seams.data as object), calendars: [{ id: source, account_id: account, user_id: owner, name: "Equipe", color_key: "calendar", selected: false }], items: [] }; const html = renderToStaticMarkup(<CalendarWorkspace />); expect(html).toContain("Todos os calendários estão ocultos"); expect(html).toContain("Revisar calendários"); expect(html).not.toContain("Nenhum compromisso neste período"); });
 it("demo never offers external OAuth or disconnect controls", () => { seams.mode = "demo"; const html = renderToStaticMarkup(<CalendarWorkspace />); expect(html).toContain("Agenda de exemplo"); expect(html).not.toContain("Conectar Google"); expect(html).not.toContain("Desconectar"); });
 it("Integrações composes the same account management, sources and per-account sync", () => { const html = renderToStaticMarkup(<CalendarIntegrations />); expect(seams.queried).toContain("agenda"); expect(html).toContain('id="calendar-accounts"'); expect(html).toContain("calendar@example.invalid"); expect(html).toContain("Conectar Google"); expect(html).toContain("Reconectar"); expect(html).toContain("Desconectar"); expect(html).toMatch(/role="group" aria-label="Calendários de calendar@example.invalid"/); expect(html).toMatch(/role="checkbox" aria-checked="true"/); expect(html).toContain("Sincronizar"); expect(html).toContain("de 1 de outubro de 2026 a 31 de outubro de 2026"); expect(html).toContain("Somente leitura"); });
 it("Integrações in demo stays honest: example calendars, no OAuth or disconnect", () => { seams.mode = "demo"; seams.data = { items: [], calendars: [{ id: "calendar-work", name: "Trabalho de exemplo", color_key: "work" }] }; const html = renderToStaticMarkup(<CalendarIntegrations />); expect(html).toContain("Nenhuma conta conectada nesta demonstração"); expect(html).toContain("Trabalho de exemplo"); expect(html).not.toContain("Conectar Google"); expect(html).not.toContain("Desconectar"); });
 it("Integrações without Calendar entitlement explains and never reads agenda", () => { seams.policy.entitlements = { calendario: false }; const html = renderToStaticMarkup(<CalendarIntegrations />); expect(seams.queried).not.toContain("agenda"); expect(html).toContain("Calendário indisponível para esta conta"); expect(html).not.toContain("calendar@example.invalid"); expect(html).not.toContain("Abrir calendário"); });
});
