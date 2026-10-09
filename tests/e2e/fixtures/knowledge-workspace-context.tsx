import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { conhecimentoDTO, documentoDeTexto, executarConhecimento, leituraPagina, normalizarTituloPagina, type ComandoConhecimento, type ConhecimentoStore, type EventoConhecimento, type Pagina, type SnapshotConhecimento } from "../../../src/core/conhecimento";

export const DEMO_LOGOUT_EVENT = "segundo-cerebro:demo-logout";
export interface KnowledgeFixtureOptions { empty?: boolean; onlyDeleted?: boolean }
const owner = "10000000-0000-4000-8000-000000000001", book = "10000000-0000-4000-8000-000000000002", source = "10000000-0000-4000-8000-000000000003", now = "2026-10-09T13:00:00Z";
function backend(options: KnowledgeFixtureOptions) {
  let state: SnapshotConhecimento = { revision: "0", notebooks: options.empty && !options.onlyDeleted ? [] : [{ id: book, user_id: owner, name: "Caderno sintético", project_id: null, position: 0, deleted_at: options.onlyDeleted ? now : null, deletion_batch_id: options.onlyDeleted ? source : null, created_at: now, updated_at: now }], pages: options.empty ? [] : [{ id: source, user_id: owner, notebook_id: book, parent_id: null, origin_capture_id: null, title: "Origem", normalized_title: "origem", document: documentoDeTexto("Texto inicial"), content_text: "Texto inicial", version: 1, position: 0, archived_at: null, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now }], refs: [], links: [], targets: [], captures: [], receipts: [] };
  const writes: ComandoConhecimento[] = []; let sequence = 10, tick = 0;
  const store: ConhecimentoStore = { snapshot: async () => structuredClone(state), transaction: async (_context, work) => { const tx = { state: structuredClone(state), events: [] as EventoConhecimento[] }; const result = await work(tx); state = tx.state; return result; } };
  const execute = (request: ComandoConhecimento) => executarConhecimento(store, { clock: { now: () => new Date(Date.parse(now) + tick++ * 1000).toISOString() }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, { user_id: owner, canal: "web" }, request);
  // An in-browser synthetic API. It never falls through to a real network.
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/api/knowledge") throw new Error("Unexpected synthetic fixture request.");
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (new Headers(init?.headers).get("X-Expected-User-ID") !== owner) return Response.json({ code: "SESSION_CHANGED", message: "Conta sintética incorreta." }, { status: 409 });
    if (init?.method === "POST") {
      const request = JSON.parse(String(init.body)) as ComandoConhecimento; writes.push(structuredClone(request));
      try { return Response.json({ ok: true, result: await execute(request) }); }
      catch (failure) { const error = failure as { code?: string; message?: string }; return Response.json({ ok: false, code: error.code ?? "UNAVAILABLE", message: error.message ?? "Falha sintética." }, { status: error.code === "CONFLICT" ? 409 : 400 }); }
    }
    return Response.json(url.searchParams.has("page") ? leituraPagina(state, url.searchParams.get("page")!) : conhecimentoDTO(state));
  };
  const app = { userId: owner, async executeDomainCommand(command: string, input: unknown) {
    const reply = await fetch("/api/knowledge", { method: "POST", headers: { "X-Expected-User-ID": owner, "Content-Type": "application/json" }, body: JSON.stringify({ command, input }) });
    const value = await reply.json() as { result?: unknown; code?: string; message?: string };
    if (!reply.ok) throw { code: value.code, message: value.message, outcomeUnknown: false };
    return value.result;
  } };
  Object.assign(globalThis, { __knowledgeFixture: {
    state: () => structuredClone({ pages: state.pages, refs: state.refs, writes }),
    remoteUpdate: async (id: string, title: string, text: string) => {
      const page = state.pages.find(row => row.id === id); if (!page) throw new Error("Synthetic page missing.");
      return execute({ command: "knowledge.page.update", input: { id, title, document: documentoDeTexto(text), expected_version: page.version, client_id: crypto.randomUUID() } });
    },
    normalizedTitle: normalizarTituloPagina,
  } });
  return app;
}
type Value = { app: ReturnType<typeof backend>; path: string; navigate(href: string, replace?: boolean): void };
const Context = createContext<Value | null>(null);
function useFixtureContext() { const value = useContext(Context); if (!value) throw new Error("Synthetic context missing."); return value; }
export function KnowledgeFixtureProvider({ children, options }: { children: ReactNode; options: KnowledgeFixtureOptions }) {
  const app = useMemo(() => backend(options), [options]);
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  const navigate = useCallback((href: string, replace = false) => { if (replace) window.history.replaceState(null, "", href); else window.history.pushState(null, "", href); setPath(window.location.pathname + window.location.search); }, []);
  useEffect(() => { const back = () => setPath(window.location.pathname + window.location.search); window.addEventListener("popstate", back); return () => window.removeEventListener("popstate", back); }, []);
  return <Context.Provider value={{ app, path, navigate }}>{children}</Context.Provider>;
}
export function useDemoApplication() { return useFixtureContext().app; }
export function useDemoPrivacy() { return { valuesHidden: false }; }
export function useSearchParams() { return new URLSearchParams(useFixtureContext().path.split("?")[1] ?? ""); }
export function useRouter() { const { navigate } = useFixtureContext(); return { replace: (href: string) => navigate(href, true), push: (href: string) => navigate(href) }; }
export function useFixturePath() { return useFixtureContext().path; }
export function NavigationLink({ href = "#", onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useFixtureContext();
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(href); } }}>{children}</a>;
}
export type KnowledgeFixtureState = { pages: Pagina[]; refs: SnapshotConhecimento["refs"]; writes: ComandoConhecimento[] };
