"use client";
import { RelatedPanel } from "@/components/layout/related-panel";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import type { AnexoCaptura, Captura, CamposCaptura } from "@/core/capturas";
import type { DemoQueries } from "@/lib/demo/types";
import { FUSO_DO_APP } from "@/core/tempo";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { ConnectedApplicationError, dismissExplicitlyResolvedConflict, isCommandOutcomeUnknown } from "@/lib/demo/connected-application";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Collapsible } from "@/components/ui/data-display";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PromoteCapture } from "@/components/layout/promote-capture";
import { fileReadUrl, uploadFile } from "@/components/layout/file-upload";
import { clearDrafts, findDraft, readDrafts, writeDrafts, type DraftMap, type DraftStorage } from "./drafts";
import { ACCEPT_IMAGES, imagesFrom, prepareImage } from "./images";
import { TYPE_LABELS, documentOfDraft, draftFrom, filterCaptures, hasDraftContent, incoming, normalize, references, rewriteWiki, sameDraft, unlinkDraft, validateDraft, withDraftDocument, type CaptureDraft } from "./model";
import { CaptureRequests } from "./requests";
import "./capture.css";
import FormattedEditor, { type DocumentReferenceCommand } from "@/components/editor/document-editor";

function ImagePreview({ attachment, blob, privateUrl, onRemove }: { attachment: AnexoCaptura; blob?: Blob; privateUrl?: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <figure className="capture-image">
    {/* Object URLs are session-only previews, so Next's network image optimizer is inapplicable. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url || privateUrl ? <img src={url ?? privateUrl} alt={`Prévia de ${attachment.name}`} loading="lazy" /> : <p>Prévia disponível apenas na sessão em que a imagem foi anexada.</p>}
    <figcaption><span>{attachment.name}</span><Button variant="ghost" onClick={onRemove} aria-label={`Remover imagem ${attachment.name}`}><Icons.X /></Button></figcaption>
  </figure>;
}

/** INFERIDO: ícones do protótipo por tipo (`capture`, `file-text`, `tasks`); lembrete usa o sino existente. */
const TYPE_ICONS = { idea: Icons.Inbox, note: Icons.File, task: Icons.Tasks, reminder: Icons.Bell } as const;
/** Lista: trecho em uma linha lógica, com a sintaxe [[...]] reduzida ao nome (o texto salvo não muda). */
const excerptOf = (content: string) => content.replace(/\[\[([^\]\n]+)\]\]/g, "$1").replace(/\s+/g, " ").trim().slice(0, 220);
const capturedLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, day: "numeric", month: "short" }).format(new Date(iso));

export function CaptureView() {
  const query = useDemoQuery("captures");
  if (query.status === "error") return <section className="capture-empty" role="alert"><h2>Não foi possível carregar suas notas</h2><p>{query.error}</p><Button onClick={query.retry}>Tentar novamente</Button></section>;
  if (!query.data) return <div className="capture-loading" role="status"><span>Carregando notas…</span><div /><div /></div>;
  return <CaptureEditor data={query.data} />;
}

function CaptureEditor({ data }: { data: DemoQueries["captures"] }) {
  const app = useDemoApplication();
  const { getCommandSnapshot, subscribeCommands, load, getSnapshot, userId } = app;
  const connected = app.mode === "connected";
  const savedFeedback = connected ? "Salva na sua conta" : "Salva nesta sessão";
  const requests = useRef(new CaptureRequests());
  const savedDraft = useRef<CaptureDraft | null>(null);
  const uncertainUndo = useRef<(() => Promise<void>) | null>(null);
  const [uncertainAction, setUncertainAction] = useState<"save" | "convert" | "organize" | "archive" | "unarchive" | null>(null);
  const router = useRouter(); const params = useSearchParams(); const { toast } = useToast();
  const commandRouter = useRef(router); commandRouter.current = router;
  const requestedId = params.get("capture") ?? "new";
  const personal = data.categories.find((category) => normalize(category.name) === "pessoal")?.id ?? null;
  const [draft, setDraft] = useState<CaptureDraft>(() => draftFrom(undefined, personal));
  const current = useRef(draft); const items = useRef(data.items); items.current = data.items;
  const drafts = useRef<DraftMap>({}); const storage = useRef<DraftStorage | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false); const signedOut = useRef(false); const writing = useRef(false); const uploadEpoch = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null); const bodyRef = useRef<HTMLTextAreaElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const richReference = useRef<DocumentReferenceCommand | null>(null);
  const exposeReference = useCallback((command: DocumentReferenceCommand | null) => { richReference.current = command; }, []);
  const linkButton = useRef<HTMLButtonElement>(null); const linkSearch = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("Pronto para escrever"); const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null); const [writeBusy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "inbox" | "organized" | "archived">("inbox"); const [query, setQuery] = useState("");
  const [linksOpen, setLinksOpen] = useState(false); const [linkQuery, setLinkQuery] = useState(""); const [cursor, setCursor] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const [mobileEditor, setMobileEditor] = useState(() => params.has("capture") || params.has("new"));
  const newNoteButton = useRef<HTMLButtonElement>(null);
  const listPanel = useRef<HTMLElement>(null), editorPanel = useRef<HTMLElement>(null);
  const listPosition = useRef({ pageX: 0, pageY: 0, scrollTop: 0 });
  const returnToList = useRef<HTMLElement | null>(null), previousMobileEditor = useRef(mobileEditor);
  const restoreListPosition = useRef(false);
  const explicitEditor = params.has("capture") || params.has("new");
  useEffect(() => { setMobileEditor(explicitEditor); }, [explicitEditor, requestedId]);
  useEffect(() => {
    const wasEditing = previousMobileEditor.current; previousMobileEditor.current = mobileEditor;
    if (wasEditing && !mobileEditor) restoreListPosition.current = true;
    if (!window.matchMedia("(max-width: 1000px)").matches || (!mobileEditor && !restoreListPosition.current)) return;
    const frame = requestAnimationFrame(() => {
      if (mobileEditor) {
        restoreListPosition.current = false;
        const panel = editorPanel.current;
        if (!panel || panel.hidden) return;
        titleRef.current?.focus({ preventScroll: true });
        // The static header can already be above the viewport after list scroll.
        const topbar = Math.max(0, document.querySelector(".shell-topbar")?.getBoundingClientRect().bottom ?? 0);
        window.scrollTo({ left: 0, top: Math.max(0, window.scrollY + panel.getBoundingClientRect().top - topbar - 16), behavior: "instant" });
      } else {
        const list = listPanel.current, position = listPosition.current;
        if (!list) return;
        list.scrollTop = position.scrollTop;
        window.scrollTo({ left: position.pageX, top: position.pageY, behavior: "instant" });
        const topbar = Math.max(0, document.querySelector(".shell-topbar")?.getBoundingClientRect().bottom ?? 0);
        const bottom = document.querySelector(".shell-bottom")?.getBoundingClientRect().top ?? window.innerHeight;
        const visible = (element: HTMLElement) => { const bounds = element.getBoundingClientRect(); return bounds.top >= topbar && bounds.bottom <= bottom; };
        const retained = returnToList.current;
        const target = retained?.isConnected && visible(retained) ? retained : Array.from(list.querySelectorAll<HTMLElement>(".capture-row, .capture-new-note")).find(visible) ?? newNoteButton.current;
        target?.focus({ preventScroll: true });
        restoreListPosition.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileEditor, requestedId]);
  const [editorEpoch, setEditorEpoch] = useState(0), [conflict, setConflict] = useState<{ id: string; clientId: string; owner: string; draft: CaptureDraft; writeError: string; reading: boolean; snapshot: Captura | null; error: string | null } | null>(null), [editorInvalid, setEditorInvalid] = useState(false);
  const conflictReadEpoch = useRef(0);
  const conflictIntent = useRef<{ id: string; clientId: string; owner: string; epoch: number; reading: boolean; ready: boolean } | null>(null);
  const busy = writeBusy || !!conflict?.reading;
  const [titleValidationFocus, setTitleValidationFocus] = useState<{ draft: CaptureDraft; owner: string; message: string } | null>(null);
  const selected = data.items.find((item) => item.id === draft.id);
  const promoted = !!selected && !!data.readonlyCaptureIds?.includes(selected.id);
  // perform() can disable the title while validation is being committed.
  // Consume only this validation request after React restores the field.
  useLayoutEffect(() => {
    if (!titleValidationFocus || busy) return;
    setTitleValidationFocus(null);
    if (signedOut.current || titleValidationFocus.owner !== app.userId ||
      titleValidationFocus.draft !== current.current || titleValidationFocus.message !== error ||
      uploading || uncertainAction || promoted || document.hidden) return;
    const title = titleRef.current;
    if (title?.isConnected && !title.matches(":disabled") && title.getClientRects().length) title.focus();
  }, [titleValidationFocus, busy, app.userId, error, uploading, uncertainAction, promoted]);
  const related = references(draft, data.items); const backlinks = incoming(draft.id, data.items);
  const filtered = filterCaptures(data.items, filter, query); const activeCount = filterCaptures(data.items, "all", "").length;
  const currentIndex = filtered.findIndex((item) => item.id === draft.id);
  const words = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;
  const wikiToken = draft.content.slice(0, cursor).match(/\[\[([^\]\n]*)$/);
  const suggestions = wikiToken ? data.items.filter((item) => item.id !== draft.id && !item.deleted_at && item.status !== "archived" && normalize(item.title ?? "").includes(normalize(wikiToken[1]!))).slice(0, 4) : [];
  const linkCandidates = data.items.filter((item) => item.id !== draft.id && !item.deleted_at && item.status !== "archived" && normalize(item.title ?? "").includes(normalize(linkQuery)));

  function assign(next: CaptureDraft, resetEditor = true) { current.current = next; setDraft(next); if (resetEditor) { setEditorInvalid(false); setEditorEpoch(epoch => epoch + 1); } }
  function persist(value = current.current) {
    if (!hydrated.current || signedOut.current) return;
    if (timer.current) clearTimeout(timer.current);
    const saved = items.current.find((item) => item.id === value.id);
    if (saved ? sameDraft(value, draftFrom(saved, personal)) : !hasDraftContent(value)) delete drafts.current[value.id];
    else drafts.current = { ...drafts.current, [value.id]: structuredClone(value) };
    const ok = writeDrafts(storage.current, app.userId, drafts.current); setAvailable(ok);
    setFeedback(ok ? findDraft(drafts.current, value.id) ? "Rascunho salvo neste navegador" : saved ? savedFeedback : "Pronto para escrever" : "Sem armazenamento · sessão atual");
    setDraftVersion((version) => version + 1);
  }
  const flush = useRef(persist); flush.current = persist;

  useEffect(() => {
    try { storage.current = window.localStorage; } catch { storage.current = null; }
    const stored = readDrafts(storage.current, app.userId); drafts.current = stored.drafts; setAvailable(stored.available); hydrated.current = true;
    const record = items.current.find((item) => item.id === requestedId);
    savedDraft.current = record ? draftFrom(record, personal) : null;
    const initial = findDraft(drafts.current, requestedId) ?? draftFrom(record, personal); assign(initial);
    if (initial.pending_client_id) setUncertainAction("save");
    setFeedback(stored.available ? findDraft(drafts.current, requestedId) ? "Rascunho recuperado" : record ? savedFeedback : "Pronto para escrever" : "Sem armazenamento · sessão atual");
    const onHide = () => { if (document.hidden) flush.current(); };
    const onLeave = () => flush.current();
    const cancelImages = () => { uploadEpoch.current++; };
    const cancelConflictRead = () => { conflictReadEpoch.current++; conflictIntent.current = null; };
    const onLogout = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId && userId !== app.userId) return;
      signedOut.current = true; cancelConflictRead(); uploadEpoch.current++; if (timer.current) clearTimeout(timer.current);
      drafts.current = {}; clearDrafts(storage.current, app.userId);
    };
    document.addEventListener("visibilitychange", onHide); window.addEventListener("pagehide", onLeave); window.addEventListener("segundo-cerebro:demo-logout", onLogout);
    return () => { cancelConflictRead(); flush.current(); cancelImages(); if (timer.current) clearTimeout(timer.current); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onLeave); window.removeEventListener("segundo-cerebro:demo-logout", onLogout); };
    // Hydration happens once per mounted user; later URL changes use the navigation effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.userId]);

  useEffect(() => {
    if (!hydrated.current || current.current.id === requestedId || uncertainAction) return;
    conflictReadEpoch.current++; conflictIntent.current = null; setConflict(null);
    flush.current();
    const record = items.current.find((item) => item.id === requestedId);
    if (requestedId !== "new" && !record) return;
    savedDraft.current = record ? draftFrom(record, personal) : null;
    assign(findDraft(drafts.current, requestedId) ?? draftFrom(record, personal)); setError(null);
    setFeedback(findDraft(drafts.current, requestedId) ? "Rascunho recuperado" : record ? savedFeedback : "Pronto para escrever");
    titleRef.current?.focus({ preventScroll: true });
  }, [requestedId, personal, savedFeedback, uncertainAction]);
  useEffect(() => {
    if (!hydrated.current || writing.current || uncertainAction || !savedDraft.current || !sameDraft(current.current, savedDraft.current)) return;
    const latest = data.items.find(item => item.id === current.current.id);
    if (latest && !sameDraft(savedDraft.current, draftFrom(latest, personal))) {
      const next = draftFrom(latest, personal); savedDraft.current = next; assign(next);
    }
  }, [data.items, personal, uncertainAction]);
  useEffect(() => {
    let active = true;
    const receive = () => {
      const result = getCommandSnapshot(), retained = current.current;
      if (!connected || !hydrated.current || writing.current || signedOut.current || !retained.pending_client_id ||
        (result.status !== "confirmed" && result.status !== "rejected") || result.clientId !== retained.pending_client_id) return;
      // Consume this terminal synchronously: another journal entry may publish
      // pending immediately after it. Never release a different intent/owner.
      requests.current.complete("save");
      if (result.status === "rejected") {
        const next = { ...retained }; delete next.pending_client_id; assign(next, false); persist(); setUncertainAction(null); setError(result.message); return;
      }
      let id: string | null = null;
      try { const url = new URL(result.href, "https://app.invalid"); if (url.pathname === "/capturar") id = url.searchParams.get("capture"); } catch { /* No fallback to a new create. */ }
      if (!id) return;
      writing.current = true; setBusy(true);
      void load("captures", true).then(() => {
        if (!active || signedOut.current || current.current.pending_client_id !== result.clientId) return;
        const saved = getSnapshot("captures").data?.items.find(item => item.id === id && item.user_id === userId);
        if (!saved) { setError("O envio foi confirmado, mas a nota ainda não foi relida. Atualize os dados antes de continuar."); return; }
        delete drafts.current[retained.id]; delete drafts.current[saved.id]; writeDrafts(storage.current, userId, drafts.current);
        savedDraft.current = draftFrom(saved); assign(savedDraft.current); setUncertainAction(null); setError(null); setFeedback("Salva na sua conta");
        if (retained.id === "new") commandRouter.current.replace(`/capturar?capture=${encodeURIComponent(saved.id)}`, { scroll: false });
      }).catch(() => { if (active) setError("Não foi possível reler a nota confirmada. Seu rascunho foi preservado."); })
        .finally(() => { if (active) { writing.current = false; setBusy(false); } });
    };
    const stop = subscribeCommands(receive); receive();
    return () => { active = false; stop(); };
    // Stable application methods retain this owner across Context wrapper renders.
    // A new application/account or unmount still invalidates the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCommandSnapshot, subscribeCommands, load, getSnapshot, userId, connected]);

  function change(patch: Partial<CaptureDraft>) {
    const next = { ...current.current, ...patch }; assign(next, false); setError(null); setFeedback("Salvando rascunho…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 350);
  }
  function open(id: string, trigger?: HTMLElement) {
    if (busy || uploading || uncertainAction) return;
    conflictReadEpoch.current++; conflictIntent.current = null; setConflict(null);
    if ((!mobileEditor || editorPanel.current?.hidden) && window.matchMedia("(max-width: 1000px)").matches) {
      listPosition.current = { pageX: window.scrollX, pageY: window.scrollY, scrollTop: listPanel.current?.scrollTop ?? 0 };
      returnToList.current = trigger ?? newNoteButton.current;
    }
    persist(); setMobileEditor(true); router.push(id === "new" ? "/capturar?capture=new" : `/capturar?capture=${encodeURIComponent(id)}`, { scroll: false });
    if (id === current.current.id) requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }

  async function readConflict(intent: { id: string; clientId: string; owner: string; draft: CaptureDraft; writeError: string }) {
    if (signedOut.current || intent.owner !== app.userId || current.current.id !== intent.id) return;
    if (conflictIntent.current?.reading) return;
    const epoch = ++conflictReadEpoch.current;
    const active = { id: intent.id, clientId: intent.clientId, owner: intent.owner, epoch, reading: true, ready: false };
    conflictIntent.current = active;
    setConflict({ ...intent, reading: true, snapshot: null, error: null });
    try {
      const snapshot = await app.readCaptureForConflict(intent.id);
      if (epoch !== conflictReadEpoch.current || signedOut.current || intent.owner !== app.userId || current.current.id !== intent.id || getCommandSnapshot().status === "session-changed") return;
      if (!sameDraft(current.current, intent.draft)) {
        active.reading = false;
        setConflict({ ...intent, reading: false, snapshot: null, error: "Seu rascunho mudou durante a leitura. Releia a versão salva antes de escolher." });
        return;
      }
      active.reading = false; active.ready = true;
      setConflict({ ...intent, reading: false, snapshot, error: null });
    } catch (reason) {
      if (epoch !== conflictReadEpoch.current || signedOut.current || intent.owner !== app.userId || current.current.id !== intent.id || getCommandSnapshot().status === "session-changed") return;
      active.reading = false;
      setConflict({ ...intent, reading: false, snapshot: null, error: reason instanceof Error ? reason.message : "Não foi possível reler a nota. Seu rascunho continua nesta aba." });
    }
  }
  function resolveConflict(useSaved: boolean) {
    const active = conflictIntent.current;
    if (!conflict?.snapshot || conflict.reading || !active?.ready || active.epoch !== conflictReadEpoch.current || active.clientId !== conflict.clientId || signedOut.current || conflict.owner !== app.userId || active.owner !== app.userId || current.current.id !== conflict.id || getCommandSnapshot().status === "session-changed") return;
    const latest = conflict.snapshot;
    savedDraft.current = draftFrom(latest, personal);
    if (useSaved) {
      assign(savedDraft.current);
      delete drafts.current[latest.id]; writeDrafts(storage.current, app.userId, drafts.current);
      setFeedback(savedFeedback);
    } else { assign({ ...current.current, expected_content: savedDraft.current.expected_content }, false); persist(); }
    setError(currentError => currentError === conflict.writeError ? null : currentError);
    conflictReadEpoch.current++; conflictIntent.current = null; setConflict(null);
    dismissExplicitlyResolvedConflict(app, conflict.clientId);
  }

  async function save(): Promise<Captura | null> {
    if (timer.current) clearTimeout(timer.current);
    if (editorInvalid) { setError("Desfaça a última alteração para voltar aos limites do documento antes de salvar."); return null; }
    const source = current.current, sourceEpoch = conflictReadEpoch.current;
    const before = items.current.find((item) => item.id === source.id);
    const fields: CamposCaptura = { title: source.title.trim(), content: source.content || null, type: source.type, category_id: source.category_id, project_id: source.project_id,
      linked_capture_ids: [...source.linked_capture_ids], attachments: source.attachments };
    const { content, ...metadata } = fields;
    const rich = connected || !!source.document;
    const expected = source.expected_content ?? { kind: "legacy" as const, content: before?.content ?? null };
    const payload = rich ? { id: source.id, fields: metadata, document: documentOfDraft(source), ...(before ? { expected_content: expected } : {}) } : { id: source.id, fields };
    if (source.pending_client_id) requests.current.retain("save", payload, source.pending_client_id);
    const retrying = requests.current.matches("save", payload);
    // A successful create with a lost response may already appear in a refreshed list.
    const validation = validateDraft(source, retrying ? [] : items.current);
    if (validation) {
      setError(validation); setTitleValidationFocus({ draft: source, owner: app.userId, message: validation });
      return null;
    }
    if (before && sameDraft(source, draftFrom(before, personal)) && !requests.current.has("save")) return before;
    const clientId = requests.current.id("save", payload);
    // Preserve the command identity alongside the immutable draft across reloads.
    assign({ ...source, pending_client_id: clientId }, false); persist();
    let saved: Captura;
    try {
      saved = rich ? before ? await app.commands.captures.update({ id: before.id, client_id: clientId, expected_content: expected, patch: { ...metadata, document: documentOfDraft(source) } })
        : await app.commands.captures.create({ ...metadata, document: documentOfDraft(source), client_id: clientId })
        : before ? await app.commands.captures.update({ id: before.id, client_id: clientId, patch: { ...metadata, content } }) : await app.commands.captures.create({ ...fields, client_id: clientId });
      requests.current.complete("save");
    } catch (reason) {
      if (isCommandOutcomeUnknown(reason)) requests.current.unknown("save");
      else {
        requests.current.complete("save");
        const retryable = { ...current.current }; delete retryable.pending_client_id; assign(retryable, false);
        if (reason instanceof ConnectedApplicationError && reason.code === "CONFLICT" && sourceEpoch === conflictReadEpoch.current && source.id === current.current.id) void readConflict({ id: source.id, clientId, owner: app.userId, draft: structuredClone(current.current), writeError: reason.message });
      }
      throw reason;
    }
    if (before?.title && before.title !== saved.title) {
      for (const value of Object.values(drafts.current)) if (!value.document) value.content = rewriteWiki(value.content, before.title, saved.title!);
    }
    delete drafts.current[source.id]; delete drafts.current[saved.id];
    writeDrafts(storage.current, app.userId, drafts.current);
    const next = draftFrom(saved, personal);
    savedDraft.current = draftFrom(saved, personal);
    assign(next); items.current = [...items.current.filter((item) => item.id !== saved.id), saved];
    setFeedback(savedFeedback); setError(null); setConflict(null); setDraftVersion((version) => version + 1);
    if (!before) router.replace(`/capturar?capture=${encodeURIComponent(saved.id)}`, { scroll: false });
    return saved;
  }

  async function perform(action: "save" | "convert" | "organize" | "archive" | "unarchive") {
    if (writing.current || uploading || signedOut.current || conflictIntent.current) return;
    writing.current = true; setBusy(true); setError(null);
    try {
      if (connected && action === "organize") throw new Error("Guardar em Conhecimento ainda não está disponível na conta conectada.");
      const saved = await save(); if (!saved) return;
      const input = { id: saved.id, client_id: requests.current.id(action, { id: saved.id, action }) };
      if (action === "convert") {
        const result = await app.commands.captures.convert({ capture_id: saved.id, client_id: input.client_id });
        toast({ message: "Tarefa criada e vinculada à captura.", duration: null, action: { label: "Abrir tarefa", onClick: () => router.push(`/tarefas?task=${encodeURIComponent(result.tarefa.id)}`) } });
      } else if (action !== "save") {
        if (action === "organize") await app.commands.captures.organize({ ...input, destination: "knowledge" });
        else if (action === "archive") await app.commands.captures.archive(input);
        else await app.commands.captures.unarchive(input);
        const undoKey = `undo:${action}`;
        const undo = { id: saved.id, client_id: requests.current.id(undoKey, { id: saved.id, action }) };
        async function undoOperation() {
          if (writing.current) return;
          writing.current = true; setBusy(true);
          try {
            await (action === "archive" ? app.commands.captures.unarchive(undo) : action === "unarchive" ? app.commands.captures.archive(undo) : app.commands.captures.organize({ ...undo, destination: "inbox" }));
            requests.current.complete(undoKey); uncertainUndo.current = null; setUncertainAction(null); setError(null);
          } catch (reason) {
            if (isCommandOutcomeUnknown(reason)) { requests.current.unknown(undoKey); uncertainUndo.current = undoOperation; setUncertainAction("save"); }
            else if (reason instanceof ConnectedApplicationError && reason.code === "VALIDATION") { requests.current.complete(undoKey); uncertainUndo.current = null; setUncertainAction(null); }
            setError(reason instanceof Error ? reason.message : "Não foi possível desfazer. Tente novamente.");
          } finally { writing.current = false; setBusy(false); }
        }
        toast({ message: action === "organize" ? "Nota guardada em Conhecimento nesta demonstração." : action === "archive" ? "Nota arquivada. Os vínculos foram preservados." : "Nota restaurada.", duration: null, action: { label: "Desfazer", onClick: () => { void undoOperation(); } } });
      } else toast({ message: "Nota salva. Suas conexões estão atualizadas." });
      requests.current.complete(action); setUncertainAction(null);
    } catch (reason) {
      if (isCommandOutcomeUnknown(reason)) { requests.current.unknown(action); setUncertainAction(action); }
      else if (reason instanceof ConnectedApplicationError) { requests.current.complete(action); setUncertainAction(null); }
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar. Seu rascunho foi mantido."); persist();
    }
    finally { writing.current = false; setBusy(false); }
  }
  function submitCurrent() { if (conflictIntent.current) return Promise.resolve(); return uncertainUndo.current ? uncertainUndo.current() : perform(uncertainAction ?? "save"); }

  async function attach(files: File[]) {
    if (!files.length || uploading || busy) return;
    const remaining = 6 - current.current.attachments.length;
    if (files.length > remaining) { setError("Cada nota aceita até seis imagens. Remova uma imagem ou escolha menos arquivos."); return; }
    setUploading(true); setError(null); const epoch = uploadEpoch.current; const id = current.current.id;
    try {
      const prepared = [];
      if (connected) {
        const attachments: AnexoCaptura[] = [];
        for (const file of files) {
          const uploaded = await uploadFile({ file, kind: "capture_image", userId: app.userId, storageOrigin: app.storageOrigin, sender: app.executeDomainCommand });
          if ((uploaded.mime !== "image/png" && uploaded.mime !== "image/jpeg") || !uploaded.width || !uploaded.height) throw new Error("A imagem ainda não foi validada.");
          attachments.push({ id: uploaded.id, name: uploaded.name, mime: uploaded.mime, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes });
        }
        if (!signedOut.current && epoch === uploadEpoch.current && current.current.id === id) change({ attachments: [...current.current.attachments, ...attachments] });
        return;
      }
      for (const file of files) prepared.push(await prepareImage(file));
      if (signedOut.current || epoch !== uploadEpoch.current || current.current.id !== id) return;
      for (const image of prepared) app.stageImage(image);
      change({ attachments: [...current.current.attachments, ...prepared.map(({ id, name, mime, width, height, bytes }) => ({ id, name, mime, width, height, bytes }))] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível preparar a imagem."); }
    finally { setUploading(false); }
  }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) { void attach(Array.from(event.target.files ?? [])); event.target.value = ""; }
  function insertWiki(item: Captura): boolean {
    if (connected || current.current.document) {
      const inserted = richReference.current?.({ id: item.id, title: item.title ?? "Sem título" }) ?? false;
      if (!inserted) setError("Aguarde o editor carregar para inserir o vínculo. Seu rascunho foi mantido.");
      return inserted;
    }
    const element = bodyRef.current; if (!element) return false;
    const start = element.selectionStart; const end = element.selectionEnd; const match = current.current.content.slice(0, start).match(/\[\[([^\]\n]*)$/);
    const from = match ? start - match[0].length : start; const token = `[[${item.title}]]`;
    const content = current.current.content.slice(0, from) + token + current.current.content.slice(end);
    if (content.length > 30_000) { setError("O texto pode ter até 30.000 caracteres."); return false; }
    change({ content }); setCursor(from + token.length);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(from + token.length, from + token.length); });
    return true;
  }
  const inboxCount = filterCaptures(data.items, "inbox", "").length;
  const missing = requestedId !== "new" && !findDraft(drafts.current, requestedId) && !data.items.some((item) => item.id === requestedId && !item.deleted_at);
  return <div className="capture-feature" data-mobile-editor={mobileEditor && !missing ? "true" : "false"}>
    {missing && <div className="capture-empty" role="status"><h2>Nota não encontrada</h2><p>Esta nota não está disponível nesta sessão. Escolha outra na biblioteca ou crie uma nova nota.</p></div>}
    <div className="capture-layout">
    <section ref={listPanel} className="capture-library" aria-label="Biblioteca de notas">
      <header className="capture-list-head">
        <div className="capture-rail-heading"><h2>Suas notas</h2><span className="capture-total">{activeCount}</span></div><Button ref={newNoteButton} className="capture-new-note" onClick={event => open("new", event.currentTarget)} disabled={busy || uploading || !!uncertainAction}><Icons.Capture />Nova nota</Button>
        <div className="capture-filters" role="group" aria-label="Filtrar notas">{([['inbox', 'Entrada'], ['organized', 'Organizadas'], ['all', 'Todas']] as const).map(([value, label]) => <Button key={value} variant="ghost" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{value === "inbox" && <span className="capture-count">{inboxCount}</span>}</Button>)}</div>
        <Field label="Filtrar suas notas" visuallyHiddenLabel type="search" placeholder="Encontrar uma nota…" value={query} onChange={(event) => setQuery(event.target.value)} wrapperClassName="capture-search" />
        <details className="capture-archive-filter"><summary>Mais filtros</summary><Button variant="ghost" aria-pressed={filter === "archived"} onClick={() => setFilter("archived")}>Arquivo</Button></details>
      </header>
      <nav className="capture-list" aria-label="Notas salvas" data-draft-version={draftVersion}>{filtered.length ? <ul>{filtered.map((item) => {
        const links = references({ id: item.id, content: item.content ?? "", linked_capture_ids: item.linked_capture_ids ?? [] }, data.items).ids.length;
        const TypeIcon = TYPE_ICONS[item.type];
        const state = findDraft(drafts.current, item.id) ? "rascunho" : item.status === "inbox" ? "entrada" : item.status === "archived" ? "arquivada" : item.status === "organized" ? "organizada" : null;
        return <li key={item.id} className="capture-item" data-selected={draft.id === item.id ? "true" : undefined}>
          <span className="capture-type-icon" aria-hidden="true"><TypeIcon width={21} height={21} /></span>
          <button type="button" className="capture-row" onClick={event => open(item.id, event.currentTarget)} aria-current={draft.id === item.id ? "true" : undefined} disabled={busy || uploading || !!uncertainAction}>
            <strong>{item.title ?? "Sem título"}</strong>
            <span className="capture-row-heading"><span className="capture-row-type">{TYPE_LABELS[item.type]}</span><span className="capture-row-date">{capturedLabel(item.captured_at)}</span></span>
            {item.content?.trim() && <span className="capture-row-body">{excerptOf(item.content)}</span>}
            <span className="capture-row-meta">{state ? `${state === "entrada" ? "Na entrada" : state === "organizada" ? "Organizada" : state === "arquivada" ? "Arquivada" : "Rascunho"} · ` : ""}{links} {links === 1 ? "conexão" : "conexões"}</span>
          </button>
          {item.converted_task_id && <div className="capture-actions"><Link className="capture-action-link" href={`/tarefas?task=${encodeURIComponent(item.converted_task_id)}`}>Abrir tarefa<span className="capture-sr-only"> de {item.title ?? "nota sem título"}</span><Icons.ArrowUpRight width={16} height={16} /></Link></div>}
        </li>;
      })}</ul> : <div className="capture-empty"><span className="capture-empty-icon" aria-hidden="true"><Icons.Inbox width={32} height={32} /></span><h3>{query ? "Nenhuma nota encontrada" : filter === "inbox" ? "Caixa de entrada em dia" : filter === "archived" ? "Nenhuma nota arquivada" : "Sua primeira ideia começa aqui"}</h3><p>{query ? "Tente outro título, trecho ou tipo." : filter === "inbox" ? "Suas capturas já foram organizadas." : "Escreva uma nota e salve para encontrá-la nesta biblioteca."}</p></div>}</nav>
      <div className="capture-library-footer">
        <div className="capture-pagination"><Button variant="ghost" aria-label="Nota anterior" disabled={busy || currentIndex <= 0} onClick={() => open(filtered[currentIndex - 1]!.id)}><Icons.ChevronLeft /></Button><span>{currentIndex >= 0 ? `${currentIndex + 1} de ${filtered.length}` : `${filtered.length} notas`}</span><Button variant="ghost" aria-label="Próxima nota" disabled={busy || currentIndex < 0 || currentIndex >= filtered.length - 1} onClick={() => open(filtered[currentIndex + 1]!.id)}><Icons.ChevronRight /></Button></div>
        {!connected && <div className="capture-example"><p className="capture-hint">Comece por uma nota de exemplo e siga suas conexões.</p><Button variant="ghost" onClick={() => open("architecture")}>Explorar exemplo<Icons.ChevronRight /></Button></div>}
      </div>
    </section>

      <section ref={editorPanel} className="capture-editor capture-compose" aria-label="Editor de nota" hidden={missing}>
        <div className="capture-compose-head"><Button variant="ghost" className="capture-back-to-list" disabled={busy || uploading || !!uncertainAction} onClick={() => { persist(); setMobileEditor(false); router.replace("/capturar", { scroll: false }); }}><Icons.ChevronLeft />Suas notas</Button><span className="capture-document-label">{draft.id === "new" ? "Nova nota" : selected?.status === "archived" ? "Nota arquivada" : "Documento"}</span><Button variant="primary" onClick={() => void submitCurrent()} loading={busy} disabled={uploading || editorInvalid || promoted || !!conflict}>{draft.id === "new" ? "Salvar nota" : "Salvar alterações"}</Button></div>
        <div className="capture-location"><span>{draft.id === "new" ? "Nova nota" : TYPE_LABELS[draft.type]} · {selected?.status === "archived" ? "Arquivo" : selected?.status === "organized" ? "Conhecimento" : "Caixa de entrada"}</span><span role="status">{feedback}</span></div>
        <form onSubmit={(event) => { event.preventDefault(); void submitCurrent(); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !document.querySelector("dialog[open]")) { event.preventDefault(); void submitCurrent(); } }} onPaste={(event) => { const files = imagesFrom(event.clipboardData); if (files.length) { event.preventDefault(); void attach(files); } }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void attach(Array.from(event.dataTransfer.files)); } }}>
          {uncertainAction && <p className="capture-hint" role="alert">O resultado ainda não foi confirmado. <Button onClick={() => void submitCurrent()} disabled={busy}>Confirmar o mesmo envio</Button></p>}
          {promoted && <p className="capture-hint">Esta é a origem arquivada da página. <Link href={`/conhecimento?origin=${encodeURIComponent(selected!.id)}`}>Abrir a página em Conhecimento</Link></p>}
          <fieldset className="capture-form-fields" disabled={busy || !!uncertainAction || promoted}>
          <Field label="Título da nota" visuallyHiddenLabel ref={titleRef} className="capture-title" placeholder="Dê um título à sua ideia" maxLength={120} value={draft.title} onChange={(event) => change({ title: event.target.value })} disabled={busy} error={error} />
          <div className="capture-toolbar"><Button variant="ghost" ref={linkButton} onClick={() => { setLinkQuery(""); setLinksOpen(true); }} disabled={busy}><Icons.Link />Vincular nota</Button><Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy || draft.attachments.length >= 6} loading={uploading}><Icons.Upload />Anexar imagem</Button><span>{words} {words === 1 ? "palavra" : "palavras"} · {related.ids.length} {related.ids.length === 1 ? "conexão" : "conexões"}</span>
          {/* Hidden native file chooser is activated by the visible, named Button; Field intentionally has no file variant. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} multiple hidden aria-label="Escolher imagens" onChange={chooseFiles} /></div>
          {connected && <p className="capture-hint">As imagens são validadas e guardadas de forma privada na sua conta.</p>}
          {connected || draft.document ? <FormattedEditor key={`${draft.id}:${editorEpoch}`} document={documentOfDraft(draft)} label="Sua anotação" referenceKind="capture" references={data.items.filter(item => item.id !== draft.id && !item.deleted_at).map(item => ({ id: item.id, title: item.title ?? "Sem título" }))} onReferenceCommand={exposeReference} disabled={busy || !!uncertainAction || promoted} onChange={document => { try { const next = withDraftDocument(current.current, document); change(next); setEditorInvalid(false); } catch { setEditorInvalid(true); setError("A nota excedeu os limites de conteúdo. Sua edição anterior foi mantida; desfaça a última alteração."); } }} />
            : <Field as="textarea" label="Sua anotação" ref={bodyRef} className="capture-body" value={draft.content} maxLength={30_000} placeholder={"Escreva sem pressa. Cole um trecho, desenvolva uma ideia ou registre o que não quer esquecer.\n\nUse [[nome da nota]] para conectar pensamentos."} onChange={(event) => { change({ content: event.target.value }); setCursor(event.target.selectionStart); }} onSelect={(event) => setCursor(event.currentTarget.selectionStart)} disabled={busy} />}
          <p className="capture-hint">Digite [[ para encontrar uma nota ou use Vincular nota.</p>
          {wikiToken && <div className="capture-chips" aria-label="Sugestões de notas">{suggestions.length ? suggestions.map((item) => <Button key={item.id} variant="ghost" onClick={() => insertWiki(item)}><Icons.Book />{item.title}</Button>) : <p>Nenhuma nota encontrada. Continue escrevendo ou crie a nota depois.</p>}</div>}
          <div className="capture-chips" aria-label="Notas vinculadas">{related.ids.map((id) => { const target = data.items.find((item) => item.id === id)!; return <span className="capture-chip" key={id}><Button variant="ghost" onClick={() => open(id)}><Icons.Link />{target.title}{target.status === "archived" ? " · arquivada" : ""}</Button><Button variant="ghost" aria-label={`Desvincular ${target.title}`} onClick={() => { assign(unlinkDraft(current.current, id, target.title ?? "")); persist(); }}><Icons.X /></Button></span>; })}</div>
          {!!related.missing.length && <p className="capture-hint">Ainda não encontrada: {related.missing.join(", ")}. O texto será salvo; o vínculo aparece quando a nota existir.</p>}
          {draft.exampleAttachment && <div className="capture-chip"><span>referencia-de-leitura.jpg · exemplo nominal</span><Button variant="ghost" aria-label="Remover anexo de exemplo" onClick={() => change({ exampleAttachment: false })}><Icons.X /></Button></div>}
          {!!draft.attachments.length && <><div className="capture-images">{draft.attachments.map((attachment) => <ImagePreview key={attachment.id} attachment={attachment} blob={app.getImage(attachment.id)?.blob} privateUrl={connected ? fileReadUrl(attachment.id, app.userId) : undefined} onRemove={() => change({ attachments: draft.attachments.filter((image) => image.id !== attachment.id) })} />)}</div><p className="capture-hint">{connected ? "Imagens reencodadas sem os metadados originais. Salve a nota para manter estes vínculos." : "Imagens preparadas sem os metadados originais. Os arquivos ficam apenas nesta sessão."}</p></>}
          <Collapsible title="Organizar e definir tipo"><div className="capture-metadata"><Field as="select" label="Tipo" value={draft.type} onChange={(event) => change({ type: event.target.value as CaptureDraft["type"] })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Field><Field as="select" label="Categoria" value={draft.category_id ?? ""} onChange={(event) => change({ category_id: event.target.value || null })}><option value="">Sem categoria</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Field><Field as="select" label="Projeto" value={draft.project_id ?? ""} onChange={(event) => change({ project_id: event.target.value || null })}><option value="">Nenhum</option>{data.projects.filter((project) => !project.deleted_at || project.id === draft.project_id).map((project) => <option key={project.id} value={project.id}>{project.name}{project.deleted_at ? " · excluído" : ""}</option>)}</Field></div>{draft.type === "reminder" && <p className="capture-hint">Lembrete classifica a anotação. Avisos agendados ainda não estão disponíveis.</p>}</Collapsible>
          <footer className="capture-save"><p>{available ? "Rascunho local automático." : "Sem armazenamento · sessão atual"}</p><span>Ctrl/Cmd + Enter para salvar.</span></footer>
          </fieldset>
        </form>
        {conflict && <section className="capture-conflict" aria-label="Conflito de edição"><h3>O conteúdo salvo mudou</h3><p>Seu rascunho foi preservado. Confira a versão atual antes de enviar novamente.</p>
          {conflict.reading ? <p role="status">Relendo a versão salva. Seu rascunho continua nesta aba.</p> : conflict.error ? <><p role="alert">{conflict.error}</p><Button onClick={() => void readConflict({ id: conflict.id, clientId: conflict.clientId, owner: conflict.owner, draft: structuredClone(current.current), writeError: conflict.writeError })}>Reler versão salva</Button></> : conflict.snapshot && <>
            <details><summary>Ver o texto salvo</summary><p>{conflict.snapshot.content}</p></details>
            <Button onClick={() => resolveConflict(false)}>Usar a versão atual como base e manter meu rascunho</Button><Button variant="ghost" onClick={() => resolveConflict(true)}>Usar o conteúdo salvo</Button>
          </>}
        </section>}
        {selected && !selected.deleted_at && <><section className="capture-backlinks"><h2>Quem menciona esta nota · {backlinks.length}</h2>{backlinks.length ? backlinks.map((item) => <Button key={item.id} variant="ghost" onClick={() => open(item.id)}>{item.title}{item.status === "archived" ? " · arquivada" : ""}<Icons.ChevronRight /></Button>) : <p>Quando outra nota apontar para esta, ela aparece aqui.</p>}</section><div className="capture-lifecycle">{selected.status === "archived" ? <Button onClick={() => void perform("unarchive")} disabled={busy || !!uncertainAction || !!conflict}>Restaurar nota</Button> : <>{selected.status === "inbox" && <>{connected ? <PromoteCapture captureId={selected.id} disabled={busy || !!uncertainAction || !!conflict || !sameDraft(draft, draftFrom(selected, personal))} /> : <Button variant="ghost" onClick={() => void perform("organize")} disabled={busy || !!uncertainAction || !!conflict}>Guardar em Conhecimento</Button>}<Button variant="ghost" onClick={() => void perform("convert")} disabled={busy || !!uncertainAction || !!conflict}>Virar tarefa</Button></>}<Button variant="ghost" onClick={() => void perform("archive")} disabled={busy || !!uncertainAction || !!conflict}>Arquivar</Button></>}{selected.converted_task_id && <Link className="capture-text-link" href={`/tarefas?task=${encodeURIComponent(selected.converted_task_id)}`}>Abrir tarefa criada<Icons.ChevronRight /></Link>}</div><RelatedPanel type="capture" id={selected.id} /></>}
      </section>

    </div>
    {linksOpen && <Dialog open onClose={() => setLinksOpen(false)} title="Vincular a outra nota" description="Vincular conecta as notas sem copiar o conteúdo." initialFocusRef={linkSearch} returnFocusRef={linkButton}><Field label="Buscar nota para vincular" type="search" ref={linkSearch} value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} /><div className="capture-link-results">{linkCandidates.length ? linkCandidates.map((item) => <Button key={item.id} variant="ghost" disabled={related.ids.includes(item.id)} onClick={() => { if ((connected || draft.document) && !insertWiki(item)) return; change({ linked_capture_ids: [...new Set([...current.current.linked_capture_ids, item.id])] }); setLinksOpen(false); }}><Icons.Book /><span>{item.title}{related.ids.includes(item.id) ? " · já vinculada" : ""}</span><Icons.Capture /></Button>) : <p className="capture-empty">Nenhuma nota encontrada. Tente outro título ou crie uma nova nota.</p>}</div></Dialog>}
  </div>;
}
