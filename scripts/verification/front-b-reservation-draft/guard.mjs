import {createHash} from 'node:crypto';

// This digest applies only to the draft SQL bytes reviewed for this diagnostic.
export const DRAFT_SHA256='18288441c5195279ad3b31bb3cf68ededd914fe0121533f8210fbbb33d843dd7';
const PREFIX="BEGIN;\nDO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;\n";
const REPLACEMENT='BEGIN;\n';
export function requireDiagnosticOptIn(flag,nodeVersion){
 if(flag!=='1'||typeof nodeVersion!=='string'||!/^24\./.test(nodeVersion))throw new Error('RESERVATION_DIAGNOSTIC_REFUSED');
}
export function qualifyDraftSql(bytes){
 if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==DRAFT_SHA256)throw new Error('RESERVATION_SQL_REFUSED');
 const sql=bytes.toString('utf8');
 if(!sql.startsWith("-- UNREVIEWED SCRATCH CANDIDATE.")||sql.split(PREFIX).length!==2||!sql.trimEnd().endsWith('COMMIT;'))throw new Error('RESERVATION_SQL_REFUSED');
 return sql.replace(PREFIX,REPLACEMENT);
}
