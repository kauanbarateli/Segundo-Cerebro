import "server-only";
import * as Sentry from "@sentry/node";
import type { EventItem, EventEnvelope } from "@sentry/core";
import { randomUUID } from "node:crypto";
import { MONITOR_AREAS, safeMonitoringEvent, safeMonitoringTransaction, type MonitorArea } from "../../core/observabilidade";

/** Static tracing ensures the transaction hook is used by Sentry 11. */
export const privacyOptions = {
  defaultIntegrations: false as const, sendDefaultPii: false, enableLogs: false,
  autoSessionTracking: false, maxBreadcrumbs: 0, traceLifecycle: "static" as const,
  tracesSampleRate: 0, profilesSampleRate: 0,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false }, databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0 },
  beforeBreadcrumb: () => null,
  beforeSend: (value: unknown) => { const safe = safeMonitoringEvent(value); return safe ? { ...safe, type: undefined } : null; },
  beforeSendTransaction: safeMonitoringTransaction,
};
/** Second filter at the wire: removes envelope sampling metadata and any other item. */
type Transport = ReturnType<typeof Sentry.makeNodeTransport>;
export function privateTransport(transport: Transport): Transport {
  return {
    flush: timeout => transport.flush(timeout),
    send(envelope) {
      const items: EventItem[] = [];
      for (const [header, payload] of envelope[1]) {
        const value = header.type === "event" ? safeMonitoringEvent(payload) : header.type === "transaction" ? safeMonitoringTransaction(payload) : null;
        if (value && (header.type === "event" || header.type === "transaction")) items.push([{ type: header.type }, value]);
      }
      if (!items.length) return Promise.resolve({ statusCode: 200 });
      const clean: EventEnvelope = [{ event_id: items[0]![1].event_id ?? randomUUID().replaceAll("-", ""), sent_at: new Date().toISOString() }, items];
      return transport.send(clean);
    },
  };
}
let client: Sentry.NodeClient | null = null;
function monitor() {
  if (client) return client;
  const raw = process.env.SENTRY_DSN?.trim();
  if (!raw || process.env.APP_MODE !== "supabase") return null;
  try {
    const dsn = new URL(raw);
    if (dsn.protocol !== "https:" || !/^[a-z0-9.-]+\.ingest(?:\.us|\.de)?\.sentry\.io$/.test(dsn.hostname) || !/^[a-f0-9]{32}$/i.test(dsn.username) || dsn.password || !/^\/\d+$/.test(dsn.pathname) || dsn.search || dsn.hash) return null;
    client = new Sentry.NodeClient({ ...privacyOptions, integrations: [], stackParser: () => [], dsn: raw, transport: options => privateTransport(Sentry.makeNodeTransport(options)) });
    client.init(); return client;
  } catch { return null; }
}
export async function reportBoundary(area: MonitorArea) {
  if (!MONITOR_AREAS.includes(area)) return;
  const sdk = monitor(); if (!sdk) return;
  sdk.captureEvent({ level: "error", tags: { area }, exception: { values: [{ type: "ApplicationError", value: "Falha na aplicação" }] } });
  await Promise.resolve(sdk.flush(1500)).catch(() => false);
}
