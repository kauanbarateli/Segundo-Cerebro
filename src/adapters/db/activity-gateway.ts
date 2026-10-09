import "server-only";
import { ACTIVITY_FEATURES, activityId, validActivityPage, type ActivityPage, type ActivityQuery, type ActivityType } from "../../core/activity";
import { assertFeature } from "../../lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";

export type ActivityRpcArgs = { p_user: string; p_session: string; p_limit: number; p_before_time?: string; p_before_id?: string };
export type ActivityRpc = (args: ActivityRpcArgs) => Promise<{ data: unknown; error: { code?: string } | null }>;
function unavailable(): never { throw new AuthGuardError("unavailable"); }
export function createActivityGateway(identity: AuthenticatedIdentity, rpc: ActivityRpc) {
  if (!activityId(identity.userId) || !activityId(identity.sessionId)) unavailable();
  return { async page(query: ActivityQuery): Promise<ActivityPage> {
    assertFeature(identity, "inicio");
    const response = await rpc({ p_user: identity.userId, p_session: identity.sessionId, p_limit: query.limit,
      ...(query.cursor ? { p_before_time: query.cursor.occurred_at, p_before_id: query.cursor.id } : {}) });
    if (response.error?.code === "42501") throw new AuthGuardError("forbidden");
    if (response.error || !response.data || typeof response.data !== "object" || Array.isArray(response.data)) unavailable();
    const raw = response.data as Record<string, unknown>;
    if (Object.keys(raw).length !== 2 || !Array.isArray(raw.items)) unavailable();
    const items = raw.items.map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return unavailable();
      const { user_id, ...item } = value as Record<string, unknown>;
      if (user_id !== identity.userId) return unavailable();
      if (typeof item.entity_type !== "string" || !Object.hasOwn(ACTIVITY_FEATURES, item.entity_type) || identity.entitlements?.[ACTIVITY_FEATURES[item.entity_type as ActivityType]] === false) return unavailable();
      return item;
    });
    const projected = { items, next_cursor: raw.next_cursor };
    if (!validActivityPage(projected, query)) unavailable();
    return structuredClone(projected);
  } };
}
