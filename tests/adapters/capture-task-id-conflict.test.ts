/** Canonical disposable SQL; real Core/decoder/Gateway/Store. Auth catalogue
 * and the injected RPC transport are fixtures, not real Auth or PostgREST.
 * No runtime factory, network, hosted data or successful gateway stub is used.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../src/adapters/db/capture-task-commands";
import { createCaptureTaskGateway, type CaptureTaskOperation, type CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import { createCaptureTaskStore } from "../../src/adapters/db/capture-task-store";
import { createLocalCanonicalSql } from "../helpers/local-canonical-sql";

const owner = "43000000-0000-4000-8000-000000000001", session = "43000000-0000-4000-8000-000000000002";
const collision = "43000000-0000-4000-8000-000000000020", now = "2026-10-10T12:00:00.000Z";
const context = { user_id: owner, canal: "web" as const };
let db: PGlite;
const calls: string[] = [];
beforeAll(async () => {
  db = await createLocalCanonicalSql();
  await db.query("insert into auth.users(id,aud,role,email) values ($1,'authenticated','authenticated','id-collision@example.invalid')", [owner]);
  await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session, owner]);
}, 30_000);
afterAll(async () => { await db?.close(); });

const signatures: Record<Parameters<CaptureTaskRpc>[0], { sql: string; extra: readonly ("p_request" | "p_command" | "p_client_id")[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
const rpc: CaptureTaskRpc = async (name, args) => {
  const signature = signatures[name]; calls.push(name);
  expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session);
  expect(Object.keys(args).sort()).toEqual(["p_user", "p_session", "p_operation", ...signature.extra].sort());
  const values = [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])];
  try {
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{ data: unknown }>(signature.sql, values);
    });
    return { data: result.rows[0]!.data, error: null };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string") throw error;
    return { data: null, error: { code } };
  }
};
const gateway = (operation: CaptureTaskOperation) => createCaptureTaskGateway(owner, session, operation, rpc);
async function persisted() {
  return (await db.query<{ state: unknown }>(`select jsonb_build_object(
    'captures',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.captures t where user_id=$1),
    'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.tasks t where user_id=$1),
    'events',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.domain_events t where user_id=$1),
    'receipts',(select coalesce(jsonb_agg(to_jsonb(t) order by t.command,t.client_id),'[]') from app_private.command_receipts t where user_id=$1),
    'revisions',(select coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]') from app_private.capture_task_revisions t where user_id=$1),
    'rate_limits',(select coalesce(jsonb_agg(to_jsonb(t) order by t.scope,t.subject_hash),'[]') from app_private.rate_limits t where user_id=$1)
  ) as state`, [owner])).rows[0]!.state;
}

it.each(["event/task", "task/existing capture"] as const)("classifies %s ID collision as CONFLICT and leaves all persistence unchanged", async kind => {
  if (kind === "task/existing capture") {
    let next = 30;
    const decoded = decodeCaptureTaskRequest({ command: "capture.create", input: { client_id: "existing-capture", type: "note", title: "Identidade ocupada", content: null, category_id: null, project_id: null } });
    await executeCaptureTaskCommand(createCaptureTaskStore(gateway(decoded.command), { maxAttempts: 1 }),
      { clock: { now: () => now }, ids: { next: () => `43000000-0000-4000-8000-${String(next++).padStart(12, "0")}` } }, context, decoded);
  }
  const occupiedId = kind === "event/task" ? collision : "43000000-0000-4000-8000-000000000030";
  const before = await persisted(), offset = calls.length;
  const decoded = decodeCaptureTaskRequest({ command: "task.create", input: {
    client_id: `collision-${kind}`, title: "Não deve persistir", description: null, category_id: null, project_id: null,
    status: "todo", priority: "medium", due_at: null, scheduled_start_at: null, scheduled_end_at: null,
    all_day: false, estimated_minutes: null, board_position: null,
  } });
  let failure: unknown;
  try {
    await executeCaptureTaskCommand(createCaptureTaskStore(gateway(decoded.command), { maxAttempts: 1 }),
      { clock: { now: () => now }, ids: { next: () => occupiedId } }, context, decoded);
  } catch (error) { failure = error; }
  // Check rollback/no commit before the error-code oracle, so the initial red
  // distinguishes a classification defect from partial writes or a fake ACK.
  expect(await persisted()).toEqual(before);
  expect(calls.slice(offset)).toEqual(["capture_task_snapshot", "capture_task_revision"]);
  expect((await db.query("select client_id from app_private.command_receipts where user_id=$1 and client_id=$2", [owner, decoded.input.client_id])).rows).toEqual([]);
  expect(failure).toMatchObject({ code: "CONFLICT", message: "Identificador já utilizado." });
});
