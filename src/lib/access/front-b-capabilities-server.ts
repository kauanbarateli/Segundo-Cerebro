import 'server-only';
import {readAuthConfiguration} from '@/lib/auth/config';
import {signupEnabled} from '@/lib/auth/signup-http';
import {feedbackReconciliationReady} from '@/lib/feedback/reconciliation-gate';

/** Presentation only; every endpoint and database function enforces its own authorization. */
export function frontBCapabilities() {
 try {
  const config=readAuthConfiguration();
  if(config.mode!=='supabase') return {signup:false,schema:false,updates:false,feedback:false};
  const schema=process.env.SC_FRONT_B_SCHEMA_READY==='true';
  return {signup:schema && signupEnabled(config),schema,updates:true,feedback:schema && feedbackReconciliationReady()};
 } catch { return {signup:false,schema:false,updates:false,feedback:false}; }
}
