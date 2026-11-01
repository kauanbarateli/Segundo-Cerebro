import { describe, expect, it } from 'vitest';
import { inspectMarker, prepareMarker, reconcile, recoveryDisposition, submissionDisposition } from '../../src/core/feedback/reconciliation';

const owner='ABCDEFGHIJKLMNOP';
const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002', feedback='90000000-0000-4000-8000-000000000001';
const marker=(clientId:string)=>({version:1 as const,clientId,ownerBinding:owner});
const receipt={status:'submitted',clientId:a,feedbackId:feedback};
function store(){let raw:string|null=null;return {getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;},current:()=>raw};}

describe('reconciliação após recarga',()=>{
 it('retém apenas o marcador, inclusive após resultado terminal, e exige verificar novamente',()=>{
  const s=store();expect(prepareMarker(s,marker(a)).status).toBe('ready');
  const before=s.current();expect(reconcile(s,owner,receipt).status).toBe('submitted');expect(s.current()).toBe(before);
  expect(inspectMarker(s,owner)).toEqual({status:'pending',clientId:a});
  expect(Object.keys(JSON.parse(before!)).sort()).toEqual(['clientId','ownerBinding','version']);
 });
 it('só substitui tentativa por outra quando o recibo terminal corresponde à chave e à mesma conta',()=>{
  const s=store();prepareMarker(s,marker(a));const before=s.current();
  expect(prepareMarker(s,marker(b)).status).toBe('blocked');
  expect(prepareMarker(s,marker(b),{status:'unknown',clientId:a}).status).toBe('blocked');
  expect(prepareMarker(s,{...marker(b),ownerBinding:'QRSTUVWXYZabcdef'},receipt).status).toBe('blocked');
  expect(s.current()).toBe(before);
  expect(prepareMarker(s,marker(b),receipt).status).toBe('ready');
  expect(reconcile(s,owner,receipt).status).toBe('unknown');
  expect(inspectMarker(s,owner)).toEqual({status:'pending',clientId:b});
 });
 it('mantém rascunho em conflito mesmo se a tentativa anterior estiver encerrada',()=>{
  expect(recoveryDisposition('submitted',true,true)).toBe('preserve-draft');
  expect(recoveryDisposition('cancelled',true,true)).toBe('preserve-draft');
  expect(recoveryDisposition('submitted',false,false)).toBe('resolve-terminal');
  expect(submissionDisposition('submitted',true)).toBe('preserve-draft');
  expect(submissionDisposition('cancelled',false)).toBe('preserve-draft');
  expect(submissionDisposition('submitted',false)).toBe('confirmed');
 });
 it('fecha o envio se a gravação falhar, inclusive quando o storage efetivou a escrita antes do erro',()=>{
  let raw:string|null=null;
  const s={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;throw Error('uncertain');}};
  expect(prepareMarker(s,marker(a)).status).toBe('blocked');expect(inspectMarker(s,owner)).toEqual({status:'pending',clientId:a});
 });
 it('ignora recibo atrasado da chave anterior após a substituição',()=>{
  const s=store();prepareMarker(s,marker(a));
  const cancelled={status:'cancelled',clientId:a};expect(reconcile(s,owner,cancelled).status).toBe('cancelled');
  expect(prepareMarker(s,marker(b),cancelled).status).toBe('ready');
  const before=s.current();expect(reconcile(s,owner,receipt).status).toBe('unknown');expect(s.current()).toBe(before);
 });
 it('recusa substituição se o marcador mudar entre as leituras',()=>{
  let raw=JSON.stringify(marker(a)),reads=0;
  const s={getItem:()=>{reads++;if(reads===2)raw=JSON.stringify(marker(b));return raw;},setItem:()=>{throw Error('unexpected');}};
  expect(prepareMarker(s,marker('30000000-0000-4000-8000-000000000003'),receipt).status).toBe('blocked');
  expect(inspectMarker(s,owner)).toEqual({status:'pending',clientId:b});
 });
});
