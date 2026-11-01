import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE,requireImage,requireOfflineContainer,sameSessionGuard,requireSqlBytes } from './offline-contract.mjs';
import { checkReadonlyContainer } from './runner.mjs';
const id='a'.repeat(64),nonce='b'.repeat(32),imageId='sha256:'+'c'.repeat(64),name='sc-front-b-offline-'+nonce;
function state(){return {Id:id,Name:'/'+name,Image:imageId,State:{Running:true},Config:{Labels:{'sc.front-b-offline':nonce}},HostConfig:{NetworkMode:'none',Privileged:false,ReadonlyRootfs:true,PortBindings:{},Binds:[],Tmpfs:{'/var/lib/postgresql/data':'rw,nosuid,nodev,size=536870912','/var/run/postgresql':'rw,nosuid,nodev,size=16777216','/tmp':'rw,nosuid,nodev,size=16777216'}},Mounts:[],NetworkSettings:{Ports:{},Networks:{none:{IPAddress:'',GlobalIPv6Address:''}}}};}
test('valid image digest and container identity pass; mutable network and mounts fail',()=>{
 assert.equal(requireImage({Os:'linux',Architecture:'amd64',Id:imageId,RepoDigests:[IMAGE]}),imageId);
 const ok=state();assert(requireOfflineContainer(ok,id,name,imageId,nonce));assert.doesNotThrow(()=>checkReadonlyContainer(ok));
 for(const mutate of [o=>o.Id='d'.repeat(64),o=>o.Config.Labels['sc.front-b-offline']='e'.repeat(32),o=>o.HostConfig.NetworkMode='host',o=>o.HostConfig.ReadonlyRootfs=false,o=>o.HostConfig.Privileged=true,o=>o.HostConfig.PortBindings={'5432/tcp':[{}]},o=>o.Mounts.push({Source:'/home'}),o=>o.HostConfig.Binds=['/host:/data'],o=>o.NetworkSettings.Networks.none.IPAddress='127.0.0.1',o=>o.HostConfig.Tmpfs['/tmp']='rw',o=>o.Image='sha256:'+'d'.repeat(64)]){
  const x=state();mutate(x);assert.throws(()=>{requireOfflineContainer(x,id,name,imageId,nonce);checkReadonlyContainer(x);});
 }
 assert.throws(()=>requireImage({Os:'linux',Architecture:'amd64',Id:imageId,RepoDigests:['postgres@sha256:'+'d'.repeat(64)]}));
});
test('session guard validates identity formats and SQL scanner rejects psql commands',()=>{
 assert(sameSessionGuard(nonce,'1234567890123456789').includes(nonce));
 assert.throws(()=>sameSessionGuard('x','1234567890123456789'));
 assert.throws(()=>sameSessionGuard(nonce,"1'; drop table x;--"));
 assert.throws(()=>requireSqlBytes(Buffer.from('select 1;\n\\! whoami\n')));
 assert.throws(()=>requireSqlBytes(Buffer.from('select 1;\n\\gexec\n')));
});
