import 'server-only';
import {readAuthConfiguration} from '../auth/config';
import {HOMOLOGATION_DATABASE_ORIGIN, HOMOLOGATION_PROJECT, PERSONAL_DATABASE_ORIGIN, trustedHostedDatabaseOrigin} from '../environment/application-destination';

/** Explicit release gates do not themselves prove that the database is ready. */
export function feedbackReconciliationReady(): boolean {
  if(process.env.SC_FRONT_B_SCHEMA_READY!=='true')return false;
  try {
    const config=readAuthConfiguration();
    if(config.mode!=='supabase')return false;
    const destination=trustedHostedDatabaseOrigin(config,process.env);
    if(process.env.SC_FEEDBACK_QA_READY==='true' && destination===HOMOLOGATION_DATABASE_ORIGIN)return true;
    return process.env.SC_FEEDBACK_PRODUCTION_READY==='true' && process.env.SC_FEEDBACK_PRODUCTION_SCHEMA_READY==='true' && destination===PERSONAL_DATABASE_ORIGIN &&
      process.env.NODE_ENV==='production' && process.env.VERCEL==='1' && process.env.VERCEL_ENV==='production' &&
      (process.env.VERCEL_TARGET_ENV===undefined || process.env.VERCEL_TARGET_ENV==='production') &&
      process.env.VERCEL_PROJECT_ID===HOMOLOGATION_PROJECT && process.env.VERCEL_GIT_PROVIDER==='github' &&
      process.env.VERCEL_GIT_REPO_OWNER==='kauanbarateli' && process.env.VERCEL_GIT_REPO_SLUG==='Segundo-Cerebro' &&
      process.env.VERCEL_GIT_COMMIT_REF==='main' &&
      (config.appOrigin==='https://segundocerebroapp.com.br' || config.appOrigin==='https://www.segundocerebroapp.com.br');
  } catch { return false; }
}
