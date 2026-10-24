/** Candidate co-installation only: one disposable engine per order. This is not
 * a native concurrency, Storage-byte, RLS-HTTP or restore qualification. */
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { createFinanceGoals026CandidateSql } from "../helpers/finance-026-candidate-sql";
import { compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource } from "../helpers/finance-goals-images-candidate-sql";
import { compileFinanceGoalsTerminalCandidate, readFinanceGoalsTerminalCandidateSource } from "../helpers/finance-goals-terminal-candidate-sql";
vi.mock("server-only", () => ({}));
import { captureGoalTerminalAttempt, decodeGoalTerminalReply, goalTerminalRpcRequest } from "../../src/adapters/db/finance-goals-terminal-canonical";
afterEach(() => vi.unstubAllGlobals());

for (const order of ["images-first", "terminal-first"] as const) {
  it(`co-installs terminal V2 and private images (${order}) without changing the financial executor identity`, async () => {
    vi.stubGlobal("fetch", () => { throw new Error("No network in candidate composition."); });
    // Both byte/source compilers must pass before constructing a database.
    const imageSql = compileFinanceGoalsImagesCandidate(await readFinanceGoalsImagesCandidateSource());
    const terminalSql = compileFinanceGoalsTerminalCandidate(await readFinanceGoalsTerminalCandidateSource());
    const db = await createFinanceGoals026CandidateSql();
    try {
      const original = (await db.query<{ oid: number }>("select 'app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure::oid::int oid")).rows[0]!.oid;
      for (const sql of order === "images-first" ? [imageSql, terminalSql] : [terminalSql, imageSql]) await db.exec(sql);
      const catalog = (await db.query<{ oid: number; image_owner_fk: number; image_trigger: number; private_helpers_closed: boolean }>(`select
        'app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure::oid::int oid,
        (select count(*)::int from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_owner_fk' and contype='f' and condeferrable and condeferred and confrelid='public.drive_files'::regclass) image_owner_fk,
        (select count(*)::int from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_z_image_binding' and tgenabled='O' and tgtype=23 and not tgisinternal and tgfoid='app_private.fgi_project()'::regprocedure) image_trigger,
        not exists(select 1 from pg_proc p where p.pronamespace='app_private'::regnamespace and p.proname in ('fgi_project','fg_image','fgt_request','fgt_status_locked','fg_terminal_previous_commit') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) private_helpers_closed`)).rows[0];
      expect(catalog).toEqual({ oid: original, image_owner_fk: 1, image_trigger: 1, private_helpers_closed: true });
      const owner = randomUUID(), session = randomUUID();
      await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [owner, owner + "@example.invalid"]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, owner]);
      const revision = (await db.query<{ revision: string }>("select app_private.fg_finance_revision($1) revision", [owner])).rows[0]!.revision;
      const intent: GoalCommand = { command: "finance.goal.create", input: { client_id: randomUUID(), expected_finance_revision: revision, name: "Meta de composição", target_cents: 10000, deadline: null, image_file_id: null } };
      const token = captureGoalTerminalAttempt(owner, intent);
      const call = async (rpc: "finance_goal_attempt_status" | "finance_goal_attempt_settle") => db.transaction(async tx => {
        await tx.exec("set local role service_role");
        return (await tx.query<{ result: unknown }>(`select public.${rpc}($1::uuid,$2::uuid,$3::jsonb) result`, [owner, session, JSON.stringify(goalTerminalRpcRequest(token))])).rows[0]!.result;
      });
      expect(decodeGoalTerminalReply(token, await call("finance_goal_attempt_status")).kind).toBe("uncertain");
      const closed = decodeGoalTerminalReply(token, await call("finance_goal_attempt_settle"));
      expect(closed.kind).toBe("closed");
      // The existing domain-event trigger may advance the global revision.
      // Repeated status/settle must then be inert; no financial row is written.
      const closedRevision = (await db.query<{ revision: string }>("select app_private.fg_finance_revision($1) revision", [owner])).rows[0]!.revision;
      expect(decodeGoalTerminalReply(token, await call("finance_goal_attempt_status"))).toEqual(closed);
      expect(decodeGoalTerminalReply(token, await call("finance_goal_attempt_settle"))).toEqual(closed);
      const effects = (await db.query<{ goals: number; reservations: number; releases: number; receipts: number; ledger: number; dispositions: number; terminal_events: number; revision: string }>(`select
        (select count(*)::int from app_private.finance_goals) goals,
        (select count(*)::int from app_private.finance_goal_reservations) reservations,
        (select count(*)::int from app_private.finance_goal_releases) releases,
        (select count(*)::int from app_private.command_receipts) receipts,
        (select count(*)::int from public.fin_transactions) ledger,
        (select count(*)::int from app_private.finance_goal_dispositions) dispositions,
        (select count(*)::int from public.domain_events where entity_type='finance_goal_disposition') terminal_events,
        app_private.fg_finance_revision($1) revision`, [owner])).rows[0];
      expect(effects).toEqual({ goals: 0, reservations: 0, releases: 0, receipts: 0, ledger: 0, dispositions: 1, terminal_events: 1, revision: closedRevision });
    } finally { await db.close(); }
  }, 120_000);
}
