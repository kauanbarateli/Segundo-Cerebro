import { NextResponse } from "next/server";
import { onboardingRpcForRequest } from "@/adapters/db/onboarding-gateway";
import { decodeOnboardingAttributeCommand,decodeOnboardingAttributeQuery,decodeOnboardingAttributeResult,OnboardingAttributeValidationError } from "@/core/onboarding/attributes";
import { OnboardingPortError } from "@/core/onboarding/types";
import { requestAuthServices } from "@/lib/auth/runtime";
import { readAuthConfiguration } from "@/lib/auth/config";
import { sameOrigin,assertFeature } from "@/lib/auth/policy";
import { AuthGuardError } from "@/lib/auth/types";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers=()=>new Headers({"Cache-Control":"private, no-store, max-age=0",Pragma:"no-cache","X-Content-Type-Options":"nosniff"});
class Changed extends Error {}
async function services(request:Request,responseHeaders:Headers,write:boolean) {
 const config=readAuthConfiguration();if(config.mode!=="supabase")throw new AuthGuardError("demo");
 const actor=await(await requestAuthServices(true,responseHeaders)).gateway.readIdentity();if(!actor)throw new AuthGuardError("unauthenticated");
 if(actor.mustChangePassword)throw new AuthGuardError("forbidden");if(request.headers.get("x-expected-user-id")!==actor.userId)throw new Changed();assertFeature(actor,"configuracoes");
 if(write && (!sameOrigin(request.headers.get("origin"),config.appOrigin) || request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json"))throw new AuthGuardError("forbidden");
 return {rpc:onboardingRpcForRequest(config,actor),actor};
}
function failure(error:unknown,responseHeaders:Headers) {
 let code="UNAVAILABLE",status=503;
 if(error instanceof Changed){code="SESSION_CHANGED";status=409;}
 else if(error instanceof OnboardingAttributeValidationError){code="VALIDATION";status=400;}
 else if(error instanceof AuthGuardError){code=error.code.toUpperCase();status=error.code==="unauthenticated"?401:error.code==="forbidden"?403:503;}
 else if(error instanceof OnboardingPortError){code=error.code;status=code==="CONFLICT"?409:code==="FORBIDDEN"?403:503;}
 return NextResponse.json({ok:false,code,message:status===409?"Os dados ou a conta mudaram. Recarregue antes de salvar.":status===400?"Revise os campos informados.":"Não foi possível confirmar esta operação."},{status,headers:responseHeaders});
}
async function body(request:Request):Promise<unknown> {
 const reader=request.body?.getReader();if(!reader)throw new OnboardingAttributeValidationError();
 const parts:Uint8Array[]=[];let size=0;try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();throw new OnboardingAttributeValidationError();}parts.push(part.value);}try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts)));}catch{throw new OnboardingAttributeValidationError();}}finally{reader.releaseLock();}
}
export async function GET(request:Request) {
 const responseHeaders=headers();try {
  const {rpc,actor}=await services(request,responseHeaders,false),params=new URL(request.url).searchParams;
  if([...params.keys()].some(key=>!["kind","id"].includes(key)) || params.getAll("kind").length!==1 || params.getAll("id").length>1)throw new OnboardingAttributeValidationError();
  const query=decodeOnboardingAttributeQuery({kind:params.get("kind"),...(params.has("id")?{projectId:params.get("id")}: {})});if(query.kind==="project")assertFeature(actor,"projetos");
  const value=await rpc("attributes_read",query,false);let result;
  try{result=decodeOnboardingAttributeResult(value,query);}catch{throw new OnboardingPortError("UNAVAILABLE");}
  return NextResponse.json({ok:true,result},{headers:responseHeaders});
 }catch(error){return failure(error,responseHeaders);}
}
export async function PATCH(request:Request) {
 const responseHeaders=headers();try {
  const {rpc,actor}=await services(request,responseHeaders,true),command=decodeOnboardingAttributeCommand(await body(request));if(command.clientId.startsWith("onb:"))throw new OnboardingAttributeValidationError();if(command.kind==="project")assertFeature(actor,"projetos");
  const query=command.kind==="profile"?{kind:"profile" as const}:{kind:"project" as const,projectId:command.projectId};
  const value=await rpc("attributes_update",{...command},true);let result;
  try{result=decodeOnboardingAttributeResult(value,query);}catch{throw new OnboardingPortError("COMMIT_UNKNOWN");}
  return NextResponse.json({ok:true,result},{headers:responseHeaders});
 }catch(error){return failure(error,responseHeaders);}
}
