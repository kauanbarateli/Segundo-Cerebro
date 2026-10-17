"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { normalizarTituloCaptura } from "@/core/capturas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { FUSO_DO_APP } from "@/core/tempo";
import "./knowledge.css";
import { ConnectedKnowledgeWorkspace } from "./knowledge-connected-workspace";

const updatedLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, day: "numeric", month: "short" }).format(new Date(iso));

export function KnowledgeSkeleton() {
  return <div className="knowledge-layout knowledge-skeleton" role="status" aria-label="Carregando conhecimento"><div className="knowledge-skeleton-tree" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((index) => <i key={index} />)}</div><div className="knowledge-skeleton-reader" aria-hidden="true"><i /><i /><i /><i /></div></div>;
}
export function KnowledgeWorkspace() {
  const { connected } = useDemoAccess();
  return connected ? <ConnectedKnowledgeWorkspace /> : <DemoKnowledgeWorkspace />;
}
function DemoKnowledgeWorkspace() {
  const query = useDemoQuery("knowledge"), { policy } = useDemoAccess();
  const router = useRouter(), params = useSearchParams();
  const notebookId = params.get("notebook"), term = params.get("q") ?? "";
  const data = query.data, items = data?.items.filter((item) => item.status === "organized" && item.archived_at === null && item.deleted_at === null) ?? [];
  const memberships = data?.memberships ?? [], notebooks = [...data?.notebooks ?? []].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const inNotebook = (id: string, notebook: string | null) => notebook === null || (notebook === "unfiled" ? !memberships.some((entry) => entry.capture_id === id) : memberships.some((entry) => entry.capture_id === id && entry.notebook_id === notebook));
  const filtered = items.filter((item) => inNotebook(item.id, notebookId) && normalizarTituloCaptura((item.title ?? "") + " " + (item.content ?? "")).includes(normalizarTituloCaptura(term)));
  const selected = params.has("note") ? items.find((item) => item.id === params.get("note")) : filtered[0];
  const selectedNotebook = notebooks.find((notebook) => memberships.some((entry) => entry.capture_id === selected?.id && entry.notebook_id === notebook.id));
  const canEdit = resolveAccess("capturar", policy).allowed;
  function navigate(change: { notebook?: string | null; note?: string | null; q?: string }) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(change)) { if (value) next.set(key, value); else next.delete(key); }
    router.replace("/conhecimento" + (next.size ? "?" + next.toString() : ""), { scroll: false });
  }
  function body(content: string) {
    return content.split(/(\[\[[^\]\n]+\]\])/g).map((part, index) => {
      const title = part.startsWith("[[") && part.endsWith("]]") ? part.slice(2, -2) : null;
      const target = title ? items.find((item) => normalizarTituloCaptura(item.title ?? "") === normalizarTituloCaptura(title)) : null;
      return target ? <Link key={index} href={"/conhecimento?note=" + encodeURIComponent(target.id)}>{title}</Link> : part;
    });
  }
  const backlinks = selected ? items.filter((item) => item.id !== selected.id && ((item.linked_capture_ids ?? []).includes(selected.id) || [...(item.content ?? "").matchAll(/\[\[([^\]\n]+)\]\]/g)].some((match) => normalizarTituloCaptura(match[1]!) === normalizarTituloCaptura(selected.title ?? "")))) : [];
  if (query.status === "error") return <Card className="knowledge-message" data-access="allowed"><h2>Não foi possível abrir suas notas</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!data) return <KnowledgeSkeleton />;
  const notebookOf = (id: string) => notebooks.find((notebook) => memberships.some((entry) => entry.capture_id === id && entry.notebook_id === notebook.id))?.name ?? "Sem caderno";
  const excerpt = (content: string | null) => (content ?? "").replace(/\[\[([^\]\n]+)\]\]/g, "$1").trim().slice(0, 220);
  const words = (selected?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  return <div className="knowledge-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="knowledge-layout">
      <aside className="knowledge-tree" aria-labelledby="knowledge-tree-title">
        <div className="knowledge-tree-head"><h2 id="knowledge-tree-title">Cadernos</h2></div>
        <Field type="search" label="Buscar nas notas" visuallyHiddenLabel placeholder="Buscar nas notas…" value={term} onChange={(event) => navigate({ q: event.target.value, note: null })} />
        <nav aria-label="Cadernos de conhecimento"><Button variant="ghost" className="knowledge-nav-item" aria-current={notebookId === null ? "true" : undefined} onClick={() => navigate({ notebook: null, note: null })}><Icons.Board width={18} height={18} />Todas as notas <span>{items.length}</span></Button>
          {notebooks.map((notebook) => <div key={notebook.id} className="knowledge-notebook"><Button variant="ghost" className="knowledge-nav-item" aria-current={notebookId === notebook.id ? "true" : undefined} aria-expanded={notebookId === notebook.id} onClick={() => navigate({ notebook: notebookId === notebook.id ? null : notebook.id, note: null })}><Icons.Book width={18} height={18} />{notebook.name}<span>{items.filter((item) => inNotebook(item.id, notebook.id)).length}</span></Button>{notebookId === notebook.id && <ul>{filtered.map((item) => <li key={item.id}><Link href={"/conhecimento?notebook=" + encodeURIComponent(notebook.id) + "&note=" + encodeURIComponent(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}>{item.title || "Nota sem título"}</Link></li>)}</ul>}</div>)}
          {items.some((item) => inNotebook(item.id, "unfiled")) && <Button variant="ghost" className="knowledge-nav-item" aria-current={notebookId === "unfiled" ? "true" : undefined} onClick={() => navigate({ notebook: "unfiled", note: null })}><Icons.File width={18} height={18} />Sem caderno</Button>}
        </nav>
        <div className="knowledge-help"><Icons.Link width={20} height={20} /><p>Ideias conectadas são mais fáceis de reencontrar.</p><small>Use [[nome da nota]] em Capturar para criar uma referência.</small></div>
      </aside>
      <div className="knowledge-main">
        <div className="knowledge-main-head"><h2 id="knowledge-results-title">{term ? "Resultados da busca" : "Notas organizadas"} <span className="knowledge-count">{filtered.length}</span></h2>
          <div className="knowledge-actions"><p className="knowledge-heading-note">Mesma coleção de Capturar</p>{canEdit && <Link className="knowledge-primary-link" href="/capturar"><Icons.Capture width={17} height={17} />Capturar uma nota</Link>}</div></div>
        {params.has("note") && !selected && <Card className="knowledge-message"><h2>Nota não encontrada</h2><p>Esta nota não está entre as notas organizadas disponíveis.</p><Button onClick={() => navigate({ note: null })}>Voltar às notas</Button></Card>}
        <section className="knowledge-results" role="region" aria-label="Notas encontradas">{filtered.length ? <ul className="knowledge-grid">{filtered.map((item) => <li className="knowledge-card" key={item.id} data-current={selected?.id === item.id || undefined}>
          <div className="knowledge-card-top"><Icons.File width={22} height={22} /><span>{notebookOf(item.id)}</span></div>
          <Link className="knowledge-card-link" href={"/conhecimento?note=" + encodeURIComponent(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}>{item.title || "Nota sem título"}</Link>
          {excerpt(item.content) && <p>{excerpt(item.content)}</p>}
          <footer><span>Atualizada em {updatedLabel(item.updated_at)}</span><Icons.ArrowUpRight width={17} height={17} /></footer>
        </li>)}</ul> : <div className="knowledge-message"><p>{items.length ? "Nenhuma nota corresponde a este recorte." : "Nenhuma nota organizada ainda."}</p>{items.length ? <Button onClick={() => navigate({ notebook: null, q: "", note: null })}>Mostrar todas as notas</Button> : canEdit ? <Link href="/capturar">Capturar a primeira nota</Link> : <p>Quando uma nota for organizada, ela aparecerá aqui.</p>}</div>}</section>
        {selected && <Card className="knowledge-reader"><div className="knowledge-editor-heading"><p className="knowledge-breadcrumb"><Icons.Book width={17} height={17} /><span>{selectedNotebook?.name ?? "Sem caderno"} · {updatedLabel(selected.updated_at)}</span></p><span className="knowledge-meta">{words} palavras · leitura</span></div>
          <h2>{selected.title || "Nota sem título"}</h2>
          <div className="knowledge-copy">{body(selected.content ?? "Esta nota ainda não tem conteúdo.")}</div>
          {canEdit && <Link className="knowledge-link" href={"/capturar?capture=" + encodeURIComponent(selected.id)}><Icons.Capture width={17} height={17} />Editar em Capturar</Link>}
          <div className="knowledge-relations"><section className="knowledge-backlinks"><h3><Icons.Link width={17} height={17} />Referências a esta nota</h3>{backlinks.length ? <ul>{backlinks.map((item) => <li key={item.id}><Link href={"/conhecimento?note=" + encodeURIComponent(item.id)}><Icons.File width={17} height={17} />{item.title || "Nota sem título"}<Icons.ArrowUpRight width={15} height={15} /></Link></li>)}</ul> : <p>Nenhuma referência entre as notas organizadas.</p>}</section></div>
        </Card>}
      </div>
    </div>
  </div>;
}
