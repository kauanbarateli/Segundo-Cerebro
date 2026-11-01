import { NextResponse } from 'next/server';
import { feedbackBarrierRpc, FeedbackGatewayError } from '@/adapters/db/feedback-gateway';
import { parseBarrierCommand } from '@/core/feedback/barrier-contract';
import { readAuthConfiguration } from '@/lib/auth/config';
import { sameOrigin } from '@/lib/auth/policy';
import { requestAuthServices } from '@/lib/auth/runtime';
import { AuthGuardError } from '@/lib/auth/types';
import { feedbackReconciliationReady } from '@/lib/feedback/reconciliation-gate';
import { runReconciliation } from '@/lib/feedback/reconciliation-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers=()=>new Headers({'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
const failure=(status:number,code:string,resultHeaders:Headers)=>NextResponse.json({ok:false,code},{status,headers:resultHeaders});
export async function POST(request:Request) {
  const resultHeaders=headers();
  try {
    // This is deliberately hard-disabled before reading request or contacting a service.
    if(!feedbackReconciliationReady())return failure(503,'UNAVAILABLE',resultHeaders);
    const config=readAuthConfiguration();
    if(config.mode!=='supabase'||!sameOrigin(request.headers.get('origin'),config.appOrigin)||request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return failure(403,'FORBIDDEN',resultHeaders);
    if(new URL(request.url).search)return failure(400,'VALIDATION',resultHeaders);
    const actor=await (await requestAuthServices(true,resultHeaders)).gateway.readIdentity();
    if(!actor)return failure(401,'UNAUTHENTICATED',resultHeaders);
    if(actor.mustChangePassword)return failure(403,'FORBIDDEN',resultHeaders);
    if(request.headers.get('x-expected-user-id')!==actor.userId)return failure(409,'SESSION_CHANGED',resultHeaders);
    const reader=request.body?.getReader();if(!reader)return failure(400,'VALIDATION',resultHeaders);
    const chunks:Uint8Array[]=[];let bytes=0;
    try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2048){await reader.cancel();return failure(400,'VALIDATION',resultHeaders);}chunks.push(part.value);}}
    finally{reader.releaseLock();}
    let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{return failure(400,'VALIDATION',resultHeaders);}
    const command=parseBarrierCommand(raw);if(!command)return failure(400,'VALIDATION',resultHeaders);
    const result=await runReconciliation({ready:feedbackReconciliationReady,perform:(who,operation)=>feedbackBarrierRpc(config,who,operation)},actor,command);
    return NextResponse.json({ok:true,result},{headers:resultHeaders});
  }catch(error){
    if(error instanceof AuthGuardError && error.code==='unauthenticated')return failure(401,'UNAUTHENTICATED',resultHeaders);
    if((error instanceof AuthGuardError && error.code==='forbidden')||(error instanceof FeedbackGatewayError&&error.code==='FORBIDDEN'))return failure(403,'FORBIDDEN',resultHeaders);
    return failure(503,'UNAVAILABLE',resultHeaders);
  }
}
