/** New, explicit disposable candidate loader. Never changes the 001–025 helper,
 * installs Cron, accepts remote SQL/credentials, or weakens source pins. */
import {readFile,readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createLocalCanonicalSql} from "./local-canonical-sql";
const root=fileURLToPath(new URL("../../",import.meta.url));
const promoted="20261023061901_onboarding_foundation.sql";
const files=[
 {name:"onboarding-foundation.sql",guard:"do $draft_only$ begin raise exception 'DRAFT_ONLY: onboarding foundation requires review and migration promotion.'; end $draft_only$;"},
 {name:"onboarding-reserved-guards.sql",guard:"do $draft_only$ begin raise exception 'DRAFT_ONLY: reviewed catalog pins required.';end $draft_only$;"},
 {name:"onboarding-retention.sql",guard:"do $draft_only$ begin raise exception 'DRAFT_ONLY: retention requires supervised installation and load/race tests.';end $draft_only$;"},
] as const;
const signatures=["app_private.projects_habits_commit(uuid,uuid,text,jsonb)","app_private.capture_task_commit(uuid,uuid,text,jsonb)","app_private.knowledge_commit(uuid,uuid,text,jsonb)","public.settings_commit(uuid,uuid,jsonb)","app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)"] as const;
const normalize=(value:string)=>value.replaceAll("\r\n","\n");
function exactlyOnce(source:string,needle:string,replacement:string):string {
 const index=source.indexOf(needle);if(index<0||source.indexOf(needle,index+needle.length)!==-1)throw new Error("Candidate boundary changed; independent review required.");
 return source.slice(0,index)+replacement+source.slice(index+needle.length);
}
/** Pure file composition only; output still must pass PostgreSQL's five catalog
 * hash comparisons. No local observed hash may replace a hosted pin. */
export async function prepareOnboardingCandidateSql():Promise<{sql:string;sha256:string}> {
 const metadata:unknown=JSON.parse(await readFile(resolve(root,"tests/fixtures/onboarding-026-catalog-pins.json"),"utf8"));
 if(!metadata||typeof metadata!=="object"||!("projectRef" in metadata)||metadata.projectRef!=="twrydxsdemaykgvdlpyd"||!("operation" in metadata)||metadata.operation!=="read-only-pg-get-functiondef-sha256"||!("schemaApplied" in metadata)||metadata.schemaApplied!==false||!("pins" in metadata)||!Array.isArray(metadata.pins)||metadata.pins.length!==5)throw new Error("Missing reviewed read-only catalog metadata.");
 const pins=new Map<string,string>();
 for(const row of metadata.pins) {
  if(!row||typeof row!=="object"||typeof row.signature!=="string"||typeof row.sha256!=="string"||!/^[a-f0-9]{64}$/.test(row.sha256)||row.security_definer!==true||!Array.isArray(row.proconfig)||row.proconfig.length!==1||row.proconfig[0]!=="search_path=\"\"")throw new Error("Invalid catalog pin.");
  // pg_get_function identity omits public when it is visible in search_path.
  const name=row.signature==="settings_commit(uuid,uuid,jsonb)"?"public."+row.signature:row.signature;
  if(!signatures.includes(name as typeof signatures[number])||pins.has(name))throw new Error("Unexpected or duplicate catalog identity.");pins.set(name,row.sha256);
 }
 const parts:string[]=[];
 for(const file of files) {
  let source=normalize(await readFile(resolve(root,"proposals",file.name),"utf8"));
  source=exactlyOnce(source,file.guard+"\n","");source=exactlyOnce(source,"\nbegin;\n","\n");
  if(!source.endsWith("\nrollback;\n"))throw new Error("Candidate final rollback boundary changed.");source=source.slice(0,-"rollback;\n".length);
  if(file.name==="onboarding-reserved-guards.sql")for(const signature of signatures)source=exactlyOnce(source,"('"+signature+"','',","('"+signature+"','"+pins.get(signature)+"',");
  if(source.includes("raise exception 'DRAFT_ONLY:"))throw new Error("Unreviewed extra draft guard.");parts.push(source);
 }
 const sql="-- Reviewed disposable candidate, composed from three inert proposals. No Cron.\nbegin;\n"+parts.join("\n")+"\ncommit;\n";
 return {sql,sha256:createHash("sha256").update(sql).digest("hex")};
}
export async function createOnboardingCandidateSql() {
 const candidate=await prepareOnboardingCandidateSql();
 const migrations=(await readdir(resolve(root,"supabase/migrations"))).filter(name=>/^\d{14}_.+\.sql$/.test(name)).sort();
 const hasPromoted=migrations.includes(promoted);
 if(migrations.length!==(hasPromoted?26:25)||hasPromoted&&migrations.at(-1)!==promoted)throw new Error("Canonical migration boundary changed; inspect before candidate validation.");
 if(hasPromoted&&normalize(await readFile(resolve(root,"supabase/migrations",promoted),"utf8"))!==candidate.sql)throw new Error("Promoted026 differs from reviewed candidate bytes.");
 const db=await createLocalCanonicalSql();
 try {
  if(!hasPromoted)await db.exec(candidate.sql);
  return db;
 }catch(error){await db.close();throw error;}
}
export async function runOnboardingCandidateAssertions(db:Awaited<ReturnType<typeof createOnboardingCandidateSql>>):Promise<void> {
 const catalog=exactlyOnce(normalize(await readFile(resolve(root,"proposals/onboarding-catalog-assertions.sql"),"utf8")),"do $draft_only$ begin raise exception 'DRAFT_ONLY: review catalog assertions before authorized isolated execution.';end $draft_only$;\n","");
 if(!catalog.endsWith("rollback;\n"))throw new Error("Catalog assertion boundary changed.");await db.exec(catalog);
 const file=resolve(root,"proposals/tests/onboarding-behavior.sql");
 const source=exactlyOnce(normalize(await readFile(file,"utf8")),"do $draft_only$ begin raise exception 'DRAFT_ONLY: onboarding serial assertions require explicit reviewed candidate helper.';end $draft_only$;\n","");
 if(!source.trimStart().startsWith("-- PROPOSAL:")||!source.endsWith("rollback;\n"))throw new Error("Serial assertion boundaries changed.");
 await db.exec(source);
 const {rows}=await db.query<{n:number}>("select count(*)::integer as n from auth.users");if(rows[0]?.n!==0)throw new Error("Serial assertions left Auth fixture rows.");
}
