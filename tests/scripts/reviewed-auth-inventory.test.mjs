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
const qaTypes='src/lib/supabase/database.front-b-qa028.ts';
const provisional='src/lib/auth/signup-provisional.ts';
const v2Paths=['src/lib/auth/origin-withdrawal-v2-gate.ts','src/lib/auth/signup-origin-snapshot.ts'];
function priorV2(paths){for(const path of v2Paths)assert.equal(paths.filter(p=>p===path).length,1);return paths.filter(path=>!v2Paths.includes(path));}
function qualifyProvisional(paths,current,withoutHelper){assert.equal(paths.filter(x=>x===provisional).length,1);qualify(paths,current,withoutHelper);}
function qualifyQa(paths,current,currentWithoutHelper,previous,previousWithoutHelper){assert.equal(paths.filter(x=>x===qaTypes).length,1);qualify(paths,current,currentWithoutHelper);qualify(paths.filter(x=>x!==qaTypes),previous,previousWithoutHelper);}
test('a única dependência runtime nova é vinculada aos inventários históricos',async()=>{
 const bytes=await readFile(new URL('../../'+name,import.meta.url));assert.equal(bytes.length,ADMIN_LOCAL_HISTORICAL_READER_PIN.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),ADMIN_LOCAL_HISTORICAL_READER_PIN.sha256);
 qualify(ADMIN_LOCAL_SOURCE_PATHS,'a33ef2273597e5ee698a34046919ab46ff4076723a8550a8f53072c26471cdbf','a82953f5e9809bee52e360ead602a7d5a5f1b145d97540bc32f3d11fda35158b');
 qualify(AVATAR_SOURCE_PATHS,'c4e69785fb6b395f4b15f2f9679ed7399eef98bcc55372ab15116ce7ad846efd','a5daff443981a3ec6420aff2e2ae947d5b8bcbbbbcd8d3725b52c6fa38ef1e4e');
});
test('fechamentos recusam omissão, substituição e reordenação sem alterar 026/027',async()=>{
 const recovery=[...new Set([...ADMIN_LOCAL_SOURCE_PATHS,...await deriveRecoverySourcePaths()])].sort();// Before 15733dd: full closure 392def35fb49f651980b54e2b5c7e43ebeefffcc2458de34eaee7d606321fc9d;
 // without the helper 26a3009686bcd0ee155f57172de323287013fcc892641b323abe76c53b2a160d.
 assert.equal(hash(recovery),'149d6e0f6e6570cb3a7561ff77ca00ee049993d17c7096b8ac7b9684b4e61edd');const priorRecovery=priorV2(recovery);
 qualifyProvisional(priorRecovery,'6f59490bcb61a18a132c0b25e5f7c8748e651e94f943d0fabfb59d8272e10e91','7c79d9e7a8b10ed37f8a465dcd51ecaa04bd63c298f7f1fb7b972bf685b35cef');
 qualifyQa(priorRecovery.filter(x=>x!==provisional),'2eed7a351da5eb4b790b5bba2ae72cd47b9d746405290817e7d61a0b45912f1b','687b2f71585166ed34fbf23a0838c8532edabb4cc99fce46f434df1dc07fc62a','349478ca75e06db8ed4d8b0fd2fcfe42e0d317a8ff038a83cbf34abc784350df','eb023efd938cef79d9cfd21a7c3e2ff26e15984db88eb6a1318e0a21c0d8c814');
 assert.doesNotThrow(()=>assertRecoverySourcePaths(recovery));for(const changed of [recovery.filter(x=>x!==name),[...recovery].reverse(),[...recovery.filter(x=>x!==name),'tests/helpers/foreign.mjs'].sort()])assert.throws(()=>assertRecoverySourcePaths(changed),{message:'SOURCE_REFUSED'});
 const finance=await current27SourceClosure(fileURLToPath(new URL('../../',import.meta.url)));assert.deepEqual(finance,CURRENT27_EXPECTED_SOURCES);qualify(finance,'88921c32009028ee89ab3b70577ff55671a0678265464a02510eb6113ff0924f','bb6fa457547a0f67f70d9e87713019a3c92a1d91139f357068e7f91accef4147');
 for(const changed of [finance.filter(x=>x!==name),[...finance].reverse(),[...finance.filter(x=>x!==name),'tests/helpers/foreign.mjs'].sort()])assert.throws(()=>assertCurrent27SourceSet(changed),{code:'SOURCE_REFUSED'});
 const browser=await deriveAdminBrowserSourcePaths(),drive=[...new Set([...ADMIN_LOCAL_SOURCE_PATHS,...await deriveDriveSourcePaths()])].sort();assertAdminBrowserSourcePaths(browser);assertDriveSourcePaths(drive);
 // Before the inventory changes: browser 35a7214fe9431c6c3e67f119fa270afdaf3d97f669c4c8fa0cd63c713c167e3a;
 // Drive 5631da45e3401d538bef4e704574f9abf4382be3c7b97db8336a5e913d1ee2a1.
 const priorBrowser=priorV2(browser),oldBrowser=[...priorBrowser,'src/components/features/configuracoes/signup-origin-setting.css','src/components/features/configuracoes/signup-origin-setting.tsx'].sort();
 assert.equal(hash(browser),'d1cabdfa83d1ed9eaedf20de5060d8febb99d6606b01a23ad94a45cff7903cae');assert.equal(hash(priorBrowser),'0a67af0fb65bf5519f8246b1d8295321c515d2c4db8dcffa5fc975e6178d7eb1');
 qualifyProvisional(oldBrowser,'80a56792536f74cb645801b1d1cc80ec995e499b5ddae674023a5867c4aeed33','94a1a0ac53e116c645c2020b36ee6a235e17b74c3f6dd53d777986ca26bf3672');
 qualifyQa(oldBrowser.filter(x=>x!==provisional),'72d05c8f1d4b4ddcd9747dae9fd9043263bf561f1c1b8998b8454fa11b23d6d8','f62b2423528d2c0daa22f5437de68df776e4229c2a40b990609c9dd1e208cf48','ad93fb418e68102fa814fb6642b46323535e9ef3d1cde9258608e5d00fd733fb','5cbb1a063ccc9cee96a462b1bb7bc12daa3ff4962435b13ef27e84afcf69d0a0');
 assert.equal(hash(drive),'962e8b1193cbfd5be9e2467e276bfd4c2ff4a1e8f63c81db016abc68f2e41c83');const priorDrive=priorV2(drive);
 qualifyProvisional(priorDrive,'99c4c804183b730c21a8304dc08ec78c70c8329073dbcc979c71a70de1809c07','075b424ecb186bf55d2f6154170d3ea6a5a5e4d1b31a79582e3e5c7f4b835ea5');
 qualifyQa(priorDrive.filter(x=>x!==provisional),'862efe637538697a5657234debdff3061580b597c6d0fa9757f8cea706d51acb','f1d9ab1d152ee4f10b0e8bc65e1a68f7f5d9db164f3841eb579aca833e0c4a5a','629bfb2a39651b023760d1981a29ea2541bed3610c2fa4a5f5788e0a3ee25a2f','c86edce223d955229084f27cb8637613787d0bf136f1c038440aad6c9fc43fbd');
 assert.ok((await deriveFoundationSources()).includes(name));assert.ok(STORAGE_SOURCE_PATHS.includes(name));
});
test('helper alterado é recusado pelo fechamento financeiro antes da projeção',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sc-source-pin-')),tests=join(root,'tests'),helpers=join(tests,'helpers'),file=join(helpers,'canonical-front-b-source.mjs');
 try{await mkdir(helpers,{recursive:true});await writeFile(file,'altered');await assert.rejects(current27SourceClosure(root,[name]),{code:'SOURCE_REFUSED'});}finally{await unlink(file);await rmdir(helpers);await rmdir(tests);await rmdir(root);}
});
