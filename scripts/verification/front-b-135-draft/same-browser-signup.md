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

The confirmation channel must check that the original browser cookie matches a
live bound intent **before** verifying the token. Therefore another device must
be shown instructions to open the original browser, without consuming or
forwarding the token. Immediately after OTP verification, getUser/getClaims
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

**Not ready to enable:** these files are isolated and do not wire the actual
cookie, routes, template, browser interaction or database migration. The current
release gate must stay closed. The OTP may be consumed even when the Auth
response is lost; an admission transaction may commit when its response is lost.
Clearing a provisional session is fail-closed, not a proven recovery flow.
Define and test a fresh, purpose-bound recovery OTP with the same live browser
secret, verified identity and an idempotent admission read; account for pending
versus already admitted status and an independently lost response. If that
cannot be proven, present a safe recovery path instead of reporting success.
Loss/expiry of the original cookie, an expired or missing intent, an existing
account, and moving devices require a separately designed recovery process; do
not adopt an old password or silently create a replacement intent.

`signup-resend-runtime.ts` already requests a fixed continuation link through
`resetPasswordForEmail`. A possible recovery is to verify a *new* recovery OTP
on the original browser, then check identity, intent, secret, moderation and
current legal/consent snapshot before the same idempotent SQL command. The
existing continuation channel currently invokes a different recovery service
and redirects to password setup; it cannot be reused unchanged. It also refuses
an existing browser session. Test the hosted Auth behavior, recovery token
expiry, overlapping calls, already admitted account, changed legal versions,
cookie expiry and new lost response; no recovery is claimed before that work.

Likely integration points, after separate review and only with the release gate
closed: `src/lib/auth/signup-runtime.ts`, `signup-service.ts`, `signup-http.ts`,
`signup-confirmation-runtime.ts`, `signup-confirmation-service.ts`,
`signup-confirmation-channel.ts`, `signup-resend-runtime.ts`, `signup-channel.ts`,
the existing `/cadastro` and `/auth/confirmar-cadastro` / `/auth/continuar-cadastro`
handlers and pages, legal publication/version configuration, retention operator
scripts, Supabase generated types and focused browser/SQL tests. The cookie must
be provisioned before the signup POST, and each adapter must implement the
`canBegin` contract without clearing or replacing an existing session. These are
integration candidates, not claims that those files have been changed.

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
