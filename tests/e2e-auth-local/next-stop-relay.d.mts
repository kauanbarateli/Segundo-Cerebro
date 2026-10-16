export interface NextStopSelection { readonly nonce:string; readonly caseName:"BLOCK_LIVE_BROWSER"|"FIRST_FORCED_BROWSER"|"RECOVERY"; readonly sourceSha:string }
export interface NextStopGate { stagePassed:boolean; ui:number; sdk:number; sql:number; nonRead:number; unknown:boolean }
export interface WorkerNextStop {
 capture(request:object,row:object,observation:{method:string;url:string}):boolean;
 replace(request:object,previousRow:object,nextRow:object|undefined):boolean;
 request(deadlineMs:number,minimumAt:number):"EMITTED"|"REFUSED"|"INELIGIBLE"|"NOT_NEEDED";
 /** Pure observation of the original attempt; never retries or reads a gate. */
 snapshot():import("./admin-browser-contract.mjs").WorkerNextStopDiagnostic|null;
}
export const SOURCE_PINS:readonly Readonly<{path:string;bytes:number;sha256:string}>[];
export const NEXT_STOP_INVENTORY_ABSENT:readonly string[];
export function nextStopEnvironment(env:Readonly<Record<string,string|undefined>>,expectedCase?:NextStopSelection["caseName"]):NextStopSelection;
export function qualifyNextStaticRuntime(dependencies?:object):Promise<object>;
export function prepareWorkerNextStop(options:{env:Readonly<Record<string,string|undefined>>;caseName:NextStopSelection["caseName"];testInfo:{workerIndex:number;retry:number};pending:ReadonlyMap<object,object>;readGate:()=>NextStopGate;dependencies?:object}):Promise<WorkerNextStop>;
