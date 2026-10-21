"use client";
import { useId, useRef, useState, type RefObject } from "react";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { decodeEntityImage, validateEntityImageFile, type EntityImagePurpose } from "@/core/drive/entity-images";
import type { Arquivo } from "@/core/drive";
import { Drawer } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { fileReadUrl, uploadFile } from "./file-upload";
import { useImagePreview } from "./use-image-preview";
import { PrivateImagePreview } from "./private-image";
import "./private-image.css";

export function EntityImageEditor({ purpose, entityId, currentFileId, title, returnFocusRef, onClose, onSaved }: {
  purpose: EntityImagePurpose; entityId: string; currentFileId: string | null; title: string;
  returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(fileId: string | null): void;
}) {
  const app = useDemoApplication(), formId = useId(), input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null), [remove, setRemove] = useState(false);
  const preview = useImagePreview(file);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [phase, setPhase] = useState("");
  const busy = useRef(false), uploaded = useRef<Arquivo | null>(null), uploadId = useRef<string | null>(null);
  const ids = useRef<{ upload: string; binding: string } | null>(null);
  function select(next: File | null) {
    if (busy.current) return;
    setError("");
    if (next && (!next.size || next.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(next.type))) {
      setError("Escolha uma imagem JPG, PNG, WebP ou GIF com até 8 MiB."); if (input.current) input.current.value = ""; return;
    }
    uploaded.current = null; uploadId.current = null; ids.current = null; setRemove(false); setFile(next);
  }
  async function save() {
    if (busy.current || !file && !remove || app.mode !== "connected") return;
    busy.current = true; setPending(true); setError(""); ids.current ??= { upload: crypto.randomUUID(), binding: crypto.randomUUID() };
    try {
      if (file && !uploaded.current) {
        // A lost finalization response reuses the original upload and client_id.
        // The shared journal resolves uncertainty before accepting another write.
        const result = uploadId.current
          ? await app.executeDomainCommand("file.upload.finalize", { upload_id: uploadId.current, client_id: ids.current.upload }) as Arquivo
          : await uploadFile({ file, kind: purpose, userId: app.userId, storageOrigin: app.storageOrigin, sender: app.executeDomainCommand,
            clientId: ids.current.upload, onReserved: id => { uploadId.current = id; }, onPhase: value => setPhase(value === "reserving" ? "Preparando envio…" : value === "uploading" ? "Enviando imagem…" : "Validando imagem…") });
        validateEntityImageFile(result, app.userId, purpose); uploaded.current = result;
      }
      setPhase("Salvando imagem…");
      const fileId = remove ? null : uploaded.current!.id;
      await app.executeDomainCommand("file.entity-image.set", decodeEntityImage({ version: 1, purpose, entity_id: entityId, file_id: fileId, expected_file_id: currentFileId, client_id: ids.current.binding }));
      onSaved(fileId); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar a imagem. Tente novamente."); }
    finally { busy.current = false; setPending(false); setPhase(""); }
  }
  const source = remove ? null : preview ?? (currentFileId ? fileReadUrl(currentFileId, app.userId) : null);
  return <Drawer open title={title} dismissible={!pending} closeOnBackdrop={false} returnFocusRef={returnFocusRef} initialFocusRef={input} onClose={onClose}
    footer={<><Button disabled={pending} onClick={onClose}>Cancelar</Button><Button variant="primary" form={formId} type="submit" loading={pending} disabled={app.mode !== "connected" || !file && !remove}>Salvar imagem</Button></>}>
    <form id={formId} className="entity-image-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <PrivateImagePreview source={source} label="Prévia da imagem escolhida" />
      <Field ref={input} type="file" label="Imagem opcional" accept="image/png,image/jpeg,image/webp,image/gif" disabled={pending || app.mode !== "connected"} onChange={event => { select(event.target.files?.[0] ?? null); event.target.value = ""; }} />
      <p>Até 8 MiB e 24 milhões de pixels. A imagem é privada; os metadados são removidos no processamento. A capa conserva proporção própria.</p>
      {currentFileId && <Button disabled={pending} onClick={() => { select(null); setRemove(true); }}>Remover imagem</Button>}
      {(file || remove) && <Button variant="ghost" disabled={pending} onClick={() => select(null)}>Desfazer escolha</Button>}
      {app.mode !== "connected" && <p>Entre na sua conta para guardar uma imagem privada.</p>}
      {phase && <p role="status">{phase}</p>}{error && <p role="alert" className="entity-image-error">{error} Se houver um envio pendente, confirme o mesmo envio antes de trocar a imagem. A prévia não confirma o vínculo salvo.</p>}
    </form>
  </Drawer>;
}
