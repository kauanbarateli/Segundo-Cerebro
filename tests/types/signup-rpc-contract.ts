import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import { signupRpc } from "../../src/lib/auth/signup-http";

// Compile-only contract: this file is included in TypeScript, not executed.
declare const config: SupabaseAuthConfig;
const binding = { p_user: "id", p_session: "session", p_intent: "intent", p_subject_hash: "hash" };
void signupRpc(config, "signup_complete", { ...binding, p_terms: "t", p_privacy: "p", p_accept_origin: false, p_origin_version: null });
// @ts-expect-error The consent-version argument is required, even when null.
void signupRpc(config, "signup_complete", { ...binding, p_terms: "t", p_privacy: "p", p_accept_origin: false });
// @ts-expect-error A consent version cannot be numeric.
void signupRpc(config, "signup_complete", { ...binding, p_terms: "t", p_privacy: "p", p_accept_origin: false, p_origin_version: 3 });
// @ts-expect-error Actor arguments cannot be substituted for a signup intent.
void signupRpc(config, "signup_intent_create", binding);
