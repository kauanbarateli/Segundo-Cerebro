"use client";
import type { MonitorArea } from "@/core/observabilidade";
/** Never pass an Error, digest, route, content or identity to monitoring. */
export function reportBoundary(area: MonitorArea) {
  void fetch("/api/monitoring", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area }) }).catch(() => undefined);
}
