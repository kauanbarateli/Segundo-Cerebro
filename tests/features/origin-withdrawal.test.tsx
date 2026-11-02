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
function fixture(fetcher: typeof fetch, store = new Map<string, string>(), actor = owner) {
  const hooks: PrivacyHooks = { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 };
  vi.stubGlobal("fetch", fetcher);
  const win = new EventTarget() as EventTarget & { sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
  win.sessionStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); }, removeItem: key => { store.delete(key); } };
  vi.stubGlobal("window", win);
  const doc = new EventTarget() as EventTarget & { visibilityState: string }; doc.visibilityState = "visible"; vi.stubGlobal("document", doc);
  return { render() { seam.hooks = hooks; beginPrivacyRender(hooks); const tree = OriginWithdrawal({ userId: actor }); flushPrivacyEffects(hooks); return tree; }, unmount() { for (const effect of hooks.effects) effect.cleanup?.(); } };
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
      reads++; return active();
    });
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    let tree = app.render(); expect(text(tree)).toContain("Não foi possível confirmar"); expect(writes).toBe(1);
    expect(text(tree)).not.toContain("Retirar consentimento"); click(tree, "Verificar novamente"); await settle();
    tree = app.render(); expect(text(tree)).toContain("Não foi possível confirmar a retirada"); expect(text(tree)).not.toContain("Retirar consentimento"); expect(writes).toBe(1); app.unmount();
  });
  it("mantém o bloqueio na recarga mesmo se a leitura mostrar ausência", async () => {
    const store = new Map<string, string>(), fetcher = async (_path: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? Promise.reject(new DOMException("timeout", "TimeoutError")) : active();
    const first = fixture(fetcher, store); first.render(); await settle(); click(first.render(), "Retirar consentimento"); await settle(); first.unmount();
    const second = fixture(async () => json({ ok: true, result: { status: "absent", expiresAt: null } }), store);
    second.render(); await settle(); const tree = second.render();
    expect(text(tree)).toContain("Não foi possível confirmar a retirada"); expect(text(tree)).not.toContain("Não há consentimento ativo"); expect(text(tree)).not.toContain("Retirar consentimento"); second.unmount();
  });
  it.each([401, 403, 409])("recusa pré-RPC %s libera a escolha após entrar novamente", async status => {
    const store = new Map<string, string>();
    const first = fixture(async (_path, init) => init?.method === "POST" ? new Response(null, { status }) : active(), store);
    first.render(); await settle(); click(first.render(), "Retirar consentimento"); await settle();
    expect(text(first.render())).toContain("Não foi possível confirmar sua conta"); expect(store.size).toBe(0); first.unmount();
    const second = fixture(async () => active(), store); second.render(); await settle();
    const tree = second.render(); expect(text(tree)).toContain("Retirar consentimento"); expect(text(tree)).not.toContain("Não foi possível confirmar a retirada"); second.unmount();
  });
  it("resposta 503 mantém o marcador de operação incerta", async () => {
    const store = new Map<string, string>();
    const app = fixture(async (_path, init) => init?.method === "POST" ? new Response(null, { status: 503 }) : active(), store);
    app.render(); await settle(); click(app.render(), "Retirar consentimento"); await settle();
    expect(text(app.render())).toContain("Não foi possível confirmar a retirada"); expect([...store.values()]).toEqual(["1"]); app.unmount();
  });
  it("separa marcador de cada usuário sem armazenar ou exibir UTMs", async () => {
    const store = new Map<string, string>(), other = "20000000-0000-4000-8000-000000000002";
    const first = fixture(async (_path, init) => init?.method === "POST" ? Promise.reject(new DOMException("timeout", "TimeoutError")) : active(), store);
    first.render(); await settle(); click(first.render(), "Retirar consentimento"); await settle(); first.unmount();
    const requests: RequestInit[] = [];
    const second = fixture(async (_path, init) => { requests.push(init!); return active(); }, store, other);
    second.render(); await settle(); const tree = second.render();
    expect(text(tree)).toContain("Retirar consentimento"); expect((requests[0]?.headers as Record<string, string>)["x-expected-user-id"]).toBe(other);
    expect([...store.values()]).toEqual(["1"]); expect(JSON.stringify([...store.entries()])).not.toMatch(/utm_|2027-10-01/); expect(text(tree)).not.toMatch(/utm_|2027-10-01/); second.unmount();
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
