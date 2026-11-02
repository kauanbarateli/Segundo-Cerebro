import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {feedbackReconciliationReady} from '../../src/lib/feedback/reconciliation-gate';
import {HOMOLOGATION_BRANCH,HOMOLOGATION_DATABASE_ORIGIN,HOMOLOGATION_PROJECT,PERSONAL_DATABASE_ORIGIN} from '../../src/lib/environment/application-destination';

const branch='segundo-cerebro-git-homologacao-test.vercel.app';
const baseline:Record<string,string|undefined>={
  SC_FEEDBACK_QA_READY:'true',SC_FRONT_B_SCHEMA_READY:'true',APP_DEPLOYMENT_TARGET:'homologation',
  APP_MODE:'supabase',APP_URL:`https://${branch}`,SUPABASE_URL:HOMOLOGATION_DATABASE_ORIGIN,
  NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',
  VERCEL_PROJECT_ID:HOMOLOGATION_PROJECT,VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'kauanbarateli',
  VERCEL_GIT_REPO_SLUG:'Segundo-Cerebro',VERCEL_GIT_COMMIT_REF:HOMOLOGATION_BRANCH,
  VERCEL_BRANCH_URL:branch,VERCEL_PROJECT_PRODUCTION_URL:'segundo-cerebro.vercel.app',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',SUPABASE_SECRET_KEY:'sb_secret_synthetic',
  AUTH_STATE_SECRET:'a'.repeat(32),AUTH_RATE_LIMIT_SECRET:'b'.repeat(32),
};
function configure(changes:Record<string,string|undefined>={}) {
 for(const [key,value] of Object.entries({...baseline,...changes}))vi.stubEnv(key,value);
}
afterEach(()=>vi.unstubAllEnvs());

describe('feedback rehearsal is restricted to verified QA',()=>{
 it('opens only with both explicit gates and the exact approved preview configuration',()=>{
  configure();expect(feedbackReconciliationReady()).toBe(true);
 });
 it.each([
  ['missing feedback opt-in',{SC_FEEDBACK_QA_READY:undefined}],
  ['non-exact opt-in',{SC_FEEDBACK_QA_READY:'TRUE'}],
  ['missing schema gate',{SC_FRONT_B_SCHEMA_READY:undefined}],
  ['personal database',{SUPABASE_URL:PERSONAL_DATABASE_ORIGIN}],
  ['different project',{VERCEL_PROJECT_ID:'prj_different'}],
  ['different branch',{VERCEL_GIT_COMMIT_REF:'main'}],
  ['production',{VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production'}],
  ['untrusted application origin',{APP_URL:'https://other.example'}],
  ['invalid host',{VERCEL_BRANCH_URL:'segundo-cerebro.vercel.app'}],
  ['demo',{APP_MODE:'demo'}],
  ['missing secret',{AUTH_STATE_SECRET:undefined}],
 ])('fails closed for %s',(_label,changes)=>{
  configure(changes);expect(feedbackReconciliationReady()).toBe(false);
 });
 it('never opens for an ordinary production configuration even with both flags',()=>{
  configure({APP_DEPLOYMENT_TARGET:undefined,SUPABASE_URL:PERSONAL_DATABASE_ORIGIN,
   APP_URL:'https://segundocerebroapp.com.br',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',
   VERCEL_GIT_COMMIT_REF:'main'});
  expect(feedbackReconciliationReady()).toBe(false);
 });
});
