import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
const registration=await file('./signup-origin-cron-registration.sql.txt');
const health=await file('./signup-origin-retention-health.sql.txt');
// The diagnostic is portable when placed under scripts/verification/ in the repo.
const candidate=await file('../front-b-135-draft/prune.sql.txt');
const admission=await file('../front-b-135-draft/admission.sql.txt');
const hash='cbd79d7ec1fbb93605616e7aa742c8b20ec741e098b7058b244f559add32d726';

test('body pin corresponds to candidate prosrc bytes normalized for CRLF',()=>{
 const match=candidate.match(/CREATE OR REPLACE FUNCTION app_private\.signup_prune\(\) RETURNS jsonb[\s\S]*?AS \$\$([\s\S]*?)\$\$;/);
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
test('guarded admission preserves legacy preflight, catalog pin and fence-aware recovery',()=>{
 assert.match(admission,/begin;\s*do \$scratch_guard\$ begin raise exception 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; end \$scratch_guard\$;/i);
 assert.match(admission,/u\.email_confirmed_at is null\s+and not exists/);
 assert.match(admission,/op\.command='admin\.user\.create' and op\.phase<>'complete'/);
 assert.ok(admission.indexOf('lock table app_private.admin_operations')<admission.indexOf('lock table auth.users'));
 assert.match(admission,/lock table public\.domain_events in access exclusive mode/);
 assert.match(admission,/pg_get_constraintdef\(c\.oid,false\)=/);assert.match(admission,/pg_get_expr\(c\.conbin,c\.conrelid,false\)=/);
 const installed=admission.match(/CREATE FUNCTION app_private\.signup_prune\(\) RETURNS jsonb[\s\S]*?AS \$\$([\s\S]*?)\$\$;/);assert(installed);assert.equal(createHash('sha256').update(installed[1].replaceAll('\r\n','\n'),'utf8').digest('hex'),hash);
 const recovery=admission.slice(admission.indexOf('create function app_private.signup_recover_verified_intent('),admission.indexOf('create function public.signup_recover_verified_intent('));
 for(const s of ['pg_advisory_xact_lock',"to_regclass('app_private.signup_completion_fences_draft')",'f.user_id=p_user','f.intent_id=i.id','delete from app_private.signup_intents'])assert.ok(recovery.includes(s),s);
 assert.ok(recovery.indexOf('pg_advisory_xact_lock')<recovery.indexOf("to_regclass('app_private.signup_completion_fences_draft')"));
 assert.ok(recovery.indexOf('f.user_id=p_user')<recovery.indexOf('delete from app_private.signup_intents'));
 assert.ok(recovery.indexOf('f.intent_id=i.id')<recovery.indexOf('delete from app_private.signup_intents'));
});
