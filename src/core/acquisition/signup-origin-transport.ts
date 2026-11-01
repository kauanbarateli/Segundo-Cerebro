import { SIGNUP_UTM_FIELDS } from './signup-origin';

/** Transport only the five allowed parameters; collection still requires consent. */
export function signupOriginQuery(input: Readonly<Record<string, string | string[] | undefined>>): string {
 const result:Record<string,string>={}, params=new URLSearchParams();
 for(const key of SIGNUP_UTM_FIELDS) {
  const raw=input[key]; if(typeof raw!=='string' || raw.length>800) continue;
  const value=raw.normalize('NFC').trim();
  if(!value || [...value].length>200 || /[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF<>]/u.test(value)) continue;
  result[key]=value;
  if(new TextEncoder().encode(JSON.stringify(result)).length>1000) {delete result[key];continue;}
  params.set(key,value);
 }
 const query=params.toString(); return query?`?${query}`:'';
}
