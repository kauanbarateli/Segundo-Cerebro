"use client";
import type { Arquivo } from "../../core/drive";
import { nomeSeguroArquivo } from "../../core/drive";
import { decodeEntityImage, type EntityImagePurpose, type SetEntityImage } from "../../core/drive/entity-images";
import { ConnectedApplicationError, type ClientApplication } from "../../lib/demo/connected-application";
import { decodeImageUploadObservation, observedImageFile } from "../../lib/files/image-upload-observation";
import { isStorageOrigin, PERSONAL_STORAGE_ORIGIN, signedUploadUrl, type StorageOrigin } from "../../lib/files/storage-origin";
import { FileClientError } from "./file-upload";

type Application = Pick<ClientApplication, "userId" | "mode" | "executeDomainCommand" | "getCommandSnapshot" | "initializeJournal"> & { closing?: boolean; storageOrigin?: StorageOrigin };
export type ImageAttemptStage = "new" | "reserving" | "reserved" | "put-uncertain" | "put-refused" | "put-confirmed" | "finalizing" | "ready" | "binding" | "rejected" | "complete";
export function pendingImageCommand(app: Application) {
  return ["pending", "journal-error", "session-changed"].includes(app.getCommandSnapshot().status);
}
export function definiteImageRefusal(error: unknown, app: Application) {
  return error instanceof ConnectedApplicationError && !error.outcomeUnknown && !pendingImageCommand(app) &&
    ["VALIDATION", "FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND", "CONFLICT", "RATE_LIMITED"].includes(error.code);
}

/** One in-memory File/intention for both editors. No bytes/capability persistence.
 * Every invocation is an explicit user retry; it never schedules itself. */
export class EntityImageAttempt {
  private phase: ImageAttemptStage = "new";
  private uploadId: string | null = null;
  private confirmed: Arquivo | null = null;
  private binding: SetEntityImage | null = null;
  private working = false;
  private putAttempted = false;
  private readonly userId: string;
  private readonly sender: Application["executeDomainCommand"];
  private readonly uploadClientId: string;
  private readonly bindingClientId: string;
  private readonly fetcher: typeof fetch;
  private readonly origin: StorageOrigin;
  private readonly reserveBody: string | null;
  constructor(private readonly options: { purpose: EntityImagePurpose; file: File | null; application(): Application; onPhase?(message: string): void; fetcher?: typeof fetch; ids?: { upload: string; binding: string } }) {
    const app = options.application(); this.userId = app.userId; this.sender = app.executeDomainCommand;
    this.origin = app.storageOrigin ?? PERSONAL_STORAGE_ORIGIN; this.fetcher = options.fetcher ?? fetch;
    this.uploadClientId = options.ids?.upload ?? crypto.randomUUID(); this.bindingClientId = options.ids?.binding ?? crypto.randomUUID();
    const file = options.file;
    if (file && (!file.size || file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))) throw new FileClientError("VALIDATION", "Escolha uma imagem de até 8 MiB.");
    this.reserveBody = file ? JSON.stringify({ kind: options.purpose, name: nomeSeguroArquivo(file.name), folder_id: null, client_id: this.uploadClientId }) : null;
  }
  get stage() { return this.phase; }
  get canDiscard() { return ["new", "ready", "rejected", "complete"].includes(this.phase) && !this.working; }
  private app() {
    const app = this.options.application();
    if (app.userId !== this.userId || app.executeDomainCommand !== this.sender || app.mode !== "connected" || app.closing) throw new FileClientError("SESSION_CHANGED", "A sessão mudou. Entre novamente para continuar.");
    return app;
  }
  private async beforeNonJournal() {
    const app = this.app(); await app.initializeJournal(); this.app();
    if (pendingImageCommand(app)) throw new FileClientError("PENDING_COMMAND", "Confirme o envio protegido no aviso da aplicação antes de continuar.");
  }
  private async reserve(): Promise<string> {
    this.app(); if (!isStorageOrigin(this.origin)) throw new FileClientError("INVALID_RESPONSE", "Destino de envio inválido.");
    this.phase = "reserving"; this.options.onPhase?.("Preparando o mesmo envio…");
    let response: Response;
    try { response = await this.fetcher("/api/files/uploads", { method: "POST", credentials: "same-origin", redirect: "error", headers: { "Content-Type": "application/json", "X-Expected-User-ID": this.userId }, body: this.reserveBody }); }
    catch { throw new FileClientError("UNAVAILABLE", "A reserva ainda não foi confirmada. Tente o mesmo envio."); }
    this.app();
    let value: unknown; try { value = await response.json(); } catch { throw new FileClientError("INVALID_RESPONSE", "A reserva ainda não foi confirmada."); }
    if (!response.ok || !value || typeof value !== "object") throw new FileClientError("UNAVAILABLE", "Não foi possível confirmar a reserva. Tente o mesmo envio.");
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "expires_at,id,token,upload_url" || typeof row.id !== "string") throw new FileClientError("INVALID_RESPONSE", "A reserva não confirma o envio original.");
    const url = signedUploadUrl(row.upload_url, this.origin, this.userId, row.id, row.token);
    if (!url || typeof row.expires_at !== "string" || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now() || this.uploadId && row.id !== this.uploadId) throw new FileClientError("INVALID_RESPONSE", "A reserva não confirma o envio original.");
    this.uploadId = row.id as string; this.phase = "reserved"; return url;
  }
  private async observe() {
    this.options.onPhase?.("Conferindo o envio original…"); this.app();
    const params = new URLSearchParams({ version: "1", purpose: this.options.purpose, upload: this.uploadId!, client_id: this.uploadClientId });
    const response = await this.fetcher(`/api/files/uploads/observe?${params}`, { credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-Expected-User-ID": this.userId } });
    this.app();
    if (!response.ok) throw new FileClientError("UNAVAILABLE", "Não foi possível conferir o envio. Tente novamente sem trocar a imagem.");
    return decodeImageUploadObservation(await response.json(), this.userId, this.uploadId!, this.options.purpose);
  }
  private async finalize() {
    this.phase = "finalizing"; this.options.onPhase?.("Confirmando a imagem enviada…");
    // Even a final file seen by observation must settle this exact journal input.
    const file = await this.app().executeDomainCommand("file.upload.finalize", { upload_id: this.uploadId!, client_id: this.uploadClientId });
    this.app(); this.confirmed = observedImageFile(file, this.userId, this.uploadId!, this.options.purpose); this.phase = "ready";
    return this.confirmed;
  }
  async upload(): Promise<Arquivo | null> {
    if (this.working) throw new FileClientError("BUSY", "Aguarde o envio em andamento.");
    this.app(); if (!this.options.file) return null;
    if (this.confirmed) return this.confirmed;
    this.working = true;
    try {
      // Never inspect Storage, reserve or PUT in front of a pending finalize.
      if (this.phase === "finalizing") return await this.finalize();
      await this.beforeNonJournal();
      if (this.putAttempted) {
        const observation = await this.observe();
        if (observation.state === "final" || observation.state === "staging") return await this.finalize();
        if (observation.state !== "missing-observed") throw new FileClientError("UNAVAILABLE", "O envio continua sem confirmação. Tente novamente sem trocar a imagem.");
        // A point-in-time absence permits only this explicit conditional retry.
        // A late first PUT can still win; a duplicate goes back to observation.
      }
      const url = await this.reserve(); this.app();
      this.putAttempted = true; this.phase = "put-uncertain"; this.options.onPhase?.("Enviando a imagem…");
      const body = new FormData(); body.append("cacheControl", "0"); body.append("", this.options.file);
      let stored: Response;
      try { stored = await this.fetcher(url, { method: "PUT", credentials: "omit", redirect: "error", headers: { "x-upsert": "false" }, body }); }
      catch { throw new FileClientError("UNAVAILABLE", "Não foi possível confirmar o envio. Tente o mesmo envio."); }
      this.app();
      if (!stored.ok || stored.redirected || stored.url && stored.url !== url) { this.phase = "put-refused"; throw new FileClientError("UNAVAILABLE", "O envio precisa ser conferido. Tente o mesmo envio."); }
      this.phase = "put-confirmed"; return await this.finalize();
    } catch (error) {
      if (this.stage === "finalizing" && definiteImageRefusal(error, this.options.application())) this.phase = "rejected";
      throw error;
    } finally { this.working = false; }
  }
  async bind(entityId: string, expectedFileId: string | null): Promise<string | null> {
    if (this.working) throw new FileClientError("BUSY", "Aguarde o envio em andamento.");
    this.app(); if (this.options.file && !this.confirmed) throw new FileClientError("VALIDATION", "Confirme o arquivo antes de salvar o vínculo.");
    const intention = decodeEntityImage({ version: 1, purpose: this.options.purpose, entity_id: entityId, file_id: this.confirmed?.id ?? null, expected_file_id: expectedFileId, client_id: this.bindingClientId });
    if (this.binding && this.binding.entity_id !== intention.entity_id) throw new FileClientError("PENDING_COMMAND", "Confirme o vínculo original antes de mudar o destino.");
    // A refreshed current-file prop cannot replace the CAS already journaled.
    this.binding ??= Object.freeze(intention); this.phase = "binding"; this.working = true;
    this.options.onPhase?.("Confirmando o vínculo da imagem…");
    try {
      const result = await this.app().executeDomainCommand("file.entity-image.set", this.binding);
      this.app();
      if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).length !== 5) throw new FileClientError("INVALID_RESPONSE", "O vínculo ainda não foi confirmado.");
      const row = result as Record<string, unknown>;
      if (row.version !== 1 || row.user_id !== this.userId || row.id !== this.binding.entity_id || row.purpose !== this.binding.purpose || row.file_id !== this.binding.file_id) throw new FileClientError("INVALID_RESPONSE", "O vínculo ainda não foi confirmado.");
      this.phase = "complete"; return this.binding.file_id;
    } catch (error) { if (definiteImageRefusal(error, this.options.application())) this.phase = "rejected"; throw error; }
    finally { this.working = false; }
  }
}
