import { NextResponse } from 'next/server';
import { parseMetricQuery, parseSignupMetrics } from '@/core/acquisition/signup-metrics';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedHostedDatabaseOrigin } from '@/lib/auth/database-origin-server';
import { assertFeature } from '@/lib/auth/policy';
import { requestAuthServices } from '@/lib/auth/runtime';
import { AuthGuardError } from '@/lib/auth/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';
class RequestFault extends Error { constructor(readonly status: 400 | 409) { super('Invalid request.'); } }
export async function GET(request: Request) {
 const headers=new Headers({'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff'});
 try {
  const config=readAuthConfiguration();
  if(config.mode!=='supabase' || !isTrustedHostedDatabaseOrigin(config)) throw new AuthGuardError('demo');
  const actor=await (await requestAuthServices(true,headers)).gateway.readIdentity();
  if(!actor) throw new AuthGuardError('unauthenticated');
  if(actor.mustChangePassword || actor.role!=='master') throw new AuthGuardError('forbidden');
  assertFeature(actor,'admin');
  if(request.headers.get('x-expected-user-id')!==actor.userId) throw new RequestFault(409);
  const query=parseMetricQuery(new URL(request.url).searchParams); if(!query) throw new RequestFault(400);
  const response=await fetch(new URL('/rest/v1/rpc/signup_metrics',config.supabaseUrl),{
   method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{'Content-Type':'application/json','Accept':'application/json',apikey:config.secretKey,Authorization:`Bearer ${config.secretKey}`},
   body:JSON.stringify({p_actor:actor.userId,p_session:actor.sessionId,p_start:query.start,p_end:query.end,p_zone:query.zone,p_bucket:query.bucket})
  });
  if(!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json') throw new Error('Unavailable.');
  const reader=response.body?.getReader(); if(!reader) throw new Error('Unavailable.');
  const chunks: Uint8Array[]=[]; let length=0;
  try { while(true) { const part=await reader.read(); if(part.done) break; length+=part.value.byteLength; if(length>524288) { await reader.cancel(); throw new Error('Unavailable.'); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(length); let offset=0; for(const chunk of chunks) {bytes.set(chunk,offset); offset+=chunk.byteLength;}
  const result=parseSignupMetrics(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown,query);
  if(!result) throw new Error('Unavailable.');
  return NextResponse.json({ok:true,result},{headers});
 } catch(error) {
  const status=error instanceof RequestFault ? error.status : error instanceof AuthGuardError ? error.code==='unauthenticated'?401:error.code==='forbidden'?403:503 : 503;
  return NextResponse.json({ok:false,message:status===400?'Revise o período informado.':status===409?'A conta mudou. Atualize a página.':'Não foi possível carregar as métricas.'},{status,headers});
 }
}
