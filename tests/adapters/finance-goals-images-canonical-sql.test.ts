/** Real Core→store→SQL-in-WASM; synthetic file metadata only. No Auth HTTP,
 * Storage bytes, signed URL, native race or hosted acceptance is claimed. */
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { GoalCommand, GoalCommandResult, FinancialGoal } from "../../src/core/financeiro/goals/goal-types";
import { executeGoalCommand } from "../../src/core/financeiro/goals/goal-use-cases";
import { ErroDeDominio } from "../../src/core/contracts/base";
vi.mock("server-only", () => ({}));
import { createFinanceGoalsGateway } from "../../src/adapters/db/finance-goals-gateway";
import { createFinanceGoalsStore } from "../../src/adapters/db/finance-goals-store";
import type { GoalRpc } from "../../src/adapters/db/finance-goals-protocol";
import { AuthGuardError } from "../../src/lib/auth/types";
import { compileFinanceGoalsImagesCandidate, createFinanceGoalsImagesCandidateSql, readFinanceGoalsImagesCandidateSource } from "../helpers/finance-goals-images-candidate-sql";
import { createFinanceGoals026CandidateSql } from "../helpers/finance-026-candidate-sql";
afterEach(() => vi.unstubAllGlobals());

interface ImageBaseline {
  goals: unknown; reserves: unknown; releases: unknown; highlights: unknown;
  files: unknown; uploads: unknown; events: unknown; receipts: unknown;
  ledger: unknown; accounts: unknown; revisions: unknown; limits: unknown;
}

it("refuses changed image SQL, removed inert boundary and unknown companions before opening a database", async () => {
  const source = await readFinanceGoalsImagesCandidateSource();
  for (const changed of [source + "\n--extra", source.replace("DRAFT_ONLY:", "ACTIVE:"), source.replace("rollback;", "commit;"), source.replace("fgi_previous_image_referenced", "capture_e4_previous_image_referenced")]) expect(() => compileFinanceGoalsImagesCandidate(changed)).toThrow("reviewed bytes");
  expect(compileFinanceGoalsImagesCandidate(source)).toContain("begin;\n");
});

it("refuses disabled, replaced or incomplete projection triggers before adding image authority", async () => {
  const compiled = compileFinanceGoalsImagesCandidate(await readFinanceGoalsImagesCandidateSource());
  const db = await createFinanceGoals026CandidateSql();
  try {
    const original = (await db.query("select prosrc from pg_proc where oid='app_private.entity_image_referenced(uuid,uuid)'::regprocedure")).rows;
    await db.exec("create function app_private.test_wrong_goal_projection() returns trigger language plpgsql set search_path='' as $$ begin return new;end $$;");
    const cases = [
      "alter table app_private.finance_goals disable trigger goal_project",
      "drop trigger goal_project on app_private.finance_goals;create trigger goal_project before insert or update or delete on app_private.finance_goals for each row execute function app_private.test_wrong_goal_projection()",
      "drop trigger goal_project on app_private.finance_goals;create trigger goal_project before update on app_private.finance_goals for each row execute function app_private.fg_project()",
    ];
    for (const fault of cases) {
      await db.exec(fault);
      await expect(db.exec(compiled)).rejects.toMatchObject({ code: "23514" });
      await db.exec("rollback;");
      expect((await db.query("select count(*)::int count from pg_attribute where attrelid='app_private.finance_goals'::regclass and attname='image_file_id' and not attisdropped")).rows).toEqual([{ count: 0 }]);
      expect((await db.query("select to_regprocedure('app_private.fgi_project()') is null absent")).rows).toEqual([{ absent: true }]);
      expect((await db.query("select prosrc from pg_proc where oid='app_private.entity_image_referenced(uuid,uuid)'::regprocedure")).rows).toEqual(original);
      await db.exec("drop trigger goal_project on app_private.finance_goals;create trigger goal_project before insert or update or delete on app_private.finance_goals for each row execute function app_private.fg_project()");
    }
  } finally { await db.close(); }
}, 120_000);

it("binds finalized private Goal images atomically, preserves all holders, money and receipt-first recovery", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("No HTTP fallback in image SQL test."); });
  const db = await createFinanceGoalsImagesCandidateSql();
  const owner = { id: randomUUID(), session: randomUUID() }, other = { id: randomUUID(), session: randomUUID() };
  try {
    for (const actor of [owner, other]) {
      await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [actor.id, actor.id + "@example.invalid"]);
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [actor.session, actor.id]);
    }
    const now = new Date().toISOString(), old = new Date(Date.now() - 3 * 86_400_000).toISOString(), expires = new Date(Date.now() + 120 * 60_000).toISOString();
    const service = async (sql: string, values: unknown[]) => db.transaction(async tx => { await tx.exec("set local role service_role"); return (await tx.query<{ result: unknown }>(sql, values)).rows[0]?.result; });
    const revision = async () => (await db.query<{ revision: string }>("select app_private.fg_finance_revision($1) revision", [owner.id])).rows[0]!.revision;
    const common = async () => ({ client_id: randomUUID(), expected_finance_revision: await revision() });
    const rpc: GoalRpc = async (name, args) => {
      try {
        if (name === "finance_goals_snapshot") return await service("select public.finance_goals_snapshot($1::uuid,$2::uuid,$3::jsonb) result", [args.p_user, args.p_session, JSON.stringify(args.p_request)]);
        if (name === "finance_goals_commit") return await service("select public.finance_goals_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) result", [args.p_user, args.p_session, args.p_operation, JSON.stringify(args.p_request)]);
        throw new Error("Undeclared image test RPC");
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : null;
        if (code === "42501") throw new AuthGuardError("forbidden");
        if (["23505", "40001", "40P01"].includes(String(code))) throw new ErroDeDominio("CONFLICT", "SQL conflict");
        if (["22023", "23514", "23503", "22P02"].includes(String(code))) throw new ErroDeDominio("VALIDATION", "SQL validation");
        throw error;
      }
    };
    const run = (request: GoalCommand) => executeGoalCommand(createFinanceGoalsStore(createFinanceGoalsGateway(owner.id, owner.session, request.command, rpc), request), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: owner.id, canal: "web" }, request);
    const goalOf = (result: GoalCommandResult): FinancialGoal => { if (!("goal" in result)) throw new Error("Expected goal result"); return result.goal; };
    const create = async (image_file_id: string | null, name = "Meta sintética") => ({ command: "finance.goal.create", input: { ...await common(), name, target_cents: 100000, deadline: null, image_file_id } }) satisfies GoalCommand;
    const file = async (actor: typeof owner, kind: "finance_goal_image" | "project_cover", finalize = true) => {
      const id = randomUUID(), lease = randomUUID(), client = randomUUID();
      await service("select public.file_upload_reserve($1::uuid,$2::uuid,$3::text,'synthetic.png',null,$4::text,$5::uuid,8388608,1073741824,$6::timestamptz) result", [actor.id, actor.session, kind, client, id, expires]);
      if (finalize) {
        await service("select public.file_upload_claim($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text) result", [actor.id, actor.session, id, lease, client]);
        const value = { id, user_id: actor.id, kind, folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), width: 40, height: 20, starred: false, deleted_at: null, deletion_batch_id: null, created_at: old, updated_at: now, modified_at: now };
        await service("select public.file_upload_complete($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::jsonb,1073741824) result", [actor.id, actor.session, id, lease, client, JSON.stringify(value)]);
      }
      return id;
    };
    const first = await file(owner, "finance_goal_image"), second = await file(owner, "finance_goal_image"), foreign = await file(other, "finance_goal_image"), wrong = await file(owner, "project_cover"), reserved = await file(owner, "finance_goal_image", false), purged = await file(owner, "finance_goal_image");
    await db.query("update public.drive_files set purged_at=now() where id=$1", [purged]);
    const baseline = async () => (await db.query<ImageBaseline>(`select
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from app_private.finance_goals t) goals,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from app_private.finance_goal_reservations t) reserves,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from app_private.finance_goal_releases t) releases,
      (select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from app_private.finance_goal_highlights t) highlights,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.drive_files t) files,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from app_private.upload_reservations t) uploads,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.domain_events t) events,
      (select coalesce(jsonb_agg(to_jsonb(t) order by user_id,command,client_id),'[]') from app_private.command_receipts t) receipts,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.fin_transactions t) ledger,
      (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.fin_accounts t) accounts,
      (select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from app_private.finance_revisions t) revisions,
      (select coalesce(jsonb_agg(to_jsonb(t) order by scope,subject_hash),'[]') from app_private.rate_limits t) limits`)).rows[0];
    for (const invalid of [foreign, wrong, reserved, purged, randomUUID()]) {
      const command = await create(invalid), before = await baseline();
      await expect(run(command)).rejects.toThrow(); expect(await baseline()).toEqual(before);
    }
    const initial = await create(first), created = goalOf(await run(initial)); let current = created;
    const catalog = (await db.query(`select
      (select count(*)::int from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_owner_fk' and contype='f' and condeferrable and condeferred and confrelid='public.drive_files'::regclass) owner_fk,
      (select count(*)::int from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_payload_match' and contype='c') payload_match,
      (select count(*)::int from pg_index where indexrelid='app_private.finance_goals_owner_image'::regclass and indrelid='app_private.finance_goals'::regclass and indisvalid) holder_index,
      not exists(select 1 from pg_proc p where p.pronamespace='app_private'::regnamespace and p.proname in ('fg_image','fgi_project','fgi_previous_image_referenced','entity_image_referenced') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))) helpers_closed`)).rows[0];
    expect(catalog).toEqual({ owner_fk: 1, payload_match: 1, holder_index: 1, helpers_closed: true });
    expect((await db.query("select image_file_id from app_private.finance_goals where id=$1", [created.id])).rows[0]).toEqual({ image_file_id: first });
    expect((await db.query("select app_private.fg_image($1,$2) proof", [owner.id, first])).rows[0]).toEqual({ proof: { id: first, user_id: owner.id, purpose: "finance_goal_image", status: "finalized", deleted_at: null } });
    const events = (await db.query<{ count: number }>("select count(*)::int count from public.domain_events where user_id=$1 and entity_type='finance_goal' and entity_id=$2", [owner.id, created.id])).rows[0]!.count;
    expect(events).toBe(1);
    const edit = async (image_file_id: string | null): Promise<GoalCommand> => ({ command: "finance.goal.update", input: { ...await common(), goal_id: current.id, expected_revision: current.revision, patch: { image_file_id } } });
    const stale = await edit(null); current = goalOf(await run(await edit(second)));
    const afterSwap = await baseline(); await expect(run(stale)).rejects.toThrow(); expect(await baseline()).toEqual(afterSwap);
    const money = (value: Awaited<ReturnType<typeof baseline>>) => ({ ledger: value!.ledger, accounts: value!.accounts, reserves: value!.reserves, releases: value!.releases });
    const beforeRemoval = await baseline(); current = goalOf(await run(await edit(null))); expect(money(await baseline())).toEqual(money(beforeRemoval));
    const replayBefore = await baseline(); expect(await run(initial)).toEqual({ version: 1, goal: created }); expect(await baseline()).toEqual(replayBefore);
    const recovered = await service("select public.finance_goals_snapshot($1::uuid,$2::uuid,$3::jsonb) result", [owner.id, owner.session, JSON.stringify(initial)]);
    expect(recovered).toMatchObject({ images: [], goals: [], receipt: { result: { version: 1, goal: created } } });
    await expect(run({ ...initial, input: { ...initial.input, image_file_id: second } })).rejects.toThrow(); expect(await baseline()).toEqual(replayBefore);

    // Existing generic setter remains closed: never bypass financial CAS.
    const generic = { version: 1, purpose: "finance_goal_image", entity_id: current.id, file_id: first, expected_file_id: null, client_id: randomUUID() };
    await expect(service("select public.file_entity_image_set($1::uuid,$2::uuid,$3::jsonb) result", [owner.id, owner.session, JSON.stringify(generic)])).rejects.toMatchObject({ code: "22023" });
    expect(await baseline()).toEqual(replayBefore);
    const kept = goalOf(await run(await create(first, "Foto preservada")));
    const archived = goalOf(await run({ command: "finance.goal.archive", input: { ...await common(), goal_id: kept.id, expected_revision: kept.revision } }));
    expect(archived.image_file_id).toBe(first); expect(archived.archived_at).not.toBeNull();
    expect((await db.query("select app_private.entity_image_referenced($1,$2) held", [owner.id, first])).rows[0]).toEqual({ held: true });

    // The extra holder composes, rather than replaces, Home/Project references.
    const project = { id: randomUUID(), user_id: owner.id, name: "Projeto sintético", description: null, color_key: "work", position: 0, deleted_at: null, cover_file_id: wrong, created_at: now, updated_at: now };
    await db.query("insert into public.projects(payload) values($1::jsonb)", [JSON.stringify(project)]);
    expect((await db.query("select app_private.entity_image_referenced($1,$2) held", [owner.id, wrong])).rows[0]).toEqual({ held: true });
    await db.query("update app_private.upload_reservations set expires_at=now()-interval '2 days',cleaned_at=now()-interval '2 days' where user_id=$1", [owner.id]);
    const cleanup = (await db.query<{ result: { id: string; remove_final: boolean }[] }>("select public.file_cleanup_candidates() result")).rows[0]!.result;
    expect(cleanup.some(row => row.id === first && row.remove_final)).toBe(false);
    expect(cleanup.some(row => row.id === wrong && row.remove_final)).toBe(false);
    expect(cleanup.some(row => row.id === second && row.remove_final)).toBe(true);
    const afterCleanup = await baseline(); await expect(run(await edit(second))).rejects.toThrow(); expect(await baseline()).toEqual(afterCleanup);
    await db.query("select public.file_cleanup_ack($1)", [first]);
    expect((await db.query("select purged_at from public.drive_files where id=$1", [first])).rows[0]).toEqual({ purged_at: null });
    await expect(service("select public.file_read_metadata($1::uuid,$2::uuid,$3::uuid) result", [other.id, other.session, first])).rejects.toMatchObject({ code: "42501" });
    expect(await service("select public.file_read_metadata($1::uuid,$2::uuid,$3::uuid) result", [owner.id, owner.session, first])).toMatchObject({ file: { id: first, user_id: owner.id, kind: "finance_goal_image" } });

    // A late failure after projection must roll back Goal+file-reference+event+
    // receipt+revision+rate-limit together. This is deliberate fault injection,
    // not a claim that all arbitrary failures or native races were exercised.
    await db.exec(`create function app_private.test_fgi_event_refusal() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'synthetic post-effect failure' using errcode='23514';end $$;
      create trigger test_fgi_event_refusal before insert on public.domain_events for each row when (new.entity_type='finance_goal') execute function app_private.test_fgi_event_refusal();`);
    const fault = await create(first, "Falha posterior"), beforeFault = await baseline();
    await expect(run(fault)).rejects.toThrow(); expect(await baseline()).toEqual(beforeFault);
    await db.exec("drop trigger test_fgi_event_refusal on public.domain_events;drop function app_private.test_fgi_event_refusal()");
    // Auth is still evaluated before a valid receipt or finalized image.
    await db.query("insert into public.user_entitlements(user_id,feature_key,allowed) values($1,'financeiro',false) on conflict(user_id,feature_key) do update set allowed=false", [owner.id]);
    const denied = await baseline(); await expect(run(initial)).rejects.toMatchObject({ code: "forbidden" });
    await expect(service("select public.file_read_metadata($1::uuid,$2::uuid,$3::uuid) result", [owner.id, owner.session, first])).rejects.toMatchObject({ code: "42501" });
    expect(await baseline()).toEqual(denied);
    for (const role of ["anon", "authenticated", "service_role"]) {
      await expect(db.transaction(async tx => { await tx.exec("set local role " + role); return tx.query("select app_private.fg_image($1,$2)", [owner.id, first]); })).rejects.toMatchObject({ code: "42501" });
      await expect(db.transaction(async tx => { await tx.exec("set local role " + role); return tx.query("select * from app_private.finance_goals"); })).rejects.toMatchObject({ code: "42501" });
    }
    const order = (await db.query<{ names: string[] }>("select array_agg(tgname order by tgname) names from pg_trigger where tgrelid='app_private.finance_goals'::regclass and not tgisinternal and (tgtype&2)=2")).rows[0]!.names;
    expect(order.indexOf("goal_project")).toBeLessThan(order.indexOf("goal_z_image_binding"));
  } finally { await db.close(); }
}, 120_000);
