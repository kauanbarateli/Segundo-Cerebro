# Same-browser signup candidate — integrated draft, closed

This candidate reduces the normal signup path to one initial password submission
to Auth and a subsequent email confirmation. The matching-browser path does not
update the password after OTP; the other-device/older-attempt fallback uses the
existing fenced password update. A separate server-issued random browser secret must already
be present in an HttpOnly, Secure, SameSite cookie before the signup POST; its
domain-separated HMAC is bound to the intent in the same transaction that
creates the intent. It is different from the pointer sent to Auth. Only the
real Auth INSERT can bind that intent to a new identity. Neither a duplicate
signup nor an Auth response or timeout is proof of creation.

Issue a fresh secret for each *new* attempt in a prior response, before the
password POST. A new submission rotates the cookie; following an email link or
requesting a continuation does not. If an earlier link is opened after
rotation, it uses the existing password-after-OTP fence: when the current
cookie resolves to a different Auth identity, the verified OTP identity is
reused for that fallback without verifying the token a second time. It never
directly admits an identity merely because it shares the current browser.
The unique hash refuses reuse. The draft includes an unscheduled, bounded
`signup_browser_prune` for expired rows; it requires a separately reviewed
retention/monitoring process and coordination with intent and origin cleanup.
The preparation response also carries a domain-separated HMAC tag tied to the
HttpOnly secret. The signup POST checks the tag against its current cookie
before creating any intent or calling Auth. When two tabs race and the cookie
changes between those requests, the stale tab is refused; the tag is not the
secret and must not be logged or placed in a URL.

**Provider qualification blocker:** issue #135 requires duplicate signup calls
not to change an existing password, permissions, profile or consent; it does
not prohibit a second signup request. The source for GoTrue 2.197.0 used by the
local CLI leaves an existing unconfirmed user unchanged, but may resend email;
its partial unique email index excludes SSO identities. That local source is
not evidence of the hosted QA version, deployed constraints, configuration,
hooks or behavior. Direct/parallel duplicate, confirmation rotation, legacy and
SSO cases need provider-level qualification. `SIGNUP_DUPLICATE_CONTRACT_QUALIFIED`
is a second, code-controlled **false** guard and cannot be enabled by environment
variables. It is not an automatic hosted-version drift detector. Before any
change to it, explicitly verify and monitor hosted Auth version/configuration;
if these diverge or cannot be established, leave signup closed. The existing
fence must still never repeat an uncertain post-OTP password change.

The confirmation channel checks that the original browser cookie matches a
live bound intent **before** verifying the token. Another device without that
cookie uses the existing fenced workflow: verify OTP and require a fresh
password chosen by the email holder. Its uncertain Auth outcomes remain blocked.
This fallback now uses `signup_browser_recover_bound`: it accepts only a live
already-bound intent with unchanged legal versions and no completion fence. It
never creates an intent, rewrites accepted versions or drops the pending UTM.
If that intent is stale because its deadline passed or legal versions changed,
a fresh OTP may authorize a distinct, short session-bound reconsent checkpoint,
issued only after the stale intent was observed and bound to current document
versions. An ordinary confirmation checkpoint cannot authorize review. The review page
requires explicit current legal consent and separately asks whether to retain
existing origin data. Renewal updates only the same bound intent, either keeps
the existing UTM under the new explicit choice or clears it and records a
withdrawal event. It marks the browser attempt as requiring the fenced password
path, so a delayed direct admission cannot bypass the new decision. Renewal
then issues the ordinary password checkpoint without extending the OTP deadline.
An unknown renewal result requires a fresh OTP instead of blind retry. Missing/pruned
intent or provenance, existing fences, mismatched identity and moderation
refusals remain closed and require a separate recovery/support workflow. This
does not by itself complete #135's interrupted-signup recovery requirement.
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
Loss/expiry of the original cookie or moving devices uses the fenced password
fallback; an expired/missing intent, existing account or uncertain password
update can still require recovery or support. Never adopt an old password or
silently create a replacement intent merely because email addresses match.

`signup-resend-runtime.ts` requests a fixed continuation link through
`resetPasswordForEmail`. The candidate verifies a *new* recovery OTP on the
original browser, then checks identity, intent, secret, moderation and current
legal/consent snapshot before the same idempotent SQL command. Another browser
uses the password-reset fence; an existing browser session is not overwritten.
Test the hosted Auth behavior, recovery token
expiry, overlapping calls, already admitted account, changed legal versions,
cookie expiry and new lost response; no recovery is claimed before that work.

The branch provisions the cookie before the signup POST and leaves it to expire
after at most 30 minutes; confirmation never clears it, because a response for
one tab could otherwise erase the secret of a newer attempt in another tab. A
new attempt rotates it. The value is random and HttpOnly; its server-side HMAC
is retained only under the separately reviewed attempt-retention policy.
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

## Separate recovery retention candidate — not deployed

`same-browser-retention.guarded.sql.txt` is a separately guarded, unapproved
candidate, not a migration and not an instruction to run one. The currently
installed 028 cleanup may delete an expired intent at its first run; there is
therefore no deployed recovery-window guarantee. The candidate would retain
only a bound intent with its original browser-attempt provenance for up to 24
hours after that attempt's original deadline. It removes UTM and its consent
metadata at the original intent expiry; expired attribution is not restored on
renewal. Existing uncertainty fences remain protected beyond that window. New
OTP, current legal consent, the same bound identity, moderation checks, and
absence of a fence are still required for renewal. A missing intent or attempt
is refused; no old account is identified by email alone.

This candidate pins the expected 028 cleanup and proposed browser-cleanup
functions and legacy recovery writer, owner and privileges before replacing them. The candidate makes the legacy writer refuse every Auth identity inserted after the cutover, while retaining its existing behavior for pre-cutover pending identities. This does not stop an invocation that began before replacement or other writers; existing deployments and sessions must be drained. It needs an independent
security and concurrency review, a new migration with its own authorization,
and coordination with the existing scheduled cleanup and its monitoring. A second unconditional SQL blocker remains even if the scratch guard is removed; it must stay until a reviewed, enforceable protocol proves the scheduled job and every other cleanup caller paused and drained, controls concurrent writers (in particular the legacy `signup_recover_verified_intent`, which may delete an expired bound intent), drains old deployments, and coordinates health checks and new function hashes. The rollout must include a concurrent test proving legacy recovery cannot race retention or a new OTP. The candidate alone cannot guarantee the window. No
cron is installed or enabled here. Health checks that count all expired intents
as stale must be updated to recognize this bounded protected population, and
function hashes/qualification must be reviewed for the new definition. Prompt
scrubbing depends on the actual scheduled cleanup running successfully; these
synthetic tests are not evidence of hosted scheduling or race safety.

If renewal's outcome is unknown, the review screen offers an explicit request
to locally end the matching provisional session and request a fresh link. That
operation verifies the signed review proof and the current user/session first;
it does not globally revoke an account session. Cross-tab cookie replacement
between request and response cannot be made atomic with browser Set-Cookie and
remains an integration limitation requiring review.

## Versioned combined review candidate

`same-browser-composed-v1.guarded.sql.txt` combines the two candidates in one
transaction, generated from their exact contents by
`compose-same-browser-v1.mjs` with source hashes recorded in the header. It is
not a migration and must not be applied. Both unconditional blockers appear
before any schema changes; the second is a formal blocker, not evidence that
the cleanup job, other callers, legacy writers, or in-flight transactions have
been stopped. The attempt tables and original browser-prune function are
created first, then the retention preflight pins those functions alongside the
installed 028 functions before the legacy-writer and cleanup replacements.
The legal-version table is deliberately empty, and the application release
gates remain closed.

The disposable PGlite diagnostic compares the stored composition against the
generator, exercises both blockers, and injects a mismatched installed cleanup
body to verify that the whole transaction rolls back. Only within that local
memory database does it remove both blockers to exercise the candidate. Before
any future rollout, independently enumerate all callers, disable and drain old
writers and cron, establish a reviewed way to prove that state rather than
removing the formal blocker by assumption, and verify races under actual
Postgres. Review the empty legal table and published-text synchronization, the
hosted Auth version/duplicate behavior, expiry monitoring and renewed function
hashes, SMTP and cross-device flows; obtain explicit authorization for a new
migration. None of these actions alters or repairs the 028 ledger.

### Provenance through intent deletion

The candidate adds `signup_created_after_cutover` to the account admission
row, initially false for existing rows. The pinned Auth INSERT trigger sets it
true for every new identity in the INSERT transaction, regardless of whether
its pointer is missing, expired, or already pruned. This marker does not admit a
user. Legacy recovery refuses marked accounts even after intent deletion;
pre-cutover pending accounts retain the existing path. A verified Admin saga
is independent of this flag, but all other identity-creation paths must be
inventoried before rollout because newly created pending accounts cannot use
legacy recovery. The admission FK removes the marker with its account.

The composition requires signup disabled, pins the Auth trigger and public and
private legacy wrappers, and retains an unconditional blocker until all old
writers, old deployments and in-flight transactions are actually drained. It
does not infer historical provenance from email or metadata; existing pending
identities and any in-flight or historical public signups require review at
the cutover, and concurrent behavior needs actual Postgres tests.

The candidate retains attempt markers until intent deletion by FK cascade, so
a renewed bound intent cannot lose `requires_password` at the 24-hour cutoff.
After the original attempt has been expired for 24 hours, the proposed
browser-prune function locks the intent and scrubs only its browser hash,
regardless of intent state. It retains the marker, `requires_password`,
provenance and any uncertainty fence. Find/admit already reject the original
expired attempt; identity-bound recovery does not use the hash. This also
covers fenced password completion, which consumes the intent without setting
`attempt.consumed_at`, and bound intents whose fence remains unresolved. Actual
hash minimization depends on a separately approved, monitored cleanup process;
none is scheduled here. A verified plan to drain all old writers and actual
concurrent Postgres and Auth/SMTP tests remain release blockers. The boolean proposal and synthetic
Admin test are not evidence about the actual QA ledger or hosted concurrency.

Existing 028 health and toggle checks pin previous function bodies and counts;
they cannot simply be reused. A reviewed cutover must introduce compatible
health checks and schedulers covering the protected window and both intent and
browser cleanup, repin the new bodies, and observe results before activation.
Do not run legacy cron scripts against this candidate. No scheduler is enabled.

### OTP deadline and transaction boundary

The signed reconsent checkpoint supplies its original expiry to the server-only
renewal RPC; no deadline is read from the form. The guarded SQL checks that
finite deadline after its locked identity/intent/attempt checks and again
after all renewal writes before returning; an expired deadline raises and rolls
back the transaction. A committed operation whose reply is lost remains
unknown and must not be replayed as though a timeout cancelled it. This check
does not certify hosted clock synchronization, cross-session races, the time
between RPC return and actual transaction commit, or the retention scheduler.
The changed RPC signature and composition need new independent review and
qualification: all prior `39abb` retention/health/PG17 evidence stays pinned
to the old artifact and must not be silently carried forward.
