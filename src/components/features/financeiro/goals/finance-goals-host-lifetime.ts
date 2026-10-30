/** Local resource lifetime only. Closing a surface never revokes an identity or
 * clears a journal. The concrete browser factory remains the only client issuer. */
export interface GoalsHostBinding {
  ownerId: string; providerEpoch: number; mode: "demo" | "connected"; closing: boolean;
  sender: unknown; initialize: unknown; commandSnapshot: unknown; refresh: () => Promise<void>;
}
function same(a: GoalsHostBinding, b: GoalsHostBinding) {
  return a.ownerId === b.ownerId && a.providerEpoch === b.providerEpoch && a.mode === b.mode && a.closing === b.closing &&
    a.sender === b.sender && a.initialize === b.initialize && a.commandSnapshot === b.commandSnapshot && a.refresh === b.refresh;
}
export function openGoalsHostLifetime<Client extends { dispose(): void }>(
  source: GoalsHostBinding, latest: () => GoalsHostBinding,
  open: (ownerId: string, current: () => boolean) => Promise<Client>,
) {
  const binding = Object.freeze({ ...source });
  let alive = binding.mode === "connected" && !binding.closing && binding.ownerId.length > 0 && Number.isSafeInteger(binding.providerEpoch) && binding.providerEpoch >= 0;
  let client: Client | null = null;
  const current = () => alive && same(binding, latest());
  const ready = Promise.resolve().then(async () => {
    if (!current()) return null;
    const candidate = await open(binding.ownerId, current);
    if (!current()) { candidate.dispose(); return null; }
    client = candidate; return candidate;
  });
  return {
    ready, current,
    close() { alive = false; const previous = client; client = null; previous?.dispose(); },
  };
}
