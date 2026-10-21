import "server-only";
import { StorageApiError, type SupabaseClient } from "@supabase/supabase-js";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { resolveStorageOrigin } from "../../lib/files/storage-origin-server";
import { isImageUploadInstant, observedImageFile, type ImageUploadObservation } from "../../lib/files/image-upload-observation";
import type { EntityImagePurpose } from "../../core/drive/entity-images";

// Narrow authored contract for draft020, NOT a generated/exported database type.
type ImageObservationDatabase = { public: Omit<Database["public"], "Functions"> & { Functions: {
  file_entity_image_upload_observe: { Args: { p_user: string; p_session: string; p_upload: string; p_kind: string; p_client_id: string }; Returns: Json };
} } };
const STAGING = "second-brain-staging";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
type Snapshot = { status: "reserved" | "processing" | "finalized" | "expired"; observed: number; expires: number; processing: boolean; file: ImageUploadObservation["file"] };

export function imageUploadObservationForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity) {
  if (!resolveStorageOrigin(config)) throw new AuthGuardError("unavailable");
  // Fresh privileged client: never inject the browser session into Storage.
  const client = createPrivilegedClient(config) as unknown as SupabaseClient<ImageObservationDatabase>;
  return { async observe(uploadId: string, purpose: EntityImagePurpose, clientId: string): Promise<ImageUploadObservation> {
    const result = (state: "staging" | "missing-observed" | "indeterminate"): ImageUploadObservation => ({ version: 1, user_id: actor.userId, upload_id: uploadId, purpose, state, file: null });
    async function snapshot(): Promise<Snapshot> {
      let reply;
      try { reply = await client.rpc("file_entity_image_upload_observe", { p_user: actor.userId, p_session: actor.sessionId, p_upload: uploadId, p_kind: purpose, p_client_id: clientId }); }
      catch { throw new AuthGuardError("unavailable"); }
      if (reply.error) throw new AuthGuardError(reply.error.code === "42501" ? "forbidden" : "unavailable");
      const row: unknown = reply.data;
      if (!record(row) || Object.keys(row).sort().join() !== "expires_at,file,kind,observed_at,processing,status,upload_id,user_id,version" || row.version !== 1 || row.user_id !== actor.userId || row.upload_id !== uploadId || row.kind !== purpose ||
        !isImageUploadInstant(row.observed_at) || !isImageUploadInstant(row.expires_at) || typeof row.processing !== "boolean" || typeof row.status !== "string" || !["reserved", "processing", "finalized", "expired"].includes(row.status)) throw new AuthGuardError("unavailable");
      if (row.status !== "processing" && row.processing || row.status !== "finalized" && row.file !== null) throw new AuthGuardError("unavailable");
      let file: Snapshot["file"] = null;
      try { if (row.status === "finalized") file = observedImageFile(row.file, actor.userId, uploadId, purpose); }
      catch { throw new AuthGuardError("unavailable"); }
      return { status: row.status as Snapshot["status"], observed: Date.parse(row.observed_at), expires: Date.parse(row.expires_at), processing: row.processing, file };
    }
    const final = (row: Snapshot): ImageUploadObservation | null => row.file ? { version: 1, user_id: actor.userId, upload_id: uploadId, purpose, state: "final", file: row.file } : null;
    const before = await snapshot(), confirmed = final(before);
    if (confirmed) return confirmed;
    // false processing is NOT sufficient: expired leases keep status processing.
    if (before.status !== "reserved" || before.processing || before.expires <= before.observed) return result("indeterminate");
    let state: "staging" | "missing-observed" | "indeterminate" = "indeterminate";
    try {
      const bucket = await client.storage.getBucket(STAGING);
      if (!bucket.error && bucket.data?.id === STAGING && bucket.data.name === STAGING && bucket.data.public === false) {
        const path = `${actor.userId}/${uploadId}`, object = await client.storage.from(STAGING).info(path);
        if (!object.error && object.data?.name === path && object.data.bucketId === STAGING) state = "staging";
        else if (!object.data && object.error instanceof StorageApiError && object.error.status === 404 && object.error.code === "NoSuchKey") state = "missing-observed";
      }
    } catch { /* Transport/schema/bucket/permission uncertainty never proves absence. */ }
    // Separate transaction: authority and reservation may change during Storage IO.
    const after = await snapshot(), nowFinal = final(after);
    if (nowFinal) return nowFinal;
    if (after.status !== "reserved" || after.processing || after.expires <= after.observed || after.observed < before.observed) return result("indeterminate");
    return result(state);
  } };
}
