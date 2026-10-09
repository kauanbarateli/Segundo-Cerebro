import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { beginPrivacyRender, flushPrivacyEffects, resetPrivacyHooks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seams = vi.hoisted(() => ({ hooks: { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 } as PrivacyHooks, app: { userId: "owner", initializeJournal: vi.fn(async () => undefined), clearSessionJournal: vi.fn(), setProjectVisibility: vi.fn(async () => undefined), refreshActive: vi.fn(async () => undefined), dispose: vi.fn() } }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), ...(await import("../helpers/privacy-hooks")).privacyHookMocks(seams.hooks) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/financeiro" }));
vi.mock("../../src/lib/navigation/demo-access-provider", () => ({ useDemoAccess: () => ({ policy: { entitlements: {}, preferences: {}, isAdmin: false }, ready: true, resetDemo: vi.fn() }) }));
vi.mock("../../src/lib/demo/connected-application", () => ({ createConnectedApplication: () => seams.app, DEMO_COMMAND_SESSION: {} }));
import { DemoApplicationProvider } from "../../src/lib/demo/demo-provider";
type ProviderTree = ReactElement<{ value: { valuesHidden: boolean; setValuesHidden(value: boolean): void }; children: ReactElement<{ value: { closing: boolean; logout(): void }; children: ReactElement<{ children?: ReactNode }> }> }>;
function render() { beginPrivacyRender(seams.hooks); const outer = DemoApplicationProvider({ children: <div>PRIVATE_CHILD_CANARY</div>, serverUserId: "owner", accountValuesHidden: true }); const tree = (outer.type as (props: unknown) => ProviderTree)(outer.props); flushPrivacyEffects(seams.hooks); return tree; }
beforeEach(() => { resetPrivacyHooks(seams.hooks); vi.clearAllMocks(); vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { href: "https://app.example.invalid/financeiro", origin: "https://app.example.invalid" } })); vi.stubGlobal("document", new EventTarget()); vi.stubGlobal("localStorage", { removeItem: vi.fn() }); });
afterEach(() => { for (const effect of seams.hooks.effects) effect.cleanup?.(); vi.unstubAllGlobals(); });
describe("provider logout conceals and unmounts before journal cleanup", () => {
 it("keeps privacy true and rejects a stale privacy callback while connected cleanup is pending", async () => {
  let resolve!: () => void; seams.app.clearSessionJournal.mockReturnValue(new Promise<void>(settle => { resolve = settle; })); const tree = render(), privacy = tree.props.value, app = tree.props.children.props.value;
  app.logout(); privacy.setValuesHidden(false); const closed = render(); expect(closed.props.value.valuesHidden).toBe(true); expect(closed.props.children.props.value.closing).toBe(true); expect(closed.props.children.props.children.props.children).toBe("Encerrando sua sessão…"); resolve(); await Promise.resolve();
 });
 it("submits a fresh connected form after cleanup even when the original shell form was removed", async () => {
  const submitted: boolean[] = [];
  class Form extends EventTarget { action = "https://app.example.invalid/auth/logout"; method = "post"; hidden = false; isConnected = false; submit() { submitted.push(this.isConnected); } }
  const doc = Object.assign(new EventTarget(), { createElement: vi.fn(() => new Form()), body: { appendChild: (form: Form) => { form.isConnected = true; } } }); vi.stubGlobal("document", doc); vi.stubGlobal("HTMLFormElement", Form);
  let resolve!: () => void; seams.app.clearSessionJournal.mockReturnValue(new Promise<void>(settle => { resolve = settle; })); render(); const original = new Form(); original.isConnected = true; const event = new Event("submit", { cancelable: true }); Object.defineProperty(event, "target", { value: original }); doc.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true); original.isConnected = false; render(); expect(submitted).toEqual([]); resolve(); for (let i = 0; i < 5; i++) await Promise.resolve(); expect(submitted).toEqual([true]); expect(doc.createElement).toHaveBeenCalledWith("form");
 });
});
