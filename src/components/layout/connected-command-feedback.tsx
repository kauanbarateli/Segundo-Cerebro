"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { IDLE_COMMAND } from "@/lib/demo/connected-application";
import { Button } from "@/components/ui/button";
import "./connected-command-feedback.css";

/** Lives with the session shell, outside route editors and query error states. */
export function ConnectedCommandFeedback({ children }: { children: ReactNode }) {
  const app = useDemoApplication();
  const [checking, setChecking] = useState(false);
  const state = useSyncExternalStore(app.subscribeCommands, app.getCommandSnapshot, () => IDLE_COMMAND);
  useEffect(() => {
    if (state.status !== "pending") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.status]);
  if (app.mode === "demo" || state.status === "idle") return children;
  return <>
    <section className="connected-command-feedback" aria-label="Confirmação de envio">
      <div role={state.status === "session-changed" || state.status === "rejected" || state.status === "journal-error" ? "alert" : "status"} aria-atomic="true">
        <strong>{state.status === "session-changed" ? "A conta foi alterada" : state.status === "confirmed" ? "Envio confirmado" : state.status === "rejected" ? "O envio não foi aceito" : state.status === "journal-error" ? "Envios pausados neste navegador" : "Há um envio para confirmar"}</strong>
        <p>{state.status === "confirmed" ? "A alteração foi confirmada na sua conta. Você já pode continuar." : state.message}</p>
      </div>
      <div className="connected-command-feedback__actions">
        {state.status === "session-changed" ? <Button onClick={() => window.location.reload()}>Recarregar página</Button>
          : state.status === "journal-error" ? <Button loading={checking} onClick={() => { setChecking(true); void app.initializeJournal().catch(() => { /* The store publishes a safe diagnosis. */ }).finally(() => setChecking(false)); }}>Verificar armazenamento</Button>
          : state.status === "pending" ? <Button variant="primary" loading={state.retrying} onClick={() => { void app.retryPendingCommand().catch(() => { /* The session store publishes the recovery state. */ }); }}>Confirmar envio</Button>
            : <>{state.status === "confirmed" && <Link className="shell-inline-link" href={state.href}>{state.label}</Link>}<Button variant="ghost" onClick={app.clearCommandFeedback}>Dispensar aviso</Button></>}
      </div>
    </section>
    {state.status !== "session-changed" && children}
  </>;
}
