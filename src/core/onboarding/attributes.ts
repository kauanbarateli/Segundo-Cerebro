import type { OnboardingFocus, OnboardingProjectContext } from "./types";
export type OnboardingAttributeQuery = { kind: "profile" } | { kind: "project"; projectId: string };
export type OnboardingAttributeCommand =
 | { kind: "profile"; clientId: string; expectedRevision: string; patch: { displayName?: string; focus?: OnboardingFocus | null } }
 | { kind: "project"; projectId: string; clientId: string; expectedRevision: string; context: OnboardingProjectContext | null };
export type OnboardingAttributeResult =
 | { displayName: string | null; focus: OnboardingFocus | null; revision: string }
 | { projectId: string; context: OnboardingProjectContext | null; revision: string };
export class OnboardingAttributeValidationError extends Error { constructor(){super("ONBOARDING_ATTRIBUTE_VALIDATION");} }
const fail = (): never => {throw new OnboardingAttributeValidationError();};
function row(value: unknown, allowed: string[], required=allowed): Record<string,unknown> {
 if(!value || typeof value!=="object" || Array.isArray(value))return fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).some(key=>typeof key!=="string" || !allowed.includes(key)) || required.some(key=>!Object.hasOwn(descriptors,key)) || Object.values(descriptors).some(descriptor=>!("value" in descriptor)))return fail();
 return Object.fromEntries(Object.entries(descriptors).map(([key,descriptor])=>[key,descriptor.value]));
}
function text(value:unknown,max:number):string {if(typeof value!=="string" || !value.trim() || [...value].length>max || /[\u0000-\u001f\u007f]/.test(value))return fail();return value;}
function id(value:unknown):string {const result=text(value,36);return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result)?result.toLowerCase():fail();}
function focus(value:unknown):OnboardingFocus|null {return value===null || typeof value==="string" && ["work","study","personal","mixed"].includes(value)?value as OnboardingFocus|null:fail();}
function context(value:unknown):OnboardingProjectContext|null {return value===null || typeof value==="string" && ["personal","work","study"].includes(value)?value as OnboardingProjectContext|null:fail();}
export function decodeOnboardingAttributeQuery(value:unknown):OnboardingAttributeQuery {
 const input=row(value,["kind","projectId"],["kind"]);
 return input.kind==="profile" && !Object.hasOwn(input,"projectId")?{kind:"profile"}:input.kind==="project"?{kind:"project",projectId:id(input.projectId)}:fail();
}
export function decodeOnboardingAttributeCommand(value:unknown):OnboardingAttributeCommand {
 const input=row(value,["kind","projectId","clientId","expectedRevision","patch","context"],["kind","clientId","expectedRevision"]);
 const base={clientId:text(input.clientId,200),expectedRevision:text(input.expectedRevision,256)};
 if(input.kind==="profile") {
  if(Object.hasOwn(input,"projectId") || Object.hasOwn(input,"context"))return fail();
  const patch=row(input.patch,["displayName","focus"],[]);if(!Object.keys(patch).length)return fail();
  return {kind:"profile",...base,patch:{...(Object.hasOwn(patch,"displayName")?{displayName:text(patch.displayName,120).trim()}:{}),...(Object.hasOwn(patch,"focus")?{focus:focus(patch.focus)}:{})}};
 }
 if(input.kind!=="project" || Object.hasOwn(input,"patch"))return fail();
 return {kind:"project",projectId:id(input.projectId),...base,context:context(input.context)};
}
export function decodeOnboardingAttributeResult(value:unknown,query:OnboardingAttributeQuery):OnboardingAttributeResult {
 if(query.kind==="profile") {const result=row(value,["displayName","focus","revision"]);return {displayName:result.displayName===null?null:text(result.displayName,120),focus:focus(result.focus),revision:text(result.revision,256)};}
 const result=row(value,["projectId","context","revision"]);if(id(result.projectId)!==query.projectId)return fail();
 return {projectId:query.projectId,context:context(result.context),revision:text(result.revision,256)};
}
