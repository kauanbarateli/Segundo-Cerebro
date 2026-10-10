/** Test-only disposable PostgreSQL. Auth/session catalogue and the RPC transport
 * are explicit fixtures; Gateway, Store, Core and canonical SQL are production.
 * No hosted Auth, PostgREST, HTTP service, credentials or Memory fallback.
 */
import type { PGlite } from "@electric-sql/pglite";
import { createCaptureTaskGateway, type CaptureTaskCommand, type CaptureTaskOperation, type CaptureTaskRpc, type CaptureTaskRpcArguments } from "../../../src/adapters/db/capture-task-gateway";
import { createCaptureTaskStore } from "../../../src/adapters/db/capture-task-store";
import type { CaptureTaskUnitOfWork, Categoria, ContextoDeEscrita, DependenciasDeDominio, Projeto } from "../../../src/core/contracts";

export const instant = "2026-10-07T12:00:00.000Z";
let sequence = 0;
const uuid = () => `52000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
export interface Actor {
  context: ContextoDeEscrita;
  session: string;
  category: Categoria;
  project: Projeto;
}
type RpcName = Parameters<CaptureTaskRpc>[0];
type RpcResponse = Awaited<ReturnType<CaptureTaskRpc>>;
const signatures: Record<RpcName, { sql: string; extra: readonly (keyof CaptureTaskRpcArguments)[] }> = {
  capture_task_snapshot: { sql: "select public.capture_task_snapshot($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_revision: { sql: "select public.capture_task_revision($1::uuid,$2::uuid,$3::text) as data", extra: [] },
  capture_task_receipt: { sql: "select public.capture_task_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as data", extra: ["p_command", "p_client_id"] },
  capture_task_commit: { sql: "select public.capture_task_commit($1::uuid,$2::uuid,$3::text,$4::jsonb) as data", extra: ["p_request"] },
};
export interface RpcCall { name: RpcName; args: CaptureTaskRpcArguments; response: RpcResponse }
export interface TransportHooks {
  before?: (name: RpcName, args: Readonly<CaptureTaskRpcArguments>) => Promise<void>;
  after?: (name: RpcName, args: Readonly<CaptureTaskRpcArguments>, response: Readonly<RpcResponse>) => Promise<void>;
}
type Work<T> = (store: CaptureTaskUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita) => Promise<T>;

/** Each case owns two fresh users, references and sessions in the disposable DB. */
export async function createContractHarness(db: PGlite) {
  let time = instant;
  const deps: DependenciasDeDominio = { ids: { next: uuid }, clock: { now: () => time } };
  async function actor(canal: ContextoDeEscrita["canal"]): Promise<Actor> {
    const user_id = uuid(), session = uuid();
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)", [user_id, `${user_id}@contract.invalid`]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, user_id]);
    const category: Categoria = { id: uuid(), user_id, name: "Categoria de contrato", normalized_name: "categoria de contrato", color_key: "blue", is_system: false, created_at: instant, updated_at: instant };
    const project: Projeto = { id: uuid(), user_id, name: "Projeto de contrato", description: null, color_key: "blue", position: 0, deleted_at: null, created_at: instant, updated_at: instant };
    // Reference metadata is fixture setup, not a claimed Project/Category command.
    await db.query("insert into public.categories(payload) values($1::jsonb)", [JSON.stringify(category)]);
    await db.query("insert into public.projects(payload) values($1::jsonb)", [JSON.stringify(project)]);
    return { context: { user_id, canal }, session, category, project };
  }
  const a = await actor("web"), b = await actor("api");
  const calls: RpcCall[] = [], hooks: TransportHooks = {};
  function bound(actor: Actor, operation: CaptureTaskOperation, maxAttempts = 3) {
    const rpc: CaptureTaskRpc = async (name, args) => {
      const signature = signatures[name];
      if (!signature || args.p_user !== actor.context.user_id || args.p_session !== actor.session || args.p_operation !== operation ||
        Object.keys(args).sort().join() !== ["p_user", "p_session", "p_operation", ...signature.extra].sort().join()) throw new Error("RPC escaped its explicit actor/session/operation binding.");
      await hooks.before?.(name, structuredClone(args));
      const values = [args.p_user, args.p_session, args.p_operation, ...signature.extra.map(key => key === "p_request" ? JSON.stringify(args[key]) : args[key])];
      let response: RpcResponse;
      try {
        const result = await db.transaction(async tx => {
          await tx.exec("set local role service_role");
          return tx.query<{ data: unknown }>(signature.sql, values);
        });
        response = { data: result.rows[0]!.data, error: null };
      } catch (error) {
        // Preserve SQLSTATE only. A refused SQL transaction is not an unknown
        // transport outcome; no success or stale response is fabricated.
        if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") throw error;
        response = { data: null, error: { code: error.code } };
      }
      calls.push({ name, args: structuredClone(args), response: structuredClone(response) });
      await hooks.after?.(name, structuredClone(args), structuredClone(response));
      return response;
    };
    const gateway = createCaptureTaskGateway(actor.context.user_id, actor.session, operation, rpc);
    return { gateway, store: createCaptureTaskStore(gateway, { maxAttempts }) };
  }
  return {
    a, b, deps, calls, hooks, bound,
    setTime(value: string) { time = value; },
    run<T>(actor: Actor, operation: CaptureTaskCommand, work: Work<T>): Promise<T> {
      // Bind BEFORE invoking Core; never infer or rewrite an operation from a receipt.
      return work(bound(actor, operation).store, deps, { ...actor.context });
    },
    read(actor: Actor) { return bound(actor, "read.captures").store.read(actor.context.user_id); },
    async persisted(actor: Actor) {
      const owner = actor.context.user_id;
      return {
        captures: (await db.query("select payload from public.captures where user_id=$1 order by id", [owner])).rows,
        tasks: (await db.query("select payload from public.tasks where user_id=$1 order by id", [owner])).rows,
        events: (await db.query("select id,entity_type,entity_id,action,canal,occurred_at,before,after from public.domain_events where user_id=$1 order by occurred_at,id", [owner])).rows,
        receipts: (await db.query("select command,client_id,request,result from app_private.command_receipts where user_id=$1 order by command,client_id", [owner])).rows,
        revision: await bound(actor, "read.captures").gateway.currentRevision(),
      };
    },
    async deleteProjectFixture(actor: Actor) {
      // Simulate a pre-existing deleted reference honestly, without giving this
      // narrow store a Project writer or claiming Project orchestration coverage.
      await db.query("update public.projects set payload=payload||jsonb_build_object('deleted_at',$2::text,'updated_at',$2::text) where id=$1", [actor.project.id, time]);
    },
  };
}
export type RealContractHarness = Awaited<ReturnType<typeof createContractHarness>>;

/** Faults occur INSIDE canonical SQL, after an actual row insertion. The receipt
 * point is a late batch failure, not a claimed engine COMMIT fault. All fixtures
 * and triggers disappear with this single disposable database.
 */
export async function installSqlFaultFixture(db: PGlite) {
  await db.exec(`
    create temporary table real_contract_faults(user_id uuid primary key, table_name text not null);
    create function pg_temp.real_contract_fault() returns trigger language plpgsql security definer set search_path='' as $$
    begin
      if exists(select 1 from pg_temp.real_contract_faults f where f.user_id=new.user_id and f.table_name=TG_TABLE_NAME) then
        raise exception 'contract SQL fault' using errcode='23514';
      end if;
      return new;
    end $$;
    create trigger real_contract_task_fault after insert on public.tasks for each row execute function pg_temp.real_contract_fault();
    create trigger real_contract_event_fault after insert on public.domain_events for each row execute function pg_temp.real_contract_fault();
    create trigger real_contract_receipt_fault after insert on app_private.command_receipts for each row execute function pg_temp.real_contract_fault();
  `);
}
