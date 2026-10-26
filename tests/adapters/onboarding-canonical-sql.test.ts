/** PROPOSAL: promote only after reviewed026 is installed by the canonical
 * loader. Actual runtime -> actual Core/store -> existing SQL, serial PGlite.
 * Auth catalogue is a fixture; this does not prove GoTrue, hosting, Cron or
 * multi-session PostgreSQL races. No native fetch fallback is ever permitted. */
import {afterEach,expect,it,vi} from "vitest";
import {randomUUID} from "node:crypto";
import {createOnboardingCandidateSql,runOnboardingCandidateAssertions} from "../../tests/helpers/onboarding-candidate-sql";
import type {SupabaseAuthConfig} from "../../src/lib/auth/config";
import type {AuthenticatedIdentity} from "../../src/lib/auth/types";
vi.mock("server-only",()=>({}));
import {onboardingForRequest} from "../../src/adapters/db/onboarding-runtime";

const owner="6b000000-0000-4000-8000-000000000001",session="6b000000-0000-4000-8000-000000000002";
const foreign="6b000000-0000-4000-8000-000000000003",foreignSession="6b000000-0000-4000-8000-000000000004";
const api="https://rishenjoikgmfubmnfiu.supabase.co";
const config:SupabaseAuthConfig={mode:"supabase",appOrigin:"https://onboarding-canonical-sql.test",supabaseUrl:api,secureCookies:true,
 publishableKey:"sb_publishable_SYNTHETIC",secretKey:"sb_secret_SYNTHETIC",stateSecret:"s".repeat(32),rateLimitSecret:"r".repeat(32)};
const actor:AuthenticatedIdentity={userId:owner,sessionId:session,role:"user",mustChangePassword:false,entitlements:{}};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it("real Habit/Project Core crosses the single-use wrapper and native immediate constraints, with replay/rollback/no bypass",async()=>{
 for(const name of ["APP_DEPLOYMENT_TARGET","VERCEL_GIT_COMMIT_REF","VERCEL_ENV","SUPABASE_URL"])vi.stubEnv(name,undefined);
 vi.stubGlobal("fetch",()=>{throw new Error("Only declared in-memory SQL transport is allowed.");});
 const db=await createOnboardingCandidateSql(),trace:{name:string;operation:string}[]=[],moduleBodies:{command:string;body:unknown}[]=[];
 let loseNextModuleReply=false;
 try {
  await runOnboardingCandidateAssertions(db);
  await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','onboarding-owner@example.invalid'),($2,'authenticated','authenticated','onboarding-foreign@example.invalid')",[owner,foreign]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2),($3,$4)",[session,owner,foreignSession,foreign]);
  const transport:typeof fetch=async(input,options)=>{
   const request=new Request(input,options),url=new URL(request.url),args=await request.json();
   expect(url.origin).toBe(api);expect(url.search).toBe("");expect(url.hash).toBe("");expect(request.method).toBe("POST");
   expect(request.headers.get("apikey")).toBe(config.secretKey);expect(request.headers.get("authorization")).toBe("Bearer "+config.secretKey);
   expect(args.p_user).toBe(owner);expect(args.p_session).toBe(session);
   let sql:string,parameters:unknown[],operation:string;
   if(url.pathname==="/rest/v1/rpc/onboarding_call") {
    expect(Object.keys(args).sort()).toEqual(["p_operation","p_request","p_session","p_user"]);
    sql="select public.onboarding_call($1::uuid,$2::uuid,$3::text,$4::jsonb) as value";parameters=[owner,session,args.p_operation,JSON.stringify(args.p_request)];operation=args.p_operation;
   } else if(url.pathname==="/rest/v1/rpc/projects_habits_snapshot") {
    expect(Object.keys(args).sort()).toEqual(["p_operation","p_session","p_user"]);
    sql="select public.projects_habits_snapshot($1::uuid,$2::uuid,$3::text) as value";parameters=[owner,session,args.p_operation];operation=args.p_operation;
   } else if(url.pathname==="/rest/v1/rpc/projects_habits_receipt") {
    expect(Object.keys(args).sort()).toEqual(["p_client_id","p_command","p_operation","p_session","p_user"]);
    sql="select public.projects_habits_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as value";parameters=[owner,session,args.p_operation,args.p_command,args.p_client_id];operation=args.p_operation;
   } else throw new Error("Undeclared RPC, including unwrapped module commit.");
   trace.push({name:url.pathname,operation});
   if(operation==="module_commit")moduleBodies.push({command:String(args.p_request.moduleCommit.receipt.command),body:args.p_request.moduleCommit});
   let value:unknown;
   try {value=(await db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query<{value:unknown}>(sql,parameters);})).rows[0]!.value;}
   catch(error){const code=error&&typeof error==="object"&&"code" in error?String(error.code):"XX000";return Response.json({code,message:"SYNTHETIC_SQL_REFUSAL"},{status:400});}
   if(operation==="module_commit"&&loseNextModuleReply){loseNextModuleReply=false;throw new Error("Synthetic response lost AFTER real SQL commit.");}
   return Response.json(value);
  };
  vi.stubGlobal("fetch",transport);
  const port=onboardingForRequest(config,actor),today=(await db.query<{day:string}>("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0]!.day;
  let snapshot=await port.start({clientId:randomUUID()});expect(snapshot.eligibility.kind).toBe("existing_opt_in");
  const draft={profile:{},habits:[{key:randomUUID(),name:"Hábito real",cadence:"three_per_week" as const,startedOn:today}],projects:[{key:randomUUID(),name:"Projeto real",context:"study" as const}],tasks:[],notes:null};
  let round=snapshot.round!;
  snapshot=await port.save({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID(),draft,step:"summary"});round=snapshot.round!;
  snapshot=await port.confirm({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID()});
  snapshot=await port.advance({roundId:round.id,clientId:randomUUID()});expect(snapshot.round?.status).toBe("executing");
  snapshot=await port.advance({roundId:round.id,clientId:randomUUID()});expect(snapshot.round?.status).toBe("complete");
  expect(snapshot.round?.receipts.map(row=>row.status)).toEqual(["confirmed","confirmed"]);expect(snapshot.recovery).toEqual([]);
  expect((await db.query("select payload->>'schedule_kind' as cadence,payload->'weekdays' as weekdays,payload->>'weekly_target' as target from public.habits where user_id=$1",[owner])).rows).toEqual([{cadence:"weekly_target",weekdays:[],target:"3"}]);
  expect((await db.query("select context from app_private.project_contexts where user_id=$1",[owner])).rows).toEqual([{context:"study"}]);
  expect((await db.query("select entity_type,count(*)::integer as n from public.domain_events where user_id=$1 and entity_type in ('habit','project','project_context') group by entity_type order by entity_type",[owner])).rows).toEqual([{entity_type:"habit",n:1},{entity_type:"project",n:1},{entity_type:"project_context",n:1}]);
  expect((await db.query("select count(*)::integer as n from app_private.onboarding_write_permits")).rows).toEqual([{n:0}]);
  const firstBody=moduleBodies[0]!;
  await expect(db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query("select public.projects_habits_commit($1::uuid,$2::uuid,$3::text,$4::jsonb)",[owner,session,firstBody.command,JSON.stringify(firstBody.body)]);})).rejects.toMatchObject({code:"42501"});
  await port.advance({roundId:round.id,clientId:randomUUID()});
  expect((await db.query("select count(*)::integer as n from app_private.command_receipts where user_id=$1 and command in ('habit.create','project.create')",[owner])).rows).toEqual([{n:2}]);

  // Lost reply still reconciles the same authentic receipt, never a new ID.
  snapshot=await port.start({clientId:randomUUID()});round=snapshot.round!;
  snapshot=await port.save({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID(),draft:{...draft,habits:[],projects:[{key:randomUUID(),name:"Resposta perdida",context:"personal"}]},step:"summary"});round=snapshot.round!;
  await port.confirm({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID()});loseNextModuleReply=true;
  snapshot=await port.advance({roundId:round.id,clientId:randomUUID()});expect(snapshot.round?.status).toBe("complete");
  expect((await db.query("select count(*)::integer as n from public.projects where user_id=$1 and payload->>'name'='Resposta perdida'",[owner])).rows).toEqual([{n:1}]);

  // Failure after the permit was consumed must roll back entity/event/receipt.
  await db.exec("create function pg_temp.reject_onboarding_project_event() returns trigger language plpgsql as $$ begin if new.entity_type='project' then raise exception 'synthetic event refusal' using errcode='P0001';end if;return new;end $$;create trigger t026_reject_project_event before insert on public.domain_events for each row execute function pg_temp.reject_onboarding_project_event();");
  snapshot=await port.start({clientId:randomUUID()});round=snapshot.round!;
  snapshot=await port.save({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID(),draft:{...draft,habits:[],projects:[{key:randomUUID(),name:"Não persistir",context:"work"}]},step:"summary"});round=snapshot.round!;
  await port.confirm({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID()});
  snapshot=await port.advance({roundId:round.id,clientId:randomUUID()});expect(snapshot.round?.status).toBe("partial");
  expect((await db.query("select count(*)::integer as n from public.projects where user_id=$1 and payload->>'name'='Não persistir'",[owner])).rows).toEqual([{n:0}]);
  expect((await db.query("select count(*)::integer as n from app_private.command_receipts where user_id=$1 and client_id like 'onb:'||$2||':%'",[owner,round.id])).rows).toEqual([{n:0}]);
  expect((await db.query("select count(*)::integer as n from public.domain_events where user_id=$1 and entity_type='project' and \"after\"->>'name'='Não persistir'",[owner])).rows).toEqual([{n:0}]);
  expect((await db.query("select count(*)::integer as n from app_private.onboarding_write_permits")).rows).toEqual([{n:0}]);
  await db.exec("drop trigger t026_reject_project_event on public.domain_events");
  expect(trace.filter(row=>row.operation==="module_commit")).toHaveLength(4);
  expect(trace.every(row=>!row.name.endsWith("/projects_habits_commit"))).toBe(true);

  // Public RPC uses caller/session validation, not a foreign owner from JSON.
  await expect(db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query("select public.onboarding_call($1,$2,'snapshot','{}')",[foreign,session]);})).rejects.toMatchObject({code:"42501"});
  expect((await db.query("select count(*)::integer as n from app_private.onboarding_rounds where user_id=$1",[foreign])).rows).toEqual([{n:0}]);
 } finally {await db.close();}
},120_000);

it("version2 habit choices cross the real coordinator/Core/wrapper while legacy3 and outer schema1 remain intact",async()=>{
 for(const name of ["APP_DEPLOYMENT_TARGET","VERCEL_GIT_COMMIT_REF","VERCEL_ENV","SUPABASE_URL"])vi.stubEnv(name,undefined);
 vi.stubGlobal("fetch",()=>{throw new Error("Only declared in-memory SQL transport is allowed.");});
 const db=await createOnboardingCandidateSql();
 try {
  await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','onboarding-frequency@example.invalid')",[owner]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[session,owner]);
  const transport:typeof fetch=async(input,options)=>{
   const request=new Request(input,options),url=new URL(request.url),args=await request.json();
   expect(url.origin).toBe(api);expect(url.search).toBe("");expect(url.hash).toBe("");expect(request.method).toBe("POST");
   expect(request.headers.get("apikey")).toBe(config.secretKey);expect(request.headers.get("authorization")).toBe("Bearer "+config.secretKey);
   expect(args.p_user).toBe(owner);expect(args.p_session).toBe(session);
   let sql:string,parameters:unknown[];
   if(url.pathname==="/rest/v1/rpc/onboarding_call"){
    expect(Object.keys(args).sort()).toEqual(["p_operation","p_request","p_session","p_user"]);
    sql="select public.onboarding_call($1::uuid,$2::uuid,$3::text,$4::jsonb) as value";parameters=[owner,session,args.p_operation,JSON.stringify(args.p_request)];
   }else if(url.pathname==="/rest/v1/rpc/projects_habits_snapshot"){
    expect(Object.keys(args).sort()).toEqual(["p_operation","p_session","p_user"]);
    sql="select public.projects_habits_snapshot($1::uuid,$2::uuid,$3::text) as value";parameters=[owner,session,args.p_operation];
   }else if(url.pathname==="/rest/v1/rpc/projects_habits_receipt"){
    expect(Object.keys(args).sort()).toEqual(["p_client_id","p_command","p_operation","p_session","p_user"]);
    sql="select public.projects_habits_receipt($1::uuid,$2::uuid,$3::text,$4::text,$5::text) as value";parameters=[owner,session,args.p_operation,args.p_command,args.p_client_id];
   }else throw new Error("Undeclared frequency RPC or unwrapped module commit.");
   const value=(await db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query<{value:unknown}>(sql,parameters);})).rows[0]!.value;
   return Response.json(value);
  };
  vi.stubGlobal("fetch",transport);
  const port=onboardingForRequest(config,actor),today=(await db.query<{day:string}>("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0]!.day;
  let value=await port.start({clientId:randomUUID()}),round=value.round!;
  const draft={profile:{},habits:[
   {key:randomUUID(),name:"Dias v2",version:2 as const,cadence:"weekdays" as const,weekdays:[5,1,3],startedOn:today},
   {key:randomUUID(),name:"Meta v2",version:2 as const,cadence:"weekly_target" as const,weeklyTarget:7,startedOn:today},
   {key:randomUUID(),name:"Legado",cadence:"three_per_week" as const,startedOn:today},
  ],projects:[],tasks:[],notes:null};
  value=await port.save({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID(),draft,step:"summary"});round=value.round!;
  expect(value.schemaVersion).toBe(1);expect(round.draft).toEqual(draft);expect(Object.hasOwn(round.draft!.habits[2]!,"version")).toBe(false);
  value=await port.confirm({roundId:round.id,expectedRevision:round.revision,clientId:randomUUID()});
  for(let index=0;index<3;index++)value=await port.advance({roundId:round.id,clientId:randomUUID()});
  expect(value.round?.status).toBe("complete");expect(value.round?.receipts.map(row=>row.status)).toEqual(["confirmed","confirmed","confirmed"]);
  const rows=(await db.query("select payload->>'name' as name,payload->>'schedule_kind' as cadence,payload->'weekdays' as weekdays,payload->>'weekly_target' as target,payload->>'started_on' as day from public.habits where user_id=$1 order by payload->>'name'",[owner])).rows;
  expect(rows).toEqual([
   {name:"Dias v2",cadence:"weekdays",weekdays:[1,3,5],target:null,day:today},
   {name:"Legado",cadence:"weekly_target",weekdays:[],target:"3",day:today},
   {name:"Meta v2",cadence:"weekly_target",weekdays:[],target:"7",day:today},
  ]);
  expect((await db.query("select count(*)::integer n from public.habit_entries where user_id=$1",[owner])).rows).toEqual([{n:0}]);
  expect((await db.query("select count(*)::integer n from public.domain_events where user_id=$1 and entity_type='habit'",[owner])).rows).toEqual([{n:3}]);
  expect((await db.query("select count(*)::integer n from app_private.command_receipts where user_id=$1 and command='habit.create'",[owner])).rows).toEqual([{n:3}]);
  await port.advance({roundId:round.id,clientId:randomUUID()});
  expect((await db.query("select count(*)::integer n from public.habits where user_id=$1",[owner])).rows).toEqual([{n:3}]);
  expect((await db.query("select count(*)::integer n from app_private.onboarding_write_permits")).rows).toEqual([{n:0}]);
 }finally{await db.close();}
},120_000);
