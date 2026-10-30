import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { initializeCaptureServiceWorkerPolicy, captureHealthAfter, firstCaptureDiagnostic } from '../../scripts/landing/capture-policy.mjs';
const base = 'http://127.0.0.1:3110';
const run = (navigator, origin = base, expectedOrigin = base) => runInNewContext(`(${initializeCaptureServiceWorkerPolicy.toString()})(${JSON.stringify({expectedOrigin})})`, {location:{origin},navigator}, {timeout:1000});
const denied = error => error?.message === 'CAPTURE_SERVICE_WORKER_POLICY';

test('serialized guard removes configurable inherited and own APIs without invoking getters', () => {
 let reads=0; const parent={keep:'parent'}, nav=Object.create(parent);
 Object.defineProperty(parent,'serviceWorker',{configurable:true,get(){reads++;throw Error('PRIVATE');}});
 Object.defineProperty(nav,'serviceWorker',{configurable:true,get(){reads++;throw Error('PRIVATE');}});
 run(nav); assert.equal('serviceWorker' in nav,false); assert.equal(reads,0); assert.equal(parent.keep,'parent');
});
test('undefined shadow is removed along with inherited API rather than preserving feature detection', () => {
 const parent={serviceWorker:{}}, nav=Object.create(parent); Object.defineProperty(nav,'serviceWorker',{value:undefined,configurable:true});
 assert.equal('serviceWorker' in nav,true); run(nav); assert.equal('serviceWorker' in nav,false);
});
test('opaque and foreign origins never access navigator', () => {
 for (const origin of ['null','http://localhost:3110','http://127.0.0.1:3111','https://127.0.0.1:3110']) {
  let reads=0; const sandbox={location:{origin}}; Object.defineProperty(sandbox,'navigator',{get(){reads++;throw Error('PRIVATE');}});
  runInNewContext(`(${initializeCaptureServiceWorkerPolicy.toString()})(${JSON.stringify({expectedOrigin:base})})`,sandbox,{timeout:1000}); assert.equal(reads,0);
 }
});
test('non-loopback matching origins are refused before navigator access', () => {
 for (const origin of ['https://private.invalid','http://127.0.0.1:99999','http://user@127.0.0.1:3110']) {
  let reads=0; const sandbox={location:{origin}}; Object.defineProperty(sandbox,'navigator',{get(){reads++;throw Error('PRIVATE');}});
  assert.throws(()=>runInNewContext(`(${initializeCaptureServiceWorkerPolicy.toString()})(${JSON.stringify({expectedOrigin:origin})})`,sandbox,{timeout:1000}),denied); assert.equal(reads,0);
 }
});
test('nonconfigurable inherited property refuses before deleting a configurable own one', () => {
 let reads=0; const parent={}; Object.defineProperty(parent,'serviceWorker',{configurable:false,get(){reads++;return {};}});
 const nav=Object.create(parent); Object.defineProperty(nav,'serviceWorker',{value:{},configurable:true});
 assert.throws(()=>run(nav),denied); assert.equal(Object.hasOwn(nav,'serviceWorker'),true); assert.equal('serviceWorker' in nav,true); assert.equal(reads,0);
});
test('unknown or cyclic prototype chain refuses with no partial removal', () => {
 let nav=Object.create(null); const tail=nav; Object.defineProperty(tail,'serviceWorker',{value:{},configurable:true});
 for(let i=0;i<9;i++) nav=Object.create(nav); assert.throws(()=>run(nav),denied); assert.equal(Object.hasOwn(tail,'serviceWorker'),true);
 const loop=new Proxy({}, {getPrototypeOf(){return loop;}}); assert.throws(()=>run(loop),denied);
});
test('reflection deletion and final presence failures refuse without echoing input errors', () => {
 for(const handler of [{getOwnPropertyDescriptor(){throw Error('PRIVATE');}},{getPrototypeOf(){throw Error('PRIVATE');}}]) assert.throws(()=>run(new Proxy({},handler)),denied);
 const retained={serviceWorker:{}}; assert.throws(()=>run(new Proxy(retained,{deleteProperty(){return false;}})),denied); assert.equal(Object.hasOwn(retained,'serviceWorker'),true);
 assert.throws(()=>run(new Proxy({}, {has(target,key){return key==='serviceWorker' || Reflect.has(target,key);}})),denied);
});
test('unsupported navigator and repeated initialization are safe and leave unrelated state intact', () => {
 const parent={language:'pt-BR'}, nav=Object.create(parent); run(nav); run(nav); assert.equal(nav.language,'pt-BR');
 assert.throws(()=>run(null),denied); assert.throws(()=>run('navigator'),denied);
});
test('both init orders converge to absence with the exact Playwright block stub', () => {
 const block="if (navigator.serviceWorker) navigator.serviceWorker.register = async () => { console.warn('Service Worker registration blocked by Playwright'); };";
 for(const order of ['guard-first','stub-first']) {
  let reads=0,calls=0; const container={register(){calls++;}}, parent={}; Object.defineProperty(parent,'serviceWorker',{configurable:true,get(){reads++;return container;}}); const nav=Object.create(parent);
  const stub=()=>runInNewContext(block,{navigator:nav,console},{timeout:1000});
  if(order==='guard-first'){run(nav);stub();}else{stub();run(nav);}
  assert.equal('serviceWorker' in nav,false); assert.equal(calls,0); assert.equal(reads,order==='guard-first'?0:2);
 }
});
test('a different context keeps the ordinary PWA capability', () => {
 const untouched={serviceWorker:{}}, capture={serviceWorker:{}}; run(capture); assert.equal('serviceWorker' in capture,false); assert.equal('serviceWorker' in untouched,true);
});
test('fatal health and the first pageerror remain fatal independently of API absence', () => {
 const first=firstCaptureDiagnostic(null,{kind:'pageerror'},'readiness'), health=captureHealthAfter(0,{kind:'pageerror'});
 const nav={serviceWorker:{}};run(nav); assert.equal(captureHealthAfter(health,{kind:'http',status:200}),1);
 assert.deepEqual(firstCaptureDiagnostic(first,{kind:'http',status:500},'closing'),['CAPTURE_PAGE_ERROR','CAPTURE_PHASE_READINESS']);
});

