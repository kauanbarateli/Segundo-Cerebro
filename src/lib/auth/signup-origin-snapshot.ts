/** Only the displayed state/revision crosses the form boundary; no origin values. */
export type SignupOriginSnapshot = Readonly<{ revision: string | null }>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseSignupOriginSnapshot(value:unknown):SignupOriginSnapshot|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!=='revision,status')return null;
 if(row.status==='absent'&&row.revision===null)return {revision:null};
 if(row.status==='active'&&typeof row.revision==='string'&&UUID.test(row.revision))return {revision:row.revision.toLowerCase()};
 return null;
}
export function parseSignupOriginForm(value:unknown):SignupOriginSnapshot|null {
 if(value==='absent')return {revision:null};
 return typeof value==='string'&&UUID.test(value)?{revision:value.toLowerCase()}:null;
}
