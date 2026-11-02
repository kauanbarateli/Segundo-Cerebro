import { afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seam = vi.hoisted(() => ({ hooks: null as unknown as PrivacyHooks }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useState"]>) => privacyHookMocks(seam.hooks).useState(...args),
  useRef: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useRef"]>) => privacyHookMocks(seam.hooks).useRef(...args),
  useCallback: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useCallback"]>) => privacyHookMocks(seam.hooks).useCallback(...args),
  useEffect: (...args: Parameters<ReturnType<typeof privacyHookMocks>["useEffect"]>) => privacyHookMocks(seam.hooks).useEffect(...args),
}));
vi.mock("@/components/ui/button", () => ({ Button: "action-button" }));
import { OriginWithdrawalV2 } from "../../src/components/legal/origin-withdrawal-v2";
const owner = "10000000-0000-4000-8000-000000000001", revision = "30000000-0000-4000-8000-000000000001", newer = "40000000-0000-4000-8000-000000000001";
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const active = (r = revision) => json({ ok: true, result: { status: "active", revision: r } });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) { if (!isValidElement<Record<string, unknown>>(child)) continue; if (predicate(child)) return child; const found = find(child.props.children as ReactNode, predicate); if (found) return found; }
}
const text = (value: ReactNode) => JSON.stringify(value, (_key, item) => typeof item === "function" ? undefined : item);
function fixture(fetcher: typeof fetch) {
  const hooks: PrivacyHooks = { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 };
  vi.stubGlobal("fetch", fetcher); vi.stubGlobal("window", new EventTarget());
  const doc = new EventTarget() as EventTarget & { visibilityState: string }; doc.visibilityState = "visible"; vi.stubGlobal("document", doc);
  return { render() { seam.hooks = hooks; beginPrivacyRender(hooks); const tree = OriginWithdrawalV2({ userId: owner }); flushPrivacyEffects(hooks); return tree; }, unmount() { for (const effect of hooks.effects) effect.cleanup?.(); } };
}
function click(tree: ReactNode, label: string) { (find(tree, element => element.type === "action-button" && element.props.children === label)!.props.onClick as () => void)(); }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("retirada versionada pelo titular", () => {
  it("após timeout repete somente a revisão originalmente escolhida", async () => {
    const bodies: string[] = []; let writes = 0;
    const app = fixture(async (_path, init) => {
      if (init?.method !== "POST") return active();
      bodies.push(String(init.body)); if (++writes === 1) throw new DOMException("timeout", "TimeoutError");
      return json({ ok: true, result: { status: "withdrawn" } });
    });
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    let tree = app.render(); expect(text(tree)).toContain("Não foi possível confirmar"); click(tree, "Tentar novamente"); await settle();
    tree = app.render(); expect(text(tree)).toContain("Consentimento retirado."); expect(bodies).toEqual([JSON.stringify({ revision }), JSON.stringify({ revision })]);
    expect(text(tree)).not.toContain(revision); expect(text(tree)).not.toContain("utm_"); app.unmount();
  });
  it("reconsentimento stale exige revisão e nova ação explícita", async () => {
    let reads = 0, writes = 0;
    const app = fixture(async (_path, init) => { if (init?.method === "POST") { writes++; return json({ ok: true, result: { status: "stale" } }); } return active(++reads === 1 ? revision : newer); });
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    let tree = app.render(); expect(text(tree)).toContain("Sua escolha mudou"); expect(writes).toBe(1);
    click(tree, "Revisar escolha"); await settle(); tree = app.render(); expect(text(tree)).toContain("Retirar consentimento"); expect(writes).toBe(1); app.unmount();
  });
  it("retorno após timeout consulta nova revisão e exige novo clique", async () => {
    let reads = 0; const bodies: string[] = [];
    const app = fixture(async (_path, init) => {
      if (init?.method !== "POST") return active(++reads === 1 ? revision : newer);
      bodies.push(String(init.body)); if (bodies.length === 1) throw new DOMException("timeout", "TimeoutError");
      return json({ ok: true, result: { status: "withdrawn" } });
    });
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    expect(text(app.render())).toContain("Não foi possível confirmar"); window.dispatchEvent(new Event("focus")); await settle();
    const tree = app.render(); expect(text(tree)).toContain("Retirar consentimento"); expect(bodies).toEqual([JSON.stringify({ revision })]);
    click(tree, "Retirar consentimento"); await settle(); expect(bodies).toEqual([JSON.stringify({ revision }), JSON.stringify({ revision: newer })]); app.unmount();
  });
  it("troca de conta fecha a página sem mostrar a revisão anterior", async () => {
    let calls = 0; const app = fixture(async () => ++calls === 1 ? active() : new Response(null, { status: 409 }));
    app.render(); await settle(); window.dispatchEvent(new Event("focus")); await settle(); const tree = app.render();
    expect(text(tree)).toContain("Não foi possível confirmar sua conta"); expect(text(tree)).not.toContain(revision); expect(text(tree)).not.toContain("Retirar consentimento"); app.unmount();
  });
  it("servidor indisponível não é tratado como ausência", async () => {
    const app = fixture(async () => new Response(null, { status: 503 })); app.render(); await settle();
    const tree = app.render(); expect(text(tree)).toContain("Não foi possível verificar"); expect(text(tree)).not.toContain("Não há consentimento ativo"); app.unmount();
  });
});
