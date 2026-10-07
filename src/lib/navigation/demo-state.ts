import { FEATURE_KEYS, type AccessPolicy, type FeatureKey, type FeaturePreference } from "../../core/access/resolve-access";

/** Deliberately separate from real account/session data and from the theme key. */
export const DEMO_ACCESS_STORAGE_KEY = "segundo-cerebro-demo-navigation-v1";
export const DEFAULT_DEMO_POLICY: AccessPolicy = { entitlements: {}, preferences: {}, isAdmin: false };

export function parseDemoPolicy(raw: string | null): AccessPolicy {
  if (!raw) return DEFAULT_DEMO_POLICY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) return DEFAULT_DEMO_POLICY;
    const data = value as Record<string, unknown>;
    const entitlements: Partial<Record<FeatureKey, boolean>> = {};
    const preferences: Partial<Record<FeatureKey, FeaturePreference>> = {};
    const rights = data.entitlements && typeof data.entitlements === "object" ? data.entitlements as Record<string, unknown> : {};
    const choices = data.preferences && typeof data.preferences === "object" ? data.preferences as Record<string, unknown> : {};
    for (const feature of FEATURE_KEYS) {
      if (typeof rights[feature] === "boolean") entitlements[feature] = rights[feature];
      const candidate = choices[feature];
      if (candidate && typeof candidate === "object" && "visible" in candidate && "order" in candidate
        && typeof candidate.visible === "boolean" && typeof candidate.order === "number" && Number.isFinite(candidate.order)) {
        preferences[feature] = { visible: candidate.visible, order: candidate.order };
      }
    }
    return { entitlements, preferences, isAdmin: data.isAdmin === true };
  } catch {
    return DEFAULT_DEMO_POLICY;
  }
}

export function serializeDemoPolicy(policy: AccessPolicy): string {
  return JSON.stringify({ version: 1, ...policy });
}
