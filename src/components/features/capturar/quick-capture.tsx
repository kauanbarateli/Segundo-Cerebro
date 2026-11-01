"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { documentoDeTexto } from "@/core/contracts/rich-document";
import type { CamposCaptura } from "@/core/capturas";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { ConnectedApplicationError, isCommandOutcomeUnknown } from "@/lib/demo/connected-application";
import { fileReadUrl } from "@/components/layout/file-upload";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { clearQuickDraft, readQuickDraft, writeQuickDraft, type DraftStorage } from "./drafts";
import { ACCEPT_IMAGES, imagesFrom } from "./images";
import { ImagePreview } from "./image-preview";
import { draftFrom, hasDraftContent, normalize, validateDraft, type CaptureDraft } from "./model";
import { CaptureRequests } from "./requests";
import { MAX_CAPTURE_IMAGES, useImageAttachments } from "./use-image-attachments";
import "./quick-capture.css";

function browserStorage(): DraftStorage | null { try { return window.localStorage; } catch { return null; } }

/** Header action: opens the quick-capture modal without leaving the page. */
export function QuickCapture() {
  const app = useDemoApplication();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button type="button" ref={trigger} className="shell-capture" aria-label="Capturar" aria-haspopup="dialog" onClick={() => setOpen(true)}><Icons.Capture /><span>Capturar</span></button>
    {/* Keyed by owner: another account never sees or sends this account's draft. */}
    {open && <QuickCaptureDialog key={app.userId} returnFocusRef={trigger} onClose={() => setOpen(false)} />}
  </>;
}

function QuickCaptureDialog({ returnFocusRef, onClose }: { returnFocusRef: React.RefObject<HTMLButtonElement | null>; onClose(): void }) {
  const app = useDemoApplication();
  const query = useDemoQuery("captures");
  const router = useRouter();
  const { toast } = useToast();
  const connected = app.mode === "connected";
  const owner = app.userId;
  const storage = useRef<DraftStorage | null>(null);
  const requests = useRef(new CaptureRequests());
  const writing = useRef(false), signedOut = useRef(false), finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CaptureDraft>(() => { storage.current = browserStorage(); return readQuickDraft(storage.current, owner) ?? draftFrom(undefined, null); });
  const [restored] = useState(() => hasDraftContent(draft));
  const current = useRef(draft);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(!!draft.pending_client_id), [error, setError] = useState<string | null>(null), [discarding, setDiscarding] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  function persist() {
    if (timer.current) clearTimeout(timer.current);
    if (finished.current || signedOut.current) return;
    const value = current.current;
    if (!hasDraftContent(value)) { clearQuickDraft(storage.current, owner); return; }
    setStorageAvailable(writeQuickDraft(storage.current, owner, structuredClone(value)));
  }
  const flush = useRef(persist); flush.current = persist;
  function assign(next: CaptureDraft) { current.current = next; setDraft(next); }
  function change(patch: Partial<CaptureDraft>) {
    assign({ ...current.current, ...patch }); setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 350);
  }
  const images = useImageAttachments({ draft: current, signedOut, busy, onAttach: (attachments) => change({ attachments: [...current.current.attachments, ...attachments] }), onError: setError });

  useEffect(() => {
    const onLogout = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId && userId !== owner) return;
      signedOut.current = true; images.cancel(); if (timer.current) clearTimeout(timer.current);
      clearQuickDraft(storage.current, owner); onClose();
    };
    const onHide = () => { if (document.hidden) flush.current(); };
    window.addEventListener("segundo-cerebro:demo-logout", onLogout); document.addEventListener("visibilitychange", onHide); window.addEventListener("pagehide", onHide);
    return () => {
      images.cancel(); flush.current();
      window.removeEventListener("segundo-cerebro:demo-logout", onLogout); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide);
    };
    // Mounted once per owner (the parent keys this component by user id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = query.data;
  // The form mounts after the collection loads; take the initial focus then, unless the person already moved it.
  const ready = !!data;
  useEffect(() => {
    if (!ready) return;
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement) || !active.closest("dialog") || !active.matches("input, textarea, select, button:not(.ui-dialog__close)")) titleRef.current?.focus({ preventScroll: true });
  }, [ready]);
  const personal = data?.categories.find(category => normalize(category.name) === "pessoal")?.id ?? null;

  async function submit() {
    if (writing.current || images.uploading || signedOut.current || !data) return;
    if (app.getCommandSnapshot().status === "session-changed") { setError("A sessão mudou. Entre novamente antes de enviar esta nota; o rascunho continua guardado."); return; }
    const source = current.current;
    const fields: CamposCaptura = { title: source.title.trim(), content: source.content || null, type: "note", category_id: source.category_id ?? personal, project_id: null, linked_capture_ids: [], attachments: source.attachments };
    const { content, ...metadata } = fields;
    const payload = connected ? { id: source.id, fields: metadata, document: documentoDeTexto(source.content) } : { id: source.id, fields: { ...fields, content } };
    writing.current = true; setBusy(true); setError(null);
    try {
      if (source.pending_client_id) requests.current.retain("save", payload, source.pending_client_id);
      const retrying = requests.current.matches("save", payload);
      const validation = validateDraft(source, retrying ? [] : data.items);
      if (validation) { setError(validation); titleRef.current?.focus(); return; }
      const clientId = requests.current.id("save", payload);
      // The command identity survives a reload together with the immutable draft.
      assign({ ...source, pending_client_id: clientId }); persist();
      const saved = connected ? await app.commands.captures.create({ ...metadata, document: documentoDeTexto(source.content), client_id: clientId }) : await app.commands.captures.create({ ...fields, client_id: clientId });
      requests.current.complete("save"); finished.current = true; clearQuickDraft(storage.current, owner);
      if (signedOut.current) return;
      onClose();
      toast({ message: "Nota capturada.", action: { label: "Abrir nota", onClick: () => router.push(`/capturar?capture=${encodeURIComponent(saved.id)}`) } });
    } catch (reason) {
      if (isCommandOutcomeUnknown(reason)) { requests.current.unknown("save"); setUncertain(true); setError("O resultado ainda não foi confirmado. Use Confirmar o mesmo envio; nada será duplicado."); }
      else {
        requests.current.complete("save"); setUncertain(false);
        const retryable = { ...current.current }; delete retryable.pending_client_id; assign(retryable); persist();
        setError(reason instanceof ConnectedApplicationError || reason instanceof Error ? reason.message : "Não foi possível salvar. Seu rascunho foi mantido.");
      }
    } finally { writing.current = false; setBusy(false); }
  }
  function discard() {
    finished.current = true; if (timer.current) clearTimeout(timer.current); clearQuickDraft(storage.current, owner); setDiscarding(false); onClose();
  }
  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => { void images.attach(Array.from(event.target.files ?? [])); event.target.value = ""; };
  const locked = busy || uncertain;
  const canDiscard = hasDraftContent(draft) && !busy;

  return <>
    <Dialog open onClose={onClose} title="Capturar uma nota" description="Escreva e guarde sem sair desta página. Ao fechar, o rascunho é mantido neste navegador." initialFocusRef={titleRef} returnFocusRef={returnFocusRef} size="md" dismissible={!busy && !images.uploading}>
      {!data ? (query.status === "error"
        ? <div role="alert"><p>Não foi possível carregar suas notas. {query.error}</p><Button onClick={query.retry}>Tentar novamente</Button></div>
        : <p role="status">Carregando…</p>)
        : <form className="quick-capture" onSubmit={event => { event.preventDefault(); void submit(); }}
          onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void submit(); } }}
          onPaste={event => { const files = imagesFrom(event.clipboardData); if (files.length) { event.preventDefault(); void images.attach(files); } }}
          onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
          onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); void images.attach(imagesFrom(event.dataTransfer)); } }}>
          {restored && <p className="quick-capture__hint" role="status">Rascunho recuperado deste navegador.</p>}
          {uncertain && <p className="quick-capture__hint" role="alert">O resultado do envio anterior ainda não foi confirmado.</p>}
          <fieldset className="quick-capture__fields" disabled={locked}>
            <Field label="Título da nota" ref={titleRef} placeholder="Dê um título à sua ideia" maxLength={120} value={draft.title} onChange={event => change({ title: event.target.value })} error={error && !uncertain ? error : undefined} />
            <Field as="textarea" label="Sua anotação" rows={6} maxLength={30_000} value={draft.content} placeholder="Escreva sem pressa ou cole um trecho." onChange={event => change({ content: event.target.value })} />
            {!!draft.attachments.length && <div className="capture-images">{draft.attachments.map(attachment => <ImagePreview key={attachment.id} attachment={attachment} blob={app.getImage(attachment.id)?.blob} privateUrl={connected ? fileReadUrl(attachment.id, owner) : undefined} onRemove={() => change({ attachments: current.current.attachments.filter(image => image.id !== attachment.id) })} />)}</div>}
            {/* Hidden native chooser is opened by the visible, named button. */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} multiple hidden aria-label="Escolher imagens" onChange={chooseFiles} />
          </fieldset>
          {uncertain && error && <p role="alert" className="quick-capture__error">{error}</p>}
          <div className="quick-capture__actions">
            <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={locked || draft.attachments.length >= MAX_CAPTURE_IMAGES} loading={images.uploading}><Icons.Upload />Anexar imagem</Button>
            {canDiscard && <Button variant="ghost" onClick={() => setDiscarding(true)} disabled={images.uploading}>Descartar rascunho</Button>}
            <Button type="submit" variant="primary" className="quick-capture__submit" loading={busy} disabled={images.uploading}>{uncertain ? "Confirmar o mesmo envio" : "Salvar nota"}</Button>
          </div>
          <p className="quick-capture__hint">{storageAvailable ? "Imagens: até 6 (PNG ou JPEG após o preparo). Ctrl/Cmd + Enter salva." : "Sem armazenamento neste navegador · o rascunho vale só nesta sessão."}</p>
        </form>}
    </Dialog>
    <ConfirmDialog open={discarding} title="Descartar o rascunho?" description="O texto e as imagens desta captura rápida serão removidos deste navegador." confirmLabel="Descartar rascunho" onClose={() => setDiscarding(false)} onConfirm={discard} />
  </>;
}
