// Local review packaging only. Never connects to a database or emits a CLI migration.
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const digest = b => createHash('sha256').update(b).digest('hex');
const source = new URL('../front-b-qa-cutover-persistent-freeze-draft/cutover.guarded.sql.txt', import.meta.url);
const bytes = await readFile(source);
const expected = 'be8aeec7678b03b1036cef3545156c76b5cb960e30f1b849da2909b30b96f65d';
if (digest(bytes) !== expected) throw Error('SOURCE_REFUSED');
const header = '-- REVIEW PACKAGE v1; NOT A CLI MIGRATION. NEVER APPLY. ALL SOURCE GUARDS AND ROLLBACK RETAINED.\n';
await writeFile(new URL('./v1-cutover.guarded.sql.txt', import.meta.url), Buffer.concat([Buffer.from(header), bytes]));
