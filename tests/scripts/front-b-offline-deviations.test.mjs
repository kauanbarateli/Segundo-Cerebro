import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {diagnosticDeviationDigest,observeCatalogue} from '../../scripts/verification/front-b-offline-observation/contract.mjs';
import {FRONT_B_FIXTURE_DEVIATIONS} from '../helpers/front-b-historical-observation.mjs';

const catalogue=deviations=>({version:1,ok:deviations.length===0,checks:2650,deviations});
test('a ordem de entrada não altera o digest; a projeção não publica nomes nem aprova',()=>{
 const values=[{check:'b',object:'one'},{check:'a',object:'two'},{check:'a',object:'one'}];
 const canonical='[["a","one"],["a","two"],["b","one"]]';
 const expected=createHash('sha256').update(canonical,'utf8').digest('hex');
 assert.equal(diagnosticDeviationDigest(values),expected);
 assert.equal(diagnosticDeviationDigest([...values].reverse()),expected);
 const observed=observeCatalogue(catalogue(values),170011);
 assert.deepEqual(observed,{serverVersion:170011,checks:2650,ok:false,deviations:3,deviationsSha256:expected,accepted:false});
 assert.equal(JSON.stringify(observed).includes('one'),false);
 assert.notEqual(diagnosticDeviationDigest([{check:'b',object:'two'},...values.slice(1)]),expected);
 assert.notEqual(diagnosticDeviationDigest(values.slice(1)),expected);
 assert.equal(diagnosticDeviationDigest([]),createHash('sha256').update('[]').digest('hex'));
 assert.equal(observeCatalogue(catalogue([]),170011).accepted,false);
});
test('recusa duplicatas, formas malformadas e campos sem valor',()=>{
 const valid={check:'a',object:'one'};
 const getter={get check(){throw Error('GETTER_EXECUTED');},object:'one'};
 for(const values of [[valid,{...valid}],[valid,{}],[{check:'',object:'x'}],[{check:'a',object:'\u0000'}],[{check:'\ud800',object:'x'}],[getter],new Array(1),[{...valid,extra:true}]]){
  assert.throws(()=>diagnosticDeviationDigest(values),{message:'OBSERVATION_REFUSED'});
  assert.throws(()=>observeCatalogue(catalogue(values),170011),{message:'OBSERVATION_REFUSED'});
 }
});
test('a baseline PGlite fixada usa a mesma serialização, apenas para comparação diagnóstica',()=>{
 assert.equal(FRONT_B_FIXTURE_DEVIATIONS.length,26);
 assert.equal(diagnosticDeviationDigest(FRONT_B_FIXTURE_DEVIATIONS),'9a5bf02b67d4e0a67a48c45456ee5889ef1b7ef1834b4a4fa9ef73730877e108');
 assert.equal(observeCatalogue(catalogue(FRONT_B_FIXTURE_DEVIATIONS),170011).accepted,false);
});
