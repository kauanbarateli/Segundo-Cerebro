/**
 * Additive QA 028 RPC types, observed via the Supabase type generator after
 * migration 20261101172256 in twrydxsdemaykgvdlpyd. Snapshot SHA-256:
 * 00f1177a7a5093b5b3c4adb98fc253612c92cb3380eec765152e4401c0219af2.
 *
 * These types do not imply that functions are callable, deployed in another
 * environment, or enabled in the application. In particular, the legacy
 * signup_attest_password_reset and signup_complete wrappers are revoked in
 * the QA composition. Keep the historical generated baseline unchanged.
 */
import type { Database, Json } from './database.generated';

type Actor = { p_session: string; p_user: string };
type IntentActor = Actor & { p_intent: string; p_subject_hash: string };
type FenceActor = IntentActor & { p_request: string; p_generation: string };
type FeedbackActor = Actor & { p_client: string };

/** Literal generator contract, including its incomplete scalar nullability. */
export type Qa028PublicFunctions = {
  feedback_barrier_cancel: { Args: FeedbackActor; Returns: Json };
  feedback_barrier_status: { Args: FeedbackActor; Returns: Json };
  feedback_barrier_submit: { Args: FeedbackActor & { p_category: string; p_message: string }; Returns: Json };
  feedback_list: { Args: Actor & { p_before: string; p_before_id: string }; Returns: Json };
  signup_attest_password_reset: { Args: IntentActor; Returns: undefined };
  signup_complete: { Args: IntentActor & { p_accept_origin: boolean; p_origin_version: string; p_privacy: string; p_terms: string }; Returns: Json };
  signup_discard_pending_origin: { Args: IntentActor; Returns: Json };
  signup_fence_ack: { Args: FenceActor; Returns: boolean };
  signup_fence_confirm: { Args: Actor & { p_intent: string }; Returns: boolean };
  signup_fence_finish: { Args: FenceActor & { p_current_origin: string; p_current_privacy: string; p_current_terms: string }; Returns: boolean };
  signup_fence_reserve: { Args: IntentActor & { p_request: string; p_terms: string; p_privacy: string; p_accept_origin: boolean; p_origin_version: string }; Returns: Json };
  signup_fence_start: { Args: FenceActor; Returns: boolean };
  signup_fence_uncertain: { Args: FenceActor; Returns: boolean };
  signup_fence_withdraw: { Args: Actor; Returns: Json };
  signup_find_bound_intent: { Args: Actor & { p_subject_hash: string }; Returns: Json };
  signup_intent_create: { Args: { p_binding_hash: string; p_expires: string; p_origin: Json; p_origin_version: string; p_privacy: string; p_subject_hash: string; p_terms: string }; Returns: string };
  signup_metrics: { Args: { p_actor: string; p_bucket: string; p_end: string; p_session: string; p_start: string; p_zone: string }; Returns: Json };
  signup_origin_status: { Args: Actor; Returns: Json };
  signup_origin_withdraw: { Args: Actor; Returns: Json };
  signup_prune: { Args: never; Returns: Json };
  signup_recover_verified_intent: { Args: Actor & { p_privacy: string; p_subject_hash: string; p_terms: string }; Returns: Json };
};

/** Preserve the 027 public contracts and extend only its function catalogue. */
export type Qa028Database = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & Qa028PublicFunctions;
  };
};

type NullableFields<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

/**
 * SQL accepts null for these scalar inputs, although the official QA type
 * generator emits `string`. These are wire shapes only, not authorization.
 */
export type Qa028NullableRpcArgs = {
  feedback_list: NullableFields<Qa028PublicFunctions['feedback_list']['Args'], 'p_before' | 'p_before_id'>;
  signup_fence_reserve: NullableFields<Qa028PublicFunctions['signup_fence_reserve']['Args'], 'p_origin_version'>;
  signup_intent_create: NullableFields<Qa028PublicFunctions['signup_intent_create']['Args'], 'p_origin_version'>;
  signup_complete: NullableFields<Qa028PublicFunctions['signup_complete']['Args'], 'p_origin_version'>;
};
