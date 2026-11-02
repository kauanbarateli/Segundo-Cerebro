import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDictionary } from './generate.mjs';
import { repositoryRoot } from './paths.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(join(repositoryRoot(root),'package.json'));
const ts=require('typescript');
const bytes=readFileSync(join(root,'origin-dictionary.json'));
const compiled=compileDictionary(bytes);
assert.equal(readFileSync(join(root,'generated/origin-dictionary.generated.ts'),'utf8'),compiled.ts);
const asData=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const dictionaryURL=asData(compiled.ts);
const modelSource=readFileSync(join(root,'generated/signup-metrics.ts'),'utf8').replace("'./origin-dictionary.generated'",JSON.stringify(dictionaryURL));
const model=await import(asData(modelSource));
const dimensions=model.METRIC_DIMENSIONS;
for(const dimension of dimensions) {
  for(const bad of ['person@example.com','+55 99 99999-9999','id_123456','https://example.org/?a=1','jõao','person%40example.com']) {
    for(const n of [1,5,19]) {
      const output=model.prepareOriginDistribution(dimension,n,[{value:bad,count:n}]);
      assert.deepEqual(output,[{kind:'other',value:null,count:n}]);
      assert(!JSON.stringify(output).includes(bad));
    }
  }
  for(const n of [1,4,5]) assert.deepEqual(model.prepareOriginDistribution(dimension,n,[{value:null,count:n}]),[{kind:'not-informed',value:null,count:n}]);
  assert.deepEqual(model.prepareOriginDistribution(dimension,0,[]),[]);
}
assert.deepEqual(model.prepareOriginDistribution('utm_source',7,[{value:' Google ',count:3},{value:'GOOGLE',count:2},{value:'private@example.com',count:1},{value:null,count:1}]),[
 {kind:'value',value:'google',count:5},{kind:'not-informed',value:null,count:1},{kind:'other',value:null,count:1}]);
assert.deepEqual(model.prepareOriginDistribution('utm_source',4,[{value:'google',count:4}]),[{kind:'other',value:null,count:4}]);
assert.equal(model.prepareOriginDistribution('utm_source',2,[{value:'google',count:1}]),null);
assert.equal(model.prepareOriginDistribution('utm_source',2,[{value:'google',count:1},{value:'google',count:1}]),null);
assert.notEqual(compileDictionary(Buffer.from(bytes.toString().replace('Google','Google Novo'))).version,compiled.version);
const dictionary=JSON.parse(bytes); dictionary.dimensions.utm_source[0].aliases.push('leak@example.com');
assert.throws(()=>compileDictionary(Buffer.from(JSON.stringify(dictionary))),/Invalid dictionary alias/);

const query={start:'2026-01-01',end:'2026-01-01',zone:'UTC',bucket:'day'};
const dist=Object.fromEntries(dimensions.map(d=>[d,[{kind:'not-informed',value:null,count:1}]]));
const valid={...query,dictionaryVersion:compiled.version,totalPublic:1,stock:{total:1,legacy:0,admin:0,public:1,unclassified:0},series:[{period:'2026-01-01',count:1}],distributions:dist};
assert(model.parseSignupMetrics(valid,query));
for(const mutation of [
 o=>o.dictionaryVersion='stale',
 o=>o.distributions.utm_source=[{kind:'value',value:'person@example.com',count:5}],
 o=>o.distributions.utm_source=[{kind:'other',value:null,count:1,unexpected:'raw'}],
 o=>o.distributions.utm_source=[{kind:'not-informed',value:null,count:1},{kind:'not-informed',value:null,count:1}],
 o=>o.distributions.utm_source=[{kind:'other',value:null,count:2}],
]) {const bad=structuredClone(valid);mutation(bad);assert.equal(model.parseSignupMetrics(bad,query),null);}
const unknownFive=structuredClone(valid); unknownFive.totalPublic=5;unknownFive.series[0].count=5;
unknownFive.distributions=Object.fromEntries(dimensions.map(d=>[d,[{kind:'not-informed',value:null,count:5}]]));
unknownFive.distributions.utm_source=[{kind:'value',value:'person@example.com',count:5}];
assert.equal(model.parseSignupMetrics(unknownFive,query),null);
const duplicated=structuredClone(valid); duplicated.totalPublic=2;duplicated.series[0].count=2;
duplicated.distributions=Object.fromEntries(dimensions.map(d=>[d,[{kind:'not-informed',value:null,count:2}]]));
duplicated.distributions.utm_source=[{kind:'not-informed',value:null,count:1},{kind:'not-informed',value:null,count:1}];
assert.equal(model.parseSignupMetrics(duplicated,query),null);
const separator=structuredClone(valid);separator.stock={'total|legacy':0,admin:0,public:1,unclassified:0};
assert.equal(model.parseSignupMetrics(separator,query),null);
const sql=readFileSync(join(root,'generated/signup-metrics.sql.txt'),'utf8');
assert.match(sql,/begin;\s*do \$\$ begin raise exception 'DRAFT_ONLY: proposta nao autorizada para execucao'; end \$\$;\s*create function/);
assert(sql.includes(compiled.sql));
assert(sql.includes(`'dictionaryVersion','${compiled.version}'`));
assert(!sql.includes('row_number() over'));
assert(sql.includes('perform app_private.admin_require_master(p_actor,p_session)'));
assert(sql.includes('grant execute on function public.signup_metrics(uuid,uuid,date,date,text,text) to service_role'));
console.log('Pure proposal checks passed: dictionary, classification, parser, static SQL. No database executed.');
