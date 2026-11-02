import {createHmac,timingSafeEqual} from "node:crypto";
import {signSignupCheckpoint,verifySignupCheckpoint,type SignupCheckpoint} from "./signup-checkpoint";

export const SIGNUP_RECONSENT_COOKIE="sc-flow-signup-reconsent";
export type SignupReconsentCheckpoint={checkpoint:SignupCheckpoint;terms:string;privacy:string};
const validVersions=(terms:unknown,privacy:unknown)=>typeof terms==="string" && terms.length>0 && terms.length<=100 && typeof privacy==="string" && privacy.length>0 && privacy.length<=100;
const mac=(body:string,key:string)=>createHmac("sha256",key).update(`signup-reconsent:v1.${body}`).digest();
/** Only issued after this request verified OTP and the database found a stale intent. */
export function signSignupReconsent(value:SignupReconsentCheckpoint,key:string,now:number):string {
 if(!validVersions(value.terms,value.privacy) || value.checkpoint.passwordConfirmed)throw Error("Invalid reconsent proof.");
 const checkpoint=signSignupCheckpoint(value.checkpoint,key,now),body=Buffer.from(JSON.stringify({checkpoint,terms:value.terms,privacy:value.privacy})).toString("base64url");
 return `${body}.${mac(body,key).toString("base64url")}`;
}
export function verifySignupReconsent(token:string|undefined,key:string,now:number):SignupReconsentCheckpoint|null {
 if(typeof token!=="string" || token.length>4096 || typeof key!=="string" || Buffer.byteLength(key,"utf8")<32)return null;
 const parts=token.split(".");if(parts.length!==2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
 try {
  const expected=mac(parts[0],key),provided=Buffer.from(parts[1],"base64url");
  if(provided.length!==expected.length || provided.toString("base64url")!==parts[1] || !timingSafeEqual(provided,expected))return null;
  const value:unknown=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).sort().join(",")!=="checkpoint,privacy,terms")return null;
  const data=value as Record<string,unknown>;if(!validVersions(data.terms,data.privacy) || typeof data.checkpoint!=="string")return null;
  const checkpoint=verifySignupCheckpoint(data.checkpoint,key,now);if(!checkpoint || checkpoint.passwordConfirmed)return null;
  return {checkpoint,terms:data.terms as string,privacy:data.privacy as string};
 }catch{return null;}
}
/** Non-secret form binding prevents one tab from submitting another tab's proof. */
export function signupReconsentFormTag(token:string,key:string):string {
 if(typeof token!=="string" || token.length>4096 || typeof key!=="string" || Buffer.byteLength(key,"utf8")<32)throw Error("Invalid reconsent proof.");
 return createHmac("sha256",key).update("signup-reconsent-form:v1\0").update(token).digest("hex");
}
export function matchesSignupReconsentFormTag(token:string,key:string,tag:string|undefined):boolean {
 if(typeof tag!=="string" || !/^[a-f0-9]{64}$/.test(tag))return false;
 const expected=Buffer.from(signupReconsentFormTag(token,key),"hex"),provided=Buffer.from(tag,"hex");
 return provided.length===expected.length && timingSafeEqual(provided,expected);
}
