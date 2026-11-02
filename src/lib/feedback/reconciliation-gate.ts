import 'server-only';
import {readAuthConfiguration} from '../auth/config';
import {HOMOLOGATION_DATABASE_ORIGIN, trustedHostedDatabaseOrigin} from '../environment/application-destination';

/** Explicit QA-only rehearsal gate; this is not evidence of cutover readiness. */
export function feedbackReconciliationReady(): boolean {
  if(process.env.SC_FEEDBACK_QA_READY!=='true'||process.env.SC_FRONT_B_SCHEMA_READY!=='true')return false;
  try {
    const config=readAuthConfiguration();
    return config.mode==='supabase' && trustedHostedDatabaseOrigin(config,process.env)===HOMOLOGATION_DATABASE_ORIGIN;
  } catch { return false; }
}
