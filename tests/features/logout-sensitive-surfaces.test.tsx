import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DemoQueryKey } from "../../src/lib/demo/types";
import { beginPrivacyRender, flushPrivacyEffects, resetPrivacyHooks, type PrivacyHooks } from "../helpers/privacy-hooks";
const seams = vi.hoisted(() => ({
 hooks: { states: [], refs: [], memos: [], effects: [], pending: [], stateIndex: 0, refIndex: 0, memoIndex: 0, effectIndex: 0 } as PrivacyHooks,
 hidden: true, invalidations: new Set<(keys: readonly DemoQueryKey[]) => void>(), app: { userId: "owner", mode: "connected", closing: false, executeDomainCommand: vi.fn(), load: vi.fn(), getSnapshot: vi.fn(), subscribeInvalidations: vi.fn<(listener: (keys: readonly DemoQueryKey[]) => void) => () => void>() },
 policy: { entitlements: {}, preferences: {}, isAdmin: false }, close: vi.fn(), push: vi.fn(),
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), ...(await import("../helpers/privacy-hooks")).privacyHookMocks(seams.hooks) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: seams.push }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../src/lib/demo/demo-provider", () => ({ DEMO_LOGOUT_EVENT: "segundo-cerebro:demo-logout", useDemoApplication: () => seams.app, useDemoPrivacy: () => ({ valuesHidden: seams.hidden }) }));
vi.mock("../../src/lib/navigation/demo-access-provider", () => ({ useDemoAccess: () => ({ policy: seams.policy, connected: true }) }));
vi.mock("../../src/components/ui/button", () => ({ Button: "button" }));
vi.mock("../../src/components/ui/field", () => ({ Field: "select" }));
vi.mock("../../src/components/ui/dialog", () => ({ Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? children : null }));
import { RelatedPanel } from "../../src/components/layout/related-panel";
import { CommandPalette } from "../../src/components/layout/command-palette";
const financial = { type: "transaction", id: "money", title: "FINANCIAL_PRIVATE_CANARY", href: "/financeiro?transaction=money" }, related = { source: { type: "capture", id: "source", title: "Capture", href: "/capturar?capture=source" }, items: [{ ...financial, link_id: "link" }] };
function renderRelated() { beginPrivacyRender(seams.hooks); const outer = RelatedPanel({ type: "capture", id: "source" }); const result = outer ? (outer.type as (props: unknown) => ReactNode)(outer.props) : null; flushPrivacyEffects(seams.hooks); return result; }
function renderPalette() { beginPrivacyRender(seams.hooks); const result = CommandPalette({ open: true, onClose: seams.close }); flushPrivacyEffects(seams.hooks); return result; }
function find(node: ReactNode, predicate: (node: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined { for (const child of Children.toArray(node)) { if (!isValidElement<Record<string, unknown>>(child)) continue; if (predicate(child)) return child; const nested = find(child.props.children as ReactNode, predicate); if (nested) return nested; } }
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function logout() { window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId: "owner" } })); }
function invalidate(keys: readonly DemoQueryKey[]) { for (const listener of seams.invalidations) listener(keys); }
beforeEach(() => { resetPrivacyHooks(seams.hooks); vi.clearAllMocks(); seams.invalidations.clear(); seams.app.subscribeInvalidations.mockImplementation(listener => { seams.invalidations.add(listener); return () => { seams.invalidations.delete(listener); }; }); seams.hidden = true; seams.app.closing = false; vi.stubGlobal("window", new EventTarget()); });
afterEach(() => { for (const effect of seams.hooks.effects) effect.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("logout clears sensitive search and related local state", () => {
 it("discards a related read whose body finishes after logout and aborts its transport", async () => {
  let resolve!: (value: unknown) => void; const body = new Promise(resolveBody => { resolve = resolveBody; }); const fetcher = vi.fn(async () => ({ ok: true, json: () => body })); vi.stubGlobal("fetch", fetcher);
  renderRelated(); await settle(); logout(); resolve(related); await settle();
  expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true); expect(seams.hooks.states[0]).toBeNull(); expect(seams.hooks.states[1]).toEqual([]); expect(renderRelated()).toBeNull();
 });
 it("removes financial text, aria-label and options; late chooser cannot refill or send", async () => {
  let resolve!: (value: unknown) => void; const choice = new Promise(resolveBody => { resolve = resolveBody; }); const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => related }).mockResolvedValueOnce({ ok: true, json: () => choice }); vi.stubGlobal("fetch", fetcher);
  renderRelated(); await settle(); seams.hooks.states[1] = [financial]; seams.hooks.states[3] = true; seams.hooks.states[5] = JSON.stringify([financial.type, financial.id]); const tree = renderRelated();
  const html = renderToStaticMarkup(tree); expect(html).toContain("valores ocultos"); expect(html).not.toContain(financial.title);
  const choose = find(tree, node => node.props.children === "Vincular registro")!, confirm = find(tree, node => node.props.children === "Vincular")!;
  (choose.props.onClick as () => void)(); await settle(); logout(); seams.hidden = false; resolve({ targets: [financial], pages: [], notebooks: [] }); await settle();
  expect(seams.hooks.states[0]).toBeNull(); expect(seams.hooks.states[1]).toEqual([]); expect(seams.hooks.states[5]).toBe(""); expect(renderToStaticMarkup(renderRelated())).not.toContain(financial.title);
  (choose.props.onClick as () => void)(); (confirm.props.onClick as () => void)(); await settle(); expect(fetcher).toHaveBeenCalledTimes(2); expect(seams.app.executeDomainCommand).not.toHaveBeenCalled();
 });
 it("clears palette memory and ignores a late search after logout even when privacy changes", async () => {
  vi.useFakeTimers(); let resolve!: (value: unknown) => void; const body = new Promise(resolveBody => { resolve = resolveBody; }), fetcher = vi.fn(async () => ({ ok: true, json: () => body })); vi.stubGlobal("fetch", fetcher);
  let tree = renderPalette(); const field = find(tree, node => node.props.label === "Buscar informações e módulos")!; (field.props.onChange as (event: unknown) => void)({ target: { value: "fin" } }); renderPalette(); await vi.advanceTimersByTimeAsync(180);
  seams.hooks.states[1] = [{ ...financial, rank: 0 }]; tree = renderPalette(); expect(renderToStaticMarkup(tree)).not.toContain(financial.title);
  logout(); seams.hidden = false; resolve({ items: [{ ...financial, rank: 0 }] }); await settle(); expect(seams.hooks.states[0]).toBe(""); expect(seams.hooks.states[1]).toEqual([]); expect(renderPalette()).toBeNull(); expect(seams.close).toHaveBeenCalledOnce();
  expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true); await vi.advanceTimersByTimeAsync(1000); expect(fetcher).toHaveBeenCalledOnce();
 });
 it("closing prevents either surface from mounting content or querying", async () => { seams.app.closing = true; const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); expect(renderRelated()).toBeNull(); resetPrivacyHooks(seams.hooks); expect(renderPalette()).toBeNull(); await settle(); expect(fetcher).not.toHaveBeenCalled(); });
});
describe("related metadata follows committed invalidations", () => {
 const file = { type: "file", id: "document", title: "Arquivo anterior", href: "/drive?file=document", link_id: "file-link" };
 it("refreshes a renamed target and removes a deleted target without loading Knowledge or retaining the old title", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ source: related.source, items: [file] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ source: related.source, items: [{ ...file, title: "Arquivo renomeado" }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ source: related.source, items: [] }) }); vi.stubGlobal("fetch", fetcher);
  renderRelated(); await settle(); expect(renderToStaticMarkup(renderRelated())).toContain(file.title);
  invalidate(["settings", "vault"]); await settle(); expect(fetcher).toHaveBeenCalledOnce();
  invalidate(["drive", "knowledge"]); await settle(); const renamed = renderToStaticMarkup(renderRelated()); expect(renamed).toContain("Arquivo renomeado"); expect(renamed).not.toContain(file.title);
  invalidate(["drive", "knowledge"]); await settle(); const removed = renderToStaticMarkup(renderRelated()); expect(removed).toContain("Nenhum vínculo neste registro."); expect(removed).not.toContain("Arquivo renomeado"); expect(seams.app.load).not.toHaveBeenCalled();
  logout(); invalidate(["drive", "knowledge"]); await settle(); expect(fetcher).toHaveBeenCalledTimes(3); expect(renderRelated()).toBeNull();
 });
 it("does not restore a deleted target when an older rename response finishes last", async () => {
  let resolveRename!: (value: unknown) => void; const rename = new Promise(resolveBody => { resolveRename = resolveBody; });
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ source: related.source, items: [file] }) }).mockResolvedValueOnce({ ok: true, json: () => rename }).mockResolvedValueOnce({ ok: true, json: async () => ({ source: related.source, items: [] }) }); vi.stubGlobal("fetch", fetcher);
  renderRelated(); await settle(); invalidate(["drive", "knowledge"]); await settle(); invalidate(["drive", "knowledge"]); await settle();
  expect(seams.hooks.states[0]).toMatchObject({ items: [] }); resolveRename({ source: related.source, items: [{ ...file, title: "Resposta anterior tardia" }] }); await settle();
  expect(seams.hooks.states[0]).toMatchObject({ items: [] }); const html = renderToStaticMarkup(renderRelated()); expect(html).toContain("Nenhum vínculo neste registro."); expect(html).not.toContain("Resposta anterior tardia"); expect(html).not.toContain(file.title);
 });
});
