/** Stable capabilities. Navigation labels and URLs belong to the web channel. */
export const FEATURE_KEYS = [
  "inicio", "capturar", "tarefas", "calendario", "conhecimento", "drive",
  "projetos", "habitos", "financeiro", "cofre", "configuracoes", "integracoes", "admin",
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type Entitlements = Readonly<Partial<Record<FeatureKey, boolean>>>;
export interface FeaturePreference { readonly visible: boolean; readonly order: number }
export type FeaturePreferences = Readonly<Partial<Record<FeatureKey, FeaturePreference>>>;
export interface AccessPolicy {
  readonly entitlements: Entitlements;
  readonly preferences: FeaturePreferences;
  readonly isAdmin: boolean;
}
export interface AccessResolution {
  readonly allowed: boolean;
  readonly visible: boolean;
  readonly reason: "allowed" | "entitlement-denied" | "admin-required";
}

/** ADR-0003: the implicit Personal Plan grants access unless individually vetoed.
 * Preferences NEVER authorize or revoke access; Admin also requires a privilege.
 * A server adapter must enforce this policy for real operations in later tickets. */
export function resolveAccess(feature: FeatureKey, policy: AccessPolicy): AccessResolution {
  if (feature === "admin" && !policy.isAdmin) {
    return { allowed: false, visible: false, reason: "admin-required" };
  }
  if (policy.entitlements[feature] === false) {
    return { allowed: false, visible: false, reason: "entitlement-denied" };
  }
  return { allowed: true, visible: policy.preferences[feature]?.visible !== false, reason: "allowed" };
}
