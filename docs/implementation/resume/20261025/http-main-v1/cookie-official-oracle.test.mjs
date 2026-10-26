// Future pure oracle: official utility functions only. No createClient/server,
// session, credentials, network, SDK factories or Next are loaded/executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root='C:/Users/Kauan Sousa Barateli/Documents/Codex/2026-10-07/inicie-a-constru-o-do-software-2/work/Segundo-Cerebro-mvp-goals-terminal-20261023';
const pins=JSON.parse(fs.readFileSync(new URL('./SOURCE-PINS.json',import.meta.url),'utf8'));
const files=['node_modules/@supabase/ssr/dist/main/utils/base64url.js','node_modules/@supabase/ssr/dist/main/utils/chunker.js'];
for(const file of files){const pin=pins.sdk.find(x=>x.path===file);assert.ok(pin);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),pin.sha256);}
const require=createRequire(import.meta.url);
const {stringToBase64URL}=require(path.join(root,files[0]));
const {createChunks,MAX_CHUNK_SIZE}=require(path.join(root,files[1]));
assert.equal(MAX_CHUNK_SIZE,3180);let checks=1;
for(const [input,expected] of [['foo','base64-Zm9v'],['{}','base64-e30'],['café','base64-Y2Fmw6k'],['😀','base64-8J-YgA']]){assert.equal('base64-'+stringToBase64URL(input),expected);checks++;}
for(const [length,names,sizes] of [[2379,['sc-auth'],[3179]],[2380,['sc-auth.0','sc-auth.1'],[3180,1]]]){
 const chunks=createChunks('sc-auth','base64-'+stringToBase64URL('a'.repeat(length)));
 assert.deepEqual(chunks.map(x=>x.name),names);assert.deepEqual(chunks.map(x=>x.value.length),sizes);checks++;
}
process.stdout.write(JSON.stringify({code:'OFFICIAL_CODEC_ORACLE_PASSED',checks,sdkClientInstantiated:false,network:0})+'\n');
