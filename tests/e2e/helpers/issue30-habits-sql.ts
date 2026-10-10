/** Canonical disposable SQL and actual product exports. Auth catalogue is a
 * fixture, not GoTrue. Historical entry mass is explicitly metadata seed, not
 * a claim that its creation traversed Core or emitted domain events. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { createLocalCanonicalSql } from "../../helpers/local-canonical-sql";
import type { RoutineOperation, RoutineRpc } from "../../../src/adapters/db/projects-habits-gateway";
import type { HabitoDoUsuario, MarcacaoHabito } from "../../../src/core/contracts/modules";

export type HabitProduct = typeof import("../fixtures/issue30-habits-sql.entry");
export const habitOwner = "50000000-0000-4000-8000-000000000001", habitSession = "50000000-0000-4000-8000-000000000002";
export const habitForeign = "50000000-0000-4000-8000-000000000003", habitForeignSession = "50000000-0000-4000-8000-000000000004";
export function shiftCivil(day: string, offset: number) {
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  return new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
}
export async function loadHabitProduct(): Promise<HabitProduct> {
  const build = await rolldown({ input: resolve("tests/e2e/fixtures/issue30-habits-sql.entry.ts"), platform: "node", tsconfig: false,
    resolve: { conditionNames: ["react-server", "node", "import", "default"] } });
  try {
    const { output } = await build.generate({ format: "es", codeSplitting: false });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk");
    assert.deepEqual(chunk.imports, []); assert.deepEqual(chunk.dynamicImports, []);
    const product = await import("data:text/javascript;base64," + Buffer.from(chunk.code).toString("base64")) as HabitProduct;
    assert.deepEqual(Object.keys(product).sort(), ["createRoutineGateway", "createRoutineStore", "decodeRoutineRequest", "executeRoutineCommand"]);
    return product;
  } finally { await build.close(); }
}
const signatures: Record<Parameters<RoutineRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  projects_habits_snapshot: { sql: "select public.projects_habits_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  projects_habits_commit: { sql: "select public.projects_habits_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
  projects_habits_receipt: { sql: "select public.projects_habits_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
};
export async function createHabitSqlFixture(product: HabitProduct) {
  const db = await createLocalCanonicalSql();
  try {
    await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','habit-owner@example.invalid'),($2,'authenticated','authenticated','habit-foreign@example.invalid')", [habitOwner, habitForeign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)", [habitSession, habitOwner, habitForeignSession, habitForeign]);
    // Align with the canonical SQL ceiling; do not fake PostgreSQL time. UTC is
    // tomorrow at 02:30, while São Paulo and the SQL day are still today.
    const today = (await db.query<{ today: string }>("select to_char(current_timestamp at time zone 'America/Sao_Paulo','YYYY-MM-DD') as today")).rows[0]!.today;
    const now = shiftCivil(today, 1) + "T02:30:00.000Z";
    let sequence = 20;
    const nextId = () => `50000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
    const deps = { clock: { now: () => now }, ids: { next: nextId } };
    const calls: { name: Parameters<RoutineRpc>[0]; operation: RoutineOperation; actor: string }[] = [];
    function gateway(operation: RoutineOperation, actor = habitOwner, sid = habitSession) {
      assert.ok(actor === habitOwner && sid === habitSession || actor === habitForeign && sid === habitForeignSession);
      const rpc: RoutineRpc = async (name, args) => {
        const signature = signatures[name];
        assert.equal(args.p_user, actor); assert.equal(args.p_session, sid); assert.equal(args.p_operation, operation);
        assert.deepEqual(Object.keys(args).sort(), ["p_user", "p_session", "p_operation", ...signature.extra].sort());
        calls.push({ name, operation, actor });
        try {
          const result = await db.transaction(async tx => {
            await tx.exec("set local role service_role");
            return tx.query<{ data: unknown }>(signature.sql, [actor, sid, operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])]);
          });
          return { data: result.rows[0]!.data, error: null };
        } catch (error) {
          const code = (error as { code?: unknown }).code;
          if (typeof code !== "string") throw error;
          return { data: null, error: { code } };
        }
      };
      return product.createRoutineGateway(actor, sid, operation, rpc);
    }
    async function command(value: unknown, actor = habitOwner, sid = habitSession) {
      const request = product.decodeRoutineRequest(value);
      return product.executeRoutineCommand(product.createRoutineStore(gateway(request.command, actor, sid)), deps, { user_id: actor, canal: "web" }, request);
    }
    async function habit(name: string, startedOn: string, position = 0, actor = habitOwner, sid = habitSession) {
      return command({ command: "habit.create", input: { name, schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: startedOn, color_key: "neutral", icon_key: null, position, client_id: "seed-" + name } }, actor, sid) as Promise<HabitoDoUsuario>;
    }
    function entry(row: HabitoDoUsuario, day: string): MarcacaoHabito {
      return { id: nextId(), user_id: row.user_id, habit_id: row.id, done_on: day, note: null, created_at: now };
    }
    async function seedHistory(row: HabitoDoUsuario, days: readonly string[]) {
      // Trigger/constraints/revision remain canonical. No invented historical
      // event/receipt is added and each row is independently auditable in SQL.
      await db.transaction(async tx => { for (const day of days) {
        const payload = entry(row, day);
        await tx.query("insert into public.habit_entries(payload) values($1::jsonb)", [JSON.stringify(payload)]);
      } });
    }
    async function ledger() {
      const [habits, entries, pauses, events, receipts, revisions, limiter] = await Promise.all([
        db.query("select payload from public.habits order by id"), db.query("select payload from public.habit_entries order by id"),
        db.query("select payload from public.habit_pauses order by id"), db.query("select id,user_id,entity_type,entity_id,action,canal,before,after from public.domain_events order by id"),
        db.query("select user_id,command,client_id,request,result from app_private.command_receipts order by user_id,command,client_id"),
        db.query("select user_id,revision::text as revision from app_private.projects_habits_revisions order by user_id"),
        db.query("select to_jsonb(r) as row from app_private.rate_limits r order by to_jsonb(r)::text"),
      ]);
      return { habits: habits.rows, entries: entries.rows, pauses: pauses.rows, events: events.rows, receipts: receipts.rows, revisions: revisions.rows, limiter: limiter.rows };
    }
    return { db, today, now, calls, gateway, command, habit, entry, seedHistory, ledger };
  } catch (error) { await db.close(); throw error; }
}
export type HabitSqlFixture = Awaited<ReturnType<typeof createHabitSqlFixture>>;
