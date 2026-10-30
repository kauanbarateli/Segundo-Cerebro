import { beforeEach, describe, expect, it, vi } from "vitest";
import { Fragment, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommandFeedback } from "@/lib/demo/connected-application";
const seams = vi.hoisted(() => ({ state: { status: "idle" } as CommandFeedback, mode: "connected" as "connected" | "demo",
 retry: vi.fn(), initialize: vi.fn(), clear: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [false, vi.fn()], useEffect: () => undefined,
 useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/lib/demo/demo-provider", () => ({ useDemoApplication: () => ({ mode: seams.mode,
 subscribeCommands: () => () => undefined, getCommandSnapshot: () => seams.state,
 retryPendingCommand: seams.retry, initializeJournal: seams.initialize, clearCommandFeedback: seams.clear }) }));
import { ConnectedCommandFeedback } from "@/components/layout/connected-command-feedback";
const child = createElement("textarea", { key: "draft-editor", defaultValue: "SYNTHETIC_PRIVATE_DRAFT" });
const states: CommandFeedback[] = [
 { status: "idle" }, { status: "confirmed", clientId: "confirmed", href: "/conhecimento", label: "Abrir Conhecimento" },
 { status: "rejected", clientId: "rejected", message: "Recusa definitiva" }, { status: "pending", retrying: false, message: "Resultado incerto" },
 { status: "journal-error", message: "Sem armazenamento" }, { status: "session-changed", message: "Conta mudou" },
];
function tree() { return ConnectedCommandFeedback({ children: child }); }
function slot(node: ReactNode) {
 expect(isValidElement(node)).toBe(true); const root = node as ReactElement<{ children: ReactNode[] }>; expect(root.type).toBe(Fragment);
 const children = root.props.children; expect(Array.isArray(children)).toBe(true); expect(children).toHaveLength(2);
 const route = children[1] as ReactElement<{ children: ReactNode }>; expect(route.type).toBe(Fragment); expect(route.key).toBe("workspace-content"); return route;
}
beforeEach(() => { seams.mode = "connected"; seams.state = { status: "idle" }; vi.clearAllMocks(); });
describe("feedback preserves a fixed route slot; browser tests prove reconciliation", () => {
 it("keeps the exact element at the same keyed slot across idle and all non-revoking notices", () => {
  for (const state of states.filter(value => value.status !== "session-changed")) { seams.state = state; expect(slot(tree()).props.children).toBe(child); }
 });
 it("still removes private children on SESSION_CHANGED instead of hiding a mounted editor", () => {
  seams.state = { status: "session-changed", message: "Conta mudou" }; const node = tree(); expect(slot(node).props.children).toBe(false);
  const html = renderToStaticMarkup(node); expect(html).not.toContain("SYNTHETIC_PRIVATE_DRAFT"); expect(html).toContain("A conta foi alterada");
 });
 it("preserves demo slot and never automatically retries unknown or initializes a journal", () => {
  for (const state of states) { seams.state = state; seams.mode = "demo"; const node = tree(); expect(slot(node).props.children).toBe(child); expect(renderToStaticMarkup(node)).not.toContain("connected-command-feedback"); }
  seams.mode = "connected"; seams.state = { status: "pending", retrying: false, message: "Resultado incerto" };
  const html = renderToStaticMarkup(tree()); expect(html).toContain("Confirmar envio"); expect(html).not.toContain("Dispensar aviso");
  expect(seams.retry).not.toHaveBeenCalled(); expect(seams.initialize).not.toHaveBeenCalled(); expect(seams.clear).not.toHaveBeenCalled();
 });
});
