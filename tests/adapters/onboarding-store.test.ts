import { describe, expect, it, vi } from "vitest";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { createOnboardingStore } from "../../src/adapters/db/onboarding-store";
import { parsePendingOnboardingIntent } from "../../src/adapters/db/onboarding-commands";
import type { OnboardingRpc } from "../../src/adapters/db/onboarding-protocol";
import type { OnboardingSnapshot } from "../../src/core/onboarding/types";
const owner = "28000000-0000-4000-8000-000000000001", round = "28000000-0000-4000-8000-000000000002", item = "28000000-0000-4000-8000-000000000003", intentId = "28000000-0000-4000-8000-000000000004";
const draft = { profile: {}, habits: [], projects: [], tasks: [], notes: null };
function snapshot(): OnboardingSnapshot {return { schemaVersion: 1, ownerId: owner, today: "2026-10-23", timeZone: "America/Sao_Paulo",
 eligibility: { kind: "existing_opt_in", canStart: true, offerPending: false, reason: null }, capabilities: { configuracoes: true, calendario: true, habitos: true, projetos: true, tarefas: true, conhecimento: true, financeiro: true, cofre: true },
 profile: { displayName: null, focus: null, revision: "baseline" }, round: null, recovery:[], calendar: { status: "not_configured", canConnect: false, accounts: [], sources: [] } };}
function intent() {return { intentId, roundId: round, roundGeneration:owner,intentVersion:1,choice:{kind:"project",name:"Privado",context:null},slot: `project:${item}`, itemKey: item, kind: "project", command: "project.create", input: { name: "Privado", client_id: `onb:${round}:project:${item}:v1` }, bindings: [], extras: {}, ordinal: 0 };}
describe("durable coordinator boundaries, no SDK, network or database", () => {
 it("persists an incomplete choice while saving without submitting any module effect",async()=>{
  const partial={...draft,projects:[{key:item,name:""}]},execute=vi.fn(),saved:Record<string,unknown>[]=[];
  const rpc:OnboardingRpc=async(operation,request)=>{if(operation==="save")saved.push(request);return operation==="snapshot"?{...snapshot(),round:{id:round,revision:"1",status:"active",step:"projects",draft:partial,editedAt:"2026-10-23T12:00:00.000Z",expiresAt:"2026-11-22T12:00:00.000Z",receipts:[]}}:{};};
  await createOnboardingStore(owner,rpc,execute).save({roundId:round,expectedRevision:"0",clientId:"save",draft:partial,step:"projects"});
  expect(saved[0]?.draft).toEqual(partial);expect(execute).not.toHaveBeenCalled();
 });
 it("cannot submit an effect when binding its body is inconclusive", async () => {
  const execute = vi.fn();const rpc: OnboardingRpc = vi.fn(async operation => {if(operation === "peek_intent") return intent();throw new Error("unknown binding");});
  await expect(createOnboardingStore(owner,rpc,execute).advance({ roundId: round,clientId: "advance" })).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
 });
 it("executes one frozen effect and asks SQL to reconcile, without passing a claimed result or entity ID", async () => {
  const calls: {operation: string;request: Record<string,unknown>}[]=[];const execute=vi.fn();
  const rpc: OnboardingRpc=async(operation,request)=>{calls.push({operation,request});return operation==="peek_intent"?intent():operation==="snapshot"?snapshot():{};};
  await createOnboardingStore(owner,rpc,execute).advance({roundId:round,clientId:"advance"});
  expect(execute).toHaveBeenCalledTimes(1);expect(calls.map(value=>value.operation)).toEqual(["peek_intent","bind_intent","record","complete","snapshot"]);
  expect(calls[2]?.request).toEqual({roundId:round,intentId,intentVersion:1,roundGeneration:owner,outcome:"reconcile",reason:null});
  expect(calls[1]?.request.canonicalInput).toBe(JSON.stringify({client_id:`onb:${round}:project:${item}:v1`,name:"Privado"}));
 });
 it.each([[new Error("transport lost"),"unknown","commit_unknown"],[new ErroDeDominio("CONFLICT","changed"),"failed","conflict"],[new ErroDeDominio("NOT_FOUND","missing"),"failed","validation"]] as const)("records uncertainty separately from a negative domain result %#",async(error,outcome,reason)=>{
  const calls:Record<string,unknown>[]=[];const rpc:OnboardingRpc=async(operation,request)=>{if(operation==="record") calls.push(request);return operation==="peek_intent"?intent():operation==="snapshot"?snapshot():{};};
  await createOnboardingStore(owner,rpc,async()=>{throw error;}).advance({roundId:round,clientId:"advance"});expect(calls).toEqual([{roundId:round,intentId,intentVersion:1,roundGeneration:owner,outcome,reason}]);
 });
 it("does not report success when the reconciliation write itself is inconclusive",async()=>{
  const rpc:OnboardingRpc=async operation=>{if(operation==="record") throw new Error("lost reply");return operation==="peek_intent"?intent():operation==="snapshot"?snapshot():{};};
  await expect(createOnboardingStore(owner,rpc,async()=>undefined).advance({roundId:round,clientId:"same-id"})).rejects.toThrow();
 });
 it("confirmation composes the saved draft and baseline, not a client-supplied batch",async()=>{
  const requests:Record<string,unknown>[]=[];const rpc:OnboardingRpc=async(operation,request)=>{if(operation==="prepare")requests.push(request);return operation==="prepare_context"?{roundId:round,revision:"9",draft,profileRevision:"baseline"}:operation==="snapshot"?snapshot():{};};
  await createOnboardingStore(owner,rpc,async()=>undefined).confirm({roundId:round,expectedRevision:"9",clientId:"confirm"});
  expect(requests).toEqual([{roundId:round,expectedRevision:"9",clientId:"confirm",plan:[]}]);
 });
 it("rejects a read model whose owner changed, even if the request was previously authenticated",async()=>{
  const rpc:OnboardingRpc=async()=>({...snapshot(),ownerId:item});await expect(createOnboardingStore(owner,rpc,async()=>undefined).load()).rejects.toThrow();
 });
 it("does not call a saved write a validation failure when its following read is invalid",async()=>{
  const rpc:OnboardingRpc=async operation=>operation==="snapshot"?({...snapshot(),ownerId:item}):{};
  await expect(createOnboardingStore(owner,rpc,async()=>undefined).start({clientId:"start"})).rejects.toMatchObject({code:"COMMIT_UNKNOWN"});
 });
 it("can replay confirmation after its draft was scrubbed without generating another plan",async()=>{
  const calls:string[]=[];const rpc:OnboardingRpc=async operation=>{calls.push(operation);return operation==="prepare_context"?{roundId:round,prepared:true}:snapshot();};
  await createOnboardingStore(owner,rpc,async()=>undefined).confirm({roundId:round,expectedRevision:"9",clientId:"confirm"});
  expect(calls).toEqual(["prepare_context","snapshot"]);
 });
 it.each([
  {command:"task.delete"},{roundId:item},{input:{client_id:"new-id"}},{extras:{context:"invented"}},
  {bindings:[{field:"user_id",slot:`project:${item}`}]},{bindings:[{field:"project_id",slot:"by-title"}]},{ownerId:owner},
 ])("refuses an unbound or expanded module command %#",patch=>expect(()=>parsePendingOnboardingIntent({...intent(),...patch},round)).toThrow());
 it("does not silently accept paginated choices in the wrong feature",async()=>{
  const rpc:OnboardingRpc=async()=>({kind:"notebooks",items:[],nextCursor:null});await expect(createOnboardingStore(owner,rpc,async()=>undefined).choices({kind:"projects",query:"",cursor:null})).rejects.toThrow();
 });
 it("amends only the frozen slot version returned by SQL, never a caller-supplied module identity",async()=>{
  const writes:Record<string,unknown>[]=[];const rpc:OnboardingRpc=async(op,request)=>{
   if(op==="amend_context")return {roundId:round,itemKey:item,nextVersion:2};if(op==="amend")writes.push(request);return op==="snapshot"?snapshot():{};
  };
  const input={roundId:round,expectedRevision:"9",clientId:owner,intentId,change:{kind:"replace" as const,value:{kind:"project" as const,name:"Corrigido",context:null}}};
  await createOnboardingStore(owner,rpc,vi.fn()).amend(input);
  expect(writes[0]).toMatchObject({...input,plan:{slot:`project:${item}`,input:{client_id:`onb:${round}:project:${item}:v2`}}});
 });
 it("replays a committed amendment without generating another version or calling an executor",async()=>{
  const operations:string[]=[];const execute=vi.fn();const rpc:OnboardingRpc=async op=>{operations.push(op);return op==="amend_context"?{roundId:round,prepared:true}:snapshot();};
  await createOnboardingStore(owner,rpc,execute).amend({roundId:round,expectedRevision:"8",clientId:owner,intentId,change:{kind:"omit",dependents:"deny",dependentIntentIds:[]}});
  expect(operations).toEqual(["amend_context","snapshot"]);expect(execute).not.toHaveBeenCalled();
 });
 it("an inconclusive amendment never falls through into advance or a second version",async()=>{
  const operations:string[]=[];const execute=vi.fn();const rpc:OnboardingRpc=async op=>{operations.push(op);if(op==="amend_context")return {roundId:round,itemKey:item,nextVersion:2};if(op==="amend")throw new Error("lost response");return snapshot();};
  await expect(createOnboardingStore(owner,rpc,execute).amend({roundId:round,expectedRevision:"8",clientId:owner,intentId,change:{kind:"omit",dependents:"deny",dependentIntentIds:[]}})).rejects.toThrow();
  expect(operations).toEqual(["amend_context","amend"]);expect(execute).not.toHaveBeenCalled();
 });
 it.each([{roundGeneration:undefined},{intentVersion:0},{intentVersion:2,input:{client_id:`onb:${round}:project:${item}:v1`}},{choice:{kind:"task",title:"Alterar tipo",project:null,due:{kind:"none"}}}])("rejects missing/forged generation or version before binding %#",patch=>expect(()=>parsePendingOnboardingIntent({...intent(),...patch},round)).toThrow());
});
