import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { exigir, ErroDeDominio } from "../../core/contracts/base";
import type { EntityImageBinding, EntityImagePurpose, SetEntityImage } from "../../core/drive/entity-images";
import { FilesCommitUnknown } from "./files-store";

// Additive local contract for the prepared migration. The canonical 019 CLI export
// stays immutable until a disposable-schema generation verifies these new RPCs.
type ImageDatabase = { public: Omit<Database["public"], "Functions"> & { Functions: {
  file_entity_image_get: { Args: { p_user: string; p_session: string; p_purpose: string; p_entity: string }; Returns: Json };
  file_entity_image_set: { Args: { p_user: string; p_session: string; p_request: Json }; Returns: Json };
} } };
export function entityImagesForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity) {
  const client = createPrivilegedClient(config) as unknown as SupabaseClient<ImageDatabase>;
  function binding(value: unknown, purpose: EntityImagePurpose, id: string): EntityImageBinding {
    exigir(!!value && typeof value === "object" && !Array.isArray(value), "Vínculo de imagem inválido.");
    const row = value as Record<string, unknown>;
    exigir(Object.keys(row).length === 5 && row.version === 1 && row.user_id === actor.userId && row.id === id && row.purpose === purpose &&
      (row.file_id === null || typeof row.file_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.file_id)), "Resposta de imagem fora do destino.");
    return row as unknown as EntityImageBinding;
  }
  function failure(error: { code?: string }, write: boolean): never {
    if (error.code === "42501") throw new AuthGuardError("forbidden");
    if (["22023", "23514", "23503"].includes(error.code ?? "")) throw new ErroDeDominio("VALIDATION", "A imagem ou o destino não está disponível. Atualize os dados e tente novamente.");
    if (["23505", "40001"].includes(error.code ?? "")) throw new ErroDeDominio("CONFLICT", "O vínculo mudou. Confirme o mesmo envio.");
    if (write && !error.code) throw new FilesCommitUnknown();
    throw new AuthGuardError("unavailable");
  }
  return {
    async get(purpose: EntityImagePurpose, id: string) {
      const reply = await client.rpc("file_entity_image_get", { p_user: actor.userId, p_session: actor.sessionId, p_purpose: purpose, p_entity: id });
      if (reply.error) failure(reply.error, false);
      try { return binding(reply.data, purpose, id); }
      catch { throw new AuthGuardError("unavailable"); }
    },
    async set(input: SetEntityImage) {
      let reply;
      try { reply = await client.rpc("file_entity_image_set", { p_user: actor.userId, p_session: actor.sessionId, p_request: { ...input } }); }
      catch { throw new FilesCommitUnknown(); }
      if (reply.error) failure(reply.error, true);
      try {
        const result = binding(reply.data, input.purpose, input.entity_id);
        exigir(result.file_id === input.file_id, "A resposta não confirma a imagem enviada.");
        return result;
      }
      catch { throw new FilesCommitUnknown(); }
    },
  };
}
