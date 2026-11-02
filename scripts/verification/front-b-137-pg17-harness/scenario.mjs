/** Inert SQL-scenario builder. It never opens a process, database or network.
 * Only a reviewed, network-disabled, identity-bound runner may consume it. */
import { createHash } from 'node:crypto';

const SQL_SHA='1e1733ed87573597220a7082536b091987f39726719fba8332de7a71ed4d19f7';
const FIXTURE_SHA='cdfc55d85535dc4cbe18d38ebc431f0c67786650d43ed3d4d3dc6f12ee019114';
const sha=b=>createHash('sha256').update(b).digest('hex');
const refused=()=>{throw Error('SYNTHETIC_SCENARIO_REFUSED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const source=(bytes,hash)=>{
 if(!Buffer.isBuffer(bytes)||bytes.length>100_000||sha(bytes)!==hash||bytes.includes(0))refused();
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{refused();}
 // Conservative: no psql meta-commands, including in comments or literals.
 if(text.includes('\\'))refused();return text;
};
export function buildScenario(input){
 if(!exact(input,['nonce','systemIdentifier','candidateBytes','fixtureBytes'])||typeof input.nonce!=='string'||!/^[a-f0-9]{32}$/.test(input.nonce)||typeof input.systemIdentifier!=='string'||!/^[0-9]{16,20}$/.test(input.systemIdentifier))refused();
 const text=source(input.candidateBytes,SQL_SHA),fixture=source(input.fixtureBytes,FIXTURE_SHA);
 const head="-- DRAFT ONLY. Depends on the reviewed admission/origin candidate; not a migration.\nbegin;\ndo $$ begin raise exception 'DRAFT_ONLY: nao autorizado para execucao'; end $$;\n";
 const tail='commit;\n',marker='-- SC_INSERT_VERIFIED_FUNCTION_HERE';
 if(!text.startsWith(head)||!text.endsWith(tail)||fixture.split(marker).length!==2)refused();
 // This in-memory transform never writes or modifies the guarded candidate.
 const functionSql=text.slice(head.length,-tail.length);
 const guard=`begin;\ndo $sc_guard$ begin if current_user<>'postgres' or current_database()<>'sc_metrics_fixture' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::int<170000 or current_setting('server_version_num')::int>=180000 or (select system_identifier::text from pg_control_system())<>'${input.systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${input.nonce}' and system_identifier='${input.systemIdentifier}')<>1 or exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role')) or to_regnamespace('auth') is not null or to_regnamespace('app_private') is not null or to_regclass('public.profiles') is not null then raise exception 'SYNTHETIC_TARGET_REFUSED'; end if; end $sc_guard$;\n`;
 return guard+fixture.replace(marker,()=>functionSql)+"\nrollback;\nselect 'SC_METRICS_SYNTHETIC_OK';\n";
}
