import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
const registration=await file('./signup-origin-cron-registration.sql.txt');
const health=await file('./signup-origin-retention-health.sql.txt');
// The diagnostic is portable when placed under scripts/verification/ in the repo.
const candidate=await file('../../../supabase/operations/candidates/20261101020254_public_admission_gate.sql');
const hash='8a0c0c2b6871d750d83596649b59f424204b1bcac0d6192a998c7bfff04ef641';

test('body pin corresponds to candidate prosrc bytes normalized for CRLF',()=>{
 const match=candidate.match(/create function app_private\.signup_prune\(\) returns jsonb language plpgsql security definer set search_path='' as \$\$([\s\S]*?)\$\$;/);
 assert(match);assert.equal(createHash('sha256').update(match[1].replaceAll('\r\n','\n'),'utf8').digest('hex'),hash);
});
test('registration remains fenced with rollback and exact function conditions',()=>{
 assert.match(registration,/begin;\s*do \$draft_only\$ begin raise exception 'DRAFT_ONLY:/);
 assert.match(registration,/rollback;\s*$/);
 for(const piece of [hash,"pg_get_userbyid(p.proowner)='postgres'","p.prokind='f'","p.pronargs=0","p.prosecdef","not p.proisstrict","not p.proretset","not p.proleakproof","p.provolatile='v'","p.proparallel='u'","l.lanname='plpgsql'","ARRAY['search_path=\"\"']","pg_catalog.aclexplode","to_regrole('anon')","to_regrole('authenticated')","to_regrole('service_role')","reviewed_prune is distinct from true","active:=false","Inactive retention job was not confirmed"])assert.ok(registration.includes(piece),piece);
});
test('health query is read-only, constrains named job and does not select content or identifiers',()=>{
 assert.match(health,/begin transaction read only;/i);assert.match(health,/rollback;\s*$/);
 for(const piece of [hash,'function_matches_reviewed_draft','job_count','qualified_job_count','qualified_active_count','last_success_at','last_failure_at','latest_run_status','oldest_origin_deadline','cron.job_run_details'])assert.ok(health.includes(piece),piece);
 assert.equal((health.match(/r\.command=j\.command and r\.username=j\.username and r\.database=j\.database/g)??[]).length,2);
 assert(!health.includes('return_message'));assert(!health.includes('utm_'));assert(!health.includes("'jobid'"));assert(!health.includes("'user_id'"));
});
test('a missing body or ACL pin is detectable by the static checklist',()=>{
 function complete(source){return [hash,'pg_catalog.aclexplode','reviewed_prune is distinct from true'].every(part=>source.includes(part));}
 assert(complete(registration));for(const part of [hash,'pg_catalog.aclexplode','reviewed_prune is distinct from true'])assert(!complete(registration.replaceAll(part,'[removed]')));
});
