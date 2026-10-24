/** Actual Core/store/gateway/SQL-in-WASM; NOT hosted GoTrue/RLS/race evidence. */
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { assinatura, ErroDeDominio } from "../../src/core/contracts/base";
import type { GoalCommand, GoalCommandResult } from "../../src/core/financeiro/goals/goal-types";
import { executeGoalCommand } from "../../src/core/financeiro/goals/goal-use-cases";
vi.mock("server-only", () => ({}));
import { createFinanceGoalsGateway } from "../../src/adapters/db/finance-goals-gateway";
import { createFinanceGoalsStore } from "../../src/adapters/db/finance-goals-store";
import type { GoalCommit, GoalRpc } from "../../src/adapters/db/finance-goals-protocol";
import { AuthGuardError } from "../../src/lib/auth/types";
import { compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources } from "../helpers/finance-goals-candidate-sql";
import { createFinanceGoals026CandidateSql as createFinanceGoalsCandidateSql } from "../helpers/finance-026-candidate-sql";

const owner = "79d20000-0000-4000-8000-000000000001", session = "79d20000-0000-4000-8000-000000000002", other = "79d20000-0000-4000-8000-000000000003", otherSession = "79d20000-0000-4000-8000-000000000004", accountId = "79d20000-0000-4000-8000-000000000005";
afterEach(() => vi.unstubAllGlobals());
it("refuses altered Goals bytes/boundaries/pin before creating a database", async () => { const sources = await readFinanceGoalsCandidateSources(); for (const index of [0, 2, 4]) { const edited = [...sources]; edited[index] = edited[index]!.replace("raise exception", "--raise exception"); expect(() => compileFinanceGoalsCandidate(edited)).toThrow("reviewed bytes"); } expect(() => compileFinanceGoalsCandidate(sources.slice(1))).toThrow("Missing"); });

it("commits seven commands; exact events/receipts, virtual money, isolation, immutable histories and close guard", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("No HTTP fallback in disposable SQL test."); }); const db = await createFinanceGoalsCandidateSql(); const bodies: GoalCommit[] = [];
  try {
    const catalog = (await db.query(`select
      (select count(*)::int from pg_class where relnamespace='app_private'::regnamespace and relname in ('finance_goals','finance_goal_reservations','finance_goal_releases','finance_goal_highlights') and relrowsecurity) rls,
      not exists(select 1 from pg_class c where c.relnamespace='app_private'::regnamespace and c.relname in ('finance_goals','finance_goal_reservations','finance_goal_releases','finance_goal_highlights') and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) tables_closed,
      not exists(select 1 from pg_proc f where f.pronamespace='app_private'::regnamespace and f.proname like 'fg_%' and (has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') or has_function_privilege('service_role',f.oid,'EXECUTE'))) helpers_closed,
      (select count(*)::int from pg_proc f where f.pronamespace='public'::regnamespace and f.proname in ('finance_goals_snapshot','finance_goals_page','finance_goal_detail','finance_goal_reservations_page','finance_goal_releases_page','finance_goals_commit') and has_function_privilege('service_role',f.oid,'EXECUTE') and not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE')) wrappers`)).rows[0];
    expect(catalog).toEqual({ rls: 4, tables_closed: true, helpers_closed: true, wrappers: 6 });
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','goals-owner@example.invalid'),($2,'authenticated','authenticated','goals-foreign@example.invalid')", [owner, other]); await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [session, owner, otherSession, other]);
    const at = new Date().toISOString(), today = (await db.query<{ civil_day: string }>("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') AS civil_day")).rows[0]!.civil_day;
    const account = { id: accountId, user_id: owner, name: "Conta sintética", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 100000, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, created_at: at, updated_at: at };
    await db.query("insert into public.fin_accounts(payload) values($1::jsonb)", [JSON.stringify(account)]);
    const revision = async () => (await db.query<{ revision: string }>("select app_private.fg_finance_revision($1) revision", [owner])).rows[0]!.revision;
    // Keep the original cardinalities and payloads, and also compare complete
    // persisted fixture rows: a same-size mutation must not escape a refusal.
    // Stored timestamps are data; no volatile clock/statistics enter this read.
    const counts = async () => (await db.query<{ ledger: number; [key: string]: unknown }>(`select
      (select count(*)::int from app_private.finance_goals) goals,
      (select count(*)::int from app_private.finance_goal_reservations) allocations,
      (select count(*)::int from app_private.finance_goal_releases) releases,
      (select count(*)::int from public.fin_transactions) ledger,
      (select count(*)::int from public.domain_events where entity_type like 'finance_goal%') events,
      (select count(*)::int from app_private.command_receipts where command like 'finance.goal.%') receipts,
      (select payload from public.fin_accounts where id=$1) account,
      (select coalesce(jsonb_agg(payload order by id),'[]') from app_private.finance_goals) goal_values,
      (select coalesce(jsonb_agg(payload order by id),'[]') from app_private.finance_goal_reservations) allocation_values,
      (select coalesce(jsonb_agg(payload order by id),'[]') from app_private.finance_goal_highlights) highlight_values,
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.id),'[]') from app_private.finance_goal_releases r where r.user_id in ($2::uuid,$3::uuid)) release_rows,
      (select coalesce(jsonb_agg(to_jsonb(e) order by e.user_id,e.id),'[]') from public.domain_events e where e.user_id in ($2::uuid,$3::uuid)) event_rows,
      (select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.command,r.client_id),'[]') from app_private.command_receipts r where r.user_id in ($2::uuid,$3::uuid)) receipt_rows,
      (select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id),'[]') from public.fin_transactions t where t.user_id in ($2::uuid,$3::uuid)) ledger_rows,
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.user_id,a.id),'[]') from public.fin_accounts a where a.user_id in ($2::uuid,$3::uuid)) account_rows,
      (select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('revision',r.revision::text) order by r.user_id),'[]') from app_private.finance_revisions r where r.user_id in ($2::uuid,$3::uuid)) finance_revision_rows,
      (select coalesce(jsonb_agg(to_jsonb(l) order by l.scope,l.subject_hash),'[]') from app_private.rate_limits l where l.user_id in ($2::uuid,$3::uuid)) rate_limit_rows`, [accountId, owner, other])).rows[0];
    const call = async (name: string, args: Record<string, unknown>) => db.transaction(async tx => { await tx.exec("set local role service_role"); let query: string, values: unknown[];
      if (name === "finance_goals_snapshot") { query = "select public.finance_goals_snapshot($1::uuid,$2::uuid,$3::jsonb) value"; values = [args.p_user, args.p_session, JSON.stringify(args.p_request)]; }
      else if (name === "finance_goals_commit") { query = "select public.finance_goals_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) value"; values = [args.p_user, args.p_session, args.p_operation, JSON.stringify(args.p_request)]; }
      else if (name === "finance_goals_page") { query = "select public.finance_goals_page($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::text) value"; values = [args.p_user, args.p_session, args.p_cursor, args.p_limit, args.p_archived]; }
      else if (name === "finance_goal_detail") { query = "select public.finance_goal_detail($1::uuid,$2::uuid,$3::uuid) value"; values = [args.p_user, args.p_session, args.p_goal]; }
      else if (name === "finance_goal_reservations_page") { query = "select public.finance_goal_reservations_page($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::integer) value"; values = [args.p_user, args.p_session, args.p_goal, JSON.stringify(args.p_cursor), args.p_limit]; }
      else if (name === "finance_goal_releases_page") { query = "select public.finance_goal_releases_page($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::integer) value"; values = [args.p_user, args.p_session, args.p_reservation, JSON.stringify(args.p_cursor), args.p_limit]; }
      else throw new Error("Undeclared Goals RPC"); return (await tx.query<{ value: unknown }>(query, values)).rows[0]!.value;
    });
    let planOnly = false;
    const rpc: GoalRpc = async (name, args, writing) => { expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session); expect(writing).toBe(name === "finance_goals_commit"); if (writing) { bodies.push(structuredClone(args.p_request) as GoalCommit); if (planOnly) return { status: "committed", result: (args.p_request as GoalCommit).receipt.result }; }
      try { return await call(name, args); } catch (error) { const code = error && typeof error === "object" && "code" in error ? error.code : null; if (code === "42501") throw new AuthGuardError("forbidden"); if (["23505", "40001", "40P01"].includes(String(code))) throw new ErroDeDominio("CONFLICT", "SQL conflict"); if (["22023", "23514", "23503", "22P02"].includes(String(code))) throw new ErroDeDominio("VALIDATION", "SQL validation"); throw error; } };
    const run = (request: GoalCommand) => executeGoalCommand(createFinanceGoalsStore(createFinanceGoalsGateway(owner, session, request.command, rpc), request), { clock: { now: () => new Date().toISOString() }, ids: { next: () => randomUUID() } }, { user_id: owner, canal: "web" }, request);
    const common = async () => ({ client_id: randomUUID(), expected_finance_revision: await revision() });
    const created = await run({ command: "finance.goal.create", input: { ...await common(), name: "Conquista", target_cents: 100000, deadline: null, image_file_id: null } }); if (!("goal" in created)) throw new Error("Expected goal"); let goal = created.goal;
    const existing = async () => ({ ...await common(), goal_id: goal.id, expected_revision: goal.revision });
    const updated = await run({ command: "finance.goal.update", input: { ...await existing(), patch: { name: "Conquista revisada" } } }); if (!("goal" in updated)) throw new Error("Expected goal"); goal = updated.goal;
    await run({ command: "finance.goal.highlight", input: { ...await common(), goal_id: goal.id, expected_highlight_revision: "0" } });
    const donorResult = await run({ command: "finance.goal.create", input: { ...await common(), name: "Doadora preservada", target_cents: 90000, deadline: null, image_file_id: null } }); if (!("goal" in donorResult)) throw new Error("Expected donor");
    planOnly = true; await run({ command: "finance.goal.update", input: { ...await existing(), patch: { name: "Alvo revisado" } } }); planOnly = false;
    const donorBody = structuredClone(bodies.at(-1)!), donorBefore = structuredClone(donorResult.goal), donorAfter = { ...donorBefore, name: "Alvo revisado", revision: "1", updated_at: donorBody.events[0]!.occurred_at };
    donorBody.changes[0] = { type: "finance_goal", before: donorBefore, after: donorAfter }; Object.assign(donorBody.events[0]!, { entity_id: donorAfter.id, before: donorBefore, after: donorAfter });
    const donorBaseline = await counts(); await expect(call("finance_goals_commit", { p_user: owner, p_session: session, p_operation: donorBody.request.command, p_request: donorBody })).rejects.toMatchObject({ code: "23514" }); expect(await counts()).toEqual(donorBaseline);
    // Prepare a legitimate Core body WITHOUT executing it; all eight coherent
    // tamper variants must leave the same DB baseline. This is not a hosted API.
    const contribute: GoalCommand = { command: "finance.goal.contribute", input: { ...await existing(), account_id: accountId, amount_cents: 20000, occurred_on: today } }; planOnly = true; await run(contribute); planOnly = false; const planned = structuredClone(bodies.at(-1)!);
    const beforeAttacks = await counts();
    const attack = async (edit: (body: GoalCommit) => void) => { const body = structuredClone(planned); edit(body); await expect(call("finance_goals_commit", { p_user: owner, p_session: session, p_operation: body.request.command, p_request: body })).rejects.toBeDefined(); expect(await counts()).toEqual(beforeAttacks); };
    await attack(body => { body.changes = []; body.events = []; });
    await attack(body => { body.events = []; });
    await attack(body => { body.events[0]!.user_id = other; });
    await attack(body => { body.changes[0]!.after = { ...body.changes[0]!.after, user_id: other }; body.events[0]!.after = { ...body.events[0]!.after, user_id: other }; });
    await attack(body => { body.changes[0]!.type = "finance_goal_release"; body.events[0]!.entity_type = "finance_goal_release"; });
    await attack(body => { body.events[0]!.action = "updated"; });
    await attack(body => { body.events.push(structuredClone(body.events[0]!)); });
    await attack(body => { if (body.request.command !== "finance.goal.contribute") throw new Error("Expected contribution"); body.request.input.amount_cents = 200000; body.receipt.fingerprint = assinatura(body.request.input); const result = body.receipt.result as GoalCommandResult; if (!("reservation" in result)) throw new Error("Expected reservation"); Object.assign(result.reservation, { amount_cents: 200000 }); Object.assign(body.changes[0]!.after, { amount_cents: 200000 }); Object.assign(body.events[0]!.after, { amount_cents: 200000 }); });
    const contribution = await run(contribute); if (!("reservation" in contribution)) throw new Error("Expected reservation"); const original = contribution.reservation;
    const current = (await db.query<{ value: { real_balance_cents: number; reserved_cents: number } }>("select app_private.fg_account_totals($1,$2) value", [owner, accountId])).rows[0]!.value; expect(current).toMatchObject({ real_balance_cents: 100000, reserved_cents: 20000 }); expect((await counts())?.ledger).toBe(0);
    const immutableBaseline = await counts();
    await expect(db.query("update app_private.finance_goal_reservations set payload=payload where user_id=$1", [owner])).rejects.toMatchObject({ code: "42501" }); expect(await counts()).toEqual(immutableBaseline);
    await expect(db.query("delete from app_private.finance_goal_reservations where user_id=$1", [owner])).rejects.toMatchObject({ code: "42501" }); expect(await counts()).toEqual(immutableBaseline);
    await expect(db.query("update public.fin_accounts set payload=payload||jsonb_build_object('archived_at',$2::text,'updated_at',$2::text) where id=$1", [accountId, new Date().toISOString()])).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(immutableBaseline);
    const archive = await run({ command: "finance.goal.archive", input: await existing() }); if (!("goal" in archive)) throw new Error("Expected goal"); goal = archive.goal; expect("highlight" in archive && archive.highlight?.goal_id).toBeNull();
    const beforeReplay = await counts(); expect(await run(contribute)).toEqual(contribution); expect(await counts()).toEqual(beforeReplay);
    await run({ command: "finance.goal.release", input: { ...await common(), reservation_id: original.id, amount_cents: 5000, occurred_on: today } });
    const restored = await run({ command: "finance.goal.restore", input: await existing() }); if (!("goal" in restored)) throw new Error("Expected goal"); goal = restored.goal;
    const queryGateway = createFinanceGoalsGateway(owner, session, "read.finance.goals", rpc), beforePages = await counts();
    const detail = await queryGateway.detail(goal.id); expect(detail?.goal.id).toBe(goal.id); expect(detail?.totals.saved_cents).toBe(15000);
    const orderedIds = [goal.id, donorResult.goal.id].sort();
    const firstPage = await queryGateway.page({ cursor: null, limit: 1, archived: "active" });
    expect(firstPage.items.map(item => item.goal.id)).toEqual([orderedIds[0]]); expect(firstPage.next_cursor).toBe(orderedIds[0]);
    const secondPage = await queryGateway.page({ cursor: firstPage.next_cursor, limit: 1, archived: "active" });
    expect(secondPage.items.map(item => item.goal.id)).toEqual([orderedIds[1]]); expect(secondPage.next_cursor).toBeNull();
    const pagedItems = [...firstPage.items, ...secondPage.items]; expect(pagedItems.map(item => item.goal.id)).toEqual(orderedIds); expect(new Set(pagedItems.map(item => item.goal.id)).size).toBe(2);
    expect(pagedItems.find(item => item.goal.id === goal.id)?.totals.saved_cents).toBe(15000);
    expect((await queryGateway.reservations({ id: goal.id, cursor: null, limit: 1 })).items[0]!.totals.released_cents).toBe(5000); expect((await queryGateway.releases({ id: original.id, cursor: null, limit: 1 })).items).toHaveLength(1);
    const foreignDetail = await call("finance_goal_detail", { p_user: other, p_session: otherSession, p_goal: goal.id }); expect(foreignDetail).toBeNull();
    expect(await counts()).toEqual(beforePages);
    await run({ command: "finance.goal.release", input: { ...await common(), reservation_id: original.id, amount_cents: 15000, occurred_on: today } }); await db.query("update public.fin_accounts set payload=payload||jsonb_build_object('archived_at',$2::text,'updated_at',$2::text) where id=$1", [accountId, new Date().toISOString()]);
    expect((await db.query<{ payload: unknown }>("select payload from app_private.finance_goal_reservations where id=$1", [original.id])).rows[0]!.payload).toEqual(original);
    const beforeImage = await counts(), newImage = { command: "finance.goal.update" as const, input: { ...await existing(), patch: { image_file_id: randomUUID() } } }; await expect(run(newImage)).rejects.toBeDefined(); expect(await counts()).toEqual(beforeImage);
    const receiptBody = bodies.find(body => body.request.command === "finance.goal.create")!; await db.query("delete from auth.sessions where id=$1", [session]); const deniedReplayBaseline = await counts();
    await expect(call("finance_goals_commit", { p_user: owner, p_session: session, p_operation: receiptBody.request.command, p_request: receiptBody })).rejects.toMatchObject({ code: "42501" }); expect(await counts()).toEqual(deniedReplayBaseline);
  } finally { await db.close(); }
}, 60_000);
