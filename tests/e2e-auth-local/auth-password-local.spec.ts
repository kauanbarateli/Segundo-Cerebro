import { test, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { dirname, relative, isAbsolute } from "node:path";
import type { Database } from "../../src/lib/supabase/database.generated";
import { acceptsDeleteAcknowledgement, classifyPostRequestFailure, cleanupMayProceed, hasLocalDocumentHeaders, localEnvironment, observePasswordOperation, passwordAcceptanceComplete, refuse, retainCleanupFailurePoint, retainPasswordFailurePoint, sessionFromCookies, type AuthLocalCleanupFailurePoint, type AuthPasswordChecks, type AuthPasswordCode, type AuthPasswordCounts, type AuthPasswordFailurePoint, type AuthPasswordStage } from "./support";
import { prepareAuthEffectObservation, createAuthEffectLedger, type AuthEffectUnknown } from "./auth-effect-outcome.mjs";

const environment = localEnvironment(process.env);
const SDK_TIMEOUT = 15_000;
const RESPONSE_LIMIT = 1_048_576;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Fixture = { id: string; email: string; password: string; marker: string; created: boolean };
type Session = { accessToken: string; sessionId: string; expiresAt: number };
type Actor = { context: BrowserContext; page: Page; fixture: Fixture; foreignRequest: boolean; session?: Session };

/** SDK transport is Node-only and cannot follow or contact a different origin. */
const localFetch: typeof fetch = async (input, options) => {
  let target: URL;
  try { target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); }
  catch { return refuse("ACCEPTANCE_FAILED"); }
  const method = (options?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const userPath = /^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/i.test(target.pathname);
  const allowed = (target.pathname === "/auth/v1/admin/users" && method === "POST" && !target.search) ||
    (userPath && ["GET", "DELETE"].includes(method) && !target.search) ||
    (target.pathname === "/auth/v1/user" && method === "GET" && !target.search) ||
    (target.pathname === "/auth/v1/logout" && method === "POST" && target.search === "?scope=global") ||
    (target.pathname === "/rest/v1/rpc/my_access_state" && method === "POST" && !target.search);
  if (target.origin !== environment.supabaseUrl || target.username || target.password || target.hash || !allowed) return refuse("ENVIRONMENT_REFUSED");
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("ACCEPTANCE_FAILED")); }, SDK_TIMEOUT);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(target, { ...options, redirect: "error", signal: controller.signal, cache: "no-store" });
      if (!response.body) return new Response(null, { status: response.status, headers: response.headers });
      reader = response.body.getReader();
      const pieces: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.byteLength;
        if (size > RESPONSE_LIMIT) return refuse("ACCEPTANCE_FAILED");
        pieces.push(result.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; }
      return new Response(bytes.buffer, { status: response.status, headers: response.headers });
    })()]);
  } catch { return refuse("ACCEPTANCE_FAILED"); }
  finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    // Cancelling a stalled body is best effort, never an unbounded cleanup wait.
    if (reader) void reader.cancel().catch(() => undefined);
  }
};

function matchesFixture(user: User | null | undefined, fixture: Fixture): boolean {
  return !!user && user.id === fixture.id && user.email === fixture.email && user.role === "authenticated" &&
    !user.is_anonymous && user.app_metadata?.sc_auth_local_ci_marker === fixture.marker;
}
function readerFor(session: Session) {
  return createClient<Database>(environment.supabaseUrl, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localFetch, headers: { Authorization: `Bearer ${session.accessToken}` } },
  });
}
async function writeClosedReport(report: unknown) {
  const root = await realpath(environment.runnerTemp), directory = await realpath(dirname(environment.reportPath));
  const child = relative(root, directory);
  const directoryStat = await stat(directory);
  if (!child || child.startsWith("..") || isAbsolute(child) || directory !== dirname(environment.reportPath) ||
      !directoryStat.isDirectory() || (directoryStat.mode & 0o077) !== 0) refuse("REPORT_WRITE_FAILED");
  const file = await open(environment.reportPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(JSON.stringify(report) + "\n", "utf8"); await file.sync(); }
  finally { await file.close(); }
}

test("Auth local real: troca normal de senha, revogação e nova entrada", async ({ browser }) => {
  const checks: AuthPasswordChecks = { loginA1: false, loginA2: false, loginB: false, protectedA1: false, protectedA2: false, protectedB: false, distinctASessions: false, passwordTerminalNotice: false, checkpointCookiesCleared: false, authCookiesCleared: false, oldADenied: false, bIntact: false, oldPasswordDeniedWithoutSession: false, newPasswordLogin: false, newSessionDistinct: false, newAProtected: false, cleanupRevokedNewA: false, cleanupRevokedB: false, cleanupConfirmed: false };
  const report = { schemaVersion: 2, scenario: "password-change" as const, status: "failed" as "passed" | "failed", code: "ACCEPTANCE_FAILED" as AuthPasswordCode, failurePoint: null as AuthPasswordFailurePoint | null, cleanupFailurePoint: null as AuthLocalCleanupFailurePoint | null, stages: [] as { name: AuthPasswordStage; passed: boolean }[], counts: { fixtureCreated: 0, fixtureDeleted: 0, browserContexts: 0, appLoginPostsA: 0, appLoginPostsB: 0, passwordChangePosts: 0, credentialAttemptsA: 0 } as AuthPasswordCounts, checks, cleanupConfirmed: false };
  const admin = createClient<Database>(environment.supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: localFetch },
  });
  const fixture = (): Fixture => ({ id: randomUUID(), email: `auth-local-${randomBytes(16).toString("hex")}@example.invalid`, password: `${randomBytes(24).toString("base64url")}-Aa1!`, marker: randomBytes(32).toString("hex"), created: false });
  const a = fixture(), b = fixture(), fixtures = [a, b];
  let newPassword = `${randomBytes(24).toString("base64url")}-Bb2!`;
  let newASession: Session | undefined;
  const actors: Actor[] = [];
  let uncertain = false;
  const effectLedger = createAuthEffectLedger();
  let failed = false;
  let activeFailurePoint: AuthPasswordFailurePoint = "FIXTURE_CREATE";

  async function stage(name: AuthPasswordStage, code: AuthPasswordCode, action: () => Promise<void>) {
    try { await action(); report.stages.push({ name, passed: true }); }
    catch { report.failurePoint = retainPasswordFailurePoint(report.failurePoint, activeFailurePoint); report.stages.push({ name, passed: false }); report.code = code; failed = true; throw new Error(code); }
  }
  async function newActor(owner: Fixture): Promise<Actor> {
    activeFailurePoint = "BROWSER_CONTEXT_CREATE";
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, viewport: { width: 1280, height: 900 } });
    const actor: Actor = { context, page: await context.newPage(), fixture: owner, foreignRequest: false };
    actors.push(actor); report.counts.browserContexts++;
    await context.route("**/*", async route => {
      let same = false;
      try { same = new URL(route.request().url()).origin === environment.appUrl; } catch { /* Closed refusal. */ }
      if (same) await route.continue();
      else { actor.foreignRequest = true; await route.abort(); }
    });
    await context.routeWebSocket("**/*", socket => {
      let same = false;
      try { const url = new URL(socket.url()); same = url.protocol === "ws:" && url.host === "127.0.0.1:3117"; } catch { /* Closed refusal. */ }
      if (same) socket.connectToServer();
      else { actor.foreignRequest = true; socket.close({ code: 1008, reason: "LOCAL_ORIGIN_REFUSED" }); }
    });
    return actor;
  }
  async function verifySession(actor: Actor): Promise<Session> {
    activeFailurePoint = "SESSION_COOKIE_POLICY";
    const cookies = await actor.context.cookies(environment.appUrl);
    const owned = cookies.filter(cookie => cookie.name === "sc-auth" || /^sc-auth\.[0-9]+$/.test(cookie.name));
    if (!owned.length || owned.some(cookie => !cookie.httpOnly || cookie.sameSite !== "Lax" || cookie.path !== "/" || cookie.secure)) refuse("LOGIN_FAILED");
    activeFailurePoint = "SESSION_COOKIE_HINT";
    const session = sessionFromCookies(owned, actor.fixture.id);
    activeFailurePoint = "SESSION_USER_VERIFICATION";
    const user = await admin.auth.getUser(session.accessToken);
    if (user.error || !matchesFixture(user.data.user, actor.fixture)) refuse("LOGIN_FAILED");
    activeFailurePoint = "SESSION_ACCESS_STATE";
    const state = await readerFor(session).rpc("my_access_state");
    const dto = state.data;
    if (state.error || !dto || typeof dto !== "object" || Array.isArray(dto) || dto.user_id !== actor.fixture.id || dto.role !== "user" || dto.must_change_password !== false ||
        !dto.entitlements || typeof dto.entitlements !== "object" || Array.isArray(dto.entitlements) || Object.keys(dto.entitlements).length !== 0) refuse("PROTECTED_SESSION_FAILED");
    activeFailurePoint = "SESSION_SCRIPT_COOKIE_ISOLATION";
    if (await actor.page.evaluate(() => document.cookie.split(";").some(cookie => /^\s*sc-auth(?:[.=]|$)/.test(cookie)))) refuse("LOGIN_FAILED");
    activeFailurePoint = "SESSION_NETWORK_ISOLATION";
    if (actor.foreignRequest) refuse("ENVIRONMENT_REFUSED");
    actor.session = session;
    return session;
  }
  async function login(actor: Actor, password = actor.fixture.password) {
    activeFailurePoint = "LOGIN_DOCUMENT";
    const response = await actor.page.goto(`${environment.appUrl}/entrar?returnTo=%2Foffline`);
    if (!response || response.status() !== 200 || !hasLocalDocumentHeaders(response.headers())) refuse("LOGIN_FAILED");
    activeFailurePoint = "LOGIN_FORM";
    const form = actor.page.locator("form.auth-form");
    if (await form.count() !== 1 || !await form.getByLabel("E-mail", { exact: true }).isEnabled() || !await form.getByLabel("Senha", { exact: true }).isEnabled()) refuse("LOGIN_FAILED");
    activeFailurePoint = "LOGIN_FIELDS";
    await form.getByLabel("E-mail", { exact: true }).fill(actor.fixture.email);
    await form.getByLabel("Senha", { exact: true }).fill(password);
    activeFailurePoint = "LOGIN_SUBMIT_NAVIGATION";
    const completion = await prepareAuthEffectObservation({ page: actor.page, operation: "login", prerequisite: async () => {
      if (actor.session || actor.foreignRequest) return false;
      return !(await actor.context.cookies(environment.appUrl)).some(cookie => /^sc-auth(?:[.-]|$)/.test(cookie.name));
    } });
    const firstFailure = (point: AuthPasswordFailurePoint) => { report.failurePoint = retainPasswordFailurePoint(report.failurePoint, point); };
    try {
      uncertain = true; // Set before submission; a lost reply must not certify cleanup.
      if (effectLedger.begin("login").status !== "armed") refuse("LOGIN_FAILED");
      if (actor.fixture === a) { report.counts.appLoginPostsA++; report.counts.credentialAttemptsA++; }
      else { report.counts.appLoginPostsB++; }
      const [posted] = await Promise.all([
        observePasswordOperation("LOGIN_RESPONSE_WAIT", () => actor.page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).origin === environment.appUrl && new URL(response.url()).pathname === "/entrar"), firstFailure),
        observePasswordOperation("LOGIN_URL_WAIT", () => actor.page.waitForURL(`${environment.appUrl}/offline`), firstFailure),
        observePasswordOperation("LOGIN_SUBMIT_CLICK", () => form.getByRole("button", { name: "Entrar", exact: true }).click(), firstFailure),
      ]);
      activeFailurePoint = "LOGIN_POST_STATUS";
      if (posted.status() < 200 || posted.status() >= 400) refuse("LOGIN_FAILED");
      activeFailurePoint = "LOGIN_POST_COMPLETION";
      const observed = await completion.observe(posted.request(), posted);
      if (observed.status !== "observed") { observationFailed(observed, firstFailure, posted.request()); refuse("LOGIN_FAILED"); }
      let verified: Session | undefined;
      const known = await effectLedger.confirmLogin(observed, {
        destination: async () => {
          activeFailurePoint = "LOGIN_DESTINATION";
          return actor.page.url() === `${environment.appUrl}/offline` &&
            await actor.page.getByRole("heading", { name: "Vamos retomar quando houver conexão", exact: true }).isVisible();
        },
        newSessionIdentityAndAccess: async () => {
          verified = await verifySession(actor);
          activeFailurePoint = "DISTINCT_SESSIONS";
          return !actors.some(other => other !== actor && other.session?.sessionId === verified!.sessionId);
        },
        protectedSameSession: async () => {
          const guarded = await protectedPage(actor);
          activeFailurePoint = "DISTINCT_SESSIONS";
          return !!verified && guarded.sessionId === verified.sessionId && guarded.accessToken === verified.accessToken;
        },
      });
      if (known.status !== "known") refuse("LOGIN_FAILED");
      uncertain = false;
    } catch {
      // Capture the original check before disposing a still-pending observer.
      firstFailure(activeFailurePoint); refuse("LOGIN_FAILED");
    } finally { completion.dispose(); }
  }
  function observationFailed(result: AuthEffectUnknown, firstFailure: (point: AuthPasswordFailurePoint) => void, request: { failure(): unknown }) {
    if (result.code === "COMPLETION_TIMEOUT") firstFailure("POST_COMPLETION_TIMEOUT");
    else if (result.code === "REQUEST_FAILED") {
      let failure: unknown; try { failure = request.failure(); } catch { /* Keep the closed unknown classification. */ }
      firstFailure(classifyPostRequestFailure(failure));
    }
    else firstFailure(activeFailurePoint);
  }
  async function protectedPage(actor: Actor) {
    activeFailurePoint = "PROTECTED_PAGE";
    const response = await actor.page.goto(`${environment.appUrl}/trocar-senha`);
    if (!response || response.status() !== 200 || actor.page.url() !== `${environment.appUrl}/trocar-senha` || !hasLocalDocumentHeaders(response.headers()) ||
        !await actor.page.getByRole("heading", { name: "Trocar senha", exact: true }).isVisible() ||
        !await actor.page.getByLabel("Senha atual", { exact: true }).isEnabled()) refuse("PROTECTED_SESSION_FAILED");
    return verifySession(actor);
  }

  try {
    await stage("fixtures-created", "FIXTURE_CREATE_FAILED", async () => {
      for (const owner of fixtures) {
        // Both exact IDs and markers exist in RAM before the first create call.
        activeFailurePoint = "FIXTURE_CREATE";
        uncertain = true;
        const result = await admin.auth.admin.createUser({ id: owner.id, email: owner.email, password: owner.password, email_confirm: true, app_metadata: { sc_auth_local_ci_marker: owner.marker } });
        if (result.error || !matchesFixture(result.data.user, owner)) refuse("FIXTURE_CREATE_FAILED");
        owner.created = true; report.counts.fixtureCreated++; uncertain = false;
      }
    });
    const a1 = await newActor(a), a2 = await newActor(a), other = await newActor(b);
    await stage("login-a1", "LOGIN_FAILED", async () => { await login(a1); checks.loginA1 = true; });
    await stage("login-a2", "LOGIN_FAILED", async () => { await login(a2); checks.loginA2 = true; });
    await stage("login-b", "LOGIN_FAILED", async () => { await login(other); checks.loginB = true; });
    await stage("protected-a1", "PROTECTED_SESSION_FAILED", async () => { await protectedPage(a1); checks.protectedA1 = true; });
    await stage("protected-a2", "PROTECTED_SESSION_FAILED", async () => { await protectedPage(a2); checks.protectedA2 = true; });
    await stage("protected-b", "PROTECTED_SESSION_FAILED", async () => { await protectedPage(other); checks.protectedB = true; });
    await stage("distinct-a-sessions", "SESSION_ISOLATION_FAILED", async () => {
      activeFailurePoint = "DISTINCT_SESSIONS";
      if (!a1.session || !a2.session || !other.session || a1.session.sessionId === a2.session.sessionId ||
          [a1.session.sessionId, a2.session.sessionId].includes(other.session.sessionId)) refuse("SESSION_ISOLATION_FAILED");
      checks.distinctASessions = true;
    });
    const oldA1 = a1.session!, oldA = a2.session!, originalB = other.session!;
    await stage("password-change-terminal", "PASSWORD_CHANGE_FAILED", async () => {
      activeFailurePoint = "PASSWORD_FORM";
      const form = a1.page.locator("form.auth-form");
      if (await form.count() !== 1 || !await a1.page.getByRole("heading", { name: "Trocar senha", exact: true }).isVisible() ||
          !await form.getByLabel("Senha atual", { exact: true }).isEnabled() ||
          !await form.getByLabel("Nova senha", { exact: true }).isEnabled() ||
          !await form.getByLabel("Confirmar nova senha", { exact: true }).isEnabled()) refuse("PASSWORD_CHANGE_FAILED");
      activeFailurePoint = "PASSWORD_FIELDS";
      if (newPassword === a.password || Buffer.byteLength(newPassword, "utf8") > 72 || newPassword.length < 12) refuse("PASSWORD_CHANGE_FAILED");
      await form.getByLabel("Senha atual", { exact: true }).fill(a.password);
      await form.getByLabel("Nova senha", { exact: true }).fill(newPassword);
      await form.getByLabel("Confirmar nova senha", { exact: true }).fill(newPassword);
      activeFailurePoint = "PASSWORD_SUBMIT_NAVIGATION";
      const completion = await prepareAuthEffectObservation({ page: a1.page, operation: "password-change", prerequisite: async () => {
        const session = await verifySession(a1);
        return session.sessionId === oldA1.sessionId && session.accessToken === oldA1.accessToken;
      } });
      const firstFailure = (point: AuthPasswordFailurePoint) => { report.failurePoint = retainPasswordFailurePoint(report.failurePoint, point); };
      try {
        uncertain = true;
        if (effectLedger.begin("password-change").status !== "armed") refuse("PASSWORD_CHANGE_FAILED");
        // These are attempts, not provider receipts or HMAC-hit observations.
        report.counts.passwordChangePosts++;
        report.counts.credentialAttemptsA++;
        const [posted] = await Promise.all([
          a1.page.waitForResponse(response => response.request().method() === "POST" && response.url() === `${environment.appUrl}/trocar-senha`),
          a1.page.waitForURL(`${environment.appUrl}/entrar?notice=password-updated`),
          form.getByRole("button", { name: "Salvar nova senha", exact: true }).click(),
        ]);
        if (posted.status() < 200 || posted.status() >= 400) refuse("PASSWORD_CHANGE_FAILED");
        const observed = await completion.observe(posted.request(), posted);
        if (observed.status !== "observed") { observationFailed(observed, firstFailure, posted.request()); refuse("PASSWORD_CHANGE_FAILED"); }
        const terminal = await effectLedger.confirmPasswordTerminal(observed, async () => {
          activeFailurePoint = "PASSWORD_TERMINAL_NOTICE";
          const notice = a1.page.locator('.auth-feedback[role="status"]');
          await notice.waitFor({ state: "visible" });
          if (await notice.count() !== 1 || !await notice.isVisible() ||
              await notice.textContent() !== "Senha atualizada. Entre novamente com sua nova senha." ||
              a1.page.url() !== `${environment.appUrl}/entrar?notice=password-updated`) return false;
          checks.passwordTerminalNotice = true;
          const cookies = await a1.context.cookies(environment.appUrl);
          activeFailurePoint = "PASSWORD_CHECKPOINT_CLEARANCE";
          if (cookies.some(cookie => cookie.name === "sc-flow-password")) return false;
          checks.checkpointCookiesCleared = true;
          activeFailurePoint = "PASSWORD_AUTH_COOKIE_CLEARANCE";
          if (cookies.some(cookie => /^sc-auth(?:[.-]|$)/.test(cookie.name))) return false;
          checks.authCookiesCleared = true;
          a1.session = undefined;
          return true;
        });
        if (terminal.status !== "pending-password-effect") refuse("PASSWORD_CHANGE_FAILED");
        // This proves only the terminal transition. The independent PW latch
        // stays pending until all old/new credential and session proofs pass.
        uncertain = false;
      } catch { firstFailure(activeFailurePoint); refuse("PASSWORD_CHANGE_FAILED"); }
      finally { completion.dispose(); }
    });
    await stage("old-a-denied", "OLD_SESSION_ACCEPTED", async () => {
      const outcome = await effectLedger.checkpoint("old-a-denied", async () => {
        activeFailurePoint = "OLD_A_TOKEN_LIFETIME";
        if (oldA.expiresAt <= Date.now() + 60_000) refuse("OLD_SESSION_ACCEPTED");
        activeFailurePoint = "OLD_A_ACCESS_STATE";
        const state = await readerFor(oldA).rpc("my_access_state");
        if (state.error?.code !== "42501" || state.data !== null) refuse("OLD_SESSION_ACCEPTED");
        activeFailurePoint = "OLD_A_TOKEN_LIFETIME";
        if (oldA.expiresAt <= Date.now() + 60_000) refuse("OLD_SESSION_ACCEPTED");
        activeFailurePoint = "OLD_A_PAGE_GUARD";
        await a2.page.goto(`${environment.appUrl}/trocar-senha`);
        if (a2.page.url() !== `${environment.appUrl}/entrar?notice=session-required` ||
            !await a2.page.getByRole("heading", { name: "Entrar", exact: true }).isVisible() ||
            oldA.expiresAt <= Date.now() + 60_000) refuse("OLD_SESSION_ACCEPTED");
        checks.oldADenied = true;
        return true;
      });
      if (outcome.status !== "pending-password-effect") refuse("OLD_SESSION_ACCEPTED");
    });
    await stage("b-intact", "OTHER_ACCOUNT_CHANGED", async () => {
      const outcome = await effectLedger.checkpoint("b-intact", async () => {
        const session = await protectedPage(other);
        activeFailurePoint = "OTHER_B_SESSION_INTACT";
        if (session.sessionId !== originalB.sessionId || session.accessToken !== originalB.accessToken) return false;
        checks.bIntact = true;
        return true;
      });
      if (outcome.status !== "pending-password-effect") refuse("OTHER_ACCOUNT_CHANGED");
    });
    await stage("old-password-denied", "OLD_PASSWORD_ACCEPTED", async () => {
      activeFailurePoint = "LOGIN_DOCUMENT";
      const response = await a1.page.goto(`${environment.appUrl}/entrar?returnTo=%2Foffline`);
      if (!response || response.status() !== 200 || !hasLocalDocumentHeaders(response.headers())) refuse("OLD_PASSWORD_ACCEPTED");
      activeFailurePoint = "LOGIN_FORM";
      const form = a1.page.locator("form.auth-form");
      if (await form.count() !== 1 || !await form.getByLabel("E-mail", { exact: true }).isEnabled() ||
          !await form.getByLabel("Senha", { exact: true }).isEnabled()) refuse("OLD_PASSWORD_ACCEPTED");
      activeFailurePoint = "LOGIN_FIELDS";
      await form.getByLabel("E-mail", { exact: true }).fill(a.email);
      await form.getByLabel("Senha", { exact: true }).fill(a.password);
      activeFailurePoint = "OLD_PASSWORD_SUBMIT_COMPLETION";
      const completion = await prepareAuthEffectObservation({ page: a1.page, operation: "old-password", prerequisite: async () => {
        if (a1.session || a1.foreignRequest) return false;
        return !(await a1.context.cookies(environment.appUrl)).some(cookie => /^sc-auth(?:[.-]|$)/.test(cookie.name));
      } });
      const firstFailure = (point: AuthPasswordFailurePoint) => { report.failurePoint = retainPasswordFailurePoint(report.failurePoint, point); };
      try {
        uncertain = true;
        if (effectLedger.begin("old-password").status !== "armed") refuse("OLD_PASSWORD_ACCEPTED");
        report.counts.appLoginPostsA++; report.counts.credentialAttemptsA++;
        const [posted] = await Promise.all([
          a1.page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).origin === environment.appUrl && new URL(response.url()).pathname === "/entrar"),
          form.getByRole("button", { name: "Entrar", exact: true }).click(),
        ]);
        if (posted.status() !== 200) refuse("OLD_PASSWORD_ACCEPTED");
        const observed = await completion.observe(posted.request(), posted);
        if (observed.status !== "observed") { observationFailed(observed, firstFailure, posted.request()); refuse("OLD_PASSWORD_ACCEPTED"); }
        const refusedOld = await effectLedger.confirmOldPasswordRefusal(observed, async () => {
          activeFailurePoint = "OLD_PASSWORD_GENERIC_REFUSAL";
          const feedback = a1.page.locator('.auth-feedback[role="alert"][data-error="true"]');
          await feedback.waitFor({ state: "visible" });
          if (await feedback.count() !== 1 || await feedback.textContent() !== "Não foi possível entrar. Confira os dados e tente novamente." ||
              a1.page.url() !== `${environment.appUrl}/entrar?returnTo=%2Foffline`) return false;
          activeFailurePoint = "OLD_PASSWORD_COOKIE_CLEARANCE";
          if ((await a1.context.cookies(environment.appUrl)).some(cookie => /^sc-auth(?:[.-]|$)/.test(cookie.name)) || a1.session) return false;
          checks.oldPasswordDeniedWithoutSession = true;
          return true;
        });
        if (refusedOld.status !== "known") refuse("OLD_PASSWORD_ACCEPTED");
        uncertain = false;
      } catch { firstFailure(activeFailurePoint); refuse("OLD_PASSWORD_ACCEPTED"); }
      finally { completion.dispose(); }
    });
    await stage("new-password-login", "NEW_PASSWORD_LOGIN_FAILED", async () => {
      await login(a1, newPassword);
      const distinct = await effectLedger.checkpoint("new-session-distinct", async () => {
        activeFailurePoint = "DISTINCT_SESSIONS";
        if (!a1.session || [oldA1.sessionId, oldA.sessionId, originalB.sessionId].includes(a1.session.sessionId)) return false;
        // Only this verified, distinct NEW session can satisfy A's cleanup check.
        newASession = a1.session;
        checks.newPasswordLogin = checks.newSessionDistinct = true;
        return true;
      });
      if (distinct.status !== "pending-password-effect") refuse("NEW_PASSWORD_LOGIN_FAILED");
    });
    await stage("new-a-protected", "PROTECTED_SESSION_FAILED", async () => {
      const complete = await effectLedger.checkpoint("new-a-protected", async () => {
        const session = await protectedPage(a1);
        activeFailurePoint = "DISTINCT_SESSIONS";
        if (!newASession || session.sessionId !== newASession.sessionId || session.accessToken !== newASession.accessToken) return false;
        newASession = session;
        checks.newAProtected = true;
        return true;
      });
      if (complete.status !== "known") refuse("PROTECTED_SESSION_FAILED");
    });
  } catch {
    report.failurePoint = retainPasswordFailurePoint(report.failurePoint, activeFailurePoint);
    failed = true;
    if (!report.stages.some(stage => !stage.passed)) report.code = "ACCEPTANCE_FAILED";
  } finally {
    activeFailurePoint = "FIXTURE_CLEANUP";
    let cleanup = cleanupMayProceed(uncertain) && effectLedger.cleanupMayProceed(false);
    if (!cleanup) report.cleanupFailurePoint = retainCleanupFailurePoint(report.cleanupFailurePoint, "OUTCOME_UNCERTAIN");
    for (const actor of actors) {
      try { await actor.context.close({ reason: "AUTH_LOCAL_CLEANUP" }); }
      catch { report.cleanupFailurePoint = retainCleanupFailurePoint(report.cleanupFailurePoint, "CONTEXT_CLOSE"); cleanup = false; }
    }
    if (cleanup) {
      for (const owner of fixtures.filter(owner => owner.created)) {
        let cleanupPoint: AuthLocalCleanupFailurePoint = "FIXTURE_PRECHECK";
        try {
          const current = await admin.auth.admin.getUserById(owner.id);
          if (current.error || !matchesFixture(current.data.user, owner) || !UUID.test(owner.id)) refuse("CLEANUP_UNCONFIRMED");
          cleanupPoint = "SESSION_REVOCATION";
          // A requires the newly verified session. The old revocation proof
          // never skips or substitutes this global cleanup of the NEW login.
          const known = owner === a ? newASession : actors.find(actor => actor.fixture === b)?.session;
          if (!known) refuse("CLEANUP_UNCONFIRMED");
          const verified = await admin.auth.getUser(known.accessToken);
          if (verified.error || !matchesFixture(verified.data.user, owner)) refuse("CLEANUP_UNCONFIRMED");
          const revoked = await admin.auth.admin.signOut(known.accessToken, "global");
          if (revoked.error) refuse("CLEANUP_UNCONFIRMED");
          if (owner === a) checks.cleanupRevokedNewA = true;
          else checks.cleanupRevokedB = true;
          cleanupPoint = "FIXTURE_DELETE_ACK";
          const removed = await admin.auth.admin.deleteUser(owner.id, false);
          if (!acceptsDeleteAcknowledgement(removed, owner)) refuse("CLEANUP_UNCONFIRMED");
          cleanupPoint = "FIXTURE_ABSENCE";
          const absent = await admin.auth.admin.getUserById(owner.id);
          if (absent.data.user || absent.error?.status !== 404 || absent.error?.code !== "user_not_found") refuse("CLEANUP_UNCONFIRMED");
          report.counts.fixtureDeleted++;
        } catch { report.cleanupFailurePoint = retainCleanupFailurePoint(report.cleanupFailurePoint, cleanupPoint); cleanup = false; }
      }
    }
    checks.cleanupConfirmed = report.cleanupConfirmed = cleanup && report.counts.fixtureCreated === report.counts.fixtureDeleted;
    report.stages.push({ name: "fixture-cleanup", passed: checks.cleanupConfirmed });
    if (!checks.cleanupConfirmed) { report.failurePoint = retainPasswordFailurePoint(report.failurePoint, activeFailurePoint); failed = true; report.code = "CLEANUP_UNCONFIRMED"; }
    if (!failed && !passwordAcceptanceComplete(report)) {
      report.failurePoint = retainPasswordFailurePoint(report.failurePoint, activeFailurePoint);
      failed = true; report.code = "ACCEPTANCE_FAILED";
    }
    report.status = failed ? "failed" : "passed";
    if (!failed) report.code = "PASSED";
    // Reports have a closed metadata projection; provider errors and fixture
    // material never enter reporter output, attachments, artifacts or this file.
    try { await writeClosedReport(report); }
    catch { refuse("REPORT_WRITE_FAILED"); }
    for (const actor of actors) { actor.session = undefined; }
    for (const owner of fixtures) { owner.password = ""; owner.email = ""; owner.marker = ""; }
    newPassword = ""; newASession = undefined;
    effectLedger.dispose();
  }
  if (failed) refuse(report.code);
});
