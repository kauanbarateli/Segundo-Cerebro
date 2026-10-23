import { expect, type Page } from "@playwright/test";
import type { OnboardingCommand, OnboardingDraft, OnboardingIntentReceipt, OnboardingSnapshot } from "../../../src/core/onboarding/types";
import { decodeOnboardingCommand, decodeOnboardingSnapshot } from "../../../src/core/onboarding/validation";

export const onboardingOrigin = "https://onboarding.test";
export const onboardingOwner = "72000000-0000-4000-8000-000000000001";
export const onboardingOtherOwner = "72000000-0000-4000-8000-000000000002";
const copy = <T>(value: T): T => structuredClone(value);
const emptyDraft = (): OnboardingDraft => ({ profile: {}, habits: [], projects: [], tasks: [], notes: null });
const fixedTime = "2026-10-23T06:00:00.000Z", expiry = "2026-11-22T06:00:00.000Z";
export function emptyOnboardingSnapshot(ownerId = onboardingOwner): OnboardingSnapshot {
  return { schemaVersion: 1, ownerId, today: "2026-10-23", timeZone: "America/Sao_Paulo",
    eligibility: { kind: "existing_opt_in", canStart: true, offerPending: false, reason: null },
    capabilities: { configuracoes: true, calendario: true, habitos: true, projetos: true, tarefas: true, conhecimento: true, financeiro: true, cofre: true },
    profile: { displayName: "Pessoa de exemplo", focus: null, revision: "profile:1" }, round: null,
    calendar: { status: "ready", canConnect: true, accounts: [], sources: [] }, recovery: [] };
}
export function partialOnboardingSnapshot(): OnboardingSnapshot {
  const state = emptyOnboardingSnapshot();
  const confirmed: OnboardingIntentReceipt = { intentId: "72000000-0000-4000-8000-000000000011", itemKey: "72000000-0000-4000-8000-000000000012", kind: "profile", status: "confirmed", entityId: onboardingOwner, reason: null };
  const project: OnboardingIntentReceipt = { intentId: "72000000-0000-4000-8000-000000000013", itemKey: "72000000-0000-4000-8000-000000000014", kind: "project", status: "failed", entityId: null, reason: "validation" };
  const task: OnboardingIntentReceipt = { intentId: "72000000-0000-4000-8000-000000000015", itemKey: "72000000-0000-4000-8000-000000000016", kind: "task", status: "blocked", entityId: null, reason: "dependency" };
  state.round = { id: "72000000-0000-4000-8000-000000000010", revision: "9", status: "partial", step: "summary", draft: null, editedAt: fixedTime, expiresAt: expiry, receipts: [confirmed, project, task] };
  state.recovery = [
    { intentId: project.intentId, itemKey: project.itemKey, kind: "project", status: "failed", choice: { kind: "project", name: "Plano a revisar", context: "personal" }, canReplace: true, canOmit: true, dependentIntentIds: [task.intentId] },
    { intentId: task.intentId, itemKey: task.itemKey, kind: "task", status: "blocked", choice: { kind: "task", title: "Próximo passo", project: { kind: "draft", key: project.itemKey }, due: { kind: "none" } }, canReplace: true, canOmit: true, dependentIntentIds: [] },
  ];
  return state;
}

/** Closed synthetic API. Models CAS and original-body receipts; not a database
 * emulator or proof of connected persistence. All requests are intercepted. */
export async function attachOnboardingApi(page: Page, theme: "light" | "dark", initial = emptyOnboardingSnapshot(), options: { lose?: "onboarding.confirm" | "onboarding.amend"; oauth?: "refuse" } = {}) {
  let snapshot = copy(initial), sequence = 100;
  const id = () => "72000000-0000-4000-8000-" + String(++sequence).padStart(12, "0");
  const trace = { commands: [] as { body: string; command: OnboardingCommand }[], reads: 0, choices: 0, effects: [] as string[], unexpected: [] as string[], errors: [] as string[], replies: 0,
    holdRead: null as Promise<void> | null, holdCommand: null as { command: OnboardingCommand["command"]; wait: Promise<void> } | null,
    amendDenial: null as { status: number; code: "FORBIDDEN" | "CONFLICT" } | null, oauth: [] as unknown[], oauthNavigations: 0, calendarSelections: [] as unknown[], themeWrites: [] as unknown[] };
  const receipts = new Map<string, { body: string; result: OnboardingSnapshot }>(); let lost = false;
  const bump = () => { snapshot.round!.revision = String(BigInt(snapshot.round!.revision) + 1n); };
  const resultSnapshot = () => decodeOnboardingSnapshot(copy(snapshot), snapshot.ownerId);
  const collectIntents = (draft: OnboardingDraft) => {
    const output: OnboardingIntentReceipt[] = [];
    const add = (kind: OnboardingIntentReceipt["kind"], itemKey: string) => output.push({ intentId: id(), itemKey, kind, status: "ready", entityId: null, reason: null });
    if (draft.profile.displayName !== undefined || draft.profile.focus !== undefined) add("profile", id());
    for (const item of draft.habits) add("habit", item.key);
    for (const item of draft.projects) add("project", item.key);
    for (const item of draft.tasks) add("task", item.key);
    if (draft.notes?.notebook.kind === "new") add("notebook", draft.notes.notebook.key);
    if (draft.notes?.page) { add("page", draft.notes.page.key); if (draft.notes.page.project) add("link", id()); }
    return output;
  };
  page.on("pageerror", error => trace.errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const json = async (value: unknown, status = 200) => { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) }); trace.replies++; };
    if (url.origin === "https://accounts.google.com" && url.pathname === "/o/oauth2/v2/auth" && url.search === "?client_id=synthetic&state=synthetic") {
      expect(request.isNavigationRequest()).toBe(true); expect(trace.oauth).toHaveLength(1); trace.oauthNavigations++;
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>OAuth simulado</title><h1>Provedor simulado, sem conexão real</h1>" }); return;
    }
    if (url.origin !== onboardingOrigin) { trace.unexpected.push("FOREIGN_ORIGIN"); await route.abort(); return; }
    if (request.isNavigationRequest() && request.method() === "GET" && url.pathname === "/onboarding") {
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR" data-theme="${theme}" data-account-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onboarding sintético</title></head><body><div id="onboarding-root"></div></body></html>` }); return;
    }
    if (request.headers()["x-expected-user-id"] !== snapshot.ownerId) { trace.unexpected.push("OWNER_HEADER"); await route.abort(); return; }
    if (request.method() === "POST") { expect(request.headers().origin).toBe(onboardingOrigin); expect(request.headers()["content-type"]).toBe("application/json"); }
    if (url.pathname === "/api/settings" && request.method() === "POST" && !url.search) { trace.themeWrites.push(request.postDataJSON()); await json({ ok: true }); return; }
    if (url.pathname === "/api/calendar/oauth/start" && request.method() === "POST" && !url.search) {
      const body = request.postDataJSON(); expect(body.continuation).toEqual({ kind: "onboarding", round_id: snapshot.round!.id }); expect(typeof body.client_id).toBe("string"); trace.oauth.push(body);
      if (options.oauth === "refuse") await json({ ok: false, code: "FORBIDDEN" }, 403);
      else await json({ ok: true, authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=synthetic&state=synthetic" });
      return;
    }
    if (url.pathname === "/api/calendar" && request.method() === "POST" && !url.search) {
      const body = request.postDataJSON(); expect(body.command).toBe("calendar.select"); trace.calendarSelections.push(body);
      const source = snapshot.calendar.sources.find(item => item.id === body.input.calendar_id); expect(source).toBeTruthy(); source!.selected = body.input.selected; await json({ ok: true }); return;
    }
    if (url.pathname !== "/api/onboarding") { trace.unexpected.push("UNDECLARED_PATH"); await route.abort(); return; }
    if (request.method() === "GET") {
      if (url.search) {
        const kind = url.searchParams.get("choices"); expect(["projects", "notebooks"]).toContain(kind); expect([...url.searchParams.keys()].sort()).toEqual(["choices", "q"]); trace.choices++;
        await json({ ok: true, result: { kind, items: [], nextCursor: null } }); return;
      }
      trace.reads++; const result = resultSnapshot(), wait = trace.holdRead; await wait; await json({ ok: true, result }); return;
    }
    if (request.method() !== "POST" || url.search) { trace.unexpected.push("UNDECLARED_METHOD"); await route.abort(); return; }
    const body = request.postData()!, command = decodeOnboardingCommand(request.postDataJSON()); trace.commands.push({ body, command });
    if (command.command === "onboarding.amend" && trace.amendDenial) { await json({ ok: false, code: trace.amendDenial.code }, trace.amendDenial.status); return; }
    const receipt = receipts.get(command.input.clientId);
    if (receipt) { expect(body).toBe(receipt.body); await json({ ok: true, result: receipt.result }); return; }
    if (command.command !== "onboarding.start") {
      expect(command.input.roundId).toBe(snapshot.round!.id);
      if ("expectedRevision" in command.input && command.input.expectedRevision !== snapshot.round!.revision) { await json({ ok: false, code: "CONFLICT" }, 409); return; }
    }
    switch (command.command) {
      case "onboarding.start":
        snapshot.eligibility.offerPending = false;
        snapshot.round = { id: id(), revision: "1", status: "active", step: "profile", draft: emptyDraft(), editedAt: fixedTime, expiresAt: expiry, receipts: [] }; break;
      case "onboarding.save": snapshot.round!.draft = copy(command.input.draft); snapshot.round!.step = command.input.step; snapshot.round!.status = "active"; bump(); break;
      case "onboarding.pause": snapshot.round!.status = "paused"; bump(); break;
      case "onboarding.confirm": {
        snapshot.round!.receipts = collectIntents(snapshot.round!.draft!); snapshot.round!.draft = null; snapshot.round!.step = "summary";
        snapshot.round!.status = snapshot.round!.receipts.length ? "executing" : "complete"; bump(); break;
      }
      case "onboarding.advance": {
        // The real adapter attempts at most one domain intention per call. A
        // multi-item response here would conceal a broken continuation loop.
        const item = snapshot.round!.receipts.find(item => !["confirmed", "omitted"].includes(item.status));
        if (item) { item.status = "confirmed"; item.entityId = item.kind === "profile" ? snapshot.ownerId : id(); item.reason = null; trace.effects.push(item.intentId); }
        const terminal = snapshot.round!.receipts.every(item => ["confirmed", "omitted"].includes(item.status));
        snapshot.round!.status = terminal ? "complete" : "executing"; snapshot.round!.draft = null;
        snapshot.recovery = snapshot.recovery.filter(entry => entry.intentId !== item?.intentId); bump(); break;
      }
      case "onboarding.amend": {
        const input = command.input, target = snapshot.round!.receipts.find(item => item.intentId === input.intentId)!; expect(target).toBeTruthy(); expect(["confirmed", "omitted"]).not.toContain(target.status);
        if (input.change.kind === "omit") {
          const expected = snapshot.recovery.find(item => item.intentId === target.intentId)!.dependentIntentIds;
          expect([...input.change.dependentIntentIds].sort()).toEqual([...expected].sort());
          for (const item of snapshot.round!.receipts.filter(item => item.intentId === target.intentId || input.change.kind === "omit" && input.change.dependentIntentIds.includes(item.intentId))) { item.status = "omitted"; item.entityId = null; item.reason = null; }
          snapshot.recovery = snapshot.recovery.filter(item => snapshot.round!.receipts.find(receipt => receipt.intentId === item.intentId)!.status !== "omitted");
        } else {
          // Replacement creates a new version/intent identity for the same
          // logical slot. Its editor must remount; other confirmed slots stay.
          const previousId = target.intentId, nextId = id(), recovery = snapshot.recovery.find(item => item.intentId === previousId)!;
          target.intentId = nextId; target.status = "ready"; target.reason = null;
          recovery.intentId = nextId; recovery.status = "ready"; recovery.choice = copy(input.change.value);
          for (const entry of snapshot.recovery) entry.dependentIntentIds = entry.dependentIntentIds.map(value => value === previousId ? nextId : value);
        }
        snapshot.round!.status = "partial"; bump(); break;
      }
    }
    const result = resultSnapshot(); receipts.set(command.input.clientId, { body, result });
    const held = trace.holdCommand; if (held?.command === command.command) await held.wait;
    if (!lost && options.lose === command.command) { lost = true; await route.abort("failed"); return; }
    await json({ ok: true, result });
  });
  return { trace, get snapshot() { return snapshot; }, set snapshot(value: OnboardingSnapshot) { snapshot = copy(value); }, commands(kind: OnboardingCommand["command"]) { return trace.commands.filter(item => item.command.command === kind); } };
}
