import { StrictMode, createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "../../../src/components/ui/button";
import { FinanceSeriesPanel } from "../../../src/components/features/financeiro/series/finance-series-panel";
import type { DemoQueries } from "../../../src/lib/demo/types";
import "../../../src/components/features/financeiro/finance.css";

/** Only the authenticated provider is synthetic. Panel, drawers, money fields,
 * HTTP transport, durable journal and native Web Locks are production code. */
export interface FinanceSeriesFixturePayload { ownerId: string; data: DemoQueries["finance"] }
interface FixtureSession extends FinanceSeriesFixturePayload { epoch: number; closing: boolean }
interface FixtureProvider { session: FixtureSession; hidden: boolean; setHidden(value: boolean): void }
const Provider = createContext<FixtureProvider | null>(null);
const refreshes: string[] = [];
let root: Root | null = null, changeSession: Dispatch<SetStateAction<FixtureSession>> | null = null;
function useFixtureProvider() { const value = useContext(Provider); if (!value) throw new Error("SYNTHETIC_PROVIDER_MISSING"); return value; }
export function useDemoApplication() {
  const { session } = useFixtureProvider();
  return { mode: "connected" as const, userId: session.ownerId, epoch: session.epoch, closing: session.closing,
    today: () => "2026-10-23", refreshActive: async () => { refreshes.push(session.ownerId); } };
}
export function useDemoPrivacy() { const value = useFixtureProvider(); return { valuesHidden: value.hidden, setValuesHidden: value.setHidden }; }
function FixtureApp({ initial }: { initial: FinanceSeriesFixturePayload }) {
  const [session, setSession] = useState<FixtureSession>({ ...initial, epoch: 0, closing: false }), [hidden, setHidden] = useState(false);
  changeSession = setSession;
  return <Provider value={{ session, hidden, setHidden }}><main className="finance-workspace" style={{ maxWidth: 1100, marginInline: "auto", padding: 16 }}>
    <h1>Financeiro sintético</h1><Button aria-pressed={hidden} onClick={() => setHidden(value => !value)}>{hidden ? "Exibir valores" : "Ocultar valores"}</Button>
    {session.closing ? <p role="status">Sessão sintética encerrada</p> : <FinanceSeriesPanel data={session.data} />}
  </main></Provider>;
}
Object.assign(globalThis, {
  __financeSeriesRefreshes: refreshes,
  __startFinanceSeries(payload: FinanceSeriesFixturePayload) {
    const host = document.getElementById("finance-series-root"); if (!host) throw new Error("FIXTURE_HOST_MISSING");
    root ??= createRoot(host); root.render(<StrictMode><FixtureApp initial={payload} /></StrictMode>);
  },
  __changeFinanceSeriesOwner(payload: FinanceSeriesFixturePayload) {
    if (!changeSession) throw new Error("FIXTURE_NOT_STARTED");
    changeSession(previous => ({ ...payload, epoch: previous.epoch + 1, closing: false }));
  },
  __logoutFinanceSeries(ownerId: string) {
    window.dispatchEvent(new CustomEvent("segundo-cerebro:demo-logout", { detail: { userId: ownerId } }));
    changeSession?.(previous => ({ ...previous, closing: true, epoch: previous.epoch + 1 }));
  },
  __unmountFinanceSeries() { root?.unmount(); root = null; changeSession = null; },
});
