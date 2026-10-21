import { NextResponse } from "next/server";
import { exigir } from "@/core/contracts/base";
import { FILE_FEATURES, type EntityImagePurpose } from "@/core/drive/entity-images";
import { assertFeature } from "@/lib/auth/policy";
import { authorizeFilesRequest, fileHeaders, fileUuid, filesFailure } from "@/adapters/db/files-http";
import { entityImagesForRequest } from "@/adapters/db/entity-images-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = fileHeaders();
  try {
    const { config, actor } = await authorizeFilesRequest(request, headers);
    const params = new URL(request.url).searchParams, purpose = params.get("purpose"), entity = params.get("entity");
    exigir((purpose === "project_cover" || purpose === "home_focus_image" || purpose === "habit_image") && fileUuid(entity), "Destino de imagem inválido.");
    assertFeature(actor, FILE_FEATURES[purpose as EntityImagePurpose]);
    return NextResponse.json(await entityImagesForRequest(config, actor).get(purpose as EntityImagePurpose, entity.toLowerCase()), { headers });
  } catch (error) { return filesFailure(error, headers); }
}
