import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { ConnectedCommandFeedback } from "../../../src/components/layout/connected-command-feedback";
import type { CommandFeedback } from "../../../src/lib/demo/connected-application";

// A closed presentation port, not a journal/Auth/backend substitute.
// ReactDOM and the production feedback wrapper reconcile the actual child.
const listeners = new Set<() => void>();
let state: CommandFeedback = { status: "idle" }, sequence = 0, mounts = 0, unmounts = 0;
const calls = { retry: 0, initialize: 0 };
function publish(next: CommandFeedback) { state = next; for (const listener of listeners) listener(); }
const app = {
  mode: "connected" as "connected" | "demo",
  subscribeCommands(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getCommandSnapshot: () => state,
  clearCommandFeedback: () => publish({ status: "idle" }),
  retryPendingCommand: async () => { calls.retry++; },
  initializeJournal: async () => { calls.initialize++; },
};
export function useDemoApplication() { return app; }
export function FeedbackNavigationLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
function EditorProbe() {
  const [instance] = useState(() => ++sequence), [draft, setDraft] = useState("");
  useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
  return <section data-feedback-probe={instance}><label>Rascunho do editor-probe<textarea value={draft} onChange={event => setDraft(event.target.value)} /></label></section>;
}
type StateName = "idle" | "confirmed" | "rejected" | "unknown" | "journal-error" | "session-changed";
function select(name: StateName) {
  if (name === "idle") publish({ status: "idle" });
  else if (name === "confirmed") publish({ status: "confirmed", clientId: "probe-confirmed", href: "/conhecimento", label: "Abrir Conhecimento" });
  else if (name === "rejected") publish({ status: "rejected", clientId: "probe-rejected", message: "Recusa sintética definitiva." });
  else if (name === "unknown") publish({ status: "pending", retrying: false, message: "Resultado sintético ainda não confirmado." });
  else if (name === "journal-error") publish({ status: "journal-error", message: "Armazenamento sintético indisponível." });
  else if (name === "session-changed") publish({ status: "session-changed", message: "Conta sintética alterada." });
  else throw new Error("Unknown finite feedback state.");
}
Object.assign(globalThis, { __startFeedbackLifetime: (mode: "connected" | "demo") => {
  const target = document.getElementById("feedback-lifetime");
  if (!target || !["connected", "demo"].includes(mode)) throw new Error("Invalid feedback fixture.");
  app.mode = mode;
  createRoot(target).render(<ConnectedCommandFeedback><EditorProbe /></ConnectedCommandFeedback>);
}, __feedbackLifetime: { select, counts: () => ({ mounts, unmounts, sequence, calls: { ...calls } }) } });
