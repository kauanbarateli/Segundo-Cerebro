"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemoApplication, useDemoPrivacy } from "@/lib/demo/demo-provider";
import type { DemoQueries } from "@/lib/demo/types";
import { browserFinanceGoalsClient, type FinanceGoalsBrowserClient } from "@/lib/finance-goals-client";
import { GoalsPanel } from "./goals-panel";
import { openGoalsHostLifetime, type GoalsHostBinding } from "./finance-goals-host-lifetime";
import { GoalImageHostBinding, useGoalImagesEnabled } from "./goal-image-host-binding";

/** One visible Goals controller at a time. Availability stays server-owned;
 * this host neither enables images nor installs the proposed financial schema. */
export function FinanceGoalsHost({ data, compact = false }: { data: DemoQueries["finance"]; compact?: boolean }) {
  const app = useDemoApplication();
  if (app.mode !== "connected" || app.closing) return null;
  return <ConnectedGoalsHost key={`${app.userId}:${app.epoch}`} data={data} compact={compact} />;
}
function ConnectedGoalsHost({ data, compact }: { data: DemoQueries["finance"]; compact: boolean }) {
  const app = useDemoApplication(), privacy = useDemoPrivacy(), imagesEnabled = useGoalImagesEnabled();
  const imageContext = useRef({ app, hidden: privacy.valuesHidden, imagesEnabled }); imageContext.current = { app, hidden: privacy.valuesHidden, imagesEnabled };
  const binding: GoalsHostBinding = {
    ownerId: app.userId, providerEpoch: app.epoch, mode: app.mode, closing: app.closing,
    sender: app.executeDomainCommand, initialize: app.initializeJournal, commandSnapshot: app.getCommandSnapshot, refresh: app.refreshActive,
  };
  const latest = useRef(binding); latest.current = binding;
  const [restart, setRestart] = useState(0);
  const [state, setState] = useState<{ lifetime: ReturnType<typeof openGoalsHostLifetime<FinanceGoalsBrowserClient>> | null; client: FinanceGoalsBrowserClient | null; images: GoalImageHostBinding | null; failed: boolean }>({ lifetime: null, client: null, images: null, failed: false });
  const { ownerId, providerEpoch, mode, closing, sender, initialize, commandSnapshot, refresh } = binding;
  useEffect(() => {
    const lifetime = openGoalsHostLifetime({ ownerId, providerEpoch, mode, closing, sender, initialize, commandSnapshot, refresh }, () => latest.current, browserFinanceGoalsClient);
    let images: GoalImageHostBinding | null = null;
    setState({ lifetime, client: null, images: null, failed: false });
    void lifetime.ready.then(client => {
      if (!lifetime.current() || !client) return;
      images = new GoalImageHostBinding({ current: () => lifetime.current() && client.isCurrent(), read: () => {
        const value = imageContext.current;
        return { ownerId: value.app.userId, providerEpoch: value.app.epoch, client, application: value.app, storageOrigin: value.app.storageOrigin, origin: window.location.origin, hidden: value.hidden, imagesEnabled: value.imagesEnabled };
      } });
      setState({ lifetime, client, images, failed: false });
    }).catch(() => { if (lifetime.current()) setState({ lifetime, client: null, images: null, failed: true }); });
    return () => { images?.dispose(); lifetime.close(); };
  }, [ownerId, providerEpoch, mode, closing, sender, initialize, commandSnapshot, refresh, restart]);
  useLayoutEffect(() => { if (privacy.valuesHidden) state.images?.conceal(); }, [privacy.valuesHidden, state.images]);
  const current = state.lifetime?.current() === true;
  if (!current || !state.client) return <section className="fg-surface" aria-label="Metas financeiras">
    {current && state.failed ? <><p role="alert">Não foi possível preparar a sessão de Metas. Os registros locais permanecem preservados.</p><Button onClick={() => setRestart(value => value + 1)}>Reabrir Metas</Button></> : <p role="status" aria-busy="true">Conferindo sua sessão de Metas…</p>}
  </section>;
  const client = state.client, lifetime = state.lifetime;
  const accounts = data.accounts.map(account => ({ id: account.id, name: account.name, kind: account.kind, currency: account.currency, archived: account.archived_at !== null }));
  return <GoalsPanel ownerId={ownerId} client={client} today={app.today()} accounts={accounts} hidden={privacy.valuesHidden} reveal={() => privacy.setValuesHidden(false)} createId={() => crypto.randomUUID()} compact={compact} silentUnavailable imageHost={state.images ?? undefined} onResolved={async () => {
    if (!lifetime?.current() || !client.isCurrent()) throw new Error("GOALS_HOST_CHANGED");
    await refresh();
    if (!lifetime.current() || !client.isCurrent()) throw new Error("GOALS_HOST_CHANGED");
  }} />;
}
