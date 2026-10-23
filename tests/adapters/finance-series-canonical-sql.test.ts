/** Serial actual Core -> actual store/gateway -> actual SQL-in-WASM. It proves
 * neither GoTrue/hosted grants nor native multi-session PostgreSQL concurrency. */
import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { executeFinanceSeriesCommand } from "../../src/core/financeiro/series/series-use-cases";
import { seriesOccurrenceDay } from "../../src/core/financeiro/series/series-calendar";
import type { FinanceSeriesCommand } from "../../src/core/financeiro/series/series-types";
import type { FinanceSeriesCommit, FinanceSeriesRpc } from "../../src/adapters/db/finance-series-protocol";
vi.mock("server-only", () => ({}));
import { createFinanceSeriesGateway } from "../../src/adapters/db/finance-series-gateway";
import { createFinanceSeriesStore } from "../../src/adapters/db/finance-series-store";
import { AuthGuardError } from "../../src/lib/auth/types";
import { compileFinanceSeriesCandidate, createFinanceSeriesCandidateSql, readFinanceSeriesCandidateSources } from "../helpers/finance-series-candidate-sql";

const owner = "78b20000-0000-4000-8000-000000000001", session = "78b20000-0000-4000-8000-000000000002";
const other = "78b20000-0000-4000-8000-000000000003", otherSession = "78b20000-0000-4000-8000-000000000004";
const accountId = "78b20000-0000-4000-8000-000000000005";
afterEach(() => { vi.unstubAllGlobals(); });

it("refuses an edited companion/draft/source pin before creating any database", async () => {
  const sources = await readFinanceSeriesCandidateSources();
  for (const index of [0, 3, 4]) {
    const edited = [...sources]; edited[index] = edited[index]!.replace("raise exception", "-- raise exception");
    expect(() => compileFinanceSeriesCandidate(edited)).toThrow("reviewed bytes");
  }
  const pin = [...sources]; pin[4] = pin[4]!.replace("855cff15825d78f988a87f0d017e802d33b1a4808060cd9c546091a9d0e539bb", "0".repeat(64));
  expect(() => compileFinanceSeriesCandidate(pin)).toThrow("reviewed bytes");
  expect(() => compileFinanceSeriesCandidate(sources.slice(1))).toThrow("Missing");
});

it("commits all8 real commands with exact events/receipts, blocks legacy writes, and preserves original replay", async () => {
  vi.stubGlobal("fetch", () => { throw new Error("Only declared disposable SQL; no HTTP fallback."); });
  const db = await createFinanceSeriesCandidateSql();
  const commits: FinanceSeriesCommit[] = [];
  try {
    const grants = await db.query<{ closed: boolean; rls: number; wrappers: number }>(`select
      not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' and p.proname not in ('fsv2_snapshot','fsv2_detail','fsv2_page','fsv2_commit') and (has_function_privilege('service_role',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
      and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname in ('finance_series','finance_series_occurrences','finance_series_permits') and (has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) as closed,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname in ('finance_series','finance_series_occurrences','finance_series_permits') and c.relrowsecurity) rls,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('finance_series_snapshot','finance_series_detail','finance_series_page','finance_series_commit') and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')) wrappers`);
    expect(grants.rows).toEqual([{ closed: true, rls: 3, wrappers: 4 }]);
    await expect(db.query("select app_private.fsv2_text(to_jsonb(repeat(chr(128578),101)),200)")).rejects.toMatchObject({ code: "22023" });
    await expect(db.query("select app_private.fsv2_text(to_jsonb(chr(160)||chr(65279)),200)")).rejects.toMatchObject({ code: "22023" });
    expect((await db.query("select app_private.fsv2_text_length(repeat(chr(128578),100)) n,to_char(app_private.fsv2_months('2028-01-31',1),'YYYY-MM-DD') feb,to_char(app_private.fsv2_months('2028-01-31',2),'YYYY-MM-DD') march,app_private.fsv2_statement('2028-02-29',31) statement")).rows).toEqual([{ n: 200, feb: "2028-02-29", march: "2028-03-31", statement: "2028-03-01" }]);
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','series-owner@example.invalid'),($2,'authenticated','authenticated','series-foreign@example.invalid')", [owner, other]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [session, owner, otherSession, other]);
    const at = new Date().toISOString();
    const account = { id: accountId, user_id: owner, name: "Conta de teste SQL", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 0, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, created_at: at, updated_at: at };
    await db.query("insert into public.fin_accounts(payload) values($1::jsonb)", [JSON.stringify(account)]);
    const today = (await db.query<{ day: string }>("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0]!.day;
    const revision = async () => (await db.query<{ value: string }>("select app_private.fsv2_finance_revision($1) as value", [owner])).rows[0]!.value;
    const counts = async () => (await db.query("select (select count(*)::int from app_private.finance_series) series,(select count(*)::int from app_private.finance_series_occurrences) maps,(select count(*)::int from public.fin_transactions) ledger,(select count(*)::int from public.domain_events where entity_type like 'finance_%') events,(select count(*)::int from app_private.command_receipts where command like 'finance.recurring.%') receipts,(select count(*)::int from app_private.finance_series_permits) permits")).rows[0];
    const sqlCall = async (name: string, args: { p_user: string; p_session: string; p_request?: unknown; p_operation?: string; p_cursor?: string | null; p_limit?: number; p_series_id?: string }) => db.transaction(async tx => {
      await tx.exec("set local role service_role");
      let result;
      if (name === "finance_series_snapshot") result = await tx.query<{ value: unknown }>("select public.finance_series_snapshot($1::uuid,$2::uuid,$3::jsonb) value", [args.p_user, args.p_session, JSON.stringify(args.p_request)]);
      else if (name === "finance_series_commit") result = await tx.query<{ value: unknown }>("select public.finance_series_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) value", [args.p_user, args.p_session, args.p_operation, JSON.stringify(args.p_request)]);
      else if (name === "finance_series_detail") result = await tx.query<{ value: unknown }>("select public.finance_series_detail($1::uuid,$2::uuid,$3::uuid) value", [args.p_user, args.p_session, args.p_series_id]);
      else if (name === "finance_series_page") result = await tx.query<{ value: unknown }>("select public.finance_series_page($1::uuid,$2::uuid,$3::uuid,$4::int) value", [args.p_user, args.p_session, args.p_cursor, args.p_limit]);
      else throw new Error("Undeclared SQL RPC");
      return result.rows[0]!.value;
    });
    const rpc: FinanceSeriesRpc = async (name, args, writing) => {
      expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session); expect(writing).toBe(name === "finance_series_commit");
      if (writing) commits.push(structuredClone(args.p_request) as FinanceSeriesCommit);
      try { return await sqlCall(name, args); }
      catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : null;
        if (code === "42501") throw new AuthGuardError("forbidden");
        if (["23505", "40001", "40P01"].includes(String(code))) throw new ErroDeDominio("CONFLICT", "SQL rejected stale/conflicting intent.");
        if (["22023", "23514", "23503", "22P02"].includes(String(code))) throw new ErroDeDominio("VALIDATION", "SQL rejected invalid effects.");
        throw error;
      }
    };
    const run = (command: FinanceSeriesCommand) => executeFinanceSeriesCommand(createFinanceSeriesStore(createFinanceSeriesGateway(owner, session, command.command, rpc), command), { clock: { now: () => new Date().toISOString() }, ids: { next: randomUUID } }, { user_id: owner, canal: "web" }, command);
    const command: Extract<FinanceSeriesCommand, { command: "finance.recurring.create" }> = { command: "finance.recurring.create", input: { client_id: randomUUID(), expected_finance_revision: await revision(), definition: { kind: "recorrencia", frequency: "monthly", anchor_on: today, first_index: 1, total: 4, ends_on: null, template: { account_id: accountId, category_id: null, kind: "expense", amount_cents: 10000, description: "  Previsão real  ", payee: null, notes: null, tag_ids: [], statement_mode: "none" } }, horizon: { from_on: today, until_exclusive: seriesOccurrenceDay(today, "monthly", 2) }, statement_assignments: [] } };
    let result = await run(command);
    expect(result.affected.created).toBe(2); expect(await counts()).toEqual({ series: 1, maps: 2, ledger: 2, events: 5, receipts: 1, permits: 0 });
    expect(result.series.template.description).toBe("Previsão real");
    const originalCreate = structuredClone(result), originalBody = structuredClone(commits[0]!);
    const base = async () => ({ client_id: randomUUID(), expected_finance_revision: await revision(), series_id: result.series.id, expected_revision: result.series.revision });
    result = await run({ command: "finance.recurring.materialize", input: { ...await base(), horizon: { from_on: seriesOccurrenceDay(today, "monthly", 2), until_exclusive: seriesOccurrenceDay(today, "monthly", 4) }, statement_assignments: [] } });
    expect(result.affected.created).toBe(2);
    result = await run({ command: "finance.recurring.update_future", input: { ...await base(), from_on: today, patch: { template: { ...result.series.template, description: "Alteração futura" } }, statement_assignments: [] } });
    expect(result.affected.updated).toBe(4);
    const maps = (await db.query<{ payload: { id: string; index: number; transaction_id: string } }>("select payload from app_private.finance_series_occurrences where user_id=$1 order by ordinal", [owner])).rows.map(row => row.payload);
    result = await run({ command: "finance.recurring.occurrence.cancel", input: { ...await base(), occurrence_id: maps[3]!.id } });
    expect(result.affected.suppressed).toBe(1);
    result = await run({ command: "finance.recurring.occurrence.update", input: { ...await base(), occurrence_id: maps[0]!.id, patch: { status: "confirmed", paid_cents: 75 } } });
    expect(result.affected.updated).toBe(1);
    result = await run({ command: "finance.recurring.pause", input: { ...await base(), from_on: today } });
    expect(result.affected).toMatchObject({ suppressed: 2, skipped: 2 });
    result = await run({ command: "finance.recurring.resume", input: { ...await base(), horizon: { from_on: today, until_exclusive: seriesOccurrenceDay(today, "monthly", 4) }, statement_assignments: [] } });
    expect(result.affected).toMatchObject({ restored: 2, created: 0, skipped: 2 });
    result = await run({ command: "finance.recurring.end", input: { ...await base(), from_on: today } });
    expect(result.series.state).toBe("ended"); expect(result.affected).toMatchObject({ suppressed: 2, skipped: 2 });
    expect(new Set(commits.map(value => value.request.command)).size).toBe(8);
    const state = await counts(); expect(state).toEqual({ series: 1, maps: 4, ledger: 4, events: 39, receipts: 8, permits: 0 });
    const page = await sqlCall("finance_series_page", { p_user: owner, p_session: session, p_cursor: null, p_limit: 1 }) as { version: number; finance_revision: string; items: unknown[]; next_cursor: string | null };
    expect(page).toEqual({ version: 2, finance_revision: await revision(), items: [result.series], next_cursor: null });
    expect((await db.query("select count(*)::int n from app_private.finance_series_occurrences m join public.fin_transactions t on t.user_id=m.user_id and t.id=m.transaction_id where (m.suppression='none') is distinct from (t.deleted_at is null)")).rows).toEqual([{ n: 0 }]);
    expect((await db.query("select count(*)::int n from public.domain_events e where e.entity_type in ('finance_series','finance_series_occurrence','finance_transaction') and (e.entity_id<>((e.after->>'id')::uuid) or e.user_id<>((e.after->>'user_id')::uuid))")).rows).toEqual([{ n: 0 }]);

    // Existing account/archive and the global CAS have changed. Authentic same
    // intent replay must still return the FIRST result and create nothing.
    await db.query("update public.fin_accounts set payload=payload||jsonb_build_object('archived_at',$1::text,'updated_at',$1::text) where id=$2", [new Date().toISOString(), accountId]);
    const beforeReplay = await counts(); expect(await run(command)).toEqual(originalCreate); expect(await counts()).toEqual(beforeReplay);
    const loser = structuredClone(originalBody); loser.receipt.result = { ...originalCreate, series: { ...originalCreate.series, id: randomUUID() } };
    const replay = await sqlCall("finance_series_commit", { p_user: owner, p_session: session, p_operation: command.command, p_request: { ...loser, changes: [], events: [] } });
    expect(replay).toEqual({ status: "replayed", result: originalCreate }); expect(await counts()).toEqual(beforeReplay);
    const changed = structuredClone(command); changed.input.definition.template.description = "Outro conteúdo";
    await expect(sqlCall("finance_series_snapshot", { p_user: owner, p_session: session, p_request: changed })).rejects.toMatchObject({ code: "23505" });

    // An old path cannot mutate a mapped row even with a coherent payload.
    await expect(db.query("update public.fin_transactions set payload=jsonb_set(payload,'{description}',to_jsonb('Bypass legado'::text)) where id=$1", [maps[1]!.transaction_id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("delete from public.fin_transactions where id=$1", [maps[1]!.transaction_id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("update public.fin_accounts set payload=jsonb_set(payload,'{kind}',to_jsonb('cash'::text)) where id=$1", [accountId])).rejects.toMatchObject({ code: "23514" });
    const oldRow = (await db.query<{ payload: Record<string, unknown> }>("select payload from public.fin_transactions where id=$1", [maps[0]!.transaction_id])).rows[0]!.payload;
    const nextRow = { ...oldRow, description: "Batch v1 forjado coerente", updated_at: new Date().toISOString() }, legacyClient = randomUUID();
    const legacyBody = { expectedRevision: await revision(), context: { user_id: owner, canal: "web" }, changes: [{ type: "finance_transaction", before: oldRow, after: nextRow }], events: [{ id: randomUUID(), user_id: owner, entity_type: "finance_transaction", entity_id: oldRow.id, action: "updated", canal: "web", occurred_at: nextRow.updated_at, before: oldRow, after: nextRow }], receipt: { user_id: owner, command: "finance.transaction.update", client_id: legacyClient, fingerprint: JSON.stringify({ client_id: legacyClient, id: oldRow.id, fields: { description: nextRow.description } }), result: nextRow } };
    await expect(db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query("select public.finance_commit($1::uuid,$2::uuid,'finance.transaction.update',$3::jsonb)", [owner, session, JSON.stringify(legacyBody)]); })).rejects.toMatchObject({ code: "42501" });
    expect((await db.query("select count(*)::int n from app_private.command_receipts where user_id=$1 and command='finance.transaction.update' and client_id=$2", [owner, legacyClient])).rows).toEqual([{ n: 0 }]);
    expect(await counts()).toEqual(beforeReplay);
    await expect(sqlCall("finance_series_detail", { p_user: other, p_session: session, p_series_id: result.series.id })).rejects.toMatchObject({ code: "42501" });
    expect(await sqlCall("finance_series_detail", { p_user: other, p_session: otherSession, p_series_id: result.series.id })).toBeNull();

    // v1 retains only its five known event species and excludes v2 receipts.
    const legacy = await db.query<{ value: { events: { entity_type: string }[]; receipts: { command: string }[] } }>("select app_private.finance_snapshot($1,$2,'read.finance') value", [owner, session]);
    expect(legacy.rows[0]!.value.events.every(row => ["finance_account", "finance_category", "finance_tag", "finance_transaction", "finance_budget"].includes(row.entity_type))).toBe(true);
    expect(legacy.rows[0]!.value.receipts.some(row => row.command.startsWith("finance.recurring."))).toBe(false);

    // Native immediate constraints remain in force. A consumed permit cannot
    // authorize a second row entry; an unused permit cannot leave its tx.
    const beforePermitRevision = await revision();
    await expect(db.transaction(async tx => {
      await tx.exec("set constraints app_private.finance_series_permit_zero deferred");
      const row = (await tx.query<{ payload: unknown }>("select payload from public.fin_transactions where id=$1", [maps[1]!.transaction_id])).rows[0]!.payload;
      await tx.query("insert into app_private.finance_series_permits(row_id,user_id,series_id,command,client_id,before_hash,after_hash,backend_pid,xact_id) values($1,$2,$3,'finance.recurring.occurrence.update',$4,encode(sha256(convert_to($5::jsonb::text,'UTF8')),'hex'),encode(sha256(convert_to($5::jsonb::text,'UTF8')),'hex'),pg_backend_pid(),pg_current_xact_id())", [maps[1]!.transaction_id, owner, result.series.id, randomUUID(), JSON.stringify(row)]);
      await tx.query("update public.fin_transactions set payload=payload where id=$1", [maps[1]!.transaction_id]);
      await tx.exec("set constraints all immediate");
      await tx.query("update public.fin_transactions set payload=payload where id=$1", [maps[1]!.transaction_id]);
    })).rejects.toMatchObject({ code: "42501" });
    expect(await counts()).toEqual(beforeReplay); expect(await revision()).toBe(beforePermitRevision);

    await expect(db.transaction(async tx => {
      await tx.exec("set constraints app_private.finance_series_permit_zero deferred");
      await tx.query("insert into app_private.finance_series_permits(row_id,user_id,series_id,command,client_id,before_hash,after_hash,backend_pid,xact_id) values($1,$2,$3,'finance.recurring.occurrence.update',$4,$5,$5,pg_backend_pid(),pg_current_xact_id())", [maps[1]!.transaction_id, owner, result.series.id, randomUUID(), "0".repeat(64)]);
      await tx.exec("set constraints all immediate");
    })).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(beforeReplay);

    // All domain writes and permits occur BEFORE event insertion. Rejecting
    // the first series event therefore tests a real late rollback, not a mock
    // throwing before SQL has touched the ledger.
    await db.query("update public.fin_accounts set payload=payload||jsonb_build_object('archived_at',null,'updated_at',$1::text) where id=$2", [new Date().toISOString(), accountId]);
    await db.exec("create function pg_temp.reject_series_event() returns trigger language plpgsql as $$begin if new.entity_type='finance_series' and new.action='created' then raise exception 'synthetic late event refusal' using errcode='P0001';end if;return new;end$$;create trigger t078_reject_series_event before insert on public.domain_events for each row execute function pg_temp.reject_series_event();");
    const attempted = structuredClone(command); attempted.input.client_id = randomUUID(); attempted.input.expected_finance_revision = await revision();
    const beforeFailure = await counts(), beforeFailureRevision = await revision(), callCount = commits.length;
    await expect(run(attempted)).rejects.toThrow(); expect(commits).toHaveLength(callCount + 1); expect(await counts()).toEqual(beforeFailure); expect(await revision()).toBe(beforeFailureRevision);
    const refused = structuredClone(commits.at(-1)!);
    await db.exec("drop trigger t078_reject_series_event on public.domain_events");
    // Omit one required row/map AND its paired events, adjusting the claimed
    // count. Every remaining BEFORE/AFTER/event is coherent, but the command's
    // full horizon still requires the omitted ordinal, so SQL must refuse.
    const omittedMap = refused.changes.find(change => change.type === "finance_series_occurrence")!;
    const omittedRow = omittedMap.after as { id: string; transaction_id: string };
    refused.changes = refused.changes.filter(change => ![omittedRow.id, omittedRow.transaction_id].includes(change.after.id));
    refused.events = refused.events.filter(event => ![omittedRow.id, omittedRow.transaction_id].includes(event.entity_id));
    refused.receipt.result = { ...(refused.receipt.result as object), affected: { created: 1, updated: 0, suppressed: 0, restored: 0, skipped: 0 } };
    await expect(sqlCall("finance_series_commit", { p_user: owner, p_session: session, p_operation: attempted.command, p_request: refused })).rejects.toMatchObject({ code: "23514" });
    expect(await counts()).toEqual(beforeFailure);

    // Complete fixture identity deletion must not be blocked by ledger guards.
    await db.query("delete from auth.users where id in ($1,$2)", [owner, other]);
    expect(await counts()).toEqual({ series: 0, maps: 0, ledger: 0, events: 0, receipts: 0, permits: 0 });
    expect((await db.query("select (select count(*)::int from auth.users) users,(select count(*)::int from auth.sessions) sessions,(select count(*)::int from public.fin_accounts) accounts,(select count(*)::int from app_private.finance_revisions) revisions,(select count(*)::int from pg_trigger where tgname like 't078_%') fixture_triggers")).rows).toEqual([{ users: 0, sessions: 0, accounts: 0, revisions: 0, fixture_triggers: 0 }]);
  } finally { await db.close(); }
}, 180_000);
