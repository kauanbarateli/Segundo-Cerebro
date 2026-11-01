import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('SAME_BROWSER_SOURCE_REFUSED');};
const hashes=Object.freeze({
 foundation:'aca4ef373aec1ad3c2ddce859d412a5454e1cb06f457e395fdab5fbada6cacff',
 composition:'39abb9b4af679d761f6bd05388f9d5a85b10fa7dc66cb5f91ccfd671f89d119e',
 fixture:'47a07cae9e0686b8d98168e9f2a60c90532d735fa1cef22686f0a620d6f07a59',
 seed:'d49f5436440bcf0b733f1cdfbc084f76ab5767ba20c420a229b9378b3071d6a0',
});
const scratch="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
const rollout="DO $rollout_block$ BEGIN RAISE EXCEPTION 'CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED'; END $rollout_block$;";
const signatures=[
 ['create function app_private.signup_intent_create(','\nend $$;'],
 ['create function app_private.signup_pending_identity(','\n$$;'],
 ['create function app_private.admission_new_identity(','\nend $$;'],
 ['CREATE FUNCTION app_private.draft_completion_context(','\nEND $$;'],
 ['CREATE FUNCTION app_private.draft_reserve_completion(','\nEND $$;'],
 ['CREATE FUNCTION app_private.signup_prune()','\nEND $$;'],
 ['create function app_private.signup_recover_verified_intent(','\nend $$;'],
 ['create function public.signup_recover_verified_intent(','$$;'],
];
/** Derive a synthetic fixture only from exact reviewed local bytes. Caller must
 * already have independently qualified an isolated offline PG17 instance. */
export function qualifySameBrowser({foundation,composition,fixture,seed}){
 for(const [name,bytes] of Object.entries({foundation,composition,fixture,seed}))if(!Buffer.isBuffer(bytes)||sha(bytes)!==hashes[name])fail();
 const source=foundation.toString('utf8');const definitions=signatures.map(([start,end])=>{
  if(source.split(start).length!==2)fail();const from=source.indexOf(start),to=source.indexOf(end,from);
  if(to<0)fail();return source.slice(from,to+end.length);
 });
 const candidate=composition.toString('utf8'),header=`BEGIN;\n${scratch}\n${rollout}\n`;
 if(candidate.split(scratch).length!==2||candidate.split(rollout).length!==2||candidate.split(header).length!==2||!candidate.trimEnd().endsWith('COMMIT;'))fail();
 const install=`begin;\n${definitions.join('\n')}\n`+
  'revoke all on function app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text),app_private.admission_new_identity() from public,anon,authenticated,service_role;\n'+
  'grant execute on function app_private.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) to service_role;\n'+
  'create trigger second_brain_admission_created after insert on auth.users for each row execute function app_private.admission_new_identity();\ncommit;\n';
 return Object.freeze({fixture:Buffer.from(fixture),seed:Buffer.from(seed),foundation:Buffer.from(install),composition:Buffer.from(candidate.replace(header,'BEGIN;\n'))});
}
