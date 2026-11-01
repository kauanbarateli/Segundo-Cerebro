// PGlite disposable demonstration only. No native concurrency claim or release approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
if(args.length===0||args.length===1&&args[0]==='--help'){
 process.stdout.write(JSON.stringify({code:'NO_DATABASE_STARTED',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');
}else if(args.length!==1||args[0]!=='--execute'||process.env.SC_FRONT_B_028_DIAGNOSTIC!=='1'){
 process.stdout.write(JSON.stringify({code:'OPT_IN_REQUIRED',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');process.exitCode=1;
}else if((await import('node:os')).freemem()<1024**3){
 process.stdout.write(JSON.stringify({code:'INSUFFICIENT_MEMORY',purpose:'DIAGNOSTIC_NOT_VALIDATION'})+'\n');process.exitCode=1;
}else{
 process.stdout.write(JSON.stringify({code:'DIAGNOSTIC_ONLY',purpose:'RISK_DEMONSTRATION_NOT_MIGRATION_VALIDATION',nativeConcurrencyVerified:false})+'\n');
 const {createCatalogueFixture}=await import(new URL('../../../tests/scripts/helpers/catalogue-fixture.mjs',import.meta.url));
 const {readCurrent27CanonicalMigrations}=await import(new URL('../../../tests/helpers/canonical-release-source.mjs',import.meta.url));
const root=new URL('../../../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const candidate=await read('supabase/operations/candidates/20261101020254_public_admission_gate.sql');
const catalogue=await read('supabase/tests/release-catalog.sql');
assert.equal(candidate.length,31936);assert.equal(hash(candidate),'e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519');
assert.equal(catalogue.length,207834);assert.equal(hash(catalogue),'19b5f158dfd2003fa89285df99f4ab2e0287ee411b07b9a6b0bc7e6fb82f6e9e');
const raw=catalogue.toString('utf8'),delim='$finance27$',start=raw.indexOf(delim),end=raw.indexOf(delim,start+delim.length);
assert.ok(start>=0&&end>start);assert.equal(raw.indexOf(delim,end+delim.length),-1);
const expected=JSON.parse(raw.slice(start+delim.length,end)).eventPredicate;
assert.equal(expected.relation,'public.domain_events');assert.equal(expected.name,'domain_events_entity_type_check');
assert.ok(typeof expected.expression==='string'&&expected.expression.length>0&&typeof expected.definition==='string'&&expected.definition.length>0);

const descriptor=`select jsonb_build_object('definition',pg_get_constraintdef(c.oid,false),'expression',pg_get_expr(c.conbin,c.conrelid,false),'type',c.contype::text,'validated',c.convalidated,'local',c.conislocal,'noInherit',c.connoinherit,'inheritCount',c.coninhcount,'parent',c.conparentid::integer,'deferrable',c.condeferrable,'deferred',c.condeferred) value from pg_constraint c where c.conrelid='public.domain_events'::regclass and c.conname='domain_events_entity_type_check'`;
const expectedDescriptor={definition:expected.definition,expression:expected.expression,type:'c',validated:true,local:true,noInherit:false,inheritCount:0,parent:0,deferrable:false,deferred:false};
const literal=s=>"'"+s.replaceAll("'","''")+"'";
// Design only. Insert immediately before the candidate's read, after its
// timeout setup and earlier locks. This does not prove the full lock order.
const guard=`lock table public.domain_events in access exclusive mode;
do $sc_027_pin$ begin
 if not exists(select 1 from pg_constraint c where c.conrelid='public.domain_events'::regclass and c.conname='domain_events_entity_type_check' and c.contype='c' and c.convalidated and c.conislocal and not c.connoinherit and c.coninhcount=0 and c.conparentid=0 and not c.condeferrable and not c.condeferred and pg_get_constraintdef(c.oid,false)=${literal(expected.definition)} and pg_get_expr(c.conbin,c.conrelid,false)=${literal(expected.expression)}) then
  raise exception 'historical domain event constraint refused' using errcode='23514';
 end if;
end $sc_027_pin$;\n`;
const candidateText=candidate.toString('utf8');
const target='do $$ declare expression text; begin\n select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint';
assert.equal(candidateText.split(target).length,2);
assert.ok(candidateText.indexOf("set local lock_timeout='5s';")<candidateText.indexOf(target));
assert.ok(candidateText.indexOf('lock table auth.users in share row exclusive mode;')<candidateText.indexOf(target));
const guarded=candidateText.replace(target,guard+target);
async function setup(){const db=await createCatalogueFixture();try{for(const row of await readCurrent27CanonicalMigrations(fileURLToPath(root)))await db.exec(row.source.toString('utf8'));return db;}catch(error){await db.close();throw error;}}
async function readConstraint(db){const rows=(await db.query(descriptor)).rows;assert.equal(rows.length,1);return rows[0].value;}
async function allowed(db,value){const expression=(await readConstraint(db)).expression;return (await db.query(`select (${expression}) as allowed from (select $1::text as entity_type) probe`,[value])).rows[0].allowed;}
async function poison(db){await db.exec('alter table public.domain_events drop constraint domain_events_entity_type_check; alter table public.domain_events add constraint domain_events_entity_type_check check(true);');}

test('028 atual preserva constraint adulterada; controle fixo a recusa em transação descartável',{timeout:60000},async()=>{
 let db=await setup();
 try{
  assert.deepEqual(await readConstraint(db),expectedDescriptor);
  assert.equal(await allowed(db,'profile'),true);assert.equal(await allowed(db,'sc_unreviewed_entity'),false);
  await poison(db);assert.equal(await allowed(db,'sc_unreviewed_entity'),true);
  await db.exec(candidateText);assert.equal(await allowed(db,'signup_admission'),true);assert.equal(await allowed(db,'sc_unreviewed_entity'),true);
  assert.equal((await db.query("select to_regclass('app_private.user_admission') is not null present")).rows[0].present,true);
 }finally{await db.close();}

 db=await setup();
 try{
  await poison(db);const before=await readConstraint(db);
  await assert.rejects(db.exec(guarded),error=>error?.code==='23514'&&/historical domain event constraint refused/.test(error.message));
  await db.exec('rollback;');assert.deepEqual(await readConstraint(db),before);
  assert.equal((await db.query("select to_regclass('app_private.user_admission') is null absent")).rows[0].absent,true);
 }finally{await db.close();}

 db=await setup();
 try{
  assert.deepEqual(await readConstraint(db),expectedDescriptor);
  await db.exec(guarded);assert.equal(await allowed(db,'profile'),true);assert.equal(await allowed(db,'signup_admission'),true);assert.equal(await allowed(db,'signup_origin'),true);assert.equal(await allowed(db,'sc_unreviewed_entity'),false);
 }finally{await db.close();}
});

}
