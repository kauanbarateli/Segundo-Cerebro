// Pure guards for an isolated synthetic PostgreSQL 17 observation.
const fail=()=>{throw Error('OFFLINE_REFUSED');};
export const IMAGE='postgres@sha256:31ba9c94a03ada9988f2bb493a22a75eef3a185884533e5cdbcd498ea835b08f';
export const IMAGE_SOURCE='https://hub.docker.com/layers/library/postgres/17.11/images/sha256-a65e6a841f6c4dbc4abda3d67fa3bc21824e9611064fcd82e87ea67aad60a0c3?tab=layers';
const ID=/^[a-f0-9]{64}$/,MARKER=/^[a-f0-9]{32}$/,SYS=/^[0-9]{16,20}$/;
export function requireImage(image){if(!image||image.Os!=='linux'||image.Architecture!=='amd64'||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||!Array.isArray(image.RepoDigests)||!image.RepoDigests.includes('postgres@sha256:'+IMAGE.split('sha256:')[1]))fail();return image.Id;}
/** Inspect returns full Docker state; never serialize it into the report. */
export function requireOfflineContainer(value,id,name,imageId,nonce,running=true){
 if(typeof running!=='boolean'||!ID.test(id)||!MARKER.test(nonce)||name!=='sc-front-b-offline-'+nonce||!value||value.Id!==id||value.Name!=='/'+name||value.Image!==imageId||value.State?.Running!==running||value.Config?.Labels?.['sc.front-b-offline']!==nonce)fail();
 const host=value.HostConfig,net=value.NetworkSettings;
 if(!host||host.NetworkMode!=='none'||host.Privileged!==false||host.PortBindings!==null&&Object.keys(host.PortBindings??{}).length!==0||host.Binds!==null&&host.Binds?.length!==0||!Array.isArray(value.Mounts)||value.Mounts.length!==0)fail();
 const tmpfs=host.Tmpfs,expected={'/var/lib/postgresql/data':'rw,nosuid,nodev,size=536870912','/var/run/postgresql':'rw,nosuid,nodev,size=16777216','/tmp':'rw,nosuid,nodev,size=16777216'};if(!tmpfs||Object.keys(tmpfs).sort().join(',')!==Object.keys(expected).sort().join(',')||Object.entries(expected).some(([path,options])=>tmpfs[path]!==options))fail();
 if(!net||Object.values(net.Ports??{}).some(x=>x!==null)||Object.keys(net.Networks??{}).join(',')!=='none'||net.Networks.none.IPAddress||net.Networks.none.GlobalIPv6Address)fail();
 return true;
}
/** SQL is issued inside one docker-exec/psql process, on its Unix socket. */
export function sameSessionGuard(nonce,systemIdentifier){
 if(!MARKER.test(nonce)||!SYS.test(systemIdentifier))fail();
 return `do $sc_guard$ begin if current_user<>'postgres' or current_database()<>'postgres' or inet_server_addr() is not null or inet_client_addr() is not null or current_setting('server_version_num')::integer<170000 or current_setting('server_version_num')::integer>=180000 or (select system_identifier::text from pg_control_system())<>'${systemIdentifier}' or (select count(*) from sc_front_b_observation.marker where nonce='${nonce}' and system_identifier='${systemIdentifier}')<>1 then raise exception 'OFFLINE_INSTANCE_REFUSED'; end if; end $sc_guard$;\n`;
}
/** Reject psql backslash commands outside PostgreSQL strings/comments. */
export function requireSqlBytes(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.includes(0))fail();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail();}
 let i=0;while(i<text.length){
  if(text[i]==='\\')fail();
  if(text.startsWith('--',i)){const end=text.indexOf('\n',i+2);i=end<0?text.length:end+1;continue;}
  if(text.startsWith('/*',i)){let depth=1;i+=2;while(i<text.length&&depth){if(text.startsWith('/*',i)){depth++;i+=2;}else if(text.startsWith('*/',i)){depth--;i+=2;}else i++;}if(depth)fail();continue;}
  if(text[i]==='"'){i++;let done=false;while(i<text.length){if(text[i]==='"'){if(text[i+1]==='"'){i+=2;continue;}i++;done=true;break;}i++;}if(!done)fail();continue;}
  if(text[i]==="'"){const escape=i>0&&/[eE]/.test(text[i-1])&&(i===1||!/[A-Za-z0-9_$]/.test(text[i-2]));i++;let done=false;while(i<text.length){if(escape&&text[i]==='\\'){i+=2;continue;}if(text[i]==="'"){if(text[i+1]==="'"){i+=2;continue;}i++;done=true;break;}i++;}if(!done)fail();continue;}
  if(text[i]==='$'&&(i===0||!/[A-Za-z0-9_$]/.test(text[i-1]))){const match=text.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);if(match){const end=text.indexOf(match[0],i+match[0].length);if(end<0)fail();i=end+match[0].length;continue;}}
  i++;
 }
 return bytes;
}
export function requireSameResults(before,after){if(JSON.stringify(before)!==JSON.stringify(after))fail();}
