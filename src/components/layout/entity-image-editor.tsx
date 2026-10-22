"use client";
import { useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import type { EntityImagePurpose } from "@/core/drive/entity-images";
import { Drawer } from "../ui/dialog";
import { Button } from "../ui/button";
import { EntityImagePicker } from "./entity-image-picker";
import { fileReadUrl } from "./file-upload";
import { EntityImageAttempt } from "./entity-image-attempt";
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
  const busy = useRef(false), attempt = useRef<EntityImageAttempt | null>(null), currentApp = useRef(app);
  const [protectedAttempt, setProtectedAttempt] = useState(false);
  useLayoutEffect(() => { currentApp.current = app; }, [app]);
  function requestClose() { if (!busy.current && (!attempt.current || attempt.current.canDiscard)) onClose(); }
  function select(next: File | null) {
    if (busy.current || attempt.current && !attempt.current.canDiscard) return false;
    setError("");
    if (next && (!next.size || next.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(next.type))) {
      setError("Escolha uma imagem JPG, PNG, WebP ou GIF com até 8 MiB."); if (input.current) input.current.value = ""; return false;
    }
    attempt.current = null; setProtectedAttempt(false); setRemove(false); setFile(next); return true;
  }
  async function save() {
    if (busy.current || !file && !remove || app.mode !== "connected") return;
    busy.current = true; setPending(true); setError("");
    try {
      attempt.current ??= new EntityImageAttempt({ purpose, file: remove ? null : file, application: () => currentApp.current, onPhase: value => { setPhase(value); setProtectedAttempt(true); } });
      await attempt.current.upload();
      const fileId = await attempt.current.bind(entityId, currentFileId);
      onSaved(fileId); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar a imagem. Tente novamente."); }
    finally { busy.current = false; setPending(false); setPhase(""); setProtectedAttempt(!!attempt.current && !attempt.current.canDiscard); }
  }
  const source = remove ? null : preview ?? (currentFileId ? fileReadUrl(currentFileId, app.userId) : null);
  return <Drawer open title={title} dismissible={!pending && !protectedAttempt} closeOnBackdrop={false} returnFocusRef={returnFocusRef} initialFocusRef={input} onClose={requestClose}
    footer={<><Button disabled={pending || protectedAttempt} onClick={requestClose}>Cancelar</Button><Button variant="primary" form={formId} type="submit" loading={pending} disabled={app.mode !== "connected" || !file && !remove}>{error && protectedAttempt ? "Tentar o mesmo envio" : "Salvar imagem"}</Button></>}>
    <form id={formId} className="entity-image-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <PrivateImagePreview source={source} label="Prévia da imagem escolhida" />
      <EntityImagePicker inputRef={input} label="Imagem opcional" hint="Até 8 MiB e 24 milhões de pixels. A imagem é privada; os metadados são removidos no processamento. A capa conserva proporção própria." disabled={pending || protectedAttempt || app.mode !== "connected"} onChange={event => { select(event.target.files?.[0] ?? null); event.target.value = ""; }} />
      {currentFileId && <Button disabled={pending || protectedAttempt} onClick={() => { if (select(null)) setRemove(true); }}>Remover imagem</Button>}
      {(file || remove) && <Button variant="ghost" disabled={pending || protectedAttempt} onClick={() => select(null)}>Desfazer escolha</Button>}
      {app.mode !== "connected" && <p>Entre na sua conta para guardar uma imagem privada.</p>}
      {phase && <p role="status">{phase}</p>}{error && <p role="alert" className="entity-image-error">{error} {protectedAttempt ? "A imagem escolhida continua nesta tela. Tente o mesmo envio antes de trocar ou fechar. Recarregar não preserva o arquivo escolhido." : "A prévia não confirma o vínculo salvo."}</p>}
    </form>
  </Drawer>;
}
