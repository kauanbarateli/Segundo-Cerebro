import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';

// Expected generated shape, not a claim about nullability accepted by SQL.
const actor={p_session:'string',p_user:'string'};
export const FRONT_B_RPC_CONTRACT=Object.freeze({
 feedback_list:{args:{...actor,p_before:'string',p_before_id:'string'},returns:'Json'},
 feedback_submit:{args:{...actor,p_client:'string',p_category:'string',p_message:'string'},returns:'Json'},
 signup_attest_password_reset:{args:{...actor,p_intent:'string',p_subject_hash:'string'},returns:'undefined'},
 signup_complete:{args:{...actor,p_intent:'string',p_subject_hash:'string',p_terms:'string',p_privacy:'string',p_accept_origin:'boolean',p_origin_version:'string'},returns:'Json'},
 signup_discard_pending_origin:{args:{...actor,p_intent:'string',p_subject_hash:'string'},returns:'Json'},
 signup_find_bound_intent:{args:{...actor,p_subject_hash:'string'},returns:'Json'},
 signup_intent_create:{args:{p_binding_hash:'string',p_subject_hash:'string',p_terms:'string',p_privacy:'string',p_expires:'string',p_origin:'Json',p_origin_version:'string'},returns:'string'},
 signup_metrics:{args:{p_actor:'string',p_session:'string',p_start:'string',p_end:'string',p_zone:'string',p_bucket:'string'},returns:'Json'},
 signup_origin_status:{args:{...actor},returns:'Json'},
 signup_origin_withdraw:{args:{...actor},returns:'Json'},
 signup_prune:{args:{},returns:'Json'},
 signup_recover_verified_intent:{args:{...actor,p_subject_hash:'string',p_terms:'string',p_privacy:'string'},returns:'Json'},
});
function properties(node){
 if(!node || !ts.isTypeLiteralNode(node)) throw new Error('TYPE_SHAPE_INVALID');
 const result=new Map();
 for(const item of node.members){
  if(!ts.isPropertySignature(item) || !item.name || !item.type || item.questionToken || result.has(item.name.text)) throw new Error('TYPE_PROPERTY_INVALID');
  result.set(item.name.text,item.type);
 }
 return result;
}
/** Parse type declarations only; never evaluate source text. */
export function parseFrontBTypes(source){
 if(typeof source!=='string' || Buffer.byteLength(source)>2_000_000) throw new Error('TYPE_SOURCE_INVALID');
 const file=ts.createSourceFile('types.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(file.parseDiagnostics.length) throw new Error('TYPE_SYNTAX_INVALID');
 const alias=name=>{const found=file.statements.filter(x=>ts.isTypeAliasDeclaration(x)&&x.name.text===name);if(found.length!==1)throw new Error('TYPE_ALIAS_INVALID');return found[0];};
 const json=alias('Json').type;
 if(!ts.isUnionTypeNode(json)||!json.types.some(x=>ts.isLiteralTypeNode(x)&&x.literal.kind===ts.SyntaxKind.NullKeyword)) throw new Error('JSON_NULL_MISSING');
 const database=properties(alias('Database').type),schema=properties(database.get('public')),functions=properties(schema.get('Functions'));
 const result={};
 for(const [name,entry] of functions){
  if(!name.startsWith('signup_')&&!name.startsWith('feedback_'))continue;
  const shape=properties(entry);if(shape.size!==2||!shape.has('Args')||!shape.has('Returns'))throw new Error('RPC_SHAPE_INVALID');
  const argsNode=shape.get('Args'),args={};
  if(ts.isTypeLiteralNode(argsNode)){for(const [arg,type] of properties(argsNode))args[arg]=type.getText(file);}
  else if(argsNode.getText(file)!=='Record<PropertyKey, never>')throw new Error('RPC_ARGS_INVALID');
  result[name]={args,returns:shape.get('Returns').getText(file)};
 }
 return result;
}
export function compareFrontBTypes(actual,expected=FRONT_B_RPC_CONTRACT){
 const missing=Object.keys(expected).filter(x=>!Object.hasOwn(actual,x)).sort();
 const unexpected=Object.keys(actual).filter(x=>!Object.hasOwn(expected,x)).sort();
 const differing=Object.keys(expected).filter(x=>Object.hasOwn(actual,x)&&!same(actual[x],expected[x])).sort();
 return {ok:missing.length===0&&unexpected.length===0&&differing.length===0,missing,unexpected,differing};
}
function same(a,b){
 if(a?.returns!==b?.returns)return false;
 const left=Object.keys(a?.args??{}).sort(),right=Object.keys(b?.args??{}).sort();
 return left.length===right.length&&left.every((key,i)=>key===right[i]&&a.args[key]===b.args[key]);
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const candidateNames=['20261101020254_public_admission_gate.sql','20261101030000_signup_metrics.sql','20261101013633_feedback_requests.sql'];
async function main(argv){
 if(argv.length!==2||argv[0]!=='--package'||!isAbsolute(argv[1])||/^(?:\\\\|\/\/)/.test(argv[1])) throw new Error('Use --package com caminho absoluto local do diretório @supabase/postgrest-typegen');
 const packageDir=await realpath(argv[1]);
 if(/^(?:\\\\|\/\/)/.test(packageDir)) throw new Error('NETWORK_PATH_REFUSED');
 const manifest=JSON.parse(await readFile(join(packageDir,'package.json'),'utf8'));
 if(manifest.name!=='@supabase/postgrest-typegen'||manifest.version!=='0.4.0') throw new Error('PACKAGE_VERSION_REFUSED');
 const introspectionPath=join(packageDir,'dist','introspection','index.js');
 const generationPath=join(packageDir,'dist','generation','index.js');
 const engineHashes={introspection:digest(await readFile(introspectionPath)),generation:digest(await readFile(generationPath))};
 // Import executes the supplied package. The caller must select a trusted installation.
 const {introspect}=await import(pathToFileURL(introspectionPath).href);
 const {generateTypescript,sortGeneratorMetadata}=await import(pathToFileURL(generationPath).href);
 const {createCatalogueFixture}=await import('../../tests/scripts/helpers/catalogue-fixture.mjs');
 const {CURRENT27_CANONICAL_REVIEW}=await import('../../tests/helpers/canonical-release-source.mjs');
 const {FRONT_B_30_DRAFT_REVIEW}=await import('../../tests/helpers/canonical-front-b-source.mjs');
 const db=await createCatalogueFixture();
 const fromRoot=path=>readFile(new URL(`../../${path}`,import.meta.url));
 try {
  for(const m of CURRENT27_CANONICAL_REVIEW){const b=await fromRoot(`supabase/migrations/${m.file}`);if(digest(b)!==m.sha256)throw new Error('HISTORICAL_SOURCE_MISMATCH');await db.exec(b.toString('utf8'));}
  const patch=await fromRoot('supabase/operations/onboarding-conflict-code.sql');
  if(digest(patch)!=='4ba6a09351e60504cbc6e5fe6500e5e70045fc6d07012f2e375704ca6bc77bba')throw new Error('PATCH_SOURCE_MISMATCH');
  await db.exec(patch.toString('utf8'));
  for(const [i,name] of candidateNames.entries()){const b=await fromRoot(`supabase/operations/candidates/${name}`);if(digest(b)!==FRONT_B_30_DRAFT_REVIEW[27+i].sha256)throw new Error('CANDIDATE_SOURCE_MISMATCH');await db.exec(b.toString('utf8'));}
  const generate=async()=>{const metadata=await introspect(db,{includedSchemas:['public']});return generateTypescript(sortGeneratorMetadata(metadata),{detectOneToOneRelationships:true,format:async value=>value});};
  const generated=await generate(),comparison=compareFrontBTypes(parseFrontBTypes(generated));
  if(!comparison.ok)throw new Error(`GENERATED_CONTRACT_MISMATCH ${JSON.stringify(comparison)}`);
  const baseline=(await fromRoot('src/lib/supabase/database.generated.ts')).toString('utf8');
  const snapshotComparison=compareFrontBTypes(parseFrontBTypes(baseline));
  await db.exec('begin');try{
   await db.exec('drop function public.feedback_list(uuid,uuid,timestamptz,uuid)');
   const negative=compareFrontBTypes(parseFrontBTypes(await generate()));
   if(negative.ok||!negative.missing.includes('feedback_list'))throw new Error('NEGATIVE_TEST_FAILED');
  }finally{await db.exec('rollback');}
  assert.equal(compareFrontBTypes(parseFrontBTypes(await generate())).ok,true,'rollback must restore function');
  console.log(JSON.stringify({check:'front_b_local_typegen',ok:true,engine:{name:manifest.name,version:manifest.version,entrypoint_sha256:engineHashes},generated_sha256:digest(generated),snapshot_sha256:digest(baseline),rpc_count:Object.keys(FRONT_B_RPC_CONTRACT).length,snapshot_comparison:snapshotComparison,negative:'feedback_list_missing_detected_and_rolled_back',limitations:['PGlite only; no QA equivalence','Scalar argument nullability not represented by typegen','Package name and version do not verify source integrity']},null,2));
 } finally{await db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){main(process.argv.slice(2)).catch(error=>{console.error(`Diagnóstico recusado: ${error.message}`);process.exitCode=1;});}
