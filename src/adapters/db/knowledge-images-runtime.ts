import "server-only";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { resolveStorageOrigin } from "../../lib/files/storage-origin-server";
import { parseKnowledgeImage } from "./knowledge-images";

/** Page-bound gate permits the promoted holder, never a generic file upload. */
export async function signedKnowledgeImage(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, pageId: string, fileId: string) {
  if (!resolveStorageOrigin(config)) throw new AuthGuardError("unavailable");
  const client = createPrivilegedClient(config);
  // Integration requires the official generated types from the new draft RPC.
  // No hand-written Database overlay or cast may substitute that gate.
  const result = await client.rpc("knowledge_image_read_metadata", { p_user: actor.userId, p_session: actor.sessionId, p_page: pageId, p_file: fileId });
  if (result.error) throw new AuthGuardError(result.error.code === "42501" ? "forbidden" : "unavailable");
  const metadata = parseKnowledgeImage(result.data, actor.userId, pageId, fileId);
  const signed = await client.storage.from("second-brain-files").createSignedUrl(metadata.storage_path, 60);
  if (signed.error || !signed.data) throw new AuthGuardError("unavailable");
  return signed.data.signedUrl;
}
