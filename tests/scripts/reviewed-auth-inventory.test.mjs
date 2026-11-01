import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{readFile,mkdtemp,mkdir,writeFile,unlink,rmdir}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{fileURLToPath}from'node:url';
import{ADMIN_LOCAL_SOURCE_PATHS,ADMIN_LOCAL_HISTORICAL_READER_PIN}from'../e2e-auth-local/admin-native-backend-local-ci-contract.mjs';
import{AVATAR_SOURCE_PATHS}from'../../scripts/verification/avatar-storage-local-ci.mjs';
import{deriveRecoverySourcePaths,assertRecoverySourcePaths}from'../../scripts/verification/auth-recovery-local-ci.mjs';
import{current27SourceClosure,CURRENT27_EXPECTED_SOURCES,assertCurrent27SourceSet}from'../e2e-auth-local/finance-goals-current27-insufficiency-preparation.mjs';
import{deriveAdminBrowserSourcePaths,assertAdminBrowserSourcePaths}from'../../scripts/verification/admin-browser-local-ci.mjs';
import{deriveDriveSourcePaths,assertDriveSourcePaths}from'../../scripts/verification/drive-browser-local-ci.mjs';
import{deriveFoundationSources}from'../../scripts/verification/foundation-local-ci.mjs';
import{STORAGE_SOURCE_PATHS}from'../../scripts/verification/capture-image-storage-local-ci.mjs';
const name='tests/helpers/canonical-front-b-source.mjs',hash=items=>createHash('sha256').update(items.join('\n')+'\n').digest('hex');
function qualify(paths,expected,previous){assert.equal(paths.filter(x=>x===name).length,1);assert.equal(hash(paths),expected);assert.equal(hash(paths.filter(x=>x!==name)),previous);}
test('a única dependência runtime nova é vinculada aos inventários históricos',async()=>{
 const bytes=await readFile(new URL('../../'+name,import.meta.url));assert.equal(bytes.length,ADMIN_LOCAL_HISTORICAL_READER_PIN.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),ADMIN_LOCAL_HISTORICAL_READER_PIN.sha256);
 qualify(ADMIN_LOCAL_SOURCE_PATHS,'a33ef2273597e5ee698a34046919ab46ff4076723a8550a8f53072c26471cdbf','a82953f5e9809bee52e360ead602a7d5a5f1b145d97540bc32f3d11fda35158b');
 qualify(AVATAR_SOURCE_PATHS,'c4e69785fb6b395f4b15f2f9679ed7399eef98bcc55372ab15116ce7ad846efd','a5daff443981a3ec6420aff2e2ae947d5b8bcbbbbcd8d3725b52c6fa38ef1e4e');
});
test('fechamentos recusam omissão, substituição e reordenação sem alterar 026/027',async()=>{
 const recovery=[...new Set([...ADMIN_LOCAL_SOURCE_PATHS,...await deriveRecoverySourcePaths()])].sort();// Before 15733dd: full closure 392def35fb49f651980b54e2b5c7e43ebeefffcc2458de34eaee7d606321fc9d;
 // without the helper 26a3009686bcd0ee155f57172de323287013fcc892641b323abe76c53b2a160d.
 qualify(recovery,'349478ca75e06db8ed4d8b0fd2fcfe42e0d317a8ff038a83cbf34abc784350df','eb023efd938cef79d9cfd21a7c3e2ff26e15984db88eb6a1318e0a21c0d8c814');
 assert.doesNotThrow(()=>assertRecoverySourcePaths(recovery));for(const changed of [recovery.filter(x=>x!==name),[...recovery].reverse(),[...recovery.filter(x=>x!==name),'tests/helpers/foreign.mjs'].sort()])assert.throws(()=>assertRecoverySourcePaths(changed),{message:'SOURCE_REFUSED'});
 const finance=await current27SourceClosure(fileURLToPath(new URL('../../',import.meta.url)));assert.deepEqual(finance,CURRENT27_EXPECTED_SOURCES);qualify(finance,'88921c32009028ee89ab3b70577ff55671a0678265464a02510eb6113ff0924f','bb6fa457547a0f67f70d9e87713019a3c92a1d91139f357068e7f91accef4147');
 for(const changed of [finance.filter(x=>x!==name),[...finance].reverse(),[...finance.filter(x=>x!==name),'tests/helpers/foreign.mjs'].sort()])assert.throws(()=>assertCurrent27SourceSet(changed),{code:'SOURCE_REFUSED'});
 const browser=await deriveAdminBrowserSourcePaths(),drive=[...new Set([...ADMIN_LOCAL_SOURCE_PATHS,...await deriveDriveSourcePaths()])].sort();assertAdminBrowserSourcePaths(browser);assertDriveSourcePaths(drive);
 assert.equal(hash(browser),'35a7214fe9431c6c3e67f119fa270afdaf3d97f669c4c8fa0cd63c713c167e3a');assert.equal(hash(drive),'5631da45e3401d538bef4e704574f9abf4382be3c7b97db8336a5e913d1ee2a1');
 assert.ok((await deriveFoundationSources()).includes(name));assert.ok(STORAGE_SOURCE_PATHS.includes(name));
});
test('helper alterado é recusado pelo fechamento financeiro antes da projeção',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sc-source-pin-')),tests=join(root,'tests'),helpers=join(tests,'helpers'),file=join(helpers,'canonical-front-b-source.mjs');
 try{await mkdir(helpers,{recursive:true});await writeFile(file,'altered');await assert.rejects(current27SourceClosure(root,[name]),{code:'SOURCE_REFUSED'});}finally{await unlink(file);await rmdir(helpers);await rmdir(tests);await rmdir(root);}
});
