import type { AccountSettings } from "../../../core/configuracoes";
type Preferences = AccountSettings["preferences"];

/** Adopt confirmed fields while keeping edits in other sections, including
 * edits made after this request started. A failed request never calls this. */
export function reconcilePreferenceDraft(
  baseline: Preferences | null, draft: Preferences | null, confirmed: Preferences, submitted: Partial<Preferences> = {},
): Preferences {
  if (!baseline || !draft) return { ...confirmed };
  const next = { ...confirmed };
  function preserve<K extends keyof Preferences>(key: K) {
    const expected = Object.hasOwn(submitted, key) ? submitted[key] : baseline![key];
    if (!Object.is(draft![key], expected)) next[key] = draft![key];
  }
  for (const key of Object.keys(confirmed) as (keyof Preferences)[]) preserve(key);
  return next;
}
