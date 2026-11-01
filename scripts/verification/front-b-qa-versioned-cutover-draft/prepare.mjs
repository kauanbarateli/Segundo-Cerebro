// Local review packaging only. Never connects to a database or emits a CLI migration.
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const digest = b => createHash('sha256').update(b).digest('hex');
const source = new URL('../front-b-qa-cutover-persistent-freeze-draft/cutover.guarded.sql.txt', import.meta.url);
const bytes = await readFile(source);
const expected = '68d6bb8677bae3f75ea5955d9a4dbf6688720cd4ec9500f808d527503a528f0f';
if (digest(bytes) !== expected) throw Error('SOURCE_REFUSED');
const header = '-- REVIEW PACKAGE v1; NOT A CLI MIGRATION. NEVER APPLY. ALL SOURCE GUARDS AND ROLLBACK RETAINED.\n';
await writeFile(new URL('./v1-cutover.guarded.sql.txt', import.meta.url), Buffer.concat([Buffer.from(header), bytes]));
