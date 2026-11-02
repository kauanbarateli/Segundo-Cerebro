import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GUARD,removeScratchGuard} from './feedback-pglite-guard.mjs';

test('pinned candidate contains one guard immediately inside its transaction',async()=>{
 const bytes=await readFile(new URL('./candidate-feedback-barrier.sql.txt',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'ffb71bd2d5f7696fb16dcf643c8720056c6e1850230d190009494bbf924ff3c3');
 const candidate=bytes.toString('utf8'),unguarded=removeScratchGuard(candidate);
 assert.equal(candidate.includes(`BEGIN;\n${GUARD}\n`),true);
 assert.equal(unguarded.includes(GUARD),false);assert.equal(unguarded.includes('BEGIN;\n'),true);
});
test('guard detached, duplicated, missing, or without COMMIT is rejected',()=>{
 for(const invalid of [`BEGIN;\nSELECT 1;\n${GUARD}\nCOMMIT;`,`BEGIN;\n${GUARD}\n${GUARD}\nCOMMIT;`,'BEGIN;\nCOMMIT;',`BEGIN;\n${GUARD}\nROLLBACK;`]) assert.throws(()=>removeScratchGuard(invalid));
});
test('relative package paths resolve from the intended checkout directory',()=>{
 const target=new URL('file:///checkout/scripts/verification/front-b-feedback-reconciliation-draft/feedback-pglite.opt-in.test.mjs');
 assert.equal(new URL('../../../package-lock.json',target).pathname,'/checkout/package-lock.json');
 assert.equal(new URL('../../../node_modules/@electric-sql/pglite/package.json',target).pathname,'/checkout/node_modules/@electric-sql/pglite/package.json');
});
