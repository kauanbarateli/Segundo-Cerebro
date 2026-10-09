import "server-only";
import { assinatura, ErroDeDominio, exigir, type ContextoDeEscrita } from "../../core/contracts/base";
import { validarSnapshotDrive, type DriveStore, type EventoDrive, type SnapshotDrive } from "../../core/drive";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
export interface DriveCommit { expected_revision:string; context:ContextoDeEscrita;changes:{type:"drive_folder"|"drive_file";before:unknown;after:unknown}[];events:EventoDrive[];receipt:ReciboIdempotente }
export interface DriveGateway { actorId:string;snapshot():Promise<SnapshotDrive>;commit(request:DriveCommit):Promise<{status:"stale"|"committed"|"replayed";result?:unknown}>;receipt(command:string,clientId:string):Promise<ReciboIdempotente|null> }
export class FilesCommitUnknown extends Error {constructor(){super("O envio ainda não foi confirmado. Confirme o mesmo envio.");this.name="FilesCommitUnknown";}}
export function createDriveStore(gateway:DriveGateway):DriveStore{
 const read=async()=>{const state=structuredClone(await gateway.snapshot());validarSnapshotDrive(state,gateway.actorId);return state;};
 return{snapshot:read,async transaction(context,work){exigir(context.user_id===gateway.actorId,"Usuário inválido.");for(let attempt=0;attempt<3;attempt++){
  const before=await read(),tx={state:structuredClone(before),events:[] as EventoDrive[]};const result=await work(tx);validarSnapshotDrive(tx.state,gateway.actorId);
  const fresh=tx.state.receipts.filter(receipt=>!before.receipts.some(old=>old.command===receipt.command&&old.client_id===receipt.client_id));if(!fresh.length)return structuredClone(result);exigir(fresh.length===1,"Recibo inválido.");const receipt=fresh[0]!;
  const changes:DriveCommit["changes"]=[];for(const key of ["folders","files"] as const){const previous=new Map(before[key].map(row=>[row.id,row]));for(const row of tx.state[key]){const old=previous.get(row.id)??null;if(assinatura(old)!==assinatura(row))changes.push({type:key==="folders"?"drive_folder":"drive_file",before:old,after:row});previous.delete(row.id);}exigir(!previous.size,"Não exclua metadados fisicamente.");}
  const remaining=[...tx.events];for(const change of changes){const index=remaining.findIndex(event=>event.entity_type===change.type&&assinatura(event.before)===assinatura(change.before)&&assinatura(event.after)===assinatura(change.after));if(index<0)throw new ErroDeDominio("EVENT_REQUIRED","Alteração sem evento.");remaining.splice(index,1);}exigir(!remaining.length,"Evento sem alteração.");
  try{const response=await gateway.commit({expected_revision:before.revision,context,changes,events:tx.events,receipt});if(response.status==="stale")continue;if(!Object.hasOwn(response,"result"))throw new FilesCommitUnknown();return structuredClone(response.result) as typeof result;}catch(error){if(!(error instanceof FilesCommitUnknown))throw error;const saved=await gateway.receipt(receipt.command,receipt.client_id);if(!saved)throw error;exigir(saved.fingerprint===receipt.fingerprint&&saved.user_id===context.user_id,"Recibo inválido.");return structuredClone(saved.result) as typeof result;}
 }throw new ErroDeDominio("CONFLICT","Os arquivos mudaram. Tente novamente com o mesmo envio.");}};
}
