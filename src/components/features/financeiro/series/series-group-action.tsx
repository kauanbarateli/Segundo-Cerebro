"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { createSeriesClassificationClient } from "@/lib/finance-series-classification-client";

export function SeriesGroupAction({ groupId, disabled, onLegacy, onManaged }: { groupId: string; disabled: boolean; onLegacy(): void; onManaged(groupId: string): void }) {
  const app = useDemoApplication(), [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const identity = useRef({ owner: app.userId, epoch: app.epoch, closing: app.closing, groupId }); identity.current = { owner: app.userId, epoch: app.epoch, closing: app.closing, groupId };
  const lifetime = useRef<{ client: ReturnType<typeof createSeriesClassificationClient> | null; busy: boolean; generation: number }>({ client: null, busy: false, generation: 0 });
  useEffect(() => {
    const instance = lifetime.current;
    let alive = true; const generation = ++instance.generation, owner = app.userId, epoch = app.epoch;
    const current = () => alive && generation === instance.generation && identity.current.owner === owner && identity.current.epoch === epoch && identity.current.groupId === groupId && !identity.current.closing;
    const client = createSeriesClassificationClient(owner, { isCurrent: current }); instance.client = client; instance.busy = false; setBusy(false); setNotice(null);
    return () => { alive = false; client.dispose(); if (instance.generation === generation) instance.client = null; };
  }, [app.userId, app.epoch, app.closing, groupId]);
  async function classify() {
    if (disabled || lifetime.current.busy || app.closing) return;
    if (app.mode !== "connected") { onLegacy(); return; }
    const client = lifetime.current.client, generation = lifetime.current.generation, owner = app.userId, epoch = app.epoch; if (!client) return;
    const current = () => generation === lifetime.current.generation && client === lifetime.current.client && identity.current.owner === owner && identity.current.epoch === epoch && identity.current.groupId === groupId && !identity.current.closing;
    lifetime.current.busy = true; setBusy(true); setNotice(null);
    try {
      const reply = await client.read(groupId); if (!current()) return;
      if (!reply.ok) { setNotice(reply.message); return; }
      if (reply.result.kind === "legacy") onLegacy();
      else if (reply.result.available) onManaged(reply.result.group_id);
      else setNotice("Esta recorrência usa a gestão de séries, temporariamente indisponível. Confira novamente antes de continuar; nenhum encerramento foi enviado.");
    } finally { if (current()) { lifetime.current.busy = false; setBusy(false); } }
  }
  return <><Button disabled={disabled || busy || app.closing} loading={busy} onClick={() => { void classify(); }}>{notice ? "Conferir recorrência novamente" : "Encerrar recorrência"}</Button>{notice && <p role="status" className="finance-note">{notice}</p>}</>;
}
