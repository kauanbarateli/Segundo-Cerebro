"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useDemoApplication, useDemoPrivacy } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { normalizarTituloPagina, textoDoDocumento, type AlvoRelacionado, type ComandoConhecimento, type ConhecimentoDTO, type Pagina, type TipoVinculo } from "@/core/conhecimento";
import { createKnowledgeClient, KnowledgeClientError } from "./knowledge-client";
import { knowledgeDraftSession, type KnowledgeDraftFields, type KnowledgeDraftSession } from "./knowledge-drafts";

const Editor = dynamic(() => import("./knowledge-editor"), { ssr: false, loading: () => <div className="knowledge-editor-loading" role="status">Carregando editor…</div> });
type Client = ReturnType<typeof createKnowledgeClient>;
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
const endedSession = (error: unknown) => error instanceof KnowledgeClientError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code);
// JSONB may reorder object keys. Compare document values while preserving the
// order of blocks, inline nodes and marks returned by the editor.
function sameDocument(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((value, index) => sameDocument(value, right[index]));
  if (Array.isArray(right)) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>, keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameDocument(a[key], b[key]));
}
export function ConnectedKnowledgeWorkspace() {
  const { userId, executeDomainCommand } = useDemoApplication(), router = useRouter(), params = useSearchParams();
  const client = useMemo(() => createKnowledgeClient(userId, undefined, executeDomainCommand), [userId, executeDomainCommand]);
  const drafts = useMemo(() => knowledgeDraftSession(userId, executeDomainCommand), [userId, executeDomainCommand]);
  const [data, setData] = useState<ConhecimentoDTO | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [notice, setNotice] = useState("");
  const [form, setForm] = useState<"notebook" | "page" | "rename" | null>(null), [name, setName] = useState(""), [book, setBook] = useState(""), [project, setProject] = useState("");
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<ComandoConhecimento | null>(null);
  const inFlight = useRef(false), loadVersion = useRef(0);
  const notebookId = params.get("notebook"), pageId = params.get("note"), term = params.get("q") ?? "", view = params.get("view") ?? "active";
  const refresh = useCallback(async (signal?: AbortSignal) => { if (drafts.isClosed()) { setData(null); setError("Sua sessão terminou. Recarregue a página para continuar."); setLoading(false); return; } const version = ++loadVersion.current; setLoading(true); try { const next = await client.load(signal); if (!signal?.aborted && !drafts.isClosed() && version === loadVersion.current) { setData(next); setError(""); } } catch (failure) { if (!signal?.aborted && version === loadVersion.current) { if (endedSession(failure)) { drafts.revoke(); setData(null); } setError(message(failure)); } } finally { if (!signal?.aborted && version === loadVersion.current) setLoading(false); } }, [client, drafts]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  function navigate(change: Record<string, string | null>) { const next = new URLSearchParams(params.toString()); for (const [key, value] of Object.entries(change)) { if (value) next.set(key, value); else next.delete(key); } router.replace(`/conhecimento${next.size ? `?${next}` : ""}`, { scroll: false }); }
  const notebooks = [...data?.notebooks ?? []].filter(item => view === "trash" ? !!item.deleted_at : !item.deleted_at).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const pages = (data?.pages ?? []).filter(page => view === "trash" ? !!page.deleted_at : !page.deleted_at && (view === "archived" ? !!page.archived_at : !page.archived_at));
  const filtered = pages.filter(page => (!notebookId || page.notebook_id === notebookId) && normalizarTituloPagina(`${page.title} ${page.content_text}`).includes(normalizarTituloPagina(term)));
  const selected = pageId ? data?.pages.find(page => page.id === pageId) : params.get("origin") ? data?.pages.find(page => page.origin_capture_id === params.get("origin")) : filtered[0];
  const selectedNotebook = data?.notebooks.find(item => item.id === (notebookId ?? selected?.notebook_id));
  const hasActiveNotebook = !!data?.notebooks.some(item => !item.deleted_at);
  async function send(request: ComandoConhecimento): Promise<unknown> {
    if (inFlight.current) throw new Error("Aguarde o envio atual."); inFlight.current = true; setBusy(true); setError("");
    try { const result = await client.command(request); setPending(null); await refresh(); return result; }
    catch (failure) { if (endedSession(failure)) { drafts.revoke(); setData(null); setPending(null); } else if (failure instanceof KnowledgeClientError && failure.unknownOutcome) setPending(request); setError(message(failure)); throw failure; }
    finally { inFlight.current = false; setBusy(false); }
  }
  const operation = async (command: ComandoConhecimento["command"], input: Record<string, unknown>, success: string) => { try { await send({ command, input: { ...input, client_id: crypto.randomUUID() } } as ComandoConhecimento); setNotice(success); } catch { /* O formulário e o erro são preservados. */ } };
  function open(kind: "notebook" | "page" | "rename") { setName(kind === "rename" ? selectedNotebook?.name ?? "" : ""); setBook(notebookId ?? data?.notebooks.find(item => !item.deleted_at)?.id ?? ""); setProject(kind === "rename" ? selectedNotebook?.project_id ?? "" : params.get("project") ?? ""); setForm(kind); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); try {
      const request: ComandoConhecimento = form === "page" ? { command: "knowledge.page.create", input: { notebook_id: book, title: name, client_id: crypto.randomUUID() } }
        : form === "rename" ? { command: "knowledge.notebook.update", input: { id: selectedNotebook!.id, name, project_id: project || null, client_id: crypto.randomUUID() } }
          : { command: "knowledge.notebook.create", input: { name, project_id: project || null, client_id: crypto.randomUUID() } };
      const result = await send(request) as { id: string; notebook_id?: string }; setForm(null); setNotice(form === "page" ? "Página criada." : "Caderno salvo.");
      navigate(form === "page" ? { note: result.id, notebook: result.notebook_id ?? book, view: null } : { notebook: result.id, note: null, view: null });
    } catch { /* Preservar campos e permitir confirmação do mesmo envio. */ }
  }
  if (!data) return error ? <Card className="knowledge-message"><h2>{drafts.isClosed() ? "Sua sessão terminou" : "Não foi possível abrir suas páginas"}</h2><p role="alert">{error}</p><Button onClick={() => drafts.isClosed() ? window.location.reload() : void refresh()}>{drafts.isClosed() ? "Recarregar página" : "Tentar de novo"}</Button></Card> : <div className="knowledge-layout knowledge-skeleton" role="status" aria-label="Carregando conhecimento"><div className="knowledge-skeleton-tree"><i /><i /><i /></div><div className="knowledge-skeleton-reader"><i /><i /></div></div>;
  return <div className="knowledge-workspace" data-access="allowed" aria-busy={loading || undefined}>
    <div className="knowledge-heading"><p>{pages.length} {pages.length === 1 ? "página" : "páginas"}</p><div className="knowledge-actions"><Button disabled={busy || !!pending} onClick={() => open("notebook")}>Novo caderno</Button><Button variant="primary" disabled={busy || !!pending || !data.notebooks.some(item => !item.deleted_at)} onClick={() => open("page")}>Nova página</Button></div></div>
    {notice && <p className="knowledge-feedback" role="status">{notice}</p>}
    {error && <div className="knowledge-feedback"><p role="alert">{error}</p>{pending ? <Button disabled={busy} onClick={() => void send(pending).then(() => setNotice("Envio confirmado.")).catch(() => undefined)}>Confirmar o mesmo envio</Button> : <Button disabled={busy} onClick={() => void refresh()}>Atualizar dados</Button>}</div>}
    <div className="knowledge-layout">
      <Card className="knowledge-tree"><h2>Cadernos</h2><Field type="search" label="Buscar nas páginas" value={term} onChange={event => navigate({ q: event.target.value, note: null })} />
        <nav aria-label="Cadernos de conhecimento"><Button variant={!notebookId && view === "active" ? "primary" : "ghost"} onClick={() => navigate({ notebook: null, note: null, view: null })}>Todas as páginas</Button>
          {notebooks.map(notebook => <div className="knowledge-notebook" key={notebook.id}><Button variant={notebookId === notebook.id ? "primary" : "ghost"} onClick={() => navigate({ notebook: notebook.id, note: null })}>{notebook.name}<span>{pages.filter(page => page.notebook_id === notebook.id).length}</span></Button>
            {notebookId === notebook.id && <ul>{filtered.map(page => <li key={page.id}><Link href={`/conhecimento?notebook=${notebook.id}&note=${page.id}${view !== "active" ? `&view=${view}` : ""}`} aria-current={selected?.id === page.id ? "page" : undefined}>{page.parent_id && <span aria-hidden="true">· </span>}{page.title}</Link></li>)}</ul>}
          </div>)}
          <Button variant={view === "archived" ? "primary" : "ghost"} onClick={() => navigate({ view: "archived", notebook: null, note: null })}>Arquivadas</Button>
          <Button variant={view === "trash" ? "primary" : "ghost"} onClick={() => navigate({ view: "trash", notebook: null, note: null })}>Lixeira</Button>
        </nav>
        {!data.notebooks.length && <p className="knowledge-empty-copy">Crie um caderno para começar a organizar suas páginas.</p>}
        {selectedNotebook && <div className="knowledge-notebook-actions">{selectedNotebook.deleted_at ? <Button disabled={busy || !!pending} onClick={() => void operation("knowledge.notebook.restore", { id: selectedNotebook.id }, "Caderno e páginas restaurados.")}>Restaurar caderno</Button> : <><Button disabled={busy || !!pending} onClick={() => open("rename")}>Editar caderno</Button><Button disabled={busy || !!pending} onClick={() => void operation("knowledge.notebook.delete", { id: selectedNotebook.id }, "Caderno e páginas enviados para a lixeira.")}>Mover caderno para lixeira</Button></>}</div>}
      </Card>
      <div className="knowledge-main">
        <Card className="knowledge-results"><h2>{view === "trash" ? "Páginas na lixeira" : view === "archived" ? "Páginas arquivadas" : term ? "Resultados da busca" : "Páginas"}</h2>
          {filtered.length ? <ul>{filtered.map(page => <li key={page.id}><Link href={`/conhecimento?note=${page.id}${view !== "active" ? `&view=${view}` : ""}`} aria-current={selected?.id === page.id ? "page" : undefined}>{page.title}</Link></li>)}</ul> : <div className="knowledge-empty-copy"><p>{term ? "Nenhuma página encontrada. Tente outro termo ou caderno." : view === "trash" ? "A lixeira está vazia." : view === "archived" ? "Nenhuma página arquivada." : hasActiveNotebook ? "Seu caderno está pronto para a primeira página." : "Crie um caderno para começar a organizar suas páginas."}</p>{view === "active" && !term && <Button disabled={busy || !!pending} onClick={() => open(hasActiveNotebook ? "page" : "notebook")}>{hasActiveNotebook ? "Criar primeira página" : "Criar primeiro caderno"}</Button>}</div>}
        </Card>
        {pageId && !selected && <Card className="knowledge-message"><h2>Página não encontrada</h2><p>Ela não está disponível para sua conta.</p><Button onClick={() => navigate({ note: null })}>Voltar às páginas</Button></Card>}
        {selected && <PageEditor key={selected.id} page={selected} data={data} client={client} send={send} drafts={drafts} busy={busy || !!pending} onNotice={setNotice} />}
      </div>
    </div>
    <Dialog open={!!form} onClose={() => setForm(null)} title={form === "page" ? "Nova página" : form === "rename" ? "Editar caderno" : "Novo caderno"} dismissible={!busy && !pending}>
      <form className="knowledge-form" onSubmit={event => void submit(event)}><Field label={form === "page" ? "Título da página" : "Nome do caderno"} value={name} onChange={event => setName(event.target.value)} maxLength={form === "page" ? 200 : 120} required disabled={busy || !!pending} />
        {form === "page" ? <Field as="select" label="Caderno" value={book} onChange={event => setBook(event.target.value)} required disabled={busy || !!pending}><option value="">Escolha um caderno</option>{data.notebooks.filter(item => !item.deleted_at).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Field>
          : <Field as="select" label="Projeto" value={project} onChange={event => setProject(event.target.value)} disabled={busy || !!pending}><option value="">Sem projeto</option>{data.targets.filter(item => item.type === "project").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Field>}
        {error && <p role="alert">{error}</p>}<Button type="submit" variant="primary" loading={busy} disabled={!!pending}>{form === "page" ? "Criar página" : "Salvar caderno"}</Button>{pending && <Button type="button" onClick={() => void send(pending).then(() => setForm(null)).catch(() => undefined)}>Confirmar o mesmo envio</Button>}
      </form>
    </Dialog>
  </div>;
}

function PageEditor({ page, data, client, send, drafts, busy, onNotice }: { page: Pagina; data: ConhecimentoDTO; client: Client; send(request: ComandoConhecimento): Promise<unknown>; drafts: KnowledgeDraftSession; busy: boolean; onNotice(value: string): void }) {
  const { valuesHidden } = useDemoPrivacy();
  const relatedTitle = (item: AlvoRelacionado) => item.type === "transaction" && valuesHidden ? "Lançamento financeiro" : item.title;
  const initial = useMemo(() => drafts.read(page.id), [drafts, page.id]);
  const [title, setTitle] = useState(initial?.title ?? page.title), [document, setDocument] = useState(initial?.document ?? page.document), [version, setVersion] = useState(initial?.version ?? page.version), [notebook, setNotebook] = useState(initial?.notebook ?? page.notebook_id), [parent, setParent] = useState(initial?.parent ?? page.parent_id ?? "");
  const [editorEpoch, setEditorEpoch] = useState(0), [failure, setFailure] = useState(""), [conflict, setConflict] = useState<Pagina | null>(null), [target, setTarget] = useState("");
  const [discarding, setDiscarding] = useState(false), discardTrigger = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const saved = useRef<KnowledgeDraftFields>(initial?.saved ?? { title: page.title, document: page.document, notebook: page.notebook_id, parent: page.parent_id ?? "" });
  const dirty = saved.current.title !== title || !sameDocument(saved.current.document, document) || saved.current.notebook !== notebook || saved.current.parent !== parent;
  function edit(patch: Partial<KnowledgeDraftFields>) {
    if (!mounted.current || drafts.isClosed()) return;
    const next = { title, document, notebook, parent, ...patch };
    if (patch.title !== undefined) setTitle(patch.title); if (patch.document !== undefined) setDocument(patch.document); if (patch.notebook !== undefined) setNotebook(patch.notebook); if (patch.parent !== undefined) setParent(patch.parent);
    if (next.title === saved.current.title && sameDocument(next.document, saved.current.document) && next.notebook === saved.current.notebook && next.parent === saved.current.parent) drafts.remove(page.id);
    else drafts.write(page.id, { ...next, version, saved: saved.current });
  }
  const readonly = !!page.deleted_at || !!page.archived_at;
  const backlinks = data.pages.filter(source => !source.deleted_at && !source.archived_at && data.refs.some(ref => ref.page_id === source.id && ref.target_id === page.id));
  const refs = data.refs.filter(ref => ref.page_id === page.id);
  const choices: AlvoRelacionado[] = [...data.pages.filter(item => !item.deleted_at && !item.archived_at && item.id !== page.id).map(item => ({ type: "page" as const, id: item.id, title: item.title, href: `/conhecimento?note=${item.id}` })), ...data.notebooks.filter(item => !item.deleted_at).map(item => ({ type: "notebook" as const, id: item.id, title: item.name, href: `/conhecimento?notebook=${item.id}` })), ...data.targets];
  const linked = data.links.filter(link => !link.deleted_at && (link.from_type === "page" && link.from_id === page.id || link.to_type === "page" && link.to_id === page.id)).map(link => ({ link, item: choices.find(item => item.type === (link.from_id === page.id && link.from_type === "page" ? link.to_type : link.from_type) && item.id === (link.from_id === page.id && link.from_type === "page" ? link.to_id : link.from_id)) })).filter(entry => !!entry.item);
  function adopt(next: Pagina) { if (!mounted.current || drafts.isClosed()) return; drafts.remove(page.id); setTitle(next.title); setDocument(next.document); setVersion(next.version); setNotebook(next.notebook_id); setParent(next.parent_id ?? ""); setEditorEpoch(value => value + 1); setConflict(null); setFailure(""); saved.current = { title: next.title, document: next.document, notebook: next.notebook_id, parent: next.parent_id ?? "" }; }
  function discardDraft() {
    // Keep the saved baseline selected from a conflict when the parent has not
    // refreshed yet; a newer parent snapshot can still replace that baseline.
    const baseline = saved.current;
    adopt(page.version > version ? page : { ...page, title: baseline.title, document: baseline.document, notebook_id: baseline.notebook, parent_id: baseline.parent || null, version });
    setDiscarding(false);
  }
  useEffect(() => {
    // An explicitly adopted conflict response can be newer than the parent
    // snapshot. That older prop must not roll back the adopted editor version.
    if (page.version <= version || dirty && (page.title !== title || !sameDocument(page.document, document) || page.notebook_id !== notebook || (page.parent_id ?? "") !== parent)) return;
    setTitle(page.title); setDocument(page.document); setVersion(page.version); setNotebook(page.notebook_id); setParent(page.parent_id ?? ""); setEditorEpoch(value => value + 1);
    saved.current = { title: page.title, document: page.document, notebook: page.notebook_id, parent: page.parent_id ?? "" }; drafts.remove(page.id);
  }, [page, version, dirty, title, document, notebook, parent, drafts]);
  async function save(nextDocument = document, expectedVersion = version): Promise<Pagina | null> {
    try { const result = await send({ command: "knowledge.page.update", input: { id: page.id, title, document: nextDocument, expected_version: expectedVersion, notebook_id: notebook, parent_id: parent || null, client_id: crypto.randomUUID() } }) as Pagina; adopt(result); onNotice("Página salva."); return result; }
    catch (error) { setFailure(message(error)); if (error instanceof KnowledgeClientError && error.code === "CONFLICT") { try { setConflict((await client.page(page.id)).page); } catch { /* Rascunho continua na tela. */ } } return null; }
  }
  async function resolve(alias: string, nextDocument = document) {
    if (dirty || !sameDocument(nextDocument, document)) { if (!await save(nextDocument)) return; }
    try { await send({ command: "knowledge.page.resolve-ref", input: { id: page.id, alias, client_id: crypto.randomUUID() } }); adopt((await client.page(page.id)).page); onNotice("Referência conectada."); } catch (error) { setFailure(message(error)); }
  }
  async function lifecycle(command: "knowledge.page.delete" | "knowledge.page.restore" | "knowledge.page.archive" | "knowledge.page.unarchive") { try { await send({ command, input: { id: page.id, client_id: crypto.randomUUID() } }); onNotice(command.endsWith("restore") ? "Árvore restaurada." : command.endsWith("delete") ? "Página e descendentes enviados para a lixeira." : "Página atualizada."); } catch (error) { setFailure(message(error)); } }
  useEffect(() => { if (!dirty) return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
  return <Card className="knowledge-reader">
    <div className="knowledge-editor-heading"><p className="knowledge-breadcrumb">{data.notebooks.find(item => item.id === page.notebook_id)?.name ?? "Caderno"}{page.origin_capture_id ? " · organizada de uma captura" : ""}</p><span className="knowledge-meta" role="status">{readonly ? page.deleted_at ? "Na lixeira" : "Arquivada" : dirty ? "Alterações por salvar" : "Salva"}</span></div>
    {readonly ? <><h2>{page.title}</h2><div className="knowledge-copy">{page.content_text}</div><Button disabled={busy} onClick={() => void lifecycle(page.deleted_at ? "knowledge.page.restore" : "knowledge.page.unarchive")}>{page.deleted_at ? "Restaurar página e descendentes" : "Desarquivar página"}</Button></> : <>
      <Field label="Título da página" value={title} onChange={event => edit({ title: event.target.value })} maxLength={200} required disabled={busy} />
      <div className="knowledge-organization"><Field as="select" label="Caderno da página" value={notebook} onChange={event => edit({ notebook: event.target.value, parent: "" })} disabled={busy}>{data.notebooks.filter(item => !item.deleted_at).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Field><Field as="select" label="Página mãe" value={parent} onChange={event => edit({ parent: event.target.value })} disabled={busy}><option value="">Raiz do caderno</option>{data.pages.filter(item => item.id !== page.id && item.notebook_id === notebook && !item.deleted_at).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Field></div>
      <Editor key={`${page.id}:${editorEpoch}`} document={document} pages={data.pages} disabled={busy} onChange={next => edit({ document: next })} onCreateReference={resolve} />
      {dirty && <p className="knowledge-feedback" role="status">Rascunho mantido nesta aba enquanto você navega. Salve antes de recarregar ou sair da conta.</p>}
      <div className="knowledge-actions"><Button variant="primary" disabled={busy || !dirty} onClick={() => void save()}>Salvar página</Button>{dirty && <Button disabled={busy} onClick={event => { discardTrigger.current = event.currentTarget; setDiscarding(true); }}>Descartar rascunho</Button>}<Button disabled={busy || dirty} onClick={() => void lifecycle("knowledge.page.archive")}>Arquivar</Button><Button disabled={busy || dirty} onClick={() => void lifecycle("knowledge.page.delete")}>Mover para lixeira</Button></div>
    </>}
    {failure && <p role="alert">{failure}</p>}
    {conflict && <section className="knowledge-conflict" aria-label="Conflito de edição"><h3>Há uma versão mais recente</h3><p>Seu rascunho continua no editor. A versão salva tem o título “{conflict.title}”.</p><details><summary>Ver o texto salvo</summary><p className="knowledge-copy">{textoDoDocumento(conflict.document)}</p></details><div className="knowledge-actions"><Button disabled={busy} onClick={() => adopt(conflict)}>Usar a versão salva</Button><Button disabled={busy} onClick={() => void save(document, conflict.version)}>Salvar meu rascunho sobre a atual</Button></div></section>}
    <section className="knowledge-backlinks"><h3>Referências nesta página</h3>{refs.length ? <ul>{refs.map(ref => { const destination = data.pages.find(item => item.id === ref.target_id); return <li key={ref.id}>{destination ? <Link href={`/conhecimento?note=${destination.id}`}>{destination.title}{destination.deleted_at ? " · na lixeira" : ""}</Link> : <Button variant="ghost" disabled={busy || readonly} onClick={() => void resolve(ref.alias)}>Criar página “{ref.alias}”</Button>}</li>; })}</ul> : <p>Digite [[ no editor para conectar uma página.</p>}</section>
    <section className="knowledge-backlinks"><h3>Referências a esta página</h3>{backlinks.length ? <ul>{backlinks.map(source => <li key={source.id}><Link href={`/conhecimento?note=${source.id}`}>{source.title}</Link></li>)}</ul> : <p>Nenhuma referência por enquanto.</p>}</section>
    <section className="knowledge-backlinks"><h3>Relacionado</h3>{linked.length ? <ul>{linked.map(({ link, item }) => <li className="knowledge-related-item" key={link.id}><Link href={item!.href}>{relatedTitle(item!)}</Link><Button variant="ghost" disabled={busy} aria-label={`Desvincular ${relatedTitle(item!)}`} onClick={() => void send({ command: "knowledge.link.delete", input: { id: link.id, client_id: crypto.randomUUID() } }).catch(error => setFailure(message(error)))}>Desvincular</Button></li>)}</ul> : <p>Conecte tarefas, capturas e outros registros para manter o contexto por perto.</p>}
      {!readonly && <form className="knowledge-link-form" onSubmit={event => { event.preventDefault(); const [type, id] = target.split(":"); if (type && id) void send({ command: "knowledge.link.create", input: { from_type: "page", from_id: page.id, to_type: type as TipoVinculo, to_id: id, client_id: crypto.randomUUID() } }).then(() => setTarget("")).catch(error => setFailure(message(error))); }}><Field as="select" label="Registro para vincular" value={target} onChange={event => setTarget(event.target.value)} disabled={busy}><option value="">Escolha um registro</option>{choices.map(item => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{relatedTitle(item)} · {item.type === "page" ? "página" : item.type === "notebook" ? "caderno" : item.type === "task" ? "tarefa" : item.type === "capture" ? "captura" : item.type === "project" ? "projeto" : item.type === "file" ? "arquivo" : item.type === "habit" ? "hábito" : item.type === "event" ? "evento" : "lançamento"}</option>)}</Field><Button type="submit" disabled={busy || !target}>Vincular</Button></form>}
    </section>
    <ConfirmDialog open={discarding} title="Descartar o rascunho?" description="As alterações não salvas desta página serão removidas. A versão salva na sua conta será mantida." confirmLabel="Descartar alterações" returnFocusRef={discardTrigger} onClose={() => setDiscarding(false)} onConfirm={discardDraft} />
  </Card>;
}
