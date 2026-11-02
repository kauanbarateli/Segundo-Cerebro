import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SIGNUP_BROWSER_COOKIE } from "./signup-channel";

/** Read the raw Cookie header: framework cookie maps may collapse duplicates. */
export function readSignupBrowserCookie(header: string | null): {status:"missing"}|{status:"invalid"}|{status:"ready";value:string} {
 const matches=(header??"").split(";").map(part=>part.trim()).filter(part=>part.split("=",1)[0]===SIGNUP_BROWSER_COOKIE);
 if(matches.length===0)return {status:"missing"};
 if(matches.length!==1)return {status:"invalid"};
 const value=matches[0]!.slice(SIGNUP_BROWSER_COOKIE.length+1);
 return /^[A-Za-z0-9_-]{43}$/.test(value)?{status:"ready",value}:{status:"invalid"};
}

/** Server-side only: never expose the key or persist/log the returned secret. */
export function newSignupBrowserSecret(): string { return randomBytes(32).toString("base64url"); }

export function signupBrowserSecretHash(secret: string, key: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || typeof key !== "string" || Buffer.byteLength(key, "utf8") < 32) throw Error("Invalid signup browser secret.");
  return createHmac("sha256", key).update("signup-browser:v1\0").update(secret).digest("hex");
}

/** The browser receives this independent tag, never the HttpOnly secret. */
export function signupBrowserPostTag(secret:string,key:string):string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || typeof key!=="string" || Buffer.byteLength(key,"utf8")<32) throw Error("Invalid signup browser secret.");
  return createHmac("sha256",key).update("signup-browser-post:v1\0").update(secret).digest("hex");
}
export function matchesSignupBrowserPostTag(secret:string,key:string,tag:string|null):boolean {
  if(typeof tag!=="string" || !/^[a-f0-9]{64}$/.test(tag)) return false;
  const expected=Buffer.from(signupBrowserPostTag(secret,key),"hex"), provided=Buffer.from(tag,"hex");
  return provided.length===expected.length && timingSafeEqual(expected,provided);
}
