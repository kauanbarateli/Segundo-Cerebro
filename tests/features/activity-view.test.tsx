import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ mode: "demo", policy: { entitlements: {} as Record<string, boolean>, preferences: {}, isAdmin: false } }));
vi.mock("../../src/lib/demo/demo-provider", () => ({ DEMO_LOGOUT_EVENT: "segundo-cerebro:demo-logout", useDemoApplication: () => ({ mode: state.mode, userId: "example" }) }));
vi.mock("../../src/lib/navigation/demo-access-provider", () => ({ useDemoAccess: () => ({ ready: true, policy: state.policy }) }));
import { ActivityPanel, ActivityView } from "../../src/components/features/atividade/activity-view";
import { INITIAL_ACTIVITY } from "../../src/components/features/atividade/activity-reader";
const actions = { refresh() {}, retry() {}, next() {}, previous() {} };
describe("Activity presentation", () => {
  it("labels demonstration explicitly and never renders a real reader", () => {
    state.mode = "demo";
    const html = renderToStaticMarkup(<ActivityView />);
    expect(html).toContain("Nenhum registro de produção é consultado aqui");
    expect(html).not.toContain("Carregando atividade");
  });
  it("denied sources do not mount the connected reader", () => {
    state.mode = "connected"; state.policy.entitlements = { capturar: false, tarefas: false };
    const html = renderToStaticMarkup(<ActivityView />);
    expect(html).toContain("A atividade não está disponível"); expect(html).not.toContain("Carregando atividade");
    state.policy.entitlements = {};
  });
  it("errors are not presented as an empty history and session change offers reload", () => {
    const html = renderToStaticMarkup(<ActivityPanel {...actions} state={{ ...INITIAL_ACTIVITY, status: "error", error: "A conta mudou", closed: true, recovery: "reload" }} />);
    expect(html).toContain('role="alert"'); expect(html).toContain("Recarregar página");
    expect(html).not.toContain("Tentar novamente"); expect(html).not.toContain("Nenhum registro");
  });
  it("formats time in São Paulo and lists changed field names without contents", () => {
    const html = renderToStaticMarkup(<ActivityPanel {...actions} state={{ ...INITIAL_ACTIVITY, status: "ready", data: { items: [{ id: "a", entity_id: "b", entity_type: "capture", action: "updated", canal: "web", occurred_at: "2026-10-07T20:00:00.123456Z", title: "<nota>", changed_fields: ["content", "title"] }], next_cursor: null } }} />);
    expect(html).toContain("17:00"); expect(html).toContain("&lt;nota&gt;"); expect(html).toContain("Campos alterados: texto, título");
    expect(html).toContain('dateTime="2026-10-07T20:00:00.123456Z"'); expect(html).toContain("Registros de atividade");
  });
});
