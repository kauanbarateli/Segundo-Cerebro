/** Fixed SQL tickets for disposable native tests; no connection or operator. */
import { nativeData, nativeRecord, nativeRefuse, GOAL_NATIVE_LIMITS } from "./finance-goals-terminal-native-contract.mjs";
const statements = new WeakMap();
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const OP = /^finance\.goal\.(?:create|update|archive|restore|highlight|contribute|release)$/;
const NS = /^sc-goals-terminal-native-[a-f0-9]{32}$/;
const lit = value => { if (typeof value !== "string") nativeRefuse("SQL_REFUSED"); return "'" + value.replaceAll("'", "''") + "'"; };
const json = value => {
  const text = JSON.stringify(nativeData(value));
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > GOAL_NATIVE_LIMITS.inputBytes) nativeRefuse("SQL_REFUSED");
  // Encoded bytes are data, never executable SQL or psql meta-commands.
  return `convert_from(decode('${Buffer.from(text, "utf8").toString("hex")}','hex'),'UTF8')::jsonb`;
};
const uuid = value => { if (typeof value !== "string" || !UUID.test(value)) nativeRefuse("SQL_REFUSED"); return lit(value) + "::uuid"; };
const materialTables = Object.freeze({ goals: "app_private.finance_goals", reservations: "app_private.finance_goal_reservations", releases: "app_private.finance_goal_releases", highlights: "app_private.finance_goal_highlights", ledger: "public.fin_transactions", accounts: "public.fin_accounts", events: "public.domain_events", receipts: "app_private.command_receipts", dispositions: "app_private.finance_goal_dispositions", limits: "app_private.rate_limits", revisions: "app_private.finance_revisions" });
function ownerMaterial(owner) {
  const rows = Object.entries(materialTables).map(([key, table]) => `${lit(key)},(select coalesce(jsonb_agg(to_jsonb(x)${key === "revisions" ? "||jsonb_build_object('revision',x.revision::text)" : ""} order by ${key === "limits" ? "x.scope,x.subject_hash" : key === "revisions" ? "x.user_id" : key === "receipts" ? "x.command,x.client_id" : "x.id"}),'[]'::jsonb) from ${table} x where x.user_id=${owner})`);
  return `jsonb_build_object(${rows.join(",")},'accountTotals',(select coalesce(jsonb_agg(app_private.fg_account_totals(${owner},a.id) order by a.id),'[]') from public.fin_accounts a where a.user_id=${owner}),'goalTotals',(select coalesce(jsonb_agg(app_private.fg_goal_totals(${owner},g.id) order by g.id),'[]') from app_private.finance_goals g where g.user_id=${owner}),'releaseTotals',(select coalesce(jsonb_agg(app_private.fg_release_totals(${owner},r.id) order by r.id),'[]') from app_private.finance_goal_reservations r where r.user_id=${owner}))`;
}
/** Fixed bootstrap only; no caller-provided SQL or unknown connection target. */
export function goalNativeBootstrapSql(namespace, sourceSha) {
  if (typeof namespace !== "string" || !NS.test(namespace) || typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceSha)) nativeRefuse("SQL_REFUSED");
  return `begin read only;select jsonb_build_object('namespace',${lit(namespace)},'sourceSha',${lit(sourceSha)},'systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'owner',current_user,'version',current_setting('server_version_num')::integer);rollback;`;
}
export function nativeSqlContext(value) {
  const context = nativeRecord(value, ["namespace", "sourceSha", "systemIdentifier"]);
  if (typeof context.namespace !== "string" || typeof context.sourceSha !== "string" || typeof context.systemIdentifier !== "string" || !NS.test(context.namespace) || !/^[a-f0-9]{40}$/.test(context.sourceSha) || !/^[0-9]{16,20}$/.test(context.systemIdentifier)) nativeRefuse("SQL_REFUSED");
  return Object.freeze(context);
}
export function goalNativeStatement(contextInput, action, data = {}) {
  const context = nativeSqlContext(contextInput); let sql, writing = false, transition = null, expected, expectation = null;
  const identity = `jsonb_build_object('namespace',${lit(context.namespace)},'sourceSha',${lit(context.sourceSha)},'systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'sessionUser',session_user,'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'pid',pg_backend_pid(),'applicationName',current_setting('application_name'))`;
  if (action === "IDENTITY") { nativeRecord(data, []); sql = identity; expected = "identity"; }
  else if (action === "BEGIN") {
    const v = nativeRecord(data, ["role"]); if (!["service_role", "postgres"].includes(v.role)) nativeRefuse("SQL_REFUSED");
    expectation = Object.freeze({ role: v.role });
    transition = "open"; expected = "begin";
    sql = `begin isolation level read committed;set local statement_timeout='12s';set local lock_timeout='10s';set local idle_in_transaction_session_timeout='15s';set local role ${v.role};\n@FRAME@jsonb_build_object('ack','begin','role',current_user,'isolation',current_setting('transaction_isolation'))`;
  } else if (action === "COMMIT" || action === "ROLLBACK") {
    nativeRecord(data, []); transition = "idle"; expected = action.toLowerCase();
    sql = `${action.toLowerCase()};\n@FRAME@jsonb_build_object('ack',${lit(expected)})`;
  } else if (action === "RPC" || action === "OLD_EXECUTOR") {
    const v = nativeRecord(data, ["rpc", "owner", "session", "operation", "request"]);
    if (typeof v.owner !== "string" || typeof v.session !== "string" || typeof v.operation !== "string" || typeof v.rpc !== "string" || !UUID.test(v.owner) || !UUID.test(v.session) || !OP.test(v.operation) || !["finance_goals_snapshot", "finance_goals_commit", "finance_goal_attempt_status", "finance_goal_attempt_settle"].includes(v.rpc) || v.request === null || typeof v.request !== "object") nativeRefuse("SQL_REFUSED");
    const target = action === "OLD_EXECUTOR" ? "app_private.fg_terminal_previous_commit" : {
      finance_goals_snapshot: "public.finance_goals_snapshot",
      finance_goals_commit: "public.finance_goals_commit",
      finance_goal_attempt_status: "public.finance_goal_attempt_status",
      finance_goal_attempt_settle: "public.finance_goal_attempt_settle",
    }[v.rpc];
    if (!target || action === "OLD_EXECUTOR" && v.rpc !== "finance_goals_commit") nativeRefuse("SQL_REFUSED");
    expectation = Object.freeze({ rpc: v.rpc });
    const args = `${lit(v.owner)}::uuid,${lit(v.session)}::uuid,${v.rpc === "finance_goals_commit" ? lit(v.operation) + "::text," : ""}${json(v.request)}`;
    sql = `jsonb_build_object('ack','rpc','rpc',${lit(v.rpc)},'value',${target}(${args}))`; expected = "rpc";
    writing = action === "OLD_EXECUTOR" || ["finance_goals_commit", "finance_goal_attempt_settle"].includes(v.rpc);
  } else if (action === "STATE") {
    const v = nativeRecord(data, ["owner"]), owner = uuid(v.owner); expected = "state";
    sql = `jsonb_build_object('ack','state','revision',app_private.fg_finance_revision(${owner}),'at',clock_timestamp(),'day',to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD'))`;
  } else if (action === "MATERIAL") {
    const v = nativeRecord(data, ["a", "b"]), a = uuid(v.a), b = uuid(v.b); if (v.a === v.b) nativeRefuse("SQL_REFUSED"); expected = "material";
    sql = `jsonb_build_object('ack','material','a',${ownerMaterial(a)},'b',${ownerMaterial(b)})`;
  } else if (action === "FIXTURE") {
    const v = nativeRecord(data, ["a", "b", "a1", "a2", "b1", "accountA", "accountB", "at"]);
    for (const key of ["a", "b", "a1", "a2", "b1", "accountA", "accountB"]) uuid(v[key]);
    if (new Set([v.a,v.b,v.a1,v.a2,v.b1,v.accountA,v.accountB]).size !== 7 || typeof v.at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.at)) nativeRefuse("SQL_REFUSED");
    const account = (id, user) => json({ id, user_id: user, name: "Conta sintética nativa", kind: "checking", institution: null, currency: "BRL", opening_balance_cents: 100000, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null, created_at: v.at, updated_at: v.at });
    expected = "fixture"; writing = true;
    sql = `do $guard$ begin if current_user<>'postgres' or (select count(*) from auth.users)<>2 or (select count(*) from auth.sessions)<>3 or exists(select 1 from public.user_roles where role<>'user') or exists(select 1 from public.user_moderation where status<>'active' or must_change_password) or exists(select 1 from public.user_entitlements) or not exists(select 1 from auth.users where id=${uuid(v.a)} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) or not exists(select 1 from auth.users where id=${uuid(v.b)} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) or (select count(*) from auth.sessions where (user_id=${uuid(v.a)} and id in (${uuid(v.a1)},${uuid(v.a2)})) or (user_id=${uuid(v.b)} and id=${uuid(v.b1)}))<>3 then raise exception 'Native ordinary fixtures differ.' using errcode='42501';end if;end $guard$;insert into public.fin_accounts(payload) values(${account(v.accountA,v.a)}),(${account(v.accountB,v.b)});\n@FRAME@jsonb_build_object('ack','fixture')`;
  } else if (action === "BACKENDS") {
    nativeRecord(data, []); expected = "backends";
    sql = `jsonb_build_object('ack','backends','other',(select count(*)::integer from pg_stat_activity where pid<>pg_backend_pid() and left(application_name,${("sc.goals.native." + context.namespace.slice(-32) + ".").length})=${lit("sc.goals.native." + context.namespace.slice(-32) + ".")}))`;
  } else if (action === "ABSENCE") {
    const v = nativeRecord(data, ["a", "b"]), a = uuid(v.a), b = uuid(v.b); expected = "absence";
    const relations = ["auth.users", "auth.sessions", ...Object.values(materialTables)];
    sql = `jsonb_build_object('ack','absence','absent',${relations.map(table => `not exists(select 1 from ${table} where ${table === "auth.users" ? "id" : "user_id"} in (${a},${b}))`).join(" and ")})`;
  } else if (action === "BLOCKING") {
    const v = nativeRecord(data, ["waiter", "winner"]);
    if (![v.waiter, v.winner].every(n => Number.isSafeInteger(n) && n > 1 && n < 2147483647) || v.waiter === v.winner) nativeRefuse("SQL_REFUSED");
    expectation = Object.freeze({ waiter: v.waiter, winner: v.winner });
    expected = "blocking";
    sql = `jsonb_build_object('ack','blocking','waiter',${v.waiter},'winner',${v.winner},'blocked',pg_blocking_pids(${v.waiter})=array[${v.winner}]::integer[],'advisory',exists(select 1 from pg_locks w join pg_locks h on h.locktype=w.locktype and h.database is not distinct from w.database and h.classid=w.classid and h.objid=w.objid and h.objsubid=w.objsubid where w.pid=${v.waiter} and h.pid=${v.winner} and w.locktype='advisory' and w.mode='ExclusiveLock' and h.mode='ExclusiveLock' and not w.granted and h.granted),'waitType',(select wait_event_type from pg_stat_activity where pid=${v.waiter}))`;
  } else nativeRefuse("SQL_REFUSED");
  const ticket = Object.freeze({ kind: "goal-native-statement", action });
  statements.set(ticket, Object.freeze({ ...context, action, sql, writing, transition, expected, expectation })); return ticket;
}
/** A matching public shape never authorizes SQL: only this module's nominal ticket does. */
export function inspectGoalNativeStatement(ticket, contextInput) {
  const expected = nativeSqlContext(contextInput), value = statements.get(ticket);
  if (!value || Object.keys(expected).some(key => expected[key] !== value[key])) nativeRefuse("SQL_REFUSED");
  return value;
}
export function frameGoalNativeStatement(ticket, contextInput, nonce, sequence) {
  const statement = inspectGoalNativeStatement(ticket, contextInput);
  if (typeof nonce !== "string" || !/^[a-f0-9]{32}$/.test(nonce) || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 512) nativeRefuse("FRAME_REFUSED");
  const prefix = `SC_GOALS_NATIVE:${nonce}:${sequence}:`, render = expression => `select ${lit(prefix)}||(${expression})::text;\n`;
  const split = statement.sql.indexOf("@FRAME@");
  return Object.freeze({ ...statement, prefix, input: split < 0 ? render(statement.sql) : statement.sql.slice(0, split) + render(statement.sql.slice(split + 7)) });
}
