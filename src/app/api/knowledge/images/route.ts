import { NextResponse } from "next/server";
import { exigir } from "@/core/contracts/base";
import { authorizeFilesRequest, fileHeaders, filesFailure, fileUuid } from "@/adapters/db/files-http";
import { signedKnowledgeImage } from "@/adapters/db/knowledge-images-runtime";
import { assertFeature } from "@/lib/auth/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = fileHeaders();
  try {
    const params = new URL(request.url).searchParams;
    exigir([...params.keys()].every(key => ["user", "page", "file"].includes(key)) && [...params.keys()].length === 3, "Informe a página e a imagem.");
    const page = params.get("page"), file = params.get("file"), user = params.get("user");
    exigir(fileUuid(page) && fileUuid(file) && fileUuid(user), "Imagem inválida.");
    const bound = new Request(request.url, { headers: request.headers }); bound.headers.set("x-expected-user-id", user);
    const { config, actor } = await authorizeFilesRequest(bound, headers);
    assertFeature(actor, "conhecimento");
    return NextResponse.redirect(await signedKnowledgeImage(config, actor, page, file), { status: 302, headers });
  } catch (error) { return filesFailure(error, headers); }
}
