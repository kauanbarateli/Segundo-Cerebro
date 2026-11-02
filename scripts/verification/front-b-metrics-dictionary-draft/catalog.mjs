/** Versioned catalogue maintenance only: writes reviewed source artifacts, never connects to a database. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDictionary } from './generate.mjs';

const root=dirname(fileURLToPath(import.meta.url)),repo=resolve(root,'../../..');
/** The historical compiler stays unchanged; stricter editorial checks live here. */
export function compileApprovedCatalog(dictionaryBytes, original) {
 const result=compileDictionary(dictionaryBytes);
 const dictionary=JSON.parse(dictionaryBytes.toString('utf8'));
 for(const entries of Object.values(dictionary.dimensions)) {
  const labels=new Set();
  for(const entry of entries) {
   const label=entry.label.toLocaleLowerCase('pt-BR');
   if(entry.label.trim()!==entry.label || !/[\p{L}]/u.test(entry.label) || ['outros','não informada','nao informada'].includes(label) || labels.has(label) || entry.aliases.length>30 || !entry.aliases.includes(entry.code)) throw Error('Invalid editorial entry');
   labels.add(label);
  }
 }
 if(createHash('sha256').update(original).digest('hex')!=='55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f')throw Error('Candidate source drift');
 let sql=original.toString('utf8');
 if(!sql.includes('begin;\ncreate function public.signup_metrics'))throw Error('Transaction structure drift');
 sql=sql.replace('begin;\ncreate function public.signup_metrics',()=>"begin;\ndo $$ begin raise exception 'DRAFT_ONLY: proposta nao autorizada para execucao'; end $$;\ncreate function public.signup_metrics");
 const start=sql.indexOf(' grouped as ('),end=sql.indexOf(', merged as (',start);
 if(start<0||end<start||sql.indexOf(' grouped as (',start+1)!==-1)throw Error('Candidate structure drift');
 sql=sql.slice(0,start)+' '+result.sql+sql.slice(end);
 const key="select jsonb_build_object('totalPublic',t.n";
 if(sql.split(key).length!==2)throw Error('JSON structure drift');
 sql=sql.replace(key,()=>`select jsonb_build_object('dictionaryVersion','${result.version}','totalPublic',t.n`);
 return {...result,candidateSql:sql};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const mode=process.argv.slice(2);
 if(mode.length!==1 || !['--check','--write'].includes(mode[0])) throw Error('Use --check or --write');
 const compiled=compileApprovedCatalog(readFileSync(join(root,'origin-dictionary.json')),readFileSync(join(repo,'supabase/operations/candidates/20261101030000_signup_metrics.sql')));
 const outputs=[[join(repo,'src/core/acquisition/origin-dictionary.generated.ts'),compiled.ts],[join(root,'catalog-integration.sql.txt'),compiled.candidateSql]];
 if(mode[0]==='--check') {
  for(const [path,expected] of outputs) if(readFileSync(path,'utf8')!==expected) throw Error('Catalogue artifacts differ: run --write and review both artifacts.');
  console.log(`Catalogue artifacts agree: ${compiled.version}`);
 } else {
  for(const [path,value] of outputs) writeFileSync(path,value,'utf8');
  console.log(`Catalogue artifacts updated: ${compiled.version}. Review both before any release.`);
 }
}
