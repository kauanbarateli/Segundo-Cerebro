"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Collapsible } from "../../ui/data-display";
import type { OwnSessionsReader, OwnSessionsState } from "./own-sessions-types";
import "./own-sessions.css";

interface OwnSessionsPanelProps {
  readonly state: OwnSessionsState;
  readonly onReload: () => void;
  /** Optional deterministic formatting; no session/device data is derived. */
  readonly timeZone?: string;
}

function SessionTime({ value, missing, timeZone }: { readonly value: string | null; readonly missing: string; readonly timeZone?: string }) {
  if (value === null || !Number.isFinite(Date.parse(value))) return <span>{missing}</span>;
  try {
    const label = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
    return <time dateTime={value}>{label}</time>;
  } catch { return <span>{missing}</span>; }
}

/** Flat own-session list in the existing DS2.1 settings anatomy. */
export function OwnSessionsPanel({ state, onReload, timeZone }: OwnSessionsPanelProps) {
  const loading = state.status === "loading";
  // The control is disabled while reading, which drops keyboard focus to the
  // document. Return it to the same control once that read settles, unless the
  // person already moved focus elsewhere.
  const reloadButton = useRef<HTMLButtonElement>(null), returnFocus = useRef(false);
  useEffect(() => {
    if (loading || !returnFocus.current) return;
    returnFocus.current = false;
    if (!document.activeElement || document.activeElement === document.body) reloadButton.current?.focus();
  }, [loading]);
  return <section id="sessoes" className="own-sessions-section" aria-label="Sessões">
    <Card className="own-sessions-card"><Collapsible defaultOpen title="Sessões">
      <div className="own-sessions-toolbar">
        {state.status === "error" && state.reason === "session-changed"
          ? <Link className="own-sessions-link" href="/entrar?notice=session-required">Entrar novamente</Link>
          : <Button ref={reloadButton} variant="ghost" disabled={loading} onClick={() => { returnFocus.current = true; onReload(); }}>{state.status === "error" ? "Tentar novamente" : "Atualizar sessões"}</Button>}
      </div>
      <div aria-busy={loading || undefined} className="own-sessions-content">
        {loading && <><p role="status">Carregando suas sessões…</p><div className="own-sessions-skeleton" aria-hidden="true"><span /><span /><span /><span /></div></>}
        {state.status === "error" && <p role="alert">{state.reason === "session-changed" ? "Sua sessão mudou. Entre novamente para consultar suas sessões." : "Não foi possível carregar suas sessões. Tente novamente."}</p>}
        {state.status === "ready" && (state.snapshot.sessions.length === 0
          ? <p>Nenhuma sessão disponível para exibir. Atualize a lista para conferir.</p>
          : <><ul className="own-sessions-list" role="list" aria-label="Sessões cadastradas">
            {state.snapshot.sessions.map((session, index) => <li key={index}>
              <strong>{session.isCurrent ? "Esta sessão" : "Outra sessão"}</strong>
              <dl><div><dt>Criada em</dt><dd><SessionTime value={session.createdAt} missing="Data indisponível" timeZone={timeZone} /></dd></div>
                <div><dt>Última renovação</dt><dd><SessionTime value={session.refreshedAt} missing="Renovação não informada" timeZone={timeZone} /></dd></div></dl>
            </li>)}
          </ul>
            <p className="own-sessions-help">{timeZone ? `Horários em ${timeZone}.` : "Horários no fuso deste navegador."}</p>
            {state.snapshot.hasMore && <p role="status">Mostrando {state.snapshot.sessions.length} sessões, incluindo esta sessão. Há outras sessões cadastradas.</p>}
          </>)}
      </div>
      <div className="own-sessions-password"><Link className="own-sessions-link" href="/trocar-senha">Trocar senha</Link><p>A troca exige sua senha atual e encerra as outras sessões.</p></div>
    </Collapsible></Card>
  </section>;
}

interface OwnSessionsSectionProps {
  /** A non-secret presentation scope, never rendered or used as an RPC argument. */
  readonly scopeKey: string;
  /** Keep the reader stable; the authenticated adapter owns the transport. */
  readonly read: OwnSessionsReader;
}

/** Presentation stays scoped while the reader owns the authenticated transport. */
export function OwnSessionsSection({ scopeKey, read }: OwnSessionsSectionProps) {
  const [view, setView] = useState<{ readonly scopeKey: string; readonly state: OwnSessionsState }>({ scopeKey, state: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setView({ scopeKey, state: { status: "loading" } });
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return undefined;
      return read(controller.signal);
    }).then(result => {
      if (!active || controller.signal.aborted || result === undefined) return;
      setView({ scopeKey, state: result.ok ? { status: "ready", snapshot: result.snapshot } : { status: "error", reason: result.reason } });
    }).catch(() => {
      // Never copy a reader/provider message, cause or payload into the UI.
      if (active && !controller.signal.aborted) setView({ scopeKey, state: { status: "error", reason: "unavailable" } });
    });
    return () => { active = false; controller.abort(); };
  }, [scopeKey, read, attempt]);
  // Account switches clear the render before effects run; old metadata cannot flash.
  const state: OwnSessionsState = view.scopeKey === scopeKey ? view.state : { status: "loading" };
  return <OwnSessionsPanel state={state} onReload={() => setAttempt(value => value + 1)} />;
}
