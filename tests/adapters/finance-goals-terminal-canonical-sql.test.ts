/** Written disposable SQL-in-WASM proofs. NOT native two-session races,
 * hosted Auth/RLS/HTTP, Storage, browser or restore-preservation acceptance. */
import { createHash, randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { executeGoalCommand } from "../../src/core/financeiro/goals/goal-use-cases";
vi.mock("server-only", () => ({}));
import { captureGoalTerminalAttempt, decodeGoalTerminalReply, goalTerminalRpcRequest, type CapturedGoalTerminalAttempt } from "../../src/adapters/db/finance-goals-terminal-canonical";
import { createFinanceGoalsGateway } from "../../src/adapters/db/finance-goals-gateway";
import { createFinanceGoalsStore } from "../../src/adapters/db/finance-goals-store";
import type { GoalCommit, GoalRpc } from "../../src/adapters/db/finance-goals-protocol";
import { createFinanceGoals026CandidateSql } from "../helpers/finance-026-candidate-sql";
import { compileFinanceGoalsTerminalCandidate, createFinanceGoalsTerminalCandidateSql, readFinanceGoalsTerminalCandidateSource } from "../helpers/finance-goals-terminal-candidate-sql";

const owner = "79f10000-0000-4000-8000-000000000001", session = "79f10000-0000-4000-8000-000000000002", other = "79f10000-0000-4000-8000-000000000003", otherSession = "79f10000-0000-4000-8000-000000000004";
const wrappers = ["finance_goals_snapshot", "finance_goals_page", "finance_goal_detail", "finance_goal_reservations_page", "finance_goal_releases_page", "finance_goals_commit"];
interface FunctionCatalogRow {
  oid: string; nspname: string; proname: string; prosrc: string;
  prosecdef: boolean; proconfig: string[] | null; provolatile: string; acl: string | null;
}
afterEach(() => vi.unstubAllGlobals());
it("refuses a changed terminal source, draft boundary or transaction before opening a database", async () => {
  const source = await readFinanceGoalsTerminalCandidateSource(); expect(compileFinanceGoalsTerminalCandidate(source)).toContain("commit;");
  for (const edited of [source + "\n--extra", source.replace("rollback;", "commit;"), source.replace("DRAFT_ONLY:", "REVIEWED:"), source.replace("Goal attempt is permanently closed.", "allowed")]) expect(() => compileFinanceGoalsTerminalCandidate(edited)).toThrow("reviewed bytes");
});
it("keeps original identities/grants, exact receipt-first replay and permanent namespace fences with atomic metadata", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("No network in terminal SQL fixture."); });
  const compiled = compileFinanceGoalsTerminalCandidate(await readFinanceGoalsTerminalCandidateSource()), db = await createFinanceGoals026CandidateSql();
  try {
    const oldCatalog = async () => (await db.query<FunctionCatalogRow>(`select f.oid::text oid,n.nspname,f.proname,f.prosrc,f.prosecdef,f.proconfig,f.provolatile,f.proacl::text acl
      from pg_proc f join pg_namespace n on n.oid=f.pronamespace where (n.nspname='public' and f.proname=any($1::text[])) or f.oid='app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure order by n.nspname,f.proname`, [wrappers])).rows;
    const beforeCatalog = await oldCatalog(); await db.exec(compiled); const afterCatalog = await oldCatalog();
    expect(afterCatalog.filter(row => row.nspname === "public")).toEqual(beforeCatalog.filter(row => row.nspname === "public"));
    const beforeCommit = beforeCatalog.find(row => row.proname === "fg_commit"), afterCommit = afterCatalog.find(row => row.proname === "fg_commit");
    expect(beforeCommit).toBeDefined(); expect(afterCommit).toBeDefined();
    expect({ ...afterCommit, prosrc: beforeCommit?.prosrc }).toEqual(beforeCommit);
    expect((await db.query<{ prosrc: string }>("select prosrc from pg_proc where oid='app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)'::regprocedure")).rows[0]?.prosrc).toBe(beforeCatalog.find(row => row.proname === "fg_commit")?.prosrc);
    expect((await db.query(`select
      (select relrowsecurity from pg_class where oid='app_private.finance_goal_dispositions'::regclass) rls,
      not exists(select 1 from pg_policies where schemaname='app_private' and tablename='finance_goal_dispositions') no_policies,
      not exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_table_privilege(r.oid,'app_private.finance_goal_dispositions','SELECT,INSERT,UPDATE,DELETE')) table_closed,
      not exists(select 1 from pg_proc f cross join pg_roles r where f.pronamespace='app_private'::regnamespace and (f.proname like 'fgt_%' or f.proname='fg_terminal_previous_commit') and r.rolname in ('anon','authenticated','service_role') and has_function_privilege(r.oid,f.oid,'EXECUTE')) helpers_closed,
      (select count(*)::int from pg_proc f where f.pronamespace='public'::regnamespace and f.proname in ('finance_goal_attempt_status','finance_goal_attempt_settle') and has_function_privilege('service_role',f.oid,'EXECUTE') and not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE')) new_wrappers,
      (select count(*)::int from pg_trigger t where not t.tgisinternal and t.tgenabled='O' and ((t.tgrelid='app_private.finance_goal_dispositions'::regclass and t.tgname='goal_terminal_disposition_guard' and t.tgfoid='app_private.fgt_disposition_guard()'::regprocedure) or (t.tgrelid='app_private.finance_goal_dispositions'::regclass and t.tgname='goal_terminal_event' and t.tgfoid='app_private.fgt_event()'::regprocedure) or (t.tgrelid='app_private.command_receipts'::regclass and t.tgname='goal_terminal_receipt_guard' and t.tgfoid='app_private.fgt_receipt_guard()'::regprocedure))) triggers`)).rows[0]).toEqual({ rls: true, no_policies: true, table_closed: true, helpers_closed: true, new_wrappers: 2, triggers: 3 });
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','terminal-owner@example.invalid'),($2,'authenticated','authenticated','terminal-other@example.invalid')", [owner, other]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [session, owner, otherSession, other]);
    const revision = async () => (await db.query<{ revision: string }>("select app_private.fg_finance_revision($1) revision", [owner])).rows[0]!.revision;
    const create = async (name = "Meta sintética"): Promise<Extract<GoalCommand, { command: "finance.goal.create" }>> => ({ command: "finance.goal.create", input: { client_id: randomUUID(), expected_finance_revision: await revision(), name, target_cents: 10000, deadline: null, image_file_id: null } });
    const material = async () => (await db.query<{ value: unknown }>(`select jsonb_build_object(
      'dispositions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.user_id,d.command,d.client_id),'[]') from app_private.finance_goal_dispositions d),
      'goals',(select coalesce(jsonb_agg(to_jsonb(g) order by g.user_id,g.id),'[]') from app_private.finance_goals g),
      'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_reservations r),
      'releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_releases r),
      'highlights',(select coalesce(jsonb_agg(to_jsonb(h) order by h.user_id,h.id),'[]') from app_private.finance_goal_highlights h),
      'ledger',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id),'[]') from public.fin_transactions t),
      'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.user_id,a.id),'[]') from public.fin_accounts a),
      'finance_revision',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('revision',r.revision::text) order by r.user_id),'[]') from app_private.finance_revisions r),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.user_id,e.id),'[]') from public.domain_events e),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.command,r.client_id),'[]') from app_private.command_receipts r),
      'limits',(select coalesce(jsonb_agg(to_jsonb(l) order by l.scope,l.subject_hash),'[]') from app_private.rate_limits l)
    ) value`)).rows[0]!.value;
    // A successful control decision writes metadata/event and may invalidate
    // finance_revision through the existing event trigger. It must not change
    // any complete financial row, money allocation or account.
    const financialRows = async () => (await db.query<{ value: unknown }>(`select jsonb_build_object(
      'goals',(select coalesce(jsonb_agg(to_jsonb(g) order by g.user_id,g.id),'[]') from app_private.finance_goals g),
      'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_reservations r),
      'releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_releases r),
      'highlights',(select coalesce(jsonb_agg(to_jsonb(h) order by h.user_id,h.id),'[]') from app_private.finance_goal_highlights h),
      'ledger',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id),'[]') from public.fin_transactions t),
      'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.user_id,a.id),'[]') from public.fin_accounts a)
    ) value`)).rows[0]!.value;
    type TerminalRpc = "finance_goal_attempt_status" | "finance_goal_attempt_settle";
    const terminal = async (name: TerminalRpc, request: unknown, actor = owner, actorSession = session) => db.transaction(async tx => { await tx.exec("set local role service_role"); return (await tx.query<{ value: unknown }>(`select public.${name}($1::uuid,$2::uuid,$3::jsonb) value`, [actor, actorSession, JSON.stringify(request)])).rows[0]!.value; });
    const status = (token: CapturedGoalTerminalAttempt) => terminal("finance_goal_attempt_status", goalTerminalRpcRequest(token)).then(value => decodeGoalTerminalReply(token, value));
    const settle = (token: CapturedGoalTerminalAttempt) => terminal("finance_goal_attempt_settle", goalTerminalRpcRequest(token)).then(value => decodeGoalTerminalReply(token, value));
    const refuse = async (operation: () => Promise<unknown>, code?: string, message?: string) => { const before = await material(); if (code) await expect(operation()).rejects.toMatchObject({ code, ...(message === undefined ? {} : { message }) }); else await expect(operation()).rejects.toBeDefined(); expect(await material()).toEqual(before); };

    const missing = captureGoalTerminalAttempt(owner, await create()); const beforeMissing = await material();
    expect((await status(missing)).kind).toBe("uncertain"); expect(await material()).toEqual(beforeMissing);
    // Protocol2 transports only escaped canonical TEXT; this read never parses
    // that text or claims to prove the namespace inside it.
    const unicode = ["N\u0000UL", "high\ud800", "low\udfff", "pair😀", "line\u2028end\u2029", "quote\"\\\n\t", "e\u0301"];
    for (const name of unicode) {
      const token = captureGoalTerminalAttempt(owner, await create(name)), request = goalTerminalRpcRequest(token);
      const raw = (await db.query<{ source: string; namespace: string; digest: string }>("select ($1::jsonb->>'canonical_input') source, ($1::jsonb->>'client_id') namespace, encode(sha256(convert_to($1::jsonb->>'canonical_input','UTF8')),'hex') digest", [JSON.stringify(request)])).rows[0]!;
      expect(raw.source).toBe(request.canonical_input); expect(raw.namespace).toBe(request.client_id); expect(raw.digest).toBe(token.binding.input_digest);
      const beforeRead = await material(); expect((await status(token)).kind).toBe("uncertain"); expect(await material()).toEqual(beforeRead);
      const closed = await settle(token); expect(closed.kind).toBe("closed"); const original = await material(); expect(await status(token)).toEqual(closed); expect(await settle(token)).toEqual(closed); expect(await material()).toEqual(original);
    }
    const token = captureGoalTerminalAttempt(owner, await create()), request = goalTerminalRpcRequest(token);
    const closed = await settle(token); expect(closed.kind).toBe("closed");
    const unchanged = await material(); expect(await status(token)).toEqual(closed); expect(await material()).toEqual(unchanged);
    // Same namespace with alternate representation or different contents never
    // reopens the UUID. No caller-supplied hash is trusted or accepted.
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: " " + request.canonical_input }), "23505");
    await refuse(() => terminal("finance_goal_attempt_status", { ...request, canonical_input: request.canonical_input.replace("Meta sintética", "Outra") }), "23505");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, input_digest: "0".repeat(64) }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, version: 1 }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, version: 3 }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, version: "2" }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonicalization_version: 2 }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, client_id: owner.toUpperCase() }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, client_id: 123 }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: "x".repeat(65537) }), "54000");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: "é".repeat(32769) }), "54000");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: "\u0001".repeat(50000) }), "54000");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, command: "finance.account.close" }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: "" }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { ...request, canonical_input: false }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", { version: 2, canonicalization_version: 1, command: request.command, client_id: request.client_id }), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", []), "22023");
    await refuse(() => terminal("finance_goal_attempt_settle", false), "22023");
    await refuse(() => db.query("insert into app_private.finance_goal_dispositions(user_id,command,client_id,version,canonicalization_version,input_digest) values($1,$2,$3,1,1,decode($4,'hex'))", [owner, request.command, randomUUID(), token.binding.input_digest]), "23514");
    await refuse(() => db.query("insert into app_private.finance_goal_dispositions(user_id,command,client_id,version,canonicalization_version,input_digest) values($1,$2,$3,2,2,decode($4,'hex'))", [owner, request.command, randomUUID(), token.binding.input_digest]), "23514");
    const update = { command: "finance.goal.update", input: { client_id: randomUUID(), expected_finance_revision: "0", goal_id: randomUUID(), expected_revision: "0", patch: { name: "Patch" } } };
    const updateRequest = goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, update));
    // Explicitly test the approved LOSS of inner SQL validation. A privileged
    // caller can bind namespace A to opaque B/non-JSON/duplicate-field text.
    // Only metadata may be written. The honest captured A MUST reject that
    // response, and the old financial executor must still be fenced for A.
    const bodyB = goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, await create("Privileged body B")));
    const opaqueCases = [bodyB.canonical_input, "[1]", "{", request.canonical_input.slice(0, -1) + ',"client_id":"' + request.client_id + '"}', updateRequest.canonical_input.replace('"name":"Patch"', '"name":"Patch","name":"Patch"'), "x".repeat(65536), "é".repeat(32768)];
    const hostileOriginals: Extract<GoalCommand, { command: "finance.goal.create" }>[] = [];
    for (const opaque of opaqueCases) {
      const originalA = await create("Honest original A"), tokenA = captureGoalTerminalAttempt(owner, originalA), envelopeA = { ...goalTerminalRpcRequest(tokenA), canonical_input: opaque }, beforeRows = await financialRows();
      const response = await terminal("finance_goal_attempt_settle", envelopeA);
      expect(response).toMatchObject({ version: 2, kind: "closed", binding: { version: 2, user_id: owner, command: originalA.command, client_id: originalA.input.client_id, canonicalization_version: 1, input_digest: createHash("sha256").update(opaque, "utf8").digest("hex") }, disposition: { version: 2 } });
      expect(() => decodeGoalTerminalReply(tokenA, response)).toThrow(); expect(await financialRows()).toEqual(beforeRows);
      const controlBaseline = await material(); expect(await terminal("finance_goal_attempt_status", envelopeA)).toEqual(response); expect(await terminal("finance_goal_attempt_settle", envelopeA)).toEqual(response); expect(await material()).toEqual(controlBaseline);
      await refuse(() => status(tokenA), "23505"); hostileOriginals.push(originalA);
    }
    // All seven old-intent shapes settle without consulting a current resource,
    // current financial revision, available balance or image metadata.
    const common = () => ({ client_id: randomUUID(), expected_finance_revision: "9223372036854775807" }), existing = () => ({ ...common(), goal_id: randomUUID(), expected_revision: "99" });
    const missingImage = await create(); missingImage.input.image_file_id = randomUUID();
    const oldIntents: GoalCommand[] = [missingImage, { command: "finance.goal.update", input: { ...existing(), patch: { name: "N\u0000UL" } } }, { command: "finance.goal.archive", input: existing() }, { command: "finance.goal.restore", input: existing() }, { command: "finance.goal.highlight", input: { ...common(), goal_id: randomUUID(), expected_highlight_revision: "99" } }, { command: "finance.goal.contribute", input: { ...existing(), account_id: randomUUID(), amount_cents: 100, occurred_on: "2026-10-23" } }, { command: "finance.goal.release", input: { ...common(), reservation_id: randomUUID(), amount_cents: 100, occurred_on: "2026-10-23" } }];
    for (const intent of oldIntents) expect((await settle(captureGoalTerminalAttempt(owner, intent))).kind).toBe("closed");
    // Another owner may use the same client UUID in its own independent
    // namespace; an owner paired with the other session is always refused.
    await refuse(() => terminal("finance_goal_attempt_status", request, other, session), "42501");
    const otherToken = captureGoalTerminalAttempt(other, JSON.parse(JSON.stringify({ command: request.command, input: JSON.parse(request.canonical_input) })));
    expect(decodeGoalTerminalReply(otherToken, await terminal("finance_goal_attempt_status", request, other, otherSession)).kind).toBe("uncertain");
    expect(decodeGoalTerminalReply(otherToken, await terminal("finance_goal_attempt_settle", request, other, otherSession)).kind).toBe("closed");

    // Plan a real Core command once, then settle it before its old executor.
    // Calling even the copied original as fixture owner must roll back its
    // earlier effects when the receipt guard encounters the closed namespace.
    const bodies: GoalCommit[] = []; let planOnly = false;
    const rpc: GoalRpc = async (name, args, writing) => {
      if (name === "finance_goals_snapshot") return (await db.query<{ value: unknown }>("select public.finance_goals_snapshot($1::uuid,$2::uuid,$3::jsonb) value", [owner, session, JSON.stringify(args.p_request)])).rows[0]!.value;
      if (name !== "finance_goals_commit" || !writing) throw new Error("Undeclared terminal fixture RPC.");
      const body = structuredClone(args.p_request) as GoalCommit; bodies.push(body);
      if (planOnly) return { status: "committed", result: body.receipt.result };
      return db.transaction(async tx => { await tx.exec("set local role service_role"); return (await tx.query<{ value: unknown }>("select public.finance_goals_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) value", [owner, session, args.p_operation, JSON.stringify(body)])).rows[0]!.value; });
    };
    const run = (intent: GoalCommand) => executeGoalCommand(createFinanceGoalsStore(createFinanceGoalsGateway(owner, session, intent.command, rpc), intent), { clock: { now: () => new Date().toISOString() }, ids: { next: () => randomUUID() } }, { user_id: owner, canal: "web" }, intent);
    for (const honest of hostileOriginals) {
      const current = { ...honest, input: { ...honest.input, expected_finance_revision: await revision() } };
      planOnly = true; await run(current); planOnly = false; const body = bodies.at(-1)!;
      await refuse(() => db.query("select public.finance_goals_commit($1,$2,$3,$4::jsonb)", [owner, session, current.command, JSON.stringify(body)]), "23505", "Goal attempt is permanently closed.");
    }
    const lateIntent = await create("Chamada antiga"); planOnly = true; await run(lateIntent); planOnly = false; const lateBody = bodies.at(-1)!;
    const lateToken = captureGoalTerminalAttempt(owner, lateIntent); expect((await settle(lateToken)).kind).toBe("closed");
    await refuse(() => db.query("select public.finance_goals_commit($1,$2,$3,$4::jsonb)", [owner, session, lateIntent.command, JSON.stringify(lateBody)]), "23505");
    // The metadata event can bump the existing global revision. Give the copied
    // old executor a fully coherent NEW body at that current revision, keeping
    // the closed namespace: otherwise a stale-CAS return would never exercise
    // the receipt trigger or prove rollback after the domain writes.
    const bypassIntent = { ...lateIntent, input: { ...lateIntent.input, expected_finance_revision: await revision() } };
    planOnly = true; await run(bypassIntent); planOnly = false; const bypassBody = bodies.at(-1)!;
    await refuse(() => db.query("select app_private.fg_terminal_previous_commit($1,$2,$3,$4::jsonb)", [owner, session, bypassIntent.command, JSON.stringify(bypassBody)]), "23505", "Goal attempt is permanently closed.");
    await refuse(() => db.query("select public.finance_goals_commit($1,$2,$3,$4::jsonb)", [owner, session, bypassIntent.command, JSON.stringify(bypassBody)]), "23505");
    const changedBody = structuredClone(lateBody); if (changedBody.request.command !== "finance.goal.create") throw new Error("Expected create"); changedBody.request.input.name = "Different body same UUID";
    await refuse(() => db.query("select public.finance_goals_commit($1,$2,$3,$4::jsonb)", [owner, session, changedBody.request.command, JSON.stringify(changedBody)]), "23505");
    await refuse(() => db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,$2,$3,'{}','{}')", [owner, lateIntent.command, lateIntent.input.client_id]), "23505");

    // Receipt wins first; later metadata/revisions do not change the original.
    const paidIntent = await create("Confirmada antes do encerramento"), originalResult = await run(paidIntent), paidBody = bodies.at(-1)!; if (!("goal" in originalResult)) throw new Error("Expected goal");
    await run({ command: "finance.goal.archive", input: { client_id: randomUUID(), expected_finance_revision: await revision(), goal_id: originalResult.goal.id, expected_revision: originalResult.goal.revision } });
    const paidToken = captureGoalTerminalAttempt(owner, paidIntent), receiptBaseline = await material(), receiptReply = await settle(paidToken);
    expect(receiptReply).toEqual({ version: 2, kind: "confirmed", binding: paidToken.binding, result: originalResult }); expect(await status(paidToken)).toEqual(receiptReply); expect(await material()).toEqual(receiptBaseline);
    expect((await db.query<{ value: unknown }>("select public.finance_goals_commit($1,$2,$3,$4::jsonb) value", [owner, session, paidIntent.command, JSON.stringify(paidBody)])).rows[0]!.value).toEqual({ status: "replayed", result: originalResult }); expect(await material()).toEqual(receiptBaseline);
    // Corruption fixtures are inserted only as disposable owner. The service
    // roles below cannot do this. Never reinterpret corrupt receipts as closed.
    const mismatchedKey = await create("Receipt key A"), storedBodyB = goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, await create("Receipt body B")));
    await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,$2,$3,to_jsonb($4::text),'{}')", [owner, mismatchedKey.command, mismatchedKey.input.client_id, storedBodyB.canonical_input]);
    const mismatchedEnvelope = { ...goalTerminalRpcRequest(captureGoalTerminalAttempt(owner, mismatchedKey)), canonical_input: storedBodyB.canonical_input };
    await refuse(() => terminal("finance_goal_attempt_status", mismatchedEnvelope), "23505", "Stored receipt namespace differs.");
    await refuse(() => terminal("finance_goal_attempt_settle", mismatchedEnvelope), "23505", "Stored receipt namespace differs.");
    const invalidResultIntent = await create("Corrupt result"), invalidResultToken = captureGoalTerminalAttempt(owner, invalidResultIntent);
    await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,$2,$3,to_jsonb($4::text),'{}')", [owner, invalidResultIntent.command, invalidResultIntent.input.client_id, goalTerminalRpcRequest(invalidResultToken).canonical_input]);
    await refuse(() => status(invalidResultToken)); await refuse(() => settle(invalidResultToken));
    const nonStringIntent = await create("Non-string fingerprint"), nonStringToken = captureGoalTerminalAttempt(owner, nonStringIntent);
    await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,$2,$3,'{}','{}')", [owner, nonStringIntent.command, nonStringIntent.input.client_id]);
    await refuse(() => status(nonStringToken), "23505"); await refuse(() => settle(nonStringToken), "23505");
    for (const { name, code } of [{ name: "corrupt\u0000nul", code: "22P05" }, { name: "corrupt\ud800high", code: "22P02" }, { name: "corrupt\udffflow", code: "22P02" }]) {
      const corrupt = await create(name), corruptToken = captureGoalTerminalAttempt(owner, corrupt);
      await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,$2,$3,to_jsonb($4::text),'{}')", [owner, corrupt.command, corrupt.input.client_id, goalTerminalRpcRequest(corruptToken).canonical_input]);
      await refuse(() => status(corruptToken), code); await refuse(() => settle(corruptToken), code);
    }
    await refuse(() => db.query("insert into app_private.finance_goal_dispositions(user_id,command,client_id,canonicalization_version,input_digest) values($1,$2,$3,1,decode($4,'hex'))", [owner, paidIntent.command, paidIntent.input.client_id, paidToken.binding.input_digest]), "23505");
    await refuse(() => db.query("update app_private.finance_goal_dispositions set version=version where user_id=$1", [owner]), "42501");
    await refuse(() => db.query("delete from app_private.finance_goal_dispositions where user_id=$1", [owner]), "42501");
    await refuse(() => db.query("delete from app_private.command_receipts where user_id=$1 and command=$2 and client_id=$3", [owner, paidIntent.command, paidIntent.input.client_id]), "42501");
    // Existing non-Goal receipt operations are intentionally unaffected.
    await db.query("insert into app_private.command_receipts(user_id,command,client_id,request,result) values($1,'fixture.non_goal','ordinary','{}','{}')", [owner]); await db.query("delete from app_private.command_receipts where user_id=$1 and command='fixture.non_goal'", [owner]);

    // Failure after disposition INSERT but before the matching event commits
    // must undo the entire control decision, not only preserve cardinalities.
    await db.exec("create function app_private.qa_terminal_fault() returns trigger language plpgsql set search_path='' as $$begin if new.entity_type='finance_goal_disposition' then raise exception 'Synthetic terminal event fault.' using errcode='23514';end if;return new;end$$; create trigger qa_terminal_fault before insert on public.domain_events for each row execute function app_private.qa_terminal_fault()");
    const faultToken = captureGoalTerminalAttempt(owner, await create("Rollback control")); await refuse(() => settle(faultToken), "23514", "Synthetic terminal event fault."); expect((await status(faultToken)).kind).toBe("uncertain");
    await db.exec("drop trigger qa_terminal_fault on public.domain_events;drop function app_private.qa_terminal_fault()");
    expect((await settle(faultToken)).kind).toBe("closed");
    // Every disposition has exactly one matching metadata event; no copied
    // canonical input/name/amount appears in that event or fence row.
    expect((await db.query(`select not exists(select 1 from app_private.finance_goal_dispositions d where (select count(*) from public.domain_events e where e.user_id=d.user_id and e.entity_type='finance_goal_disposition' and e.entity_id=d.id and e.action='created' and e.canal='web' and e.before is null and e.after=app_private.fgt_disposition(d))<>1) exact,
      (select count(*)::int from information_schema.columns where table_schema='app_private' and table_name='finance_goal_dispositions' and column_name in ('canonical_input','request','result','fingerprint','name','amount_cents')) forbidden_columns,
      not exists(select 1 from public.domain_events e where e.entity_type='finance_goal_disposition' and e.after-array['version','id','user_id','command','client_id','canonicalization_version','input_digest','closed_at']<>'{}'::jsonb) closed_metadata`)).rows[0]).toEqual({ exact: true, forbidden_columns: 0, closed_metadata: true });
    for (const role of ["anon", "authenticated", "service_role"]) await refuse(() => db.transaction(async tx => { await tx.exec(`set local role ${role}`); return tx.query("select app_private.fg_terminal_previous_commit($1,$2,$3,$4::jsonb)", [owner, session, paidIntent.command, JSON.stringify(paidBody)]); }), "42501");
    for (const role of ["anon", "authenticated"]) await refuse(() => db.transaction(async tx => { await tx.exec(`set local role ${role}`); return tx.query("select public.finance_goal_attempt_status($1,$2,$3::jsonb)", [owner, session, JSON.stringify(request)]); }), "42501");
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'financeiro',false) on conflict(user_id,feature_key) do update set allowed=false", [owner]);
    await refuse(() => status(paidToken), "42501"); await refuse(() => settle(paidToken), "42501"); await db.query("delete from public.user_entitlements where user_id=$1 and feature_key='financeiro'", [owner]);
    await db.query("delete from auth.sessions where id=$1", [session]); await refuse(() => status(paidToken), "42501"); await refuse(() => settle(paidToken), "42501");
    // Identity cascade is the sole accepted fence deletion. Test fixture only.
    await db.query("delete from auth.users where id=$1", [other]); expect((await db.query<{ n: number }>("select count(*)::int n from app_private.finance_goal_dispositions where user_id=$1", [other])).rows[0]!.n).toBe(0);
  } finally { await db.close(); }
}, 90_000);

it("limits only new terminal fences with the existing shared Goal-write quota and rolls back an exhausted attempt", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("No network in terminal quota fixture."); });
  const db = await createFinanceGoalsTerminalCandidateSql();
  const quotaOwner = "79f10000-0000-4000-8000-000000000005", quotaSession = "79f10000-0000-4000-8000-000000000006";
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','terminal-quota@example.invalid')", [quotaOwner]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [quotaSession, quotaOwner]);
    const token = (name: string) => captureGoalTerminalAttempt(quotaOwner, { command: "finance.goal.create", input: { client_id: randomUUID(), expected_finance_revision: "0", name, target_cents: 10000, deadline: null, image_file_id: null } });
    const terminal = async (name: "finance_goal_attempt_status" | "finance_goal_attempt_settle", intent: CapturedGoalTerminalAttempt) => db.transaction(async tx => {
      await tx.exec("set local role service_role");
      const result = (await tx.query<{ value: unknown }>(`select public.${name}($1::uuid,$2::uuid,$3::jsonb) value`, [quotaOwner, quotaSession, JSON.stringify(goalTerminalRpcRequest(intent))])).rows[0]!.value;
      return decodeGoalTerminalReply(intent, result);
    });
    const material = async () => (await db.query<{ value: unknown }>(`select jsonb_build_object(
      'dispositions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.user_id,d.command,d.client_id),'[]') from app_private.finance_goal_dispositions d),
      'goals',(select coalesce(jsonb_agg(to_jsonb(g) order by g.user_id,g.id),'[]') from app_private.finance_goals g),
      'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_reservations r),
      'releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_releases r),
      'highlights',(select coalesce(jsonb_agg(to_jsonb(h) order by h.user_id,h.id),'[]') from app_private.finance_goal_highlights h),
      'ledger',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id),'[]') from public.fin_transactions t),
      'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.user_id,a.id),'[]') from public.fin_accounts a),
      'finance_revision',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('revision',r.revision::text) order by r.user_id),'[]') from app_private.finance_revisions r),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.user_id,e.id),'[]') from public.domain_events e),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.command,r.client_id),'[]') from app_private.command_receipts r),
      'limits',(select coalesce(jsonb_agg(to_jsonb(l) order by l.scope,l.subject_hash),'[]') from app_private.rate_limits l)
    ) value`)).rows[0]!.value;
    const counts = async () => (await db.query<{ fences: number; events: number; receipts: number; hits: number }>(`select
      (select count(*)::int from app_private.finance_goal_dispositions where user_id=$1) fences,
      (select count(*)::int from public.domain_events where user_id=$1 and entity_type='finance_goal_disposition') events,
      (select count(*)::int from app_private.command_receipts where user_id=$1) receipts,
      (select cardinality(hits) from app_private.rate_limits where scope='capture_task_write' and subject_hash=encode(sha256(convert_to($1::uuid::text,'UTF8')),'hex') and user_id=$1) hits`, [quotaOwner])).rows[0]!;

    const first = token("Primeiro encerramento"), firstClosed = await terminal("finance_goal_attempt_settle", first);
    expect(firstClosed.kind).toBe("closed"); expect(await counts()).toEqual({ fences: 1, events: 1, receipts: 0, hits: 1 });
    // Fixture-only saturation of the EXISTING bucket. No new scope/limit or
    // call to the protected executor is needed to reach its 30/min boundary.
    expect((await db.query<{ user_id: string }>(`update app_private.rate_limits set hits=array_fill(clock_timestamp(),array[30])
      where scope='capture_task_write' and subject_hash=encode(sha256(convert_to($1::uuid::text,'UTF8')),'hex') and user_id=$1 returning user_id`, [quotaOwner])).rows).toEqual([{ user_id: quotaOwner }]);
    const saturated = await material();
    expect(await terminal("finance_goal_attempt_status", first)).toEqual(firstClosed);
    expect(await terminal("finance_goal_attempt_settle", first)).toEqual(firstClosed);
    expect(await material()).toEqual(saturated);
    const next = token("Novo encerramento limitado");
    expect((await terminal("finance_goal_attempt_status", next)).kind).toBe("uncertain"); expect(await material()).toEqual(saturated);
    await expect(terminal("finance_goal_attempt_settle", next)).rejects.toMatchObject({ code: "PT429", message: "Goal write rate reached." });
    // The limiter's rejected-hit cleanup/updated_at and all metadata/events/
    // financial rows must roll back too, not merely keep their cardinalities.
    expect(await material()).toEqual(saturated); expect(await counts()).toEqual({ fences: 1, events: 1, receipts: 0, hits: 30 });
    expect((await terminal("finance_goal_attempt_status", next)).kind).toBe("uncertain"); expect(await material()).toEqual(saturated);
    // Backdate only this synthetic bucket's hits; production timeouts and the
    // original 30/min policy remain untouched. The same UUID can now close once.
    expect((await db.query<{ user_id: string }>(`update app_private.rate_limits set hits=array_fill(clock_timestamp()-interval '2 minutes',array[30])
      where scope='capture_task_write' and subject_hash=encode(sha256(convert_to($1::uuid::text,'UTF8')),'hex') and user_id=$1 returning user_id`, [quotaOwner])).rows).toEqual([{ user_id: quotaOwner }]);
    const nextClosed = await terminal("finance_goal_attempt_settle", next);
    expect(nextClosed.kind).toBe("closed"); expect(await counts()).toEqual({ fences: 2, events: 2, receipts: 0, hits: 1 });
    const recovered = await material(); expect(await terminal("finance_goal_attempt_status", next)).toEqual(nextClosed); expect(await terminal("finance_goal_attempt_settle", next)).toEqual(nextClosed); expect(await material()).toEqual(recovered);
  } finally { await db.close(); }
}, 90_000);
