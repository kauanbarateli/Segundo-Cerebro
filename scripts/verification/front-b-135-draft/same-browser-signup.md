# Same-browser signup candidate — closed and unintegrated

This candidate reduces the normal signup path to one initial password submission
to Auth and a subsequent email confirmation. It never repeats or updates the
password after OTP. A separate server-issued random browser secret must already
be present in an HttpOnly, Secure, SameSite cookie before the signup POST; its
domain-separated HMAC is bound to the intent in the same transaction that
creates the intent. It is different from the pointer sent to Auth. Only the
real Auth INSERT can bind that intent to a new identity. Neither a duplicate
signup nor an Auth response or timeout is proof of creation.

Issue a fresh secret for each *new* attempt in a prior response, before the
password POST. Do not regenerate it while the person follows the email link or
retries the same attempt. Expiry, confirmed success or an explicitly requested
new attempt ends its usable life; deleting/rotating it earlier breaks recovery.
The unique hash refuses reuse. The draft includes an unscheduled, bounded
`signup_browser_prune` for expired rows; it requires a separately reviewed
retention/monitoring process and coordination with intent and origin cleanup.
**Open usability blocker:** the single cookie is preserved for recovery and a
second attempt cannot reuse its unique hash while the first row is live. This
includes a neutral duplicate-email result or an ambiguous preparation. There
is no implemented rotation that preserves access to every pending attempt, and
cookie expiry can precede intent expiry. The existing password-after-OTP
fallback is used when a confirmation has no matching live browser attempt, but
it does not make a new signup attempt immediately available. Do not rotate or
delete a possibly live attempt automatically; implement and qualify a bounded
multi-attempt or other safe reconciliation design before opening signup.

**Cross-browser uncertainty blocker:** the current uniqueness constraint is on
the browser hash, not on the email-subject hash. Two browsers can prepare
different intents for the same email and issue two signup requests even while
the first provider outcome is unknown. A multi-cookie rotation alone does not
fix that race. An indefinitely retained per-subject fence could prevent a
second call, but could also be used to deny signup for somebody else's email;
expiring it does not prove an in-flight Auth request cannot finish later. An
acceptable release design must establish an authoritative provider outcome or a
reviewed idempotency/serialization contract, define abuse and retention
handling, and test races across sessions. The available Supabase docs do not
establish an idempotency key for this signup call. Rate limits and timeouts are
not proof of cancellation. The release gate remains closed.

The confirmation channel checks that the original browser cookie matches a
live bound intent **before** verifying the token. Another device without that
cookie uses the existing fenced workflow: verify OTP and require a fresh
password chosen by the email holder. Its uncertain Auth outcomes remain blocked.
Immediately after OTP verification, getUser/getClaims
must establish identity and session; only the trusted server can invoke the
admission function. It checks the subject, intent, browser hash, current legal
versions, pending state, active moderation/session, consent and any competing
fence. Admission, onboarding, events and optional UTM are one transaction.
Repeated admission with the same verified identity and decision is idempotent;
withdrawal remains a separate existing command. The SQL does not itself verify
an OTP: exposing these privileged wrappers to clients is unsafe.

The candidate introduces a locked database legal-version row, initially absent
so preparation and admission fail closed. The lock serializes the DB decision
against changes to that row. It does **not** make a web deployment and database
update atomic: a reviewed publishing protocol must pause signup, synchronize
the actual displayed documents, server constants and row, validate them, then
reopen. No such provisioner, release protocol or production integration exists.

**Not ready to enable:** the branch wires the cookie, routes and browser flow,
but the guarded SQL is not an installed migration and hosted Auth behavior is
not qualified. The current release gate must stay closed. The OTP may be consumed even when the Auth
response is lost; an admission transaction may commit when its response is lost.
Clearing a provisional session is fail-closed, not a proven recovery flow.
Define and test a fresh, purpose-bound recovery OTP with the same live browser
secret, verified identity and an idempotent admission read; account for pending
versus already admitted status and an independently lost response. If that
cannot be proven, present a safe recovery path instead of reporting success.
Loss/expiry of the original cookie, an expired or missing intent, an existing
account, and moving devices require a separately designed recovery process; do
not adopt an old password or silently create a replacement intent.

`signup-resend-runtime.ts` requests a fixed continuation link through
`resetPasswordForEmail`. The candidate verifies a *new* recovery OTP on the
original browser, then checks identity, intent, secret, moderation and current
legal/consent snapshot before the same idempotent SQL command. Another browser
uses the password-reset fence; an existing browser session is not overwritten.
Test the hosted Auth behavior, recovery token
expiry, overlapping calls, already admitted account, changed legal versions,
cookie expiry and new lost response; no recovery is claimed before that work.

The branch provisions the cookie before the signup POST and expires it only
after confirmed admission; an ambiguous result preserves it for recovery.
Disabled JavaScript prevents new signup and is explained on the form; email
confirmation and the cross-device password path remain server-rendered. The
legal publishing protocol, operator retention, generated types, reviewed SQL,
provider/SMTP QA, release and independent security validation remain pending.

Before any rollout, validate the exact hosted GoTrue behavior under duplicate
and concurrent signup, token replay and reissue, direct Auth calls, third-party
email scanners, link handling, existing authenticated sessions, moderation,
all database/API gates, origin withdrawal and legal-version changes. Verify
normal login and administrative admissions remain intact, and ensure no secret,
password, link or token appears in logs. Origin consent must remain independent
from legal acceptance, be revocable, and be used only for the five allowed UTM
fields. Review cleanup and retention of browser hashes (including consumed
records) and ensure stale drafts cannot race retention. Pause signup, drain old
writers, and use a new separately reviewed and explicitly authorized migration;
never rewrite installed 028 or its ledger. Deploy the server and DB contract in
a coordinated, fail-closed order.

Evidence so far: a focused Vitest suite and an explicitly opted-in PGlite
diagnostic exercise synthetic data, including the installed pending-identity
and Auth INSERT trigger functions. They do not establish hosted Supabase Auth,
Postgres version, email, browser, or production security behavior.
