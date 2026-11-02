import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './paths.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dimensionNames = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(key=>Object.hasOwn(o,key));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function compileDictionary(bytes) {
  const value = JSON.parse(bytes.toString('utf8'));
  if (!exact(value, ['schemaVersion','dimensions']) || value.schemaVersion !== 1 || !exact(value.dimensions, dimensionNames)) throw Error('Invalid dictionary structure');
  const comparisons = [];
  for (const dimension of dimensionNames) {
    const entries = value.dimensions[dimension];
    if (!Array.isArray(entries) || entries.length > 100) throw Error('Invalid dictionary entries');
    const codes = new Set(), aliases = new Set();
    for (const entry of entries) {
      if (!exact(entry,['code','label','aliases']) || !/^[a-z][a-z0-9_]{0,31}$/.test(entry.code) || ['other','not-informed'].includes(entry.code) || codes.has(entry.code) || typeof entry.label !== 'string' || !/^[\p{L} ]{1,40}$/u.test(entry.label) || !Array.isArray(entry.aliases) || !entry.aliases.length) throw Error('Invalid dictionary entry');
      codes.add(entry.code);
      for (const alias of entry.aliases) {
        if (typeof alias !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(alias) || aliases.has(alias)) throw Error('Invalid dictionary alias');
        aliases.add(alias);
        comparisons.push(`   when d.name='${dimension}' and lower(btrim(p.origin->>d.name) collate "C")='${alias}' then '${entry.code}'`);
      }
    }
  }
  const version = `sha256:${hash(bytes)}`;
  const ts = `// Generated from the reviewed origin-dictionary.json; do not edit separately.\nexport const ORIGIN_DICTIONARY_VERSION = ${JSON.stringify(version)};\nexport const ORIGIN_DICTIONARY = ${JSON.stringify(value.dimensions, null, 2)} as const;\n`;
  const sql = `classified as materialized (\n  select d.name,case when p.origin->>d.name is null then null\n${comparisons.join('\n')}\n   else '__other__' end as value\n  from dimensions d cross join population p\n ), grouped as (\n  select name,value,count(*)::int as n from classified group by name,value\n ), normalized as (\n  select name,case when value is null then 'not-informed' when value='__other__' or n<5 then 'other' else 'value' end as kind,\n   case when value is null or value='__other__' or n<5 then null else value end as value,n from grouped\n )`;
  return { version, ts, sql };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo=repositoryRoot(root);
  const result = compileDictionary(readFileSync(join(root,'origin-dictionary.json')));
  const srcPath = join(repo,'supabase/operations/candidates/20261101030000_signup_metrics.sql');
  const original = readFileSync(srcPath);
  if (hash(original) !== '55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f') throw Error('Candidate source drift');
  let sql = original.toString('utf8');
  if (!sql.includes('begin;\ncreate function public.signup_metrics')) throw Error('Transaction structure drift');
  sql=sql.replace('begin;\ncreate function public.signup_metrics', () => "begin;\ndo $$ begin raise exception 'DRAFT_ONLY: proposta nao autorizada para execucao'; end $$;\ncreate function public.signup_metrics");
  const start=sql.indexOf(' grouped as (');
  const end=sql.indexOf(', merged as (', start);
  if (start < 0 || end < start || sql.indexOf(' grouped as (',start+1)!==-1) throw Error('Candidate structure drift');
  sql=sql.slice(0,start)+' '+result.sql+sql.slice(end);
  const key="select jsonb_build_object('totalPublic',t.n";
  if (sql.split(key).length !== 2) throw Error('JSON structure drift');
  sql=sql.replace(key, `select jsonb_build_object('dictionaryVersion','${result.version}','totalPublic',t.n`);
  mkdirSync(join(root,'generated'),{recursive:true});
  writeFileSync(join(root,'generated/origin-dictionary.generated.ts'),result.ts);
  writeFileSync(join(root,'generated/signup-metrics.sql.txt'),sql);
  console.log(`Scratch proposal generated; dictionary ${result.version}. SQL is inert text.`);
}
