// Pure guard transformation: does not execute SQL, load PGlite or read remote data.
export const GUARD="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
export function removeScratchGuard(candidate){
 if(typeof candidate!=='string')throw Error('candidate must be a string');
 const sequence=`BEGIN;\n${GUARD}\n`;
 if(candidate.split(GUARD).length!==2 || candidate.split(sequence).length!==2 || !candidate.trimEnd().endsWith('COMMIT;')) throw Error('guard is not bound to exactly one transaction');
 return candidate.replace(sequence,'BEGIN;\n');
}
