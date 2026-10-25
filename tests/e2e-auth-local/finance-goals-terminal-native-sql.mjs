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

/** Preparatory image issuer. It shares the original nominal registry/frame;
 * no runner mode, fixture DDL, arbitrary SQL/RPC or acceptance is exposed. */
export const GOAL_IMAGES_NATIVE_ACTIONS = Object.freeze(["IMAGE_RESERVE", "IMAGE_CLAIM", "IMAGE_COMPLETE", "IMAGE_CLEANUP_CANDIDATES", "IMAGE_CLEANUP_ACK", "IMAGE_MATERIAL", "IMAGE_ABSENCE", "IMAGE_FIXTURE_AGE", "IMAGE_ASSERT_GRANTS", "IMAGE_FIXTURE_HOLDERS", "IMAGE_ASSERT_HOLDERS", "IMAGE_FIXTURE_FIRST_PASS", "IMAGE_FIXTURE_TOMBSTONE", "IMAGE_FAULT_INSTALL", "IMAGE_FAULT_REMOVE", "IMAGE_ASSERT_DENIED", "IMAGE_ASSERT_FAULT", "IMAGE_ASSERT_PRIVATE_DENIED"]);
const IMAGE_NATIVE_KINDS = Object.freeze(["drive", "capture_image", "avatar", "project_cover", "habit_image", "finance_goal_image", "home_focus_image"]);
function imageKind(value) { if (typeof value !== "string" || !IMAGE_NATIVE_KINDS.includes(value)) nativeRefuse("SQL_REFUSED"); return value; }
function imageInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) nativeRefuse("SQL_REFUSED");
  return value;
}
function imageActor(value, fields) {
  const v = nativeRecord(nativeData(value), ["owner", "session", "uploadId", "clientId", ...fields], "SQL_REFUSED");
  for (const field of ["owner", "session", "uploadId", "clientId"]) uuid(v[field]);
  return v;
}
const imageHolderTables = Object.freeze({ profiles: "public.profiles", preferences: "public.user_preferences", projects: "public.projects", captures: "public.captures", captureLinks: "public.capture_file_links", habits: "public.habits", notebooks: "public.knowledge_notebooks", pages: "public.knowledge_pages", links: "public.links", pageRefs: "public.page_refs", roles: "public.user_roles", moderation: "public.user_moderation", entitlements: "public.user_entitlements" });
function imageMaterial(owner) {
  const holders = Object.entries(imageHolderTables).map(([key,table]) => `${lit(key)},(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from ${table} x where x.user_id=${owner})`);
  return `jsonb_build_object('finance',${ownerMaterial(owner)},'files',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.drive_files x where x.user_id=${owner}),'uploads',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from app_private.upload_reservations x where x.user_id=${owner}),${holders.join(",")})`;
}
/** Closed literal templates only. Tickets are never reconstructed by shape. */
export function goalImagesNativeStatement(contextInput, action, data = {}) {
  const context = nativeSqlContext(contextInput);
  if (typeof action !== "string" || !GOAL_IMAGES_NATIVE_ACTIONS.includes(action)) nativeRefuse("SQL_REFUSED");
  let sql, writing = false, expected, expectation = null;
  function rpc(name, expression) {
    expected = "rpc"; expectation = Object.freeze({ rpc: name });
    return `jsonb_build_object('ack','rpc','rpc',${lit(name)},'value',${expression})`;
  }
  if (action === "IMAGE_RESERVE") {
    const v = imageActor(data, ["kind", "expires"]); imageKind(v.kind); imageInstant(v.expires);
    sql = rpc("file_upload_reserve", `public.file_upload_reserve(${uuid(v.owner)},${uuid(v.session)},${lit(v.kind)}::text,'synthetic.png'::text,null::uuid,${lit(v.clientId)}::text,${uuid(v.uploadId)},8388608::bigint,1073741824::bigint,${lit(v.expires)}::timestamptz)`); writing = true;
  } else if (action === "IMAGE_CLAIM") {
    const v = imageActor(data, ["leaseId"]); uuid(v.leaseId);
    sql = rpc("file_upload_claim", `public.file_upload_claim(${uuid(v.owner)},${uuid(v.session)},${uuid(v.uploadId)},${uuid(v.leaseId)},${lit(v.clientId)}::text)`); writing = true;
  } else if (action === "IMAGE_COMPLETE") {
    const v = imageActor(data, ["leaseId", "kind", "createdAt", "updatedAt"]); uuid(v.leaseId); imageKind(v.kind); imageInstant(v.createdAt); imageInstant(v.updatedAt);
    if (v.createdAt > v.updatedAt) nativeRefuse("SQL_REFUSED");
    // Explicit metadata fixture, not bytes, an image observation or a File proof.
    const file = { id: v.uploadId, user_id: v.owner, kind: v.kind, folder_id: null, name: "synthetic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), width: 40, height: 20, starred: false, deleted_at: null, deletion_batch_id: null, created_at: v.createdAt, updated_at: v.updatedAt, modified_at: v.updatedAt };
    sql = rpc("file_upload_complete", `public.file_upload_complete(${uuid(v.owner)},${uuid(v.session)},${uuid(v.uploadId)},${uuid(v.leaseId)},${lit(v.clientId)}::text,${json(file)},1073741824::bigint)`); writing = true;
  } else if (action === "IMAGE_CLEANUP_CANDIDATES") {
    nativeRecord(data, [], "SQL_REFUSED");
    sql = rpc("file_cleanup_candidates", "public.file_cleanup_candidates()"); writing = true;
  } else if (action === "IMAGE_CLEANUP_ACK") {
    const v = nativeRecord(data, ["uploadId"], "SQL_REFUSED"); uuid(v.uploadId);
    sql = rpc("file_cleanup_ack", `public.file_cleanup_ack(${uuid(v.uploadId)})`); writing = true;
  } else if (action === "IMAGE_FIXTURE_AGE") {
    const v = nativeRecord(data, ["owner", "uploadId"], "SQL_REFUSED"), owner = uuid(v.owner), upload = uuid(v.uploadId);
    // A fixed fixture-only transformation AFTER all three public upload RPCs.
    // Never promotes a reservation/file to finalized and never creates a file.
    sql = `do $image_age$ begin
      if current_user<>'postgres' or not exists(select 1 from auth.users where id=${owner} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)})
       or not exists(select 1 from app_private.upload_reservations r join public.drive_files f on f.user_id=r.user_id and f.id=r.file_id where r.id=${upload} and r.user_id=${owner} and r.status='finalized' and r.file_id=r.id and f.purged_at is null and f.deleted_at is null and f.kind=r.kind and f.created_at<now()-interval '1 day') then
       raise exception 'Finalized original image fixture required.' using errcode='42501';end if;
      update app_private.upload_reservations set expires_at=now()-interval '2 days',cleaned_at=now()-interval '2 days',lease_until=null where id=${upload} and user_id=${owner};
      end $image_age$;\n@FRAME@jsonb_build_object('ack','fixture')`; expected = "fixture"; writing = true;
  } else if (action === "IMAGE_ASSERT_GRANTS") {
    nativeRecord(data, [], "SQL_REFUSED");
    // Native catalogue assertions, not a metadata-shaped capability or caller SQL.
    sql = `do $image_catalogue$ declare r text;f regprocedure;t regclass;begin
      if current_user<>'postgres' or not exists(select 1 from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_owner_fk' and contype='f' and condeferrable and condeferred and confrelid='public.drive_files'::regclass)
       or not exists(select 1 from pg_constraint where conrelid='app_private.finance_goals'::regclass and conname='finance_goals_image_payload_match' and contype='c')
       or not exists(select 1 from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_project' and not tgisinternal and tgtype=31 and tgenabled='O' and tgfoid='app_private.fg_project()'::regprocedure)
       or not exists(select 1 from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_z_image_binding' and not tgisinternal and tgtype=23 and tgenabled='O' and tgfoid='app_private.fgi_project()'::regprocedure)
       or to_regprocedure('app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)') is null then raise exception 'Image and terminal composition differ.' using errcode='23514';end if;
      foreach r in array array['anon','authenticated','service_role'] loop
       foreach t in array array['app_private.finance_goals'::regclass,'app_private.upload_reservations'::regclass] loop
        if has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE') or not(select relrowsecurity from pg_class where oid=t) then raise exception 'Private image tables exposed.' using errcode='42501';end if;
       end loop;
       foreach f in array array['app_private.fg_image(uuid,uuid)'::regprocedure,'app_private.fgi_project()'::regprocedure,'app_private.fgi_previous_image_referenced(uuid,uuid)'::regprocedure,'app_private.entity_image_referenced(uuid,uuid)'::regprocedure,'app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)'::regprocedure] loop
        if has_function_privilege(r,f,'EXECUTE') then raise exception 'Private image helpers exposed.' using errcode='42501';end if;
       end loop;
      end loop;
      foreach f in array array['public.file_upload_reserve(uuid,uuid,text,text,uuid,text,uuid,bigint,bigint,timestamp with time zone)'::regprocedure,'public.file_upload_claim(uuid,uuid,uuid,uuid,text)'::regprocedure,'public.file_upload_complete(uuid,uuid,uuid,uuid,text,jsonb,bigint)'::regprocedure,'public.file_cleanup_candidates()'::regprocedure,'public.file_cleanup_ack(uuid)'::regprocedure] loop
       if not has_function_privilege('service_role',f,'EXECUTE') or has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'Public image wrapper grant differs.' using errcode='42501';end if;
      end loop;
      end $image_catalogue$;\n@FRAME@jsonb_build_object('ack','fixture')`; expected = "fixture";
  } else if (action === "IMAGE_FIXTURE_HOLDERS") {
    const v = nativeRecord(nativeData(data), ["owner", "files", "ids", "at"], "SQL_REFUSED"), owner=uuid(v.owner);imageInstant(v.at);
    const fileKeys=["avatar","capture","project","home","habit","page"],idKeys=["project","habit","capture","pageCapture","notebook","page","link","deletionBatch"];
    const files=nativeRecord(v.files,fileKeys,"SQL_REFUSED"),ids=nativeRecord(v.ids,idKeys,"SQL_REFUSED");for(const value of [...Object.values(files),...Object.values(ids)])uuid(value);
    if(new Set([v.owner,...Object.values(files),...Object.values(ids)]).size!==15)nativeRefuse("SQL_REFUSED");
    const kinds={avatar:"avatar",capture:"capture_image",project:"project_cover",home:"home_focus_image",habit:"habit_image",page:"capture_image"};
    const attachment=file=>({id:file,name:"synthetic.png",mime:"image/png",width:40,height:20,bytes:100});
    const capture=(id,file)=>({id,user_id:v.owner,client_id:id,project_id:null,type:"note",title:"Native holder capture",content:"Synthetic native holder",status:"inbox",category_id:null,converted_task_id:null,captured_at:v.at,organized_at:null,archived_at:null,deleted_at:null,created_at:v.at,updated_at:v.at,attachments:[attachment(file)]});
    const project={id:ids.project,user_id:v.owner,name:"Native holder project",description:null,color_key:"work",position:0,deleted_at:null,cover_file_id:files.project,created_at:v.at,updated_at:v.at};
    const habit={id:ids.habit,user_id:v.owner,name:"Native archived holder",schedule_kind:"daily",weekdays:[],weekly_target:null,started_on:v.at.slice(0,10),archived_at:v.at,color_key:"work",icon_key:null,position:0,created_at:v.at,updated_at:v.at,image_file_id:files.habit};
    const notebook={id:ids.notebook,user_id:v.owner,name:"Native holder notebook",project_id:null,position:0,deleted_at:null,deletion_batch_id:null,created_at:v.at,updated_at:v.at};
    const page={id:ids.page,user_id:v.owner,notebook_id:ids.notebook,parent_id:null,origin_capture_id:ids.pageCapture,title:"Native holder page",normalized_title:"native holder page",document:{type:"doc",content:[{type:"paragraph",content:[]}]},content_text:"",version:1,position:0,archived_at:null,deleted_at:null,deletion_batch_id:null,created_at:v.at,updated_at:v.at};
    const link={id:ids.link,user_id:v.owner,from_type:"page",from_id:ids.page,to_type:"file",to_id:files.page,deleted_at:null,created_at:v.at,updated_at:v.at};
    const guards=fileKeys.map(key=>`not exists(select 1 from public.drive_files f join app_private.upload_reservations r on r.user_id=f.user_id and r.id=f.id and r.file_id=f.id where f.user_id=${owner} and f.id=${uuid(files[key])} and f.kind=${lit(kinds[key])} and r.kind=f.kind and r.status='finalized' and f.deleted_at is null and f.purged_at is null and f.name='synthetic.png' and f.mime='image/png' and f.bytes=100 and f.width=40 and f.height=20 and f.sha256=${lit("a".repeat(64))})`).join(" or ");
    // Explicit holder fixture; existing projection/validation/constraints run.
    // A Page's file initially has a real Capture attachment, then the source
    // attachment is removed before trashing the Page: only the Page link keeps
    // that image, so this does not accidentally prove the Capture branch twice.
    sql=`do $image_holders$ declare n integer;begin
      if current_user<>'postgres' or not exists(select 1 from auth.users where id=${owner} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) or ${guards} then raise exception 'Original finalized holder fixtures required.' using errcode='42501';end if;
      perform app_private.capture_task_lock(${owner});
      update public.profiles set avatar_file_id=${uuid(files.avatar)} where user_id=${owner};get diagnostics n=row_count;if n<>1 then raise exception 'One fixture profile required.' using errcode='23514';end if;
      update public.user_preferences set home_focus_file_id=${uuid(files.home)} where user_id=${owner};get diagnostics n=row_count;if n<>1 then raise exception 'One fixture preference required.' using errcode='23514';end if;
      insert into public.projects(payload) values(${json(project)});
      insert into public.habits(payload) values(${json(habit)});
      insert into public.captures(payload) values(${json(capture(ids.capture,files.capture))}),(${json(capture(ids.pageCapture,files.page))});
      insert into public.knowledge_notebooks(id,user_id,payload) values(${uuid(ids.notebook)},${owner},${json(notebook)});
      insert into public.knowledge_pages(id,user_id,payload) values(${uuid(ids.page)},${owner},${json(page)});
      insert into public.links(id,user_id,payload) values(${uuid(ids.link)},${owner},${json(link)});
      update public.captures set payload=jsonb_set(payload,'{attachments}','[]'::jsonb) where user_id=${owner} and id=${uuid(ids.pageCapture)};get diagnostics n=row_count;if n<>1 then raise exception 'One fixture origin required.' using errcode='23514';end if;
      update public.knowledge_pages set payload=payload||jsonb_build_object('version',2,'deleted_at',${lit(v.at)},'deletion_batch_id',${uuid(ids.deletionBatch)}) where user_id=${owner} and id=${uuid(ids.page)};get diagnostics n=row_count;if n<>1 then raise exception 'One fixture Page required.' using errcode='23514';end if;
      if exists(select 1 from public.capture_file_links where user_id=${owner} and file_id=${uuid(files.page)}) or not app_private.capture_e4_image_holder(${owner},${uuid(files.page)}) then raise exception 'Page must hold independently of Capture.' using errcode='23514';end if;
      end $image_holders$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";writing=true;
  } else if (action === "IMAGE_ASSERT_HOLDERS") {
    const v=nativeRecord(nativeData(data),["owner","files"],"SQL_REFUSED"),owner=uuid(v.owner),keys=["avatar","capture","project","home","habit","page","goal","archivedGoal"],files=nativeRecord(v.files,keys,"SQL_REFUSED");for(const file of Object.values(files))uuid(file);if(new Set(Object.values(files)).size!==8)nativeRefuse("SQL_REFUSED");
    const previous=keys.slice(0,6).map(key=>`not app_private.fgi_previous_image_referenced(${owner},${uuid(files[key])})`).join(" or ");
    const current=keys.map(key=>`not app_private.entity_image_referenced(${owner},${uuid(files[key])})`).join(" or ");
    sql=`do $image_holder_oracle$ begin if current_user<>'postgres' or ${previous} or ${current} or app_private.fgi_previous_image_referenced(${owner},${uuid(files.goal)}) or app_private.fgi_previous_image_referenced(${owner},${uuid(files.archivedGoal)}) then raise exception 'Complete old and Goal holder chains required.' using errcode='23514';end if;end $image_holder_oracle$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";
  } else if (action === "IMAGE_FIXTURE_FIRST_PASS" || action === "IMAGE_FIXTURE_TOMBSTONE") {
    const fields=action==="IMAGE_FIXTURE_TOMBSTONE"?["owner","uploadId","batchId"]:["owner","uploadId"],v=nativeRecord(data,fields,"SQL_REFUSED"),owner=uuid(v.owner),upload=uuid(v.uploadId);if(action==="IMAGE_FIXTURE_TOMBSTONE")uuid(v.batchId);
    const change=action==="IMAGE_FIXTURE_FIRST_PASS"?`update app_private.upload_reservations set cleaned_at=null where user_id=${owner} and id=${upload};get diagnostics n=row_count;if n<>1 then raise exception 'One original upload fixture required.' using errcode='23514';end if;`:`update public.drive_files set payload=payload||jsonb_build_object('deleted_at',now(),'deletion_batch_id',${uuid(v.batchId)},'updated_at',now(),'modified_at',now()) where user_id=${owner} and id=${upload};get diagnostics n=row_count;if n<>1 or not app_private.entity_image_referenced(${owner},${upload}) then raise exception 'One retained holder fixture required.' using errcode='23514';end if;`;
    // ADVERSARIAL setup for an otherwise unreachable defensive ACK branch;
    // never asserted to be a legitimate application operation or file proof.
    sql=`do $image_adversarial$ declare r app_private.upload_reservations;f public.drive_files;n integer;begin
      if current_user<>'postgres' or not exists(select 1 from auth.users where id=${owner} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) then raise exception 'Original native owner required.' using errcode='42501';end if;
      perform 1 from auth.users where id=${owner} for share;perform app_private.capture_task_lock(${owner});
      select * into r from app_private.upload_reservations where id=${upload} and user_id=${owner} for update;
      select * into f from public.drive_files where id=${upload} and user_id=${owner} for update;
      if r.id is null or f.id is null or r.file_id is distinct from f.id or r.id is distinct from f.id or r.status is distinct from 'finalized' or r.kind is distinct from f.kind or r.expires_at>=now() or r.lease_until is not null or f.purged_at is not null or f.deleted_at is not null or not app_private.entity_image_referenced(${owner},${upload}) then raise exception 'Finalized retained original fixture required.' using errcode='23514';end if;
      ${change}end $image_adversarial$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";writing=true;
  } else if (action === "IMAGE_FAULT_INSTALL" || action === "IMAGE_FAULT_REMOVE") {
    const v=nativeRecord(data,["owner","goalId"],"SQL_REFUSED"),owner=uuid(v.owner),goal=uuid(v.goalId);
    const change=action==="IMAGE_FAULT_INSTALL"?`if to_regprocedure('app_private.test_fgi_native_event_refusal()') is not null or exists(select 1 from app_private.finance_goals where id=${goal}) then raise exception 'Clean uncommitted fault fixture required.' using errcode='23514';end if;
      create function app_private.test_fgi_native_event_refusal() returns trigger language plpgsql set search_path='' as $known_fault$ begin raise exception 'Synthetic image native post-projection failure.' using errcode='23514';end $known_fault$;
      comment on function app_private.test_fgi_native_event_refusal() is ${lit(context.namespace+":"+v.owner+":"+v.goalId)};
      revoke all on function app_private.test_fgi_native_event_refusal() from public,anon,authenticated,service_role;
      create trigger test_fgi_native_event_refusal before insert on public.domain_events for each row when(new.entity_type='finance_goal' and new.user_id=${owner} and new.entity_id=${goal}) execute function app_private.test_fgi_native_event_refusal();`:`if to_regprocedure('app_private.test_fgi_native_event_refusal()') is null or obj_description('app_private.test_fgi_native_event_refusal()'::regprocedure,'pg_proc') is distinct from ${lit(context.namespace+":"+v.owner+":"+v.goalId)} then raise exception 'Armed original fault fixture required.' using errcode='23514';end if;drop trigger test_fgi_native_event_refusal on public.domain_events;drop function app_private.test_fgi_native_event_refusal();`;
    sql=`do $image_fault_fixture$ begin if current_user<>'postgres' or not exists(select 1 from auth.users where id=${owner} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) then raise exception 'Native fault owner required.' using errcode='42501';end if;${change}end $image_fault_fixture$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";writing=true;
  } else if (action === "IMAGE_ASSERT_PRIVATE_DENIED") {
    const v=nativeRecord(data,["owner","uploadId"],"SQL_REFUSED"),owner=uuid(v.owner),upload=uuid(v.uploadId);
    sql=`do $image_private_denials$ declare r text;caught boolean;begin
      if current_user<>'postgres' or not exists(select 1 from auth.users where id=${owner} and raw_app_meta_data->>'sc_goal_native_fixture'=${lit(context.namespace)}) or app_private.fg_image(${owner},${upload}) is null then raise exception 'Valid native private oracle fixture required.' using errcode='23514';end if;
      foreach r in array array['anon','authenticated','service_role'] loop
       execute format('set local role %I',r);caught:=false;
       begin perform app_private.fg_image(${owner},${upload});exception when insufficient_privilege then caught:=true;end;
       set local role postgres;if not caught then raise exception 'Private image helper unexpectedly callable.' using errcode='23514';end if;
       execute format('set local role %I',r);caught:=false;
       begin perform 1 from app_private.finance_goals;exception when insufficient_privilege then caught:=true;end;
       set local role postgres;if not caught then raise exception 'Private Goal table unexpectedly readable.' using errcode='23514';end if;
      end loop;end $image_private_denials$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";
  } else if (action === "IMAGE_ASSERT_DENIED" || action === "IMAGE_ASSERT_FAULT") {
    const fields=action==="IMAGE_ASSERT_FAULT"?["owner","session","request"]:["owner","session","request","mode"],v=nativeRecord(nativeData(data),fields,"SQL_REFUSED");uuid(v.owner);uuid(v.session);
    const request=nativeRecord(v.request,["request","expected_finance_revision","context","changes","events","receipt"],"SQL_REFUSED");
    if(request.request?.command!=="finance.goal.create"||!Array.isArray(request.changes)||request.changes.length!==1||!Array.isArray(request.events)||request.events.length!==1)nativeRefuse("SQL_REFUSED");
    const mode=action==="IMAGE_ASSERT_FAULT"?"fault":v.mode;if(typeof mode!=="string"||!["foreign-owner","foreign-session","purpose","fault"].includes(mode)||action==="IMAGE_ASSERT_DENIED"&&mode==="fault")nativeRefuse("SQL_REFUSED");
    const expectedState=mode==="fault"?"23514":mode==="purpose"?"22023":"42501",expectedMessage=mode==="fault"?"Synthetic image native post-projection failure.":mode==="purpose"?"New goal image is not finalized for this purpose.":null;
    const messageCheck=expectedMessage===null?"":`or sqlerrm is distinct from ${lit(expectedMessage)}`;
    // The public RPC is REAL. Its work is isolated in a PostgreSQL exception
    // subtransaction; expected failure rolls back projections/revisions/quota.
    // Missing or different errors are refused. Material is compared externally.
    sql=`do $image_expected_refusal$ declare caught boolean:=false;begin
      if current_user<>'service_role' then raise exception 'Service wrapper path required.' using errcode='42501';end if;
      begin perform public.finance_goals_commit(${uuid(v.owner)},${uuid(v.session)},'finance.goal.create'::text,${json(request)});
      exception when others then if sqlstate is distinct from ${lit(expectedState)} ${messageCheck} then raise;end if;caught:=true;end;
      if not caught then raise exception 'Expected native refusal was not observed.' using errcode='23514';end if;
      end $image_expected_refusal$;\n@FRAME@jsonb_build_object('ack','fixture')`;expected="fixture";writing=true;
  } else if (action === "IMAGE_MATERIAL") {
    const v = nativeRecord(data, ["a", "b"], "SQL_REFUSED"), a = uuid(v.a), b = uuid(v.b); if (v.a === v.b) nativeRefuse("SQL_REFUSED");
    sql = `jsonb_build_object('ack','material','a',${imageMaterial(a)},'b',${imageMaterial(b)})`; expected = "material";
  } else if (action === "IMAGE_ABSENCE") {
    const v = nativeRecord(data, ["a", "b"], "SQL_REFUSED"), a = uuid(v.a), b = uuid(v.b); if (v.a === v.b) nativeRefuse("SQL_REFUSED");
    const relations = ["auth.users", "auth.sessions", ...Object.values(materialTables), "public.drive_files", "app_private.upload_reservations", ...Object.values(imageHolderTables)];
    sql = `jsonb_build_object('ack','absence','absent',${relations.map(table => `not exists(select 1 from ${table} where ${table === "auth.users" ? "id" : "user_id"} in (${a},${b}))`).join(" and ")} and to_regprocedure('app_private.test_fgi_native_event_refusal()') is null and not exists(select 1 from pg_trigger where tgrelid='public.domain_events'::regclass and tgname='test_fgi_native_event_refusal'))`; expected = "absence";
  } else nativeRefuse("SQL_REFUSED");
  const ticket = Object.freeze({ kind: "goal-native-statement", action });
  statements.set(ticket, Object.freeze({ ...context, action, sql, writing, transition: null, expected, expectation })); return ticket;
}

/** D3-only append. The complete fa4 N12/I8 SQL above stays byte-for-byte intact. */
const distinctTables = Object.freeze({ series: "app_private.finance_series", occurrences: "app_private.finance_series_occurrences", permits: "app_private.finance_series_permits", categories: "public.fin_categories", tags: "public.fin_tags", transactionTags: "public.fin_transaction_tags", budgets: "public.fin_budgets" });
function distinctMaterial(owner) {
  const rows = Object.entries(distinctTables).map(([key, table]) => `${lit(key)},(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from ${table} x where x.user_id=${owner})`);
  return `(${ownerMaterial(owner)}||jsonb_build_object(${rows.join(",")}))`;
}
/** Three closed actions share the original nominal registry, context and ACKs. */
export function goalDistinctNativeStatement(contextInput, action, data = {}) {
  const context = nativeSqlContext(contextInput); let sql, writing = false, expected, expectation = null;
  if (action === "SERIES_RPC") {
    const v = nativeRecord(data, ["rpc", "owner", "session", "operation", "request"]);
    if (!["finance_series_snapshot", "finance_series_commit"].includes(v.rpc) || !["finance.recurring.create", "finance.recurring.materialize"].includes(v.operation) || v.request === null || typeof v.request !== "object") nativeRefuse("SQL_REFUSED");
    const owner = uuid(v.owner), session = uuid(v.session); expected = "rpc"; expectation = Object.freeze({ rpc: v.rpc }); writing = v.rpc === "finance_series_commit";
    sql = `jsonb_build_object('ack','rpc','rpc',${lit(v.rpc)},'value',public.${v.rpc}(${owner},${session},${writing ? lit(v.operation) + "::text," : ""}${json(v.request)}))`;
  } else if (action === "DISTINCT_MATERIAL") {
    const v = nativeRecord(data, ["a", "b"]), a = uuid(v.a), b = uuid(v.b); if (v.a === v.b) nativeRefuse("SQL_REFUSED"); expected = "material";
    sql = `jsonb_build_object('ack','material','a',${distinctMaterial(a)},'b',${distinctMaterial(b)})`;
  } else if (action === "DISTINCT_ABSENCE") {
    const v = nativeRecord(data, ["a", "b"]), a = uuid(v.a), b = uuid(v.b); if (v.a === v.b) nativeRefuse("SQL_REFUSED"); expected = "absence";
    const relations = ["auth.users", "auth.sessions", ...Object.values(materialTables), ...Object.values(distinctTables)];
    sql = `jsonb_build_object('ack','absence','absent',${relations.map(table => `not exists(select 1 from ${table} where ${table === "auth.users" ? "id" : "user_id"} in (${a},${b}))`).join(" and ")})`;
  } else nativeRefuse("SQL_REFUSED");
  const ticket = Object.freeze({ kind: "goal-native-statement", action });
  statements.set(ticket, Object.freeze({ ...context, action, sql, writing, transition: null, expected, expectation })); return ticket;
}
