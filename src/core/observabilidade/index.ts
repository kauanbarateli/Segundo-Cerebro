/** Final allowlist, rebuilt from scratch. No content, identifiers, URL or stack. */
export const MONITOR_AREAS = ["workspace", "global", "capturar", "tarefas", "financeiro", "conhecimento", "drive", "projetos", "habitos", "cofre", "calendario", "configuracoes", "admin"] as const;
export type MonitorArea = typeof MONITOR_AREAS[number];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const hex = (value: unknown, length: number) => typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
const stamp = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 && value < 253402300800;
export function safeMonitoringEvent(value: unknown) {
  if (!object(value)) return null;
  const tags = object(value.tags) ? value.tags : {};
  const area: MonitorArea = MONITOR_AREAS.includes(tags.area as MonitorArea) ? tags.area as MonitorArea : "workspace";
  return {
    ...(hex(value.event_id, 32) ? { event_id: value.event_id as string } : {}),
    ...(stamp(value.timestamp) ? { timestamp: value.timestamp as number } : {}),
    platform: "javascript", level: "error" as const, tags: { area },
    exception: { values: [{ type: "ApplicationError", value: "Falha na aplicação" }] },
  };
}
export function safeMonitoringTransaction(value: unknown) {
  if (!object(value) || !object(value.contexts) || !object(value.contexts.trace)) return null;
  const trace = value.contexts.trace;
  if (!hex(trace.trace_id, 32) || !hex(trace.span_id, 16) || !stamp(value.start_timestamp) || !stamp(value.timestamp) || Number(value.timestamp) < Number(value.start_timestamp)) return null;
  return {
    ...(hex(value.event_id, 32) ? { event_id: value.event_id as string } : {}),
    type: "transaction" as const, platform: "javascript", transaction: "workspace",
    start_timestamp: value.start_timestamp as number, timestamp: value.timestamp as number,
    contexts: { trace: { trace_id: trace.trace_id as string, span_id: trace.span_id as string, op: "ui.render" } },
    spans: [], tags: { area: "workspace" },
  };
}
