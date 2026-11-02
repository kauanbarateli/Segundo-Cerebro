// Offline, guarded drafting only; no database or network access.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url);
const read=async name=>(await readFile(new URL(name,dir),'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const replaceOnce=(s,a,b)=>{if(s.split(a).length!==2)throw Error('DRAFT_SOURCE_MISMATCH');return s.replace(a,()=>b);};
const original=await read('cutover-218-observed-ledger.guarded.sql.txt');
const extension=await read('extend-freeze-four-tables.guarded.sql.txt');
if(sha(original)!=='3d00f3b2f81edfff0dcd01b3837a11925ebdcb3ed542ebe8158e2a28e8d0a17c'||sha(extension)!=='eb9cc8f05bb36437689a9c84c6dbd5653845390fc9cabf3f8ad41bf91e636d0e')throw Error('DRAFT_PIN_MISMATCH');
let out=original;
out=replaceOnce(out,'LOCK TABLE app_private.signup_intents,app_private.signup_origins IN ACCESS EXCLUSIVE MODE;',`LOCK TABLE app_private.signup_completion_fences_draft,app_private.signup_intents,app_private.signup_origins,app_private.user_admission IN ACCESS EXCLUSIVE MODE;
DO $extension_pending_guard$ BEGIN RAISE EXCEPTION 'STOP: four-table extension ledger identity and statement not observed or qualified'; END $extension_pending_guard$;
DO $extension_identity_guard$
DECLARE v constant text := '__FOUR_TABLE_VERSION_PENDING__'; n constant text := '__FOUR_TABLE_NAME_PENDING__'; h constant text := '__FOUR_TABLE_STATEMENT_SHA256_PENDING__';
BEGIN
 IF v !~ '^[0-9]{14}$' OR v <= '20261102100908'
 OR n !~ '^[a-z0-9_]{1,63}$' OR n = 'sc218_quarantine_install_20261102'
 OR h !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'STOP: extension identity not qualified';
 END IF;
END $extension_identity_guard$;`);
out=replaceOnce(out,"version IS DISTINCT FROM '20261102100908' OR name IS DISTINCT FROM 'sc218_quarantine_install_20261102'","(version IS DISTINCT FROM '20261102100908' OR name IS DISTINCT FROM 'sc218_quarantine_install_20261102') AND (version IS DISTINCT FROM '__FOUR_TABLE_VERSION_PENDING__' OR name IS DISTINCT FROM '__FOUR_TABLE_NAME_PENDING__')");
out=replaceOnce(out," OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations\n  WHERE name='sc218_ledger_probe_20261102_5e81f9ab') THEN", " OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='__FOUR_TABLE_VERSION_PENDING__' AND name='__FOUR_TABLE_NAME_PENDING__' AND cardinality(statements)=1 AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='__FOUR_TABLE_STATEMENT_SHA256_PENDING__')\n OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations\n  WHERE name='sc218_ledger_probe_20261102_5e81f9ab') THEN");
out=replaceOnce(out,"e.name IN ('signup_intents','signup_origins') AND t.tgname='sc_cutover_freeze_038f'","e.name IN ('signup_completion_fences_draft','signup_intents','signup_origins','user_admission') AND t.tgname='sc_cutover_freeze_038f'");
const start='do $freeze_check$ declare fn oid; begin',end='end $freeze_check$;';
const a=extension.lastIndexOf(start),b=extension.indexOf(end,a)+end.length;
if(a<0||b<a||extension.slice(a,b).indexOf('t.tgfoid=fn and not t.tgisinternal)<>4')<0)throw Error('DRAFT_FREEZE_MISMATCH');
const newCheck=extension.slice(a,b),first=out.indexOf(start),last=out.indexOf(end,first)+end.length;
if(first<0||last<first)throw Error('DRAFT_FREEZE_MISMATCH');
const oldCheck=out.slice(first,last);if(out.split(oldCheck).length!==3)throw Error('DRAFT_FREEZE_MISMATCH');
out=out.split(oldCheck).join(newCheck);
out=replaceOnce(out,'DO $cutover_guard$ BEGIN RAISE EXCEPTION',"DO $empty_guard$ BEGIN IF EXISTS(SELECT 1 FROM app_private.signup_intents) OR EXISTS(SELECT 1 FROM app_private.signup_origins) OR EXISTS(SELECT 1 FROM app_private.signup_completion_fences_draft) THEN RAISE EXCEPTION 'STOP: QA nonempty'; END IF; END $empty_guard$;\nDO $cutover_guard$ BEGIN RAISE EXCEPTION");
await writeFile(new URL('cutover-218-four-table.DRAFT.guarded.sql.txt',dir),out,{flag:'wx'});
process.stdout.write(sha(out)+'\n');
