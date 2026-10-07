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
import "./knowledge.css";

export function KnowledgeSkeleton() {
  return <div className="knowledge-layout knowledge-skeleton" role="status" aria-label="Carregando conhecimento"><div className="knowledge-skeleton-tree" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((index) => <i key={index} />)}</div><div className="knowledge-skeleton-reader" aria-hidden="true"><i /><i /><i /><i /></div></div>;
}
export function KnowledgeWorkspace() {
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
  return <div className="knowledge-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="knowledge-heading"><p>{items.length} {items.length === 1 ? "nota organizada" : "notas organizadas"} · mesma coleção de Capturar</p>{canEdit && <Link className="knowledge-link" href="/capturar">Capturar uma nota</Link>}</div>
    <div className="knowledge-layout">
      <Card className="knowledge-tree"><h2>Cadernos</h2><Field type="search" label="Buscar nas notas" value={term} onChange={(event) => navigate({ q: event.target.value, note: null })} /><nav aria-label="Cadernos de conhecimento"><Button variant={notebookId === null ? "primary" : "ghost"} onClick={() => navigate({ notebook: null, note: null })}>Todas as notas <span>{items.length}</span></Button>
        {notebooks.map((notebook) => <div key={notebook.id} className="knowledge-notebook"><Button variant={notebookId === notebook.id ? "primary" : "ghost"} aria-expanded={notebookId === notebook.id} onClick={() => navigate({ notebook: notebookId === notebook.id ? null : notebook.id, note: null })}>{notebook.name}<span>{items.filter((item) => inNotebook(item.id, notebook.id)).length}</span></Button>{notebookId === notebook.id && <ul>{filtered.map((item) => <li key={item.id}><Link href={"/conhecimento?notebook=" + encodeURIComponent(notebook.id) + "&note=" + encodeURIComponent(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}>{item.title || "Nota sem título"}</Link></li>)}</ul>}</div>)}
        {items.some((item) => inNotebook(item.id, "unfiled")) && <Button variant={notebookId === "unfiled" ? "primary" : "ghost"} onClick={() => navigate({ notebook: "unfiled", note: null })}>Sem caderno</Button>}
      </nav></Card>
      <div className="knowledge-main">
        {params.has("note") && !selected && <Card className="knowledge-message"><h2>Nota não encontrada</h2><p>Esta nota não está entre as notas organizadas disponíveis.</p><Button onClick={() => navigate({ note: null })}>Voltar às notas</Button></Card>}
        <Card className="knowledge-results" role="region" aria-label="Notas encontradas"><h2>{term ? "Resultados da busca" : "Notas organizadas"}</h2>{filtered.length ? <ul>{filtered.map((item) => <li key={item.id}><Link href={"/conhecimento?note=" + encodeURIComponent(item.id)} aria-current={selected?.id === item.id ? "page" : undefined}>{item.title || "Nota sem título"}</Link></li>)}</ul> : <div className="knowledge-message"><p>{items.length ? "Nenhuma nota corresponde a este recorte." : "Nenhuma nota organizada ainda."}</p>{items.length ? <Button onClick={() => navigate({ notebook: null, q: "", note: null })}>Mostrar todas as notas</Button> : canEdit ? <Link href="/capturar">Capturar a primeira nota</Link> : <p>Quando uma nota for organizada, ela aparecerá aqui.</p>}</div>}</Card>
        {selected && <Card className="knowledge-reader"><p className="knowledge-breadcrumb">{selectedNotebook?.name ?? "Sem caderno"}</p><h2>{selected.title || "Nota sem título"}</h2><p className="knowledge-meta">{(selected.content ?? "").trim().split(/\s+/).filter(Boolean).length} palavras · leitura</p><div className="knowledge-copy">{body(selected.content ?? "Esta nota ainda não tem conteúdo.")}</div>{canEdit && <Link className="knowledge-link" href={"/capturar?capture=" + encodeURIComponent(selected.id)}>Editar em Capturar</Link>}<section className="knowledge-backlinks"><h3>Referências a esta nota</h3>{backlinks.length ? <ul>{backlinks.map((item) => <li key={item.id}><Link href={"/conhecimento?note=" + encodeURIComponent(item.id)}>{item.title || "Nota sem título"}</Link></li>)}</ul> : <p>Nenhuma referência entre as notas organizadas.</p>}</section></Card>}
      </div>
    </div>
  </div>;
}
