"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_LOGOUT_EVENT, useDemoApplication, useDemoPrivacy } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { filterRoutes, getVisibleRoutes } from "@/lib/navigation/routes";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { normalizeSearch, rankSearch, searchRank, validSearchResults, SEARCH_PATHS, SEARCH_TYPES, type SearchResult, type SearchType } from "@/core/busca";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import "./command-palette.css";
const labels: Record<SearchType, string> = { task: "Tarefas", capture: "Capturas", page: "Páginas", transaction: "Lançamentos", file: "Arquivos", project: "Projetos", habit: "Hábitos" };
const features: Record<SearchType, FeatureKey> = { task: "tarefas", capture: "capturar", page: "conhecimento", transaction: "financeiro", file: "drive", project: "projetos", habit: "habitos" };
export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const app = useDemoApplication(), { valuesHidden } = useDemoPrivacy(), { policy } = useDemoAccess(), router = useRouter();
  const { mode, userId, load, getSnapshot } = app;
  const [term, setTerm] = useState(""), [items, setItems] = useState<SearchResult[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(false), [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null), region = useRef<HTMLDivElement>(null);
  const [closed, setClosed] = useState(false), lifetime = useRef({ generation: 0, closing: false, controller: null as AbortController | null }), close = useRef(onClose); close.current = onClose;
  useEffect(() => { const session = lifetime.current; session.generation++; session.closing = false; const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (!detail || typeof detail !== "object" || !("userId" in detail) || detail.userId !== userId) return; session.closing = true; session.generation++; session.controller?.abort(); setTerm(""); setItems([]); setError(""); setLoading(false); setActive(0); setClosed(true); close.current(); }; window.addEventListener(DEMO_LOGOUT_EVENT, logout); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, logout); session.closing = true; session.generation++; session.controller?.abort(); }; }, [userId]);
  const routes = filterRoutes(getVisibleRoutes(policy), term), query = normalizeSearch(term);
  const actions = useMemo(() => [{ id: "new-capture", title: "Nova captura", href: "/capturar?capture=new", feature: "capturar" as const }, { id: "new-task", title: "Nova tarefa", href: "/tarefas?new=1", feature: "tarefas" as const }].filter(item => resolveAccess(item.feature, policy).allowed && (!query || normalizeSearch(item.title).includes(query))), [policy, query]);
  useEffect(() => { if (open) { setTerm(""); setItems([]); setError(""); setActive(0); } }, [open]);
  useEffect(() => {
    const session = lifetime.current;
    if (closed || app.closing || session.closing || !open || !term.trim()) { setItems([]); setLoading(false); return; }
    const controller = new AbortController(), generation = session.generation; session.controller = controller; setLoading(true); setError("");
    const alive = () => !session.closing && !app.closing && generation === session.generation && !controller.signal.aborted;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!alive()) return;
          let found: SearchResult[];
          if (mode === "connected") {
            const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { headers: { "X-Expected-User-ID": userId }, credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal }); const value: unknown = await response.json();
            if (!response.ok || !value || typeof value !== "object" || !("items" in value) || !validSearchResults(value.items)) throw new Error("Não foi possível buscar suas informações. Tente novamente.");
            found = value.items;
            if (found.some(row => !SEARCH_TYPES.includes(row.type) || !resolveAccess(features[row.type], policy).allowed || row.href !== SEARCH_PATHS[row.type] + encodeURIComponent(row.id))) throw new Error("Os resultados mudaram. Recarregue a página.");
          } else {
            const data: SearchResult[] = [];
            const add = (type: SearchType, id: string, title: string, text = "") => { if (normalizeSearch(`${title} ${text}`).includes(query)) data.push({ id, type, title, href: SEARCH_PATHS[type] + encodeURIComponent(id), rank: searchRank(title, text, term) }); };
            const keys = [["tasks", "task"], ["captures", "capture"], ["knowledge", "page"], ["finance", "transaction"], ["drive", "file"], ["projects", "project"], ["habits", "habit"]] as const;
            await Promise.all(keys.filter(([, type]) => resolveAccess(features[type], policy).allowed).map(async ([key, type]) => {
              if (!alive()) return; await load(key); if (!alive()) return; const snapshot = getSnapshot(key).data; if (!snapshot) return;
              if (key === "finance" && "transactions" in snapshot) snapshot.transactions.filter(row => !row.deleted_at).forEach(row => add(type, row.id, row.description, `${row.payee ?? ""} ${row.notes ?? ""}`));
              else if (key === "drive" && "files" in snapshot) snapshot.files.filter(row => !row.deleted_at).forEach(row => add(type, row.id, row.name));
              else if ("items" in snapshot) for (const row of snapshot.items) {
                if ("deleted_at" in row && row.deleted_at || "archived_at" in row && row.archived_at) continue;
                add(type, row.id, "title" in row ? row.title ?? "Sem título" : "name" in row ? row.name : "Registro", "content" in row ? row.content ?? "" : "description" in row ? row.description ?? "" : "");
              }
            })); found = rankSearch(data).slice(0, 70);
          }
          if (alive()) setItems(found);
        } catch (failure) { if (alive()) { setError(failure instanceof Error ? failure.message : "Não foi possível buscar."); setItems([]); } } finally { if (alive()) setLoading(false); }
      })();
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); if (session.controller === controller) session.controller = null; };
  }, [open, term, mode, userId, load, getSnapshot, policy, query, closed, app.closing]);
  const hrefs = [...actions.map(row => row.href), ...routes.map(row => row.href), ...SEARCH_TYPES.flatMap(type => items.filter(row => row.type === type).map(row => row.href))];
  useEffect(() => { setActive(0); }, [term, items]);
  function navigate(href: string) { if (closed || app.closing || lifetime.current.closing) return; onClose(); router.push(href); }
  if (closed || app.closing) return null;
  return <Dialog open={open} onClose={onClose} title="Buscar" description="Encontre suas informações e atalhos. Ctrl/Cmd + K abre esta busca." initialFocusRef={input}>
    <Field label="Buscar informações e módulos" role="combobox" aria-expanded={open} aria-autocomplete="list" type="search" ref={input} value={term} maxLength={120} onChange={event => setTerm(event.target.value)} placeholder="Tarefas, notas, projetos…" onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const next = Math.max(0, Math.min(hrefs.length - 1, active + (event.key === "ArrowDown" ? 1 : -1))); setActive(next); region.current?.querySelectorAll<HTMLElement>("a")[next]?.scrollIntoView({ block: "nearest" }); }
      if (event.key === "Enter" && hrefs[active]) { event.preventDefault(); navigate(hrefs[active]); }
    }} aria-controls="command-palette-results" aria-activedescendant={hrefs.length ? `command-result-${active}` : undefined} />
    <p className="shell-search-count" role="status">{loading ? "Buscando…" : `${items.length} ${items.length === 1 ? "registro" : "registros"} e ${actions.length + routes.length} ${actions.length + routes.length === 1 ? "atalho disponível" : "atalhos disponíveis"}`}</p>{error && <p role="alert">{error}</p>}
    <div id="command-palette-results" role="listbox" aria-label="Resultados e atalhos" className="command-palette-results" ref={region}>
      {(() => { let position = 0; const link = (href: string, title: string, id: string) => { const index = position++; return <Link key={id} role="option" aria-selected={index === active} id={`command-result-${index}`} href={href} data-active={index === active || undefined} onFocus={() => setActive(index)} onClick={event => { if (lifetime.current.closing || app.closing) event.preventDefault(); else onClose(); }}>{title}</Link>; };
        return <>{!!actions.length && <section><h3>Ações</h3>{actions.map(row => link(row.href, row.title, row.id))}</section>}{!!routes.length && <section><h3>Módulos</h3>{routes.map(row => link(row.href, row.label, row.feature))}</section>}{SEARCH_TYPES.map(type => { const group = items.filter(row => row.type === type); return group.length ? <section key={type}><h3>{labels[type]}</h3>{group.map(row => link(row.href, type === "transaction" && valuesHidden ? "Lançamento financeiro · valores ocultos" : row.title, `${type}:${row.id}`))}</section> : null; })}</>;
      })()}
      {!loading && term.trim() && !hrefs.length && <p>Nenhum resultado. Tente um trecho do título, outro termo ou o nome de um módulo.</p>}
    </div><Button variant="ghost" onClick={onClose}>Fechar busca</Button>
  </Dialog>;
}
