// Disposable PGlite 18.3 observation only, NOT a 30-migration release
// classifier. The historical catalogue remains failed; its already-failing
// checks can hide further damage, so both independent verifiers are mandatory.
const signatures=Object.freeze([
 'feedback_list(uuid,uuid,timestamp with time zone,uuid)',
 'feedback_submit(uuid,uuid,uuid,text,text)',
 'signup_attest_password_reset(uuid,uuid,uuid,text)',
 'signup_complete(uuid,uuid,uuid,text,text,text,boolean,text)',
 'signup_discard_pending_origin(uuid,uuid,uuid,text)',
 'signup_find_bound_intent(uuid,uuid,text)',
 'signup_intent_create(text,text,text,text,timestamp with time zone,jsonb,text)',
 'signup_metrics(uuid,uuid,date,date,text,text)',
 'signup_origin_status(uuid,uuid)',
 'signup_origin_withdraw(uuid,uuid)',
 'signup_prune()',
 'signup_recover_verified_intent(uuid,uuid,text,text,text)',
]);
const row=(check,object)=>Object.freeze({check,object});
export const FRONT_B_FIXTURE_DEVIATIONS=Object.freeze([
 row('finance27_domain_events_predicate','public.domain_events.domain_events_entity_type_check'),
 row('onboarding_function','public.onboarding_call(uuid,uuid,text,jsonb)'),
 row('onboarding_relation','app_private.onboarding_entries'),
 ...signatures.filter(value=>!value.startsWith('signup_metrics(')).map(value=>row('service_function_allowlist','app_private.app_private.'+value)),
 ...signatures.map(value=>row('service_function_allowlist','public.'+value)),
]);
const keys=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).sort().join(','):'';
const pairs=values=>values.map(value=>`${value.check}\0${value.object}`).sort();
const expected=pairs(FRONT_B_FIXTURE_DEVIATIONS);
/** Matches the frozen local experiment; true does not approve promotion. */
export function matchesFrontBFixtureObservation(catalogue,patch,additive){
 if(keys(catalogue)!=='checks,deviations,ok,version'||catalogue.ok!==false||catalogue.version!==1||catalogue.checks!==2650||!Array.isArray(catalogue.deviations)||catalogue.deviations.length!==expected.length)return false;
 if(catalogue.deviations.some(value=>keys(value)!=='check,object'||typeof value.check!=='string'||typeof value.object!=='string'))return false;
 if(JSON.stringify(pairs(catalogue.deviations))!==JSON.stringify(expected))return false;
 return keys(patch)==='check,ok'&&patch.check==='onboarding_conflict_patch_pt409'&&patch.ok===true
  &&keys(additive)==='check,failures,ok'&&additive.check==='front_b_additive_catalogue'&&additive.ok===true&&Array.isArray(additive.failures)&&additive.failures.length===0;
}
