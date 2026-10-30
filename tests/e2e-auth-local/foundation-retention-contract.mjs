// Finite native retention contract. Importing it starts no I/O or process.
const tickets = new WeakMap();
const HEX = /^[a-f0-9]{64}$/u, UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export const RETENTION_CASES = Object.freeze(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
export const RETENTION_NATIVE_LIMITS = Object.freeze({ sessionMs: 120000, actionMs: 15000, inputBytes: 65536, frameBytes: 131072, sessionBytes: 1048576, stderrBytes: 16384 });
export class RetentionNativeError extends Error {
  constructor(code, sqlRefusal = null) { super(code); this.name = 'RetentionNativeError'; this.code = code; this.sqlRefusal = sqlRefusal; }
}
export function retentionRefuse(code = 'RETENTION_REFUSED') { throw new RetentionNativeError(code); }
export function retentionRecord(input, keys, code = 'RETENTION_REFUSED') {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) retentionRefuse(code);
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) retentionRefuse(code);
  const result = {};
  for (const key of keys) { const p = Object.getOwnPropertyDescriptor(input, key); if (!p || !Object.hasOwn(p, 'value')) retentionRefuse(code); result[key] = p.value; }
  return result;
}
export function retentionData(input, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 4096 || depth > 12) retentionRefuse('FRAME_REFUSED');
  if (input === null || typeof input === 'boolean' || typeof input === 'string' && input.length <= 98304) return input;
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (Array.isArray(input)) {
    if (input.length > 1024 || Reflect.ownKeys(input).length !== input.length + 1) retentionRefuse('FRAME_REFUSED');
    return Array.from({ length: input.length }, (_, index) => { const p = Object.getOwnPropertyDescriptor(input, String(index)); if (!p || !Object.hasOwn(p, 'value')) retentionRefuse('FRAME_REFUSED'); return retentionData(p.value, depth + 1, budget); });
  }
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) retentionRefuse('FRAME_REFUSED');
  const keys = Reflect.ownKeys(input); if (keys.length > 64 || keys.some(key => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))) retentionRefuse('FRAME_REFUSED');
  const out = {};
  for (const key of keys) { const p = Object.getOwnPropertyDescriptor(input, key); if (!p || !Object.hasOwn(p, 'value')) retentionRefuse('FRAME_REFUSED'); out[key] = retentionData(p.value, depth + 1, budget); }
  return out;
}
export function retentionSqlContext(input) {
  const c = retentionRecord(input, ['namespace', 'sourceSha', 'systemIdentifier', 'projectId'], 'INSTANCE_REFUSED');
  if (Object.values(c).some(value => typeof value !== 'string') || !/^sc-retention-native-[a-f0-9]{32}$/u.test(c.namespace) || !/^[a-f0-9]{40}$/u.test(c.sourceSha)
    || !/^[0-9]{16,20}$/u.test(c.systemIdentifier ?? '') || !/^sc-auth-ci-[a-f0-9]{24}$/u.test(c.projectId ?? '')) retentionRefuse('INSTANCE_REFUSED');
  return Object.freeze(c);
}
const lit = value => { if (typeof value !== 'string' || value.includes('\0')) retentionRefuse('SQL_REFUSED'); return `'${value.replaceAll("'", "''")}'`; };
const uuid = value => { if (typeof value !== 'string' || !UUID.test(value)) retentionRefuse('SQL_REFUSED'); return `${lit(value)}::uuid`; };
const setting = key => `current_setting('sc_retention.${key}')`;
const actor = key => `${setting(key)}::uuid`;
const a = actor('owner_a'), b = actor('owner_b'), sa = actor('session_a');
const round = `(${setting('binding')}::jsonb->>'roundId')::uuid`;
const json = value => `convert_from(decode('${Buffer.from(JSON.stringify(retentionData(value)), 'utf8').toString('hex')}','hex'),'UTF8')::jsonb`;
const result = expression => `@FRAME@jsonb_build_object('ack',@ACK@,'value',${expression})`;
const frameAfter = (sql, expression = "'{}'::jsonb") => `${sql}\n${result(expression)}`;
const emptyArgs = data => retentionRecord(data, [], 'SQL_REFUSED');
function actorGuard(c) {
  const foundation = 'sc-foundation-' + c.namespace.slice(-32);
  return `do $scope$ begin if current_user<>'postgres' or current_database()<>'postgres' or current_setting('server_version_num')::integer not between 170000 and 179999 or (select system_identifier::text from pg_control_system())<>${lit(c.systemIdentifier)} or (select count(*) from sc_ci_foundation.marker where namespace=${lit(foundation)} and source_sha=${lit(c.sourceSha)} and project_id=${lit(c.projectId)} and system_identifier=${lit(c.systemIdentifier)})<>1 then raise exception 'Retention instance refused.' using errcode='42501';end if;end $scope$;`;
}
const ownedActors = `do $actors$ begin if ${a}=${b} or (select count(*) from auth.users)<>2 or (select count(*) from auth.users where id in(${a},${b}) and raw_app_meta_data->>'sc_retention_native_fixture'=${setting('namespace')})<>2 or (select count(*) from auth.sessions)<>2 or (select count(*) from auth.sessions where (id=${sa} and user_id=${a}) or (id=${actor('session_b')} and user_id=${b}))<>2 or exists(select 1 from public.user_roles where role<>'user') or exists(select 1 from public.user_moderation where status<>'active' or must_change_password) or exists(select 1 from public.user_entitlements) then raise exception 'Retention actors refused.' using errcode='42501';end if;end $actors$;`;
function prepareProfile() {
  return `do $profile$ declare snap jsonb;r jsonb;draft jsonb;save_request jsonb;plan jsonb;pending jsonb;binding jsonb;rid text;revision text;begin
    if current_setting('sc_retention.case') not in('R01','R02','R03') or exists(select 1 from app_private.onboarding_rounds) then raise exception 'Retention fixture refused.';end if;
    perform public.onboarding_call(${a},${sa},'start',jsonb_build_object('clientId',gen_random_uuid()));
    snap:=public.onboarding_call(${a},${sa},'snapshot','{}');r:=snap->'round';rid:=r->>'id';revision:=snap->'profile'->>'revision';
    draft:=jsonb_build_object('profile',jsonb_build_object('displayName','Retenção nativa sintética'),'habits','[]'::jsonb,'projects','[]'::jsonb,'tasks','[]'::jsonb,'notes',null);
    save_request:=jsonb_build_object('roundId',rid,'expectedRevision',r->>'revision','clientId',gen_random_uuid(),'step','summary','draft',draft);
    perform public.onboarding_call(${a},${sa},'save',save_request);perform set_config('sc_retention.save_request',save_request::text,false);
    snap:=public.onboarding_call(${a},${sa},'snapshot','{}');r:=snap->'round';
    if current_setting('sc_retention.case')='R01' then perform set_config('sc_retention.binding',jsonb_build_object('roundId',rid)::text,false);return;end if;
    plan:=jsonb_build_array(jsonb_build_object('slot','profile:'||rid,'itemKey',rid,'kind','profile','command','settings.profile.v2.update','input',jsonb_build_object('client_id','onb:'||rid||':profile:'||rid||':v1','expectedRevision',revision,'patch',draft->'profile'),'choice',jsonb_build_object('kind','profile','patch',draft->'profile','expectedProfileRevision',revision),'bindings','[]'::jsonb,'extras','{}'::jsonb,'ordinal',0));
    perform public.onboarding_call(${a},${sa},'prepare',jsonb_build_object('roundId',rid,'expectedRevision',r->>'revision','clientId',gen_random_uuid(),'plan',plan));
    pending:=public.onboarding_call(${a},${sa},'peek_intent',jsonb_build_object('roundId',rid));binding:=pending-array['kind','slot','itemKey','command','input','choice','bindings','extras','ordinal'];
    perform public.onboarding_call(${a},${sa},'bind_intent',binding||jsonb_build_object('canonicalInput',(pending->'input')::text));perform set_config('sc_retention.binding',binding::text,false);
  end $profile$;`;
}
function prepareVersions() {
  return `do $versions$ declare owner uuid;rid uuid;item uuid;expiry timestamptz;body jsonb;anchor timestamptz:=clock_timestamp();begin
    if current_setting('sc_retention.case') not in('R04','R05','R06') or exists(select 1 from app_private.onboarding_rounds) or exists(select 1 from app_private.onboarding_write_permits) then raise exception 'Retention versions refused.';end if;
    for n in 1..102 loop owner:=case when n<=100 then ${a} else ${b} end;rid:=md5(${setting('namespace')}||':round:'||n)::uuid;item:=md5(${setting('namespace')}||':item:'||n)::uuid;expiry:=anchor-interval '1 second'+n*interval '1 millisecond';
      insert into app_private.onboarding_rounds(id,user_id,status,step,draft,profile_revision,edited_at,expires_at) values(rid,owner,'complete','summary','{"profile":{},"habits":[],"projects":[],"tasks":[],"notes":null}',app_private.onboarding_profile(owner)->>'revision',expiry-interval '720 hours',expiry);
      for version in 1..3 loop body:=jsonb_build_object('client_id','onb:'||rid||':project:'||item||':v'||version,'name','Payload sintético vencido');
        insert into app_private.onboarding_intents(id,user_id,round_id,slot,item_key,kind,command,input,bound_input,bindings,extras,ordinal,expected_fingerprint,choice,intent_version,active,dependency_slots,status)
        values(md5(${setting('namespace')}||':intent:'||n||':'||version)::uuid,owner,rid,'project:'||item,item,'project','project.create',body,body,'[]','{"context":"personal"}',0,encode(sha256(convert_to(body::text,'UTF8')),'hex'),'{"kind":"project","name":"Payload sintético vencido","context":"personal"}',version,version=3,'{}','unknown');
      end loop;
    end loop;
    if (select count(*) from app_private.onboarding_rounds)<>102 or (select count(*) from app_private.onboarding_intents)<>306 then raise exception 'Retention count refused.';end if;
  end $versions$;`;
}
// Only the two exact expected expiry events of B's synthetic rounds101/102
// have their own counters. Every other B event remains in the invariant hash.
const expectedRetentionEvent = `${setting('case')} in('R04','R05','R06') and e.user_id=${b} and e.entity_type='onboarding_round' and e.action='updated' and e.canal='web' and e.entity_id in(md5(${setting('namespace')}||':round:101')::uuid,md5(${setting('namespace')}||':round:102')::uuid) and e.before is null and e.after=jsonb_build_object('id',e.entity_id,'user_id',${b},'status','expired','step','summary','revision','1','counts',jsonb_build_object('blocked',1))`;
const baseline = `jsonb_build_object('profileHash',(select encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') from public.profiles p where user_id=${a}),'receiptHash',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by command,client_id),'[]')::text,'UTF8')),'hex') from app_private.command_receipts r where user_id=${a} and command='settings.profile.v2.update'),'receiptCount',(select count(*)::integer from app_private.command_receipts where user_id=${a} and command='settings.profile.v2.update'),'profileEvents',(select count(*)::integer from public.domain_events where user_id=${a} and entity_type='profile' and action='updated'),'foreignHash',(select encode(sha256(convert_to(jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where user_id=${b}),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.domain_events e where user_id=${b} and (${expectedRetentionEvent}) is not true),'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by command,client_id),'[]') from app_private.command_receipts x where user_id=${b}))::text,'UTF8')),'hex')),'retentionEvents',(select count(*)::integer from public.domain_events e where ${expectedRetentionEvent}),'retentionEventRounds',(select count(distinct e.entity_id)::integer from public.domain_events e where ${expectedRetentionEvent}))`;
const health = `(select jsonb_build_object('observedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'health',h||jsonb_build_object('lastStartedAt',to_char((h->>'lastStartedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'lastCompletedAt',to_char((h->>'lastCompletedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'oldestDueAt',to_char((h->>'oldestDueAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) from (select app_private.onboarding_retention_health() h) observed)`;
const postflight = `jsonb_build_object('rounds',(select count(*)::integer from app_private.onboarding_rounds),'versions',(select count(*)::integer from app_private.onboarding_intents),'expired',(select count(*)::integer from app_private.onboarding_rounds where status='expired'),'payload',(select count(*)::integer from app_private.onboarding_intents where input is not null or bound_input is not null or choice is not null or extras<>'{}' or bindings<>'[]'),'drafts',(select count(*)::integer from app_private.onboarding_rounds where draft is not null),'permits',(select count(*)::integer from app_private.onboarding_write_permits)+(select count(*)::integer from app_private.onboarding_oauth where permit_backend_pid is not null or permit_xact_id is not null),'foreignRounds',(select count(*)::integer from app_private.onboarding_rounds where user_id not in(${a},${b})),'cursorCleared',not exists(select 1 from app_private.onboarding_retention_state where cursor_expires is not null or cursor_round is not null))`;
const absenceTables = Object.freeze({ users: 'auth.users', sessions: 'auth.sessions', refreshTokens: 'auth.refresh_tokens', identities: 'auth.identities', profiles: 'public.profiles', preferences: 'public.user_preferences', modules: 'public.user_modules', roles: 'public.user_roles', moderation: 'public.user_moderation', entitlements: 'public.user_entitlements', events: 'public.domain_events', receipts: 'app_private.command_receipts', rateLimits: 'app_private.rate_limits where user_id is not null', focus: 'app_private.profile_focus', entries: 'app_private.onboarding_entries', rounds: 'app_private.onboarding_rounds', intents: 'app_private.onboarding_intents', permits: 'app_private.onboarding_write_permits', oauth: 'app_private.onboarding_oauth', flows: 'app_private.google_oauth_flows', commands: 'app_private.onboarding_commands' });

export function retentionStatement(contextInput, action, data = {}) {
  const c = retentionSqlContext(contextInput); let sql, writing = false, transition = null, expected = 'result', requires = 'any';
  if (action === 'IDENTITY') {
    emptyArgs(data); expected = 'identity'; requires = 'idle';
    sql = `jsonb_build_object('namespace',${lit(c.namespace)},'sourceSha',${lit(c.sourceSha)},'projectId',${lit(c.projectId)},'systemIdentifier',(select system_identifier::text from pg_control_system()),'database',current_database(),'sessionUser',session_user,'currentUser',current_user,'serverVersion',current_setting('server_version_num')::integer,'pid',pg_backend_pid(),'applicationName',current_setting('application_name'),'bound',(select count(*)=1 from sc_ci_foundation.marker where namespace=${lit('sc-foundation-' + c.namespace.slice(-32))} and source_sha=${lit(c.sourceSha)} and project_id=${lit(c.projectId)} and system_identifier=${lit(c.systemIdentifier)}))`;
  } else if (['BEGIN', 'BEGIN_WAITING_COMMIT'].includes(action)) {
    emptyArgs(data); requires = 'idle'; transition = 'open'; expected = 'begin';
    sql = `begin isolation level read committed;set local statement_timeout='15s';set local lock_timeout='${action === 'BEGIN' ? '5s' : '12s'}';set local idle_in_transaction_session_timeout='30s';\n@FRAME@jsonb_build_object('ack','begin','role',current_user,'isolation',current_setting('transaction_isolation'))`;
  } else if (['COMMIT', 'ROLLBACK'].includes(action)) {
    emptyArgs(data); requires = 'open'; transition = 'idle'; expected = action.toLowerCase();
    sql = `${action.toLowerCase()};\n@FRAME@jsonb_build_object('ack',${lit(expected)})`;
  } else if (action === 'BIND_ACTORS') {
    const v = retentionRecord(data, ['a', 'sa', 'b', 'sb', 'caseId'], 'SQL_REFUSED'); for (const key of ['a', 'sa', 'b', 'sb']) uuid(v[key]);
    if (new Set([v.a, v.sa, v.b, v.sb]).size !== 4 || !RETENTION_CASES.includes(v.caseId)) retentionRefuse('SQL_REFUSED');
    requires = 'idle';
    const values = { namespace: c.namespace, owner_a: v.a, session_a: v.sa, owner_b: v.b, session_b: v.sb, case: v.caseId };
    sql = frameAfter(actorGuard(c) + Object.entries(values).map(([key, value]) => `do $bind$ begin perform set_config('sc_retention.${key}',${lit(value)},false);end $bind$;`).join('') + ownedActors);
  } else if (action === 'BIND_ROUND') {
    const v = retentionRecord(data, ['roundId'], 'SQL_REFUSED'); uuid(v.roundId); requires = 'idle';
    sql = frameAfter(`do $bind$ begin if not exists(select 1 from app_private.onboarding_rounds where id=${uuid(v.roundId)} and user_id=${a}) then raise exception 'Retention round refused.';end if;perform set_config('sc_retention.binding',${json({ roundId: v.roundId })}::text,false);end $bind$;`);
  } else {
    emptyArgs(data);
    if (action === 'PREPARE_PROFILE') { requires = 'open'; writing = true; sql = frameAfter(actorGuard(c) + ownedActors + prepareProfile(), `${setting('binding')}::jsonb`); }
    else if (action === 'PREPARE_VERSIONS') { requires = 'open'; writing = true; sql = frameAfter(actorGuard(c) + ownedActors + prepareVersions(), "jsonb_build_object('rounds',102,'versions',306)"); }
    else if (action === 'SET_NEAR_DEADLINE' || action === 'EXPIRE_BOUND') {
      writing = true; requires = 'open';
      sql = frameAfter(`do $expiry$ declare anchor timestamptz:=clock_timestamp()${action === 'SET_NEAR_DEADLINE' ? "+interval '10 seconds'" : "-interval '1 second'"};n integer;begin update app_private.onboarding_rounds set edited_at=anchor-interval '720 hours',expires_at=anchor where user_id=${a} and id=${round};get diagnostics n=row_count;if n<>1 then raise exception 'Retention scope refused.';end if;end $expiry$;`);
    } else if (action === 'READ_DEADLINE') sql = result(`(select jsonb_build_object('due',clock_timestamp()>=expires_at,'exact720h',expires_at-edited_at=interval '720 hours','deadlineHash',encode(sha256(convert_to(jsonb_build_array(edited_at,expires_at)::text,'UTF8')),'hex')) from app_private.onboarding_rounds where user_id=${a} and id=${round})`);
    else if (action === 'SNAPSHOT') sql = result(`jsonb_build_object('snapshot',public.onboarding_call(${a},${sa},'snapshot','{}'))`);
    else if (action === 'PAUSE') { writing = true; requires = 'open'; sql = result(`public.onboarding_call(${a},${sa},'pause',jsonb_build_object('roundId',${round},'expectedRevision',(select revision::text from app_private.onboarding_rounds where id=${round} and user_id=${a}),'clientId',gen_random_uuid()))`); }
    else if (action === 'REPLAY_SAVE') { writing = true; requires = 'open'; sql = result(`public.onboarding_call(${a},${sa},'save',${setting('save_request')}::jsonb)`); }
    else if (action === 'PROFILE_COMMIT') { writing = true; requires = 'open'; sql = result(`public.onboarding_call(${a},${sa},'profile_update',${setting('binding')}::jsonb)`); }
    else if (action === 'LOCK_USER_SHARE_AND_ADVISORY') { requires = 'open'; sql = frameAfter(`do $lock$ begin perform 1 from auth.users where id=${a} for share;perform pg_advisory_xact_lock(hashtextextended('capture-task:'||${a}::text,0));end $lock$;`); }
    else if (action === 'LOCK_AUTH_PARENT_UPDATE') { requires = 'open'; sql = frameAfter(`do $lock$ begin perform 1 from auth.users where id=${a} for update;end $lock$;`); }
    else if (action === 'BLOCK_BOUND_ACTOR') { requires = 'open'; writing = true; sql = frameAfter(`do $blocked$ declare n integer;begin if current_setting('sc_retention.case')<>'R05' or (select count(*) from auth.users where id=${a} and raw_app_meta_data->>'sc_retention_native_fixture'=${setting('namespace')})<>1 then raise exception 'Retention scope refused.';end if;update public.user_moderation set status='blocked',must_change_password=true where user_id=${a};get diagnostics n=row_count;if n<>1 then raise exception 'Retention scope refused.';end if;end $blocked$;`, `(select jsonb_build_object('blocked',status='blocked' and must_change_password) from public.user_moderation where user_id=${a})`); }
    else if (action === 'LOCK_GLOBAL_SWEEP') { requires = 'open'; sql = frameAfter("do $lock$ begin perform pg_advisory_xact_lock(hashtextextended('sc-onboarding-retention-v1',0));end $lock$;"); }
    else if (action === 'SWEEP') { writing = true; sql = result('app_private.onboarding_retention_sweep()'); }
    else if (action === 'HEALTH') sql = result(health);
    else if (action === 'BASELINE') sql = result(baseline);
    else if (action === 'POSTFLIGHT') sql = result(postflight);
    else if (action === 'BACKDATE') { requires = 'open'; writing = true; sql = frameAfter(`do $expiry$ declare anchor timestamptz:=clock_timestamp()-interval '121 seconds';n integer;begin update app_private.onboarding_rounds r set edited_at=anchor-interval '720 hours',expires_at=anchor from generate_series(1,102) item(n) where r.id=md5(${setting('namespace')}||':round:'||item.n)::uuid and r.user_id=case when item.n<=100 then ${a} else ${b} end;get diagnostics n=row_count;if n<>102 then raise exception 'Retention scope refused.';end if;end $expiry$;`); }
    else if (action === 'ACL') sql = result(`jsonb_build_object('invoker',not(select prosecdef from pg_proc where oid='app_private.onboarding_retention_sweep()'::regprocedure),'denied',not exists(select 1 from unnest(array['anon','authenticated','service_role']) role where has_function_privilege(role,'app_private.onboarding_retention_sweep()','EXECUTE') or has_function_privilege(role,'app_private.onboarding_retention_health()','EXECUTE') or has_table_privilege(role,'app_private.onboarding_retention_state','SELECT,INSERT,UPDATE,DELETE')))`);
    else if (action === 'ABSENCE') sql = result(`jsonb_build_object(${Object.entries(absenceTables).map(([key, table]) => `${lit(key)},(select count(*)::integer from ${table})`).join(',')})`);
    else if (action === 'BACKENDS') sql = result(`jsonb_build_object('other',(select count(*)::integer from pg_stat_activity where pid<>pg_backend_pid() and left(application_name,${('sc.retention.native.' + c.namespace.slice(-32) + '.').length})=${lit('sc.retention.native.' + c.namespace.slice(-32) + '.')}))`);
    else retentionRefuse('SQL_REFUSED');
  }
  if (expected === 'result') sql = sql.replaceAll('@ACK@', lit(action));
  const ticket = Object.freeze({ kind: 'retention-native-statement', action });
  tickets.set(ticket, Object.freeze({ ...c, action, sql, writing, transition, expected, expectation: null, requires })); return ticket;
}
export function retentionBlockingStatement(contextInput, waiter, winner) {
  const c = retentionSqlContext(contextInput);
  if (![waiter, winner].every(value => Number.isSafeInteger(value) && value > 1 && value <= 2147483647) || waiter === winner) retentionRefuse('SQL_REFUSED');
  const action = 'PROVE_A_BLOCKED', ticket = Object.freeze({ kind: 'retention-native-statement', action });
  const value = `jsonb_build_object('blocked',pg_blocking_pids(${waiter})=array[${winner}]::integer[],'advisory',exists(select 1 from pg_locks w join pg_locks h on h.locktype=w.locktype and h.database is not distinct from w.database and h.classid=w.classid and h.objid=w.objid and h.objsubid=w.objsubid where w.pid=${waiter} and h.pid=${winner} and w.locktype='advisory' and w.mode='ExclusiveLock' and h.mode='ExclusiveLock' and not w.granted and h.granted))`;
  tickets.set(ticket, Object.freeze({ ...c, action, sql: result(value).replaceAll('@ACK@', lit(action)), writing: false, transition: null, expected: 'result', expectation: null, requires: 'open' })); return ticket;
}
export function inspectRetentionStatement(ticket, contextInput) {
  const c = retentionSqlContext(contextInput), value = tickets.get(ticket);
  if (!value || Object.keys(c).some(key => c[key] !== value[key])) retentionRefuse('SQL_REFUSED');
  return value;
}
export function frameRetentionNativeStatement(ticket, contextInput, nonce, sequence) {
  const statement = inspectRetentionStatement(ticket, contextInput);
  if (typeof nonce !== 'string' || !/^[a-f0-9]{32}$/u.test(nonce) || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 512) retentionRefuse('FRAME_REFUSED');
  const prefix = `SC_RETENTION_NATIVE:${nonce}:${sequence}:`, render = expression => `select ${lit(prefix)}||(${expression})::text;\n`;
  const split = statement.sql.indexOf('@FRAME@');
  const input = split < 0 ? render(statement.sql) : statement.sql.slice(0, split) + render(statement.sql.slice(split + 7));
  if (Buffer.byteLength(input) > RETENTION_NATIVE_LIMITS.inputBytes) retentionRefuse('SQL_REFUSED');
  return Object.freeze({ ...statement, prefix, input });
}
// Private control channel supports only these three fixed observer operations.
// There is no caller-supplied SQL, target, expression or output destination.
export function retentionObserverInput(ticket, contextInput) {
  const s = inspectRetentionStatement(ticket, contextInput);
  if (!['ABSENCE', 'BACKENDS', 'SWEEP'].includes(s.action) || s.expected !== 'result' || s.sql.indexOf('@FRAME@') !== 0) retentionRefuse('SQL_REFUSED');
  return `begin${s.writing ? '' : ' read only'};set local statement_timeout='15s';set local lock_timeout='5s';select (${s.sql.slice(7)})::jsonb->'value';${s.writing ? 'commit' : 'rollback'};`;
}
export function assertRetentionAbsence(input) {
  const v = retentionRecord(input, Object.keys(absenceTables), 'CLEANUP_UNCONFIRMED');
  if (Object.values(v).some(value => value !== 0)) retentionRefuse('CLEANUP_UNCONFIRMED');
  return true;
}
export function assertRetentionBaseline(value) {
  const v = retentionRecord(value, ['profileHash', 'receiptHash', 'receiptCount', 'profileEvents', 'foreignHash', 'retentionEvents', 'retentionEventRounds']);
  if (!['profileHash', 'receiptHash', 'foreignHash'].every(key => typeof v[key] === 'string' && HEX.test(v[key])) || !['receiptCount', 'profileEvents'].every(key => Number.isSafeInteger(v[key]) && v[key] >= 0 && v[key] <= 1)
    || !['retentionEvents', 'retentionEventRounds'].every(key => Number.isSafeInteger(v[key]) && v[key] >= 0 && v[key] <= 2)) retentionRefuse('MATERIAL_REFUSED');
  return Object.freeze(v);
}
export function assertRetentionPostflight(value, rounds) {
  const v = retentionRecord(value, ['rounds', 'versions', 'expired', 'payload', 'drafts', 'permits', 'foreignRounds', 'cursorCleared']);
  if (v.rounds !== rounds || v.versions !== (rounds === 102 ? 306 : rounds === 1 ? 1 : 0) || v.expired !== rounds || v.payload !== 0 || v.drafts !== 0 || v.permits !== 0 || v.foreignRounds !== 0 || typeof v.cursorCleared !== 'boolean') retentionRefuse('MATERIAL_REFUSED');
  return v;
}

const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) retentionRefuse('HEALTH_REFUSED');
  return Date.parse(value);
};
export function inspectRetentionHealth(input) {
  const v = retentionRecord(input, ['observedAt', 'health']), now = instant(v.observedAt);
  const h = retentionRecord(v.health, ['lastStartedAt', 'lastCompletedAt', 'lastCode', 'durationMs', 'visited', 'cleaned', 'skipped', 'failed', 'dueCount', 'oldestDueAt', 'expiredPayloadCount', 'residualPermitCount']);
  for (const key of ['visited', 'cleaned', 'skipped', 'failed']) if (h[key] !== null && (!Number.isSafeInteger(h[key]) || h[key] < 0 || h[key] > 100)) retentionRefuse('HEALTH_REFUSED');
  for (const key of ['dueCount', 'expiredPayloadCount', 'residualPermitCount']) if (!Number.isSafeInteger(h[key]) || h[key] < 0 || h[key] > 1024) retentionRefuse('HEALTH_REFUSED');
  const started = h.lastStartedAt === null ? null : instant(h.lastStartedAt), ended = h.lastCompletedAt === null ? null : instant(h.lastCompletedAt), oldest = h.oldestDueAt === null ? null : instant(h.oldestDueAt);
  if (![null, 'OK', 'PARTIAL'].includes(h.lastCode) || started !== null && started > now || ended !== null && (started === null || ended < started || ended > now) || oldest !== null && oldest > now || (h.dueCount === 0) !== (oldest === null)
    || h.durationMs !== null && (typeof h.durationMs !== 'number' || !Number.isFinite(h.durationMs) || h.durationMs < 0 || h.durationMs > 15000)) retentionRefuse('HEALTH_REFUSED');
  return Object.freeze({ ...h, observedAt: v.observedAt, oldestLagSeconds: oldest === null ? null : (now - oldest) / 1000,
    clean: ended !== null && h.lastCode === 'OK' && h.failed === 0 && h.dueCount === 0 && h.expiredPayloadCount === 0 && h.residualPermitCount === 0 && now - ended <= 120000 });
}
export function blankRetentionReport() {
  return { schemaVersion: 1, scenario: 'foundation-retention-native', status: 'failed', code: 'NOT_RUN',
    cases: RETENTION_CASES.map(id => ({ id, status: 'not-run', code: 'NOT_RUN', checks: { identity: false, material: false, transactions: false, cleanup: false }, sqlState: null, lagViolationObserved: false })),
    writeOutcomeUncertain: false, pendingProcesses: 0, cleanupConfirmed: false, autonomousRetentionAccepted: false, hostedValidated: false, productionValidated: false };
}
export function validateRetentionReport(input) {
  const value = retentionData(input), v = retentionRecord(value, Object.keys(blankRetentionReport()), 'REPORT_REFUSED');
  if (v.schemaVersion !== 1 || v.scenario !== 'foundation-retention-native' || !['passed', 'failed'].includes(v.status) || !['PASSED', 'NOT_RUN', 'CASE_REFUSED', 'CLEANUP_UNCONFIRMED', 'WRITE_OUTCOME_UNCERTAIN'].includes(v.code)
    || !Array.isArray(v.cases) || v.cases.length !== 7 || typeof v.writeOutcomeUncertain !== 'boolean' || !Number.isSafeInteger(v.pendingProcesses) || v.pendingProcesses < 0 || v.pendingProcesses > 2 || typeof v.cleanupConfirmed !== 'boolean'
    || v.autonomousRetentionAccepted !== false || v.hostedValidated !== false || v.productionValidated !== false) retentionRefuse('REPORT_REFUSED');
  v.cases.forEach((row, index) => {
    retentionRecord(row, ['id', 'status', 'code', 'checks', 'sqlState', 'lagViolationObserved'], 'REPORT_REFUSED');
    retentionRecord(row.checks, ['identity', 'material', 'transactions', 'cleanup'], 'REPORT_REFUSED');
    if (row.id !== RETENTION_CASES[index] || !['passed', 'failed', 'not-run'].includes(row.status) || !['PASSED', 'NOT_RUN', 'CASE_REFUSED', 'CLEANUP_UNCONFIRMED'].includes(row.code) || Object.values(row.checks).some(x => typeof x !== 'boolean') || ![null, '40001'].includes(row.sqlState) || typeof row.lagViolationObserved !== 'boolean') retentionRefuse('REPORT_REFUSED');
    if (row.status === 'passed' && (row.code !== 'PASSED' || Object.values(row.checks).some(x => !x) || row.sqlState !== (row.id === 'R02' ? '40001' : null) || row.lagViolationObserved !== (row.id === 'R06'))) retentionRefuse('REPORT_REFUSED');
  });
  if (v.status === 'passed' && (v.code !== 'PASSED' || v.writeOutcomeUncertain || v.pendingProcesses !== 0 || !v.cleanupConfirmed || v.cases.some(row => row.status !== 'passed'))) retentionRefuse('REPORT_REFUSED');
  if (v.status === 'failed' && v.code === 'PASSED') retentionRefuse('REPORT_REFUSED');
  return v;
}
