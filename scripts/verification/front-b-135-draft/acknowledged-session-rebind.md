# Candidate: recover an acknowledged signup after session revocation

This is a guarded draft, not a migration or approval to alter a database. The
candidate applies only when a password response was already recorded as
`password_acknowledged`. A server-verified, fresh email OTP establishes the new
user and session; the service-only RPC checks the pending admission, moderation,
bound intent, legal versions and unexpired proof. It requires the former session
and all other sessions for that user to be absent, transfers the original proof
without extending its expiry, and never repeats the Auth password update. The
existing origin decision is not reset. With no fence, the original recovery
path remains in place; any rejection is fail-closed.

The currently installed session foreign key deletes the proof when its session
is deleted. The draft instead preserves it with `ON DELETE SET NULL` until the
intent/user is removed. This cannot recreate proofs already deleted. Retention
and cleanup must cover null-session proofs. The preflight refuses mismatched
schema or acknowledged fences without matching proofs. Release requires signup
to be paused, old writers drained, review of retention and concurrency, a new
separately reviewed and authorized migration, aligned generated types, and an
application deployment coordinated with that migration. The installed migration
and its ledger must never be rewritten. The server change fails closed if its
RPC is absent; the public signup gate must remain closed until the whole release
is qualified.

This does **not** reconcile `reserved`, `auth_in_flight`, or `uncertain`, whose
external Auth operation might still complete later. Deleting a session is not
evidence that an in-flight provider operation was cancelled. Nor does this draft
offer a user-facing way to revoke all prior sessions. Provider behavior, any
in-flight or independently initiated Auth operations, revocation, expiry, OTP
recovery, and the complete customer journey remain to be validated in a safe
environment before the gate is opened. A row-absence test alone does not prove
those guarantees. No claim of full issue #135 completion follows from this draft.

Local evidence: `tests/adapters/signup-confirmation-runtime.test.ts` exercises
OTP ordering, fallback, and fail-closed behavior; the explicitly opted-in
`tests/scripts/front-b-acknowledged-session-rebind.opt-in.mjs` uses an in-memory
synthetic database with the installed identity/context functions. Neither is a
live Supabase Auth, PostgreSQL version, or deployment test.
