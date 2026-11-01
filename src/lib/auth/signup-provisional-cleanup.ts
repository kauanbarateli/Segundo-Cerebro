import "server-only";
import {createRequestClient,type AuthCookieJar} from "./clients";
import type {SupabaseAuthConfig} from "./config";
import {secureCookieOptions} from "./cookie-policy";
import {isProvisionalCookie,signupProvisionalCookie} from "./signup-provisional";

/** Best effort: a timeout does not prove revocation at the provider. */
export async function discardAdmittedProvisionalSession(config:SupabaseAuthConfig,jar:AuthCookieJar,headers:Headers,scope:string):Promise<void> {
 let root:string;
 try {root=signupProvisionalCookie(scope);}catch{return;}
 try {await createRequestClient(config,jar,true,headers,root,3000).auth.signOut({scope:"local"});}catch{/* Admission succeeded; provider outcome is unknown. */}
 finally {
  const expired=secureCookieOptions(config.secureCookies,{maxAge:0});
  let scoped:string[]=[];
  try {scoped=jar.getAll().filter(cookie=>isProvisionalCookie(cookie.name,scope)).map(cookie=>cookie.name);}catch{/* Cookie enumeration unavailable. */}
  for(const name of new Set([root,...scoped]))try{jar.set(name,"",expired);}catch{/* Admission must not be reported as failed. */}
 }
}
