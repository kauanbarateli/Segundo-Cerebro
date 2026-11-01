/** Only already-aggregated rows belong here. This module never receives users. */
export type SignupOriginCount = Readonly<{ value: string | null; count: number }>;
export type DisplayOriginCount = Readonly<
  | { kind: "value"; value: string; count: number }
  | { kind: "not-informed"; value: null; count: number }
  | { kind: "other"; value: null; count: number }
>;

/**
 * Reject incomplete or duplicated populations before consolidating small groups.
 * Suppression reduces disclosure but cannot guarantee anonymity across queries.
 */
export function prepareOriginDistribution(total: number, groups: readonly SignupOriginCount[]): readonly DisplayOriginCount[] | null {
  if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(groups) || groups.length > 500) return null;
  const seen = new Set<string | null>(), visible: DisplayOriginCount[] = [];
  let sum = 0, other = 0;
  for (const group of groups) {
    if (!group || (group.value !== null && (typeof group.value !== "string" || !group.value.trim() || [...group.value].length > 200 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(group.value))) || !Number.isSafeInteger(group.count) || group.count < 1 || seen.has(group.value)) return null;
    seen.add(group.value); sum += group.count;
    if (!Number.isSafeInteger(sum) || sum > total) return null;
    if (group.count < 5) other += group.count;
    else if (group.value === null) visible.push({ kind: "not-informed", value: null, count: group.count });
    else visible.push({ kind: "value", value: group.value, count: group.count });
  }
  if (sum !== total) return null;
  if (other) visible.push({ kind: "other", value: null, count: other });
  return visible;
}
