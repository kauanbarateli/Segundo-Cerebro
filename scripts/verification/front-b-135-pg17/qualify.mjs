import {createHash} from 'node:crypto';
const GUARD="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
const FIXTURE='db35f101300407095589e7279a7af23fc89bad2bab87e302bb3b5cb0673fbbe2';
const ORIGINAL='18288441c5195279ad3b31bb3cf68ededd914fe0121533f8210fbbb33d843dd7';
const CANDIDATE='2ed365eb0943c25d3463b7a8578268d47e1813c39cadcacf3b3eac35094b42bc';
const sha=b=>createHash('sha256').update(b).digest('hex');const bad=()=>{throw Error('SOURCE_REFUSED');};
export function qualifySources(fixture,candidate,original){
 if(![fixture,candidate,original].every(Buffer.isBuffer)||sha(fixture)!==FIXTURE||sha(candidate)!==CANDIDATE||sha(original)!==ORIGINAL)bad();
 let derived=original.toString('utf8');for(const [oldValue,newValue] of [
  ['IF NOT app_private.signup_pending_identity(p_user,p_session) THEN','IF app_private.signup_pending_identity(p_user,p_session) IS NOT TRUE THEN'],
  ["OR v_intent.state <> 'bound' OR (p_require_live AND v_intent.expires_at<=pg_catalog.now()) THEN","OR v_intent.state IS DISTINCT FROM 'bound' OR v_intent.expires_at IS NULL OR (p_require_live AND v_intent.expires_at<=pg_catalog.now()) THEN"],
  ["IF NOT FOUND OR v_admission.origin<>'unclassified' OR v_admission.state<>'pending' THEN","IF NOT FOUND OR v_admission.origin IS DISTINCT FROM 'unclassified' OR v_admission.state IS DISTINCT FROM 'pending' THEN"]
 ]){if(derived.split(oldValue).length!==2)bad();derived=derived.replace(oldValue,newValue);}
 if(!Buffer.from(derived).equals(candidate))bad();const needle=`BEGIN;\n${GUARD}\n`;if(derived.split(needle).length!==2||derived.split(GUARD).length!==2||!derived.trimEnd().endsWith('COMMIT;'))bad();return Object.freeze({fixture:Buffer.from(fixture),candidate:Buffer.from(derived.replace(needle,'BEGIN;\n'))});
}
