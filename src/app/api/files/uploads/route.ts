import { NextResponse } from "next/server";
import { exigir } from "@/core/contracts/base";
import type { TipoArquivo } from "@/core/drive";
import { assertFeature } from "@/lib/auth/policy";
import { authorizeFilesRequest,fileHeaders,fileObject,fileUuid,filesFailure,readFilesBody } from "@/adapters/db/files-http";
import { filesServicesForRequest } from "@/adapters/db/files-runtime";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){const headers=fileHeaders();try{const{config,actor}=await authorizeFilesRequest(request,headers,true);const value=await readFilesBody(request);exigir(fileObject(value)&&Object.keys(value).every(key=>["kind","name","folder_id","client_id"].includes(key))&&["drive","capture_image","avatar"].includes(String(value.kind))&&typeof value.name==="string"&&typeof value.client_id==="string"&&value.client_id.trim().length>0&&value.client_id.length<=200&&(value.folder_id===undefined||value.folder_id===null||fileUuid(value.folder_id)),"Reserva inválida.");assertFeature(actor,value.kind==="drive"?"drive":value.kind==="capture_image"?"capturar":"configuracoes");exigir(value.kind==="drive"||!value.folder_id,"Este envio não pertence a uma pasta.");const result=await filesServicesForRequest(config,actor).reserve(value.kind as TipoArquivo,value.name,value.folder_id as string|null??null,value.client_id);return NextResponse.json(result,{headers});}catch(error){return filesFailure(error,headers);}}
