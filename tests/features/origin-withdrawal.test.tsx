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
import { OriginWithdrawal } from "../../src/components/legal/origin-withdrawal";
const owner = "10000000-0000-4000-8000-000000000001";
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const active = () => json({ ok: true, result: { status: "active", expiresAt: "2027-10-01T00:00:00Z" } });
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) { if (!isValidElement<Record<string, unknown>>(child)) continue; if (predicate(child)) return child; const found = find(child.props.children as ReactNode, predicate); if (found) return found; }
}
const text = (value: ReactNode) => JSON.stringify(value, (_key, item) => typeof item === "function" ? undefined : item);
function fixture(fetcher: typeof fetch) {
  const hooks: PrivacyHooks = { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 };
  vi.stubGlobal("fetch", fetcher); vi.stubGlobal("window", new EventTarget());
  const doc = new EventTarget() as EventTarget & { visibilityState: string }; doc.visibilityState = "visible"; vi.stubGlobal("document", doc);
  return { render() { seam.hooks = hooks; beginPrivacyRender(hooks); const tree = OriginWithdrawal({ userId: owner }); flushPrivacyEffects(hooks); return tree; }, unmount() { for (const effect of hooks.effects) effect.cleanup?.(); } };
}
function click(tree: ReactNode, label: string) { (find(tree, element => element.type === "action-button" && element.props.children === label)!.props.onClick as () => void)(); }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("retirada da origem pelo titular", () => {
  it("usa a identidade esperada e confirma apenas após sucesso", async () => {
    const requests: RequestInit[] = [];
    const app = fixture(async (_path, init) => { requests.push(init!); return init?.method === "POST" ? json({ ok: true, result: { status: "withdrawn" } }) : active(); });
    app.render(); await settle(); let tree = app.render(); expect(text(tree)).toContain("Retirar consentimento");
    click(tree, "Retirar consentimento"); await settle(); tree = app.render(); expect(text(tree)).toContain("Consentimento retirado.");
    expect(requests).toHaveLength(2); expect(requests.every(request => (request.headers as Record<string, string>)["x-expected-user-id"] === owner)).toBe(true);
    expect(requests[1]?.body).toBe("{}"); expect(text(tree)).not.toMatch(/utm_|2027-10-01/); app.unmount();
  });
  it("fecha estado anterior quando outra conta assume a sessão", async () => {
    let calls = 0; const app = fixture(async () => ++calls === 1 ? active() : new Response(null, { status: 409 }));
    app.render(); await settle(); expect(text(app.render())).toContain("Retirar consentimento");
    window.dispatchEvent(new Event("focus")); await settle(); const tree = app.render();
    expect(text(tree)).toContain("Não foi possível confirmar sua conta"); expect(text(tree)).not.toContain("Retirar consentimento"); app.unmount();
  });
  it("não declara sucesso se a resposta falhar ou trouxer valores extras", async () => {
    const app = fixture(async (_path, init) => init?.method === "POST" ? json({ ok: true, result: { status: "withdrawn", utm_source: "privado" } }) : active());
    app.render(); await settle(); const tree = app.render(); click(tree, "Retirar consentimento"); await settle();
    const after = app.render(); expect(text(after)).toContain("Não foi possível confirmar"); expect(text(after)).not.toContain("Consentimento retirado."); expect(text(after)).not.toContain("privado"); app.unmount();
  });
  it("resultado incerto não repete POST e exige consultar o estado antes de nova ação", async () => {
    let reads = 0, writes = 0;
    const app = fixture(async (_path, init) => {
      if (init?.method === "POST") { writes++; throw new DOMException("timeout", "TimeoutError"); }
      return ++reads === 1 ? active() : json({ ok: true, result: { status: "absent", expiresAt: null } });
    });
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    let tree = app.render(); expect(text(tree)).toContain("Não foi possível confirmar"); expect(writes).toBe(1);
    expect(text(tree)).not.toContain("Retirar consentimento"); click(tree, "Verificar novamente"); await settle();
    tree = app.render(); expect(text(tree)).toContain("Não há consentimento ativo"); expect(writes).toBe(1); app.unmount();
  });
  it("revalida a identidade se a conta mudar enquanto a retirada está em andamento", async () => {
    let finish!: (response: Response) => void, reads = 0;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    const app = fixture(async (_path, init) => init?.method === "POST" ? pending : ++reads === 1 ? active() : new Response(null, { status: 409 }));
    app.render(); await settle(); click(app.render(), "Retirar consentimento");
    window.dispatchEvent(new Event("focus")); expect(text(app.render())).not.toContain("Retirar consentimento");
    finish(json({ ok: true, result: { status: "withdrawn" } })); await settle();
    const tree = app.render(); expect(text(tree)).toContain("Não foi possível confirmar sua conta"); expect(text(tree)).not.toContain("Consentimento retirado."); app.unmount();
  });
});
