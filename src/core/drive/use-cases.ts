import { assinatura, ErroDeDominio, exigir, naoEncontrado, type ContextoDeEscrita } from "../contracts/base";
import { arvorePastas, caminhoPasta, nomeSeguroArquivo, nomeSeguroPasta } from "./rules";
import type { Arquivo, ComandoDrive, DependenciasDrive, DriveDTO, DriveStore, EventoDrive, Pasta, SnapshotDrive, TransacaoDrive } from "./types";
export function driveDTO(snapshot: SnapshotDrive):DriveDTO { const {folders,files,usage_bytes,capacity_bytes,max_file_bytes,projects}=snapshot;return structuredClone({folders,files:files.filter(file=>file.kind==="drive"),usage_bytes,capacity_bytes,max_file_bytes,projects}); }
export async function executarDrive(store:DriveStore,deps:DependenciasDrive,context:ContextoDeEscrita,request:ComandoDrive):Promise<Pasta|Arquivo>{
 request=structuredClone(request);exigir(request.input.client_id.trim().length>0&&request.input.client_id.length<=200,"Informe client_id.");const fingerprint=assinatura(request.input);
 return store.transaction(context,async tx=>{
  exigir([...tx.state.folders,...tx.state.files].every(item=>item.user_id===context.user_id),"Registro fora do usuário.");
  const receipt=tx.state.receipts.find(item=>item.command===request.command&&item.client_id===request.input.client_id);if(receipt){if(receipt.fingerprint!==fingerprint)throw new ErroDeDominio("CONFLICT","client_id utilizado com outro conteúdo.");return structuredClone(receipt.result) as Pasta|Arquivo;}
  const now=deps.clock.now();let result:Pasta|Arquivo;
  const emit=(type:EventoDrive["entity_type"],before:Pasta|Arquivo|null,after:Pasta|Arquivo,action:EventoDrive["action"]="updated")=>{if(before&&assinatura(before)===assinatura(after))return;tx.events.push({id:deps.ids.next(),user_id:context.user_id,entity_type:type,entity_id:after.id,action,canal:context.canal,occurred_at:now,before:structuredClone(before),after:structuredClone(after)});};
  const folder=(id:string)=>{const value=tx.state.folders.find(item=>item.id===id);if(!value)naoEncontrado();return value;};
  const validParent=(id:string|null)=>exigir(caminhoPasta(tx.state.folders,id)!==null,"Pasta de destino indisponível.");
  if(request.command==="drive.folder.create"){
   const input=request.input;validParent(input.parent_id??null);if(input.project_id)exigir(tx.state.projects.some(project=>project.id===input.project_id),"Projeto indisponível.");
   result={id:deps.ids.next(),user_id:context.user_id,name:nomeSeguroPasta(input.name),parent_id:input.parent_id??null,project_id:input.project_id??null,deleted_at:null,deletion_batch_id:null,position:tx.state.folders.length,created_at:now,updated_at:now};tx.state.folders.push(result);emit("drive_folder",null,result,"created");
  }else if(request.command.startsWith("drive.folder.")){
   const input=request.input as {id:string;name?:string;parent_id?:string|null;client_id:string};const item=folder(input.id);result=item;const before=structuredClone(item);
   if(request.command==="drive.folder.update"||request.command==="drive.folder.move"){
    exigir(!item.deleted_at,"Restaure a pasta antes de editar.");
    if(request.command==="drive.folder.update")item.name=nomeSeguroPasta(input.name);
    else{validParent(input.parent_id??null);exigir(!arvorePastas(tx.state.folders,item.id).some(child=>child.id===input.parent_id),"Uma pasta não pode ser movida para sua descendente.");item.parent_id=input.parent_id??null;}
    item.updated_at=now;emit("drive_folder",before,item);
   }else{
    const deleting=request.command.endsWith("delete");if(!!item.deleted_at!==deleting){if(!deleting)validParent(item.parent_id);const batch=deleting?deps.ids.next():item.deletion_batch_id;const subtree=arvorePastas(tx.state.folders,item.id),ids=new Set(subtree.map(child=>child.id));
     for(const child of subtree.filter(child=>deleting?!child.deleted_at:child.deletion_batch_id===batch)){const old=structuredClone(child);child.deleted_at=deleting?now:null;child.deletion_batch_id=deleting?batch:null;child.updated_at=now;emit("drive_folder",old,child,deleting?"deleted":"restored");}
     for(const file of tx.state.files.filter(file=>file.folder_id&&ids.has(file.folder_id)&&(deleting?!file.deleted_at:file.deletion_batch_id===batch))){const old=structuredClone(file);file.deleted_at=deleting?now:null;file.deletion_batch_id=deleting?batch:null;file.updated_at=now;file.modified_at=now;emit("drive_file",old,file,deleting?"deleted":"restored");}
    }
   }
  }else{
   const input=request.input as {id:string;name?:string;folder_id?:string|null;starred?:boolean;client_id:string};const item=tx.state.files.find(file=>file.id===input.id&&file.kind==="drive");if(!item)naoEncontrado();result=item;const before=structuredClone(item);
   if(request.command==="drive.file.delete"||request.command==="drive.file.restore"){
    const deleting=request.command.endsWith("delete");if(!!item.deleted_at!==deleting){if(!deleting)validParent(item.folder_id);item.deleted_at=deleting?now:null;item.deletion_batch_id=deleting?deps.ids.next():null;item.updated_at=now;item.modified_at=now;emit("drive_file",before,item,deleting?"deleted":"restored");}
   }else{
    exigir(!item.deleted_at,"Restaure o arquivo antes de editar.");if(request.command==="drive.file.update")item.name=nomeSeguroArquivo(input.name);else if(request.command==="drive.file.move"){validParent(input.folder_id??null);item.folder_id=input.folder_id??null;}else{exigir(typeof input.starred==="boolean","Informe o destaque.");item.starred=input.starred;}
    item.updated_at=now;item.modified_at=now;if(assinatura(before)!==assinatura(item))emit("drive_file",before,item);
   }
  }
  tx.state.receipts.push({user_id:context.user_id,command:request.command,client_id:request.input.client_id,fingerprint,result:structuredClone(result)});return structuredClone(result);
 });
}
export function validarSnapshotDrive(state:SnapshotDrive,actor:string){exigir(/^(0|[1-9][0-9]*)$/.test(state.revision),"Revisão inválida.");exigir([...state.folders,...state.files,...state.receipts].every(item=>item.user_id===actor),"Registro fora do usuário.");exigir([state.folders,state.files].every(rows=>new Set(rows.map(row=>row.id)).size===rows.length),"Identidade duplicada.");for(const folder of state.folders){const visited=new Set([folder.id]);let next=folder.parent_id;while(next){exigir(!visited.has(next),"Árvore cíclica.");visited.add(next);const parent=state.folders.find(item=>item.id===next);exigir(parent,"Pasta mãe inexistente.");next=parent.parent_id;}}exigir(state.files.every(file=>Number.isSafeInteger(file.bytes)&&file.bytes>0&&(file.folder_id===null||state.folders.some(folder=>folder.id===file.folder_id))),"Metadados de arquivo inválidos.");}
export type { TransacaoDrive };
