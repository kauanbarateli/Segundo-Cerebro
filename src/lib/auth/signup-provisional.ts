import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
type SignupCookieReader={getAll():{name:string;value:string}[]};

export const SIGNUP_CONTEXT_COOKIE="sc-flow-signup-context";
export const SIGNUP_CONTEXT_SECONDS=24*60*60;
const NONCE=/^[A-Za-z0-9_-]{43}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SignupContext={scope:string;userId:string;sessionId:string};
type SignedSignupContext=SignupContext&{issuedAt:number;expiresAt:number};
export function signupProvisionalCookie(scope:string):string {
 if(!NONCE.test(scope))throw Error("Invalid provisional scope.");
 return `sc-signup-provisional-${scope}`;
}
export function isProvisionalCookie(name:string,scope:string):boolean {
 const root=signupProvisionalCookie(scope);return name===root||name.startsWith(`${root}.`)||name.startsWith(`${root}-`);
}
const mac=(body:string,key:string)=>createHmac("sha256",key).update(`signup-provisional-context:v1.${body}`).digest();
export function signSignupContext(value:SignupContext,key:string,now=Date.now()):string {
 if(Buffer.byteLength(key,"utf8")<32||!NONCE.test(value.scope)||!UUID.test(value.userId)||!UUID.test(value.sessionId)||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(now+SIGNUP_CONTEXT_SECONDS*1000))throw Error("Invalid provisional context.");
 const body=Buffer.from(JSON.stringify({...value,issuedAt:now,expiresAt:now+SIGNUP_CONTEXT_SECONDS*1000})).toString("base64url");return `${body}.${mac(body,key).toString("base64url")}`;
}
export function verifySignupContext(token:string|undefined,key:string,now=Date.now()):SignedSignupContext|null {
 if(typeof token!=="string"||token.length>1024||Buffer.byteLength(key,"utf8")<32||!Number.isSafeInteger(now))return null;
 const parts=token.split(".");if(parts.length!==2||!parts[0]||!parts[1]||!/^[-_A-Za-z0-9]+$/.test(parts[0])||!/^[-_A-Za-z0-9]+$/.test(parts[1]))return null;
 try {const supplied=Buffer.from(parts[1],"base64url"),expected=mac(parts[0],key);if(supplied.length!==expected.length||supplied.toString("base64url")!==parts[1]||!timingSafeEqual(supplied,expected))return null;
  const value:unknown=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!=="expiresAt,issuedAt,scope,sessionId,userId")return null;
  const v=value as Record<string,unknown>;if(typeof v.scope!=="string"||typeof v.userId!=="string"||typeof v.sessionId!=="string"||!NONCE.test(v.scope)||!UUID.test(v.userId)||!UUID.test(v.sessionId)||typeof v.issuedAt!=="number"||typeof v.expiresAt!=="number"||!Number.isSafeInteger(v.issuedAt)||!Number.isSafeInteger(v.expiresAt)||v.issuedAt<0||v.issuedAt>now||v.expiresAt<=now||v.expiresAt<=v.issuedAt||v.expiresAt-v.issuedAt>SIGNUP_CONTEXT_SECONDS*1000)return null;
  return {scope:v.scope,userId:v.userId,sessionId:v.sessionId,issuedAt:v.issuedAt,expiresAt:v.expiresAt};
 }catch{return null;}
}
export function readSignupContext(jar:SignupCookieReader,key:string):SignupContext|null {
 const matches=jar.getAll().filter(c=>c.name===SIGNUP_CONTEXT_COOKIE);return matches.length===1?verifySignupContext(matches[0]?.value,key):null;
}
