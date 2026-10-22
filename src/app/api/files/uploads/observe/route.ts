import { NextResponse } from "next/server";
import { exigir } from "@/core/contracts/base";
import { FILE_FEATURES } from "@/core/drive/entity-images";
import { assertFeature } from "@/lib/auth/policy";
import { authorizeFilesRequest, fileHeaders, fileUuid, filesFailure } from "@/adapters/db/files-http";
import { imageUploadObservationForRequest } from "@/adapters/db/image-upload-observation-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = fileHeaders();
  try {
    const { actor, config } = await authorizeFilesRequest(request, headers);
    const params = new URL(request.url).searchParams, purpose = params.get("purpose"), upload = params.get("upload"), clientId = params.get("client_id");
    exigir(params.size === 4 && ["version", "purpose", "upload", "client_id"].every(key => params.getAll(key).length === 1) && params.get("version") === "1" &&
      (purpose === "project_cover" || purpose === "home_focus_image" || purpose === "habit_image") && fileUuid(upload) && typeof clientId === "string" && clientId.trim().length > 0 && clientId.length <= 200, "Observação de envio inválida.");
    assertFeature(actor, FILE_FEATURES[purpose]);
    return NextResponse.json(await imageUploadObservationForRequest(config, actor).observe(upload.toLowerCase(), purpose, clientId), { headers });
  } catch (error) { return filesFailure(error, headers); }
}
