import { test, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { dirname, relative, isAbsolute } from "node:path";
import type { Database } from "../../src/lib/supabase/database.generated";
import { cleanupMayProceed, localEnvironment, refuse, retainFailurePoint, sessionFromCookies, type AuthLocalCode, type AuthLocalFailurePoint, type AuthLocalStage } from "./support";

const environment = localEnvironment(process.env);
const SDK_TIMEOUT = 15_000;
const RESPONSE_LIMIT = 1_048_576;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Fixture = { id: string; email: string; password: string; marker: string; created: boolean };
type Session = { accessToken: string; sessionId: string; expiresAt: number };
type Actor = { context: BrowserContext; page: Page; fixture: Fixture; foreignRequest: boolean; session?: Session };
type Checks = { loginA1: boolean; loginA2: boolean; loginB: boolean; protectedA1: boolean; protectedA2: boolean; protectedB: boolean; distinctASessions: boolean; logoutGlobalA: boolean; oldADenied: boolean; bIntact: boolean; cleanupConfirmed: boolean };

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
function hasProtectedHeaders(headers: Record<string, string>): boolean {
  return /private/.test(headers["cache-control"] ?? "") && /no-store/.test(headers["cache-control"] ?? "") &&
    !!headers["content-security-policy"] && headers["x-content-type-options"] === "nosniff";
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

test("Auth local real: três sessões, logout global e isolamento", async ({ browser }) => {
  const checks: Checks = { loginA1: false, loginA2: false, loginB: false, protectedA1: false, protectedA2: false, protectedB: false, distinctASessions: false, logoutGlobalA: false, oldADenied: false, bIntact: false, cleanupConfirmed: false };
  const report = { schemaVersion: 1, status: "failed" as "passed" | "failed", code: "ACCEPTANCE_FAILED" as AuthLocalCode, failurePoint: null as AuthLocalFailurePoint | null, stages: [] as { name: AuthLocalStage; passed: boolean }[], counts: { fixtureCreated: 0, fixtureDeleted: 0, browserContexts: 0 }, checks, cleanupConfirmed: false };
  const admin = createClient<Database>(environment.supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: localFetch },
  });
  const fixture = (): Fixture => ({ id: randomUUID(), email: `auth-local-${randomBytes(16).toString("hex")}@example.invalid`, password: `${randomBytes(24).toString("base64url")}-Aa1!`, marker: randomBytes(32).toString("hex"), created: false });
  const a = fixture(), b = fixture(), fixtures = [a, b];
  const actors: Actor[] = [];
  let uncertain = false;
  let failed = false;
  let activeFailurePoint: AuthLocalFailurePoint = "FIXTURE_CREATE";

  async function stage(name: AuthLocalStage, code: AuthLocalCode, action: () => Promise<void>) {
    try { await action(); report.stages.push({ name, passed: true }); }
    catch { report.failurePoint = retainFailurePoint(report.failurePoint, activeFailurePoint); report.stages.push({ name, passed: false }); report.code = code; failed = true; throw new Error(code); }
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
    if (state.error || !dto || typeof dto !== "object" || Array.isArray(dto) || dto.user_id !== actor.fixture.id || dto.role !== "user" || dto.must_change_password !== false) refuse("PROTECTED_SESSION_FAILED");
    activeFailurePoint = "SESSION_SCRIPT_COOKIE_ISOLATION";
    if (await actor.page.evaluate(() => document.cookie.split(";").some(cookie => /^\s*sc-auth(?:[.=]|$)/.test(cookie)))) refuse("LOGIN_FAILED");
    activeFailurePoint = "SESSION_NETWORK_ISOLATION";
    if (actor.foreignRequest) refuse("ENVIRONMENT_REFUSED");
    actor.session = session;
    return session;
  }
  async function login(actor: Actor) {
    activeFailurePoint = "LOGIN_DOCUMENT";
    const response = await actor.page.goto(`${environment.appUrl}/entrar?returnTo=%2Foffline`);
    if (!response || response.status() !== 200 || !hasProtectedHeaders(response.headers())) refuse("LOGIN_FAILED");
    activeFailurePoint = "LOGIN_FORM";
    const form = actor.page.locator("form.auth-form");
    if (await form.count() !== 1 || !await form.getByLabel("E-mail", { exact: true }).isEnabled() || !await form.getByLabel("Senha", { exact: true }).isEnabled()) refuse("LOGIN_FAILED");
    activeFailurePoint = "LOGIN_FIELDS";
    await form.getByLabel("E-mail", { exact: true }).fill(actor.fixture.email);
    await form.getByLabel("Senha", { exact: true }).fill(actor.fixture.password);
    activeFailurePoint = "LOGIN_SUBMIT_NAVIGATION";
    uncertain = true; // Set before submission; a lost reply must not certify cleanup.
    await Promise.all([actor.page.waitForURL(`${environment.appUrl}/offline`), form.getByRole("button", { name: "Entrar", exact: true }).click()]);
    activeFailurePoint = "LOGIN_DESTINATION";
    if (!await actor.page.getByRole("heading", { name: "Vamos retomar quando houver conexão", exact: true }).isVisible()) refuse("LOGIN_FAILED");
    await verifySession(actor);
    uncertain = false;
  }
  async function protectedPage(actor: Actor) {
    activeFailurePoint = "PROTECTED_PAGE";
    const response = await actor.page.goto(`${environment.appUrl}/trocar-senha`);
    if (!response || response.status() !== 200 || actor.page.url() !== `${environment.appUrl}/trocar-senha` || !hasProtectedHeaders(response.headers()) ||
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
    const oldA = a2.session!, originalB = other.session!;
    await stage("logout-global-a", "LOGOUT_FAILED", async () => {
      activeFailurePoint = "LOGOUT_DOCUMENT";
      const response = await a1.page.goto(`${environment.appUrl}/sair`);
      if (!response || response.status() !== 200) refuse("LOGOUT_FAILED");
      const form = a1.page.locator('form[action="/auth/logout"]');
      if (await form.count() !== 1 || await form.getAttribute("method") !== "post") refuse("LOGOUT_FAILED");
      activeFailurePoint = "LOGOUT_SUBMIT_NAVIGATION";
      uncertain = true;
      const [logout] = await Promise.all([
        a1.page.waitForResponse(response => response.request().method() === "POST" && response.url() === `${environment.appUrl}/auth/logout`),
        form.getByRole("button", { name: "Sair da conta", exact: true }).click(),
      ]);
      await a1.page.waitForURL(`${environment.appUrl}/entrar?notice=signed-out`);
      activeFailurePoint = "LOGOUT_RESPONSE_POLICY";
      if (logout.status() !== 303 || logout.headers().location !== "/entrar?notice=signed-out" ||
          !hasProtectedHeaders(logout.headers()) || !logout.headers()["clear-site-data"]?.includes('"storage"')) refuse("LOGOUT_FAILED");
      activeFailurePoint = "LOGOUT_COOKIE_CLEARANCE";
      if ((await a1.context.cookies(environment.appUrl)).some(cookie => /^sc-auth(?:[.-]|$)/.test(cookie.name))) refuse("LOGOUT_FAILED");
      checks.logoutGlobalA = true; uncertain = false;
    });
    await stage("old-a-denied", "OLD_SESSION_ACCEPTED", async () => {
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
    });
    await stage("b-intact", "OTHER_ACCOUNT_CHANGED", async () => {
      const session = await protectedPage(other);
      activeFailurePoint = "OTHER_B_SESSION_INTACT";
      if (session.sessionId !== originalB.sessionId) refuse("OTHER_ACCOUNT_CHANGED");
      checks.bIntact = true;
    });
  } catch {
    report.failurePoint = retainFailurePoint(report.failurePoint, activeFailurePoint);
    failed = true;
    if (!report.stages.some(stage => !stage.passed)) report.code = "ACCEPTANCE_FAILED";
  } finally {
    activeFailurePoint = "FIXTURE_CLEANUP";
    let cleanup = cleanupMayProceed(uncertain);
    for (const actor of actors) {
      try { await actor.context.close({ reason: "AUTH_LOCAL_CLEANUP" }); }
      catch { cleanup = false; }
    }
    if (cleanup) {
      for (const owner of fixtures.filter(owner => owner.created)) {
        try {
          const current = await admin.auth.admin.getUserById(owner.id);
          if (current.error || !matchesFixture(current.data.user, owner) || !UUID.test(owner.id)) refuse("CLEANUP_UNCONFIRMED");
          const sessions = actors.filter(actor => actor.fixture === owner && actor.session).map(actor => actor.session!);
          // A's app logout was proven against the old RPC and cookie; otherwise
          // verify the exact marker + token subject before a global SDK revoke.
          if (!(owner === a && checks.logoutGlobalA && checks.oldADenied) && sessions.length) {
            const known = sessions[0]!;
            const verified = await admin.auth.getUser(known.accessToken);
            if (verified.error || !matchesFixture(verified.data.user, owner)) refuse("CLEANUP_UNCONFIRMED");
            const revoked = await admin.auth.admin.signOut(known.accessToken, "global");
            if (revoked.error) refuse("CLEANUP_UNCONFIRMED");
          }
          const removed = await admin.auth.admin.deleteUser(owner.id, false);
          if (removed.error || !matchesFixture(removed.data.user, owner)) refuse("CLEANUP_UNCONFIRMED");
          const absent = await admin.auth.admin.getUserById(owner.id);
          if (absent.data.user || absent.error?.status !== 404 || absent.error?.code !== "user_not_found") refuse("CLEANUP_UNCONFIRMED");
          report.counts.fixtureDeleted++;
        } catch { cleanup = false; }
      }
    }
    checks.cleanupConfirmed = report.cleanupConfirmed = cleanup && report.counts.fixtureCreated === report.counts.fixtureDeleted;
    report.stages.push({ name: "fixture-cleanup", passed: checks.cleanupConfirmed });
    if (!checks.cleanupConfirmed) { report.failurePoint = retainFailurePoint(report.failurePoint, activeFailurePoint); failed = true; report.code = "CLEANUP_UNCONFIRMED"; }
    report.status = failed ? "failed" : "passed";
    if (!failed) report.code = "PASSED";
    // Reports have a closed metadata projection; provider errors and fixture
    // material never enter reporter output, attachments, artifacts or this file.
    try { await writeClosedReport(report); }
    catch { refuse("REPORT_WRITE_FAILED"); }
    for (const actor of actors) { actor.session = undefined; }
    for (const owner of fixtures) { owner.password = ""; owner.email = ""; owner.marker = ""; }
  }
  if (failed) refuse(report.code);
});
