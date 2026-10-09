import { NextResponse } from "next/server";
import { exigir } from "@/core/contracts/base";
import { authorizeFilesRequest,fileHeaders,fileUuid,filesFailure } from "@/adapters/db/files-http";
import { filesServicesForRequest } from "@/adapters/db/files-runtime";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){const headers=fileHeaders();try{const expected=new URL(request.url).searchParams.get("user");const safeRequest=new Request(request.url,{headers:request.headers});if(expected)safeRequest.headers.set("x-expected-user-id",expected);const{config,actor}=await authorizeFilesRequest(safeRequest,headers);const params=new URL(request.url).searchParams,id=params.get("id");exigir(fileUuid(id),"Arquivo inválido.");const result=await filesServicesForRequest(config,actor).signedRead(id,params.get("download")==="1");return NextResponse.redirect(result.url,{status:302,headers});}catch(error){return filesFailure(error,headers);}}
