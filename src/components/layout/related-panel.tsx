"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_LOGOUT_EVENT, useDemoApplication, useDemoPrivacy } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { TIPOS_VINCULO, type AlvoRelacionado, type RelacionadosDTO, type TipoVinculo } from "@/core/conhecimento";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import "./related-panel.css";
const paths: Record<TipoVinculo, string> = { page: "/conhecimento?note=", notebook: "/conhecimento?notebook=", task: "/tarefas?task=", capture: "/capturar?capture=", event: "/calendario?event=", file: "/drive?file=", project: "/projetos?project=", transaction: "/financeiro?transaction=", habit: "/habitos?habit=" };
const valid = (row: unknown): row is AlvoRelacionado => !!row && typeof row === "object" && "type" in row && TIPOS_VINCULO.includes(row.type as TipoVinculo) && "id" in row && typeof row.id === "string" && "title" in row && typeof row.title === "string" && "href" in row && row.href === paths[row.type as TipoVinculo] + encodeURIComponent(row.id);
export function RelatedPanel({ type, id }: { type: TipoVinculo; id: string }) {
  const app = useDemoApplication(), { policy, connected } = useDemoAccess(), { valuesHidden } = useDemoPrivacy();
  return !app.closing && connected && resolveAccess("conhecimento", policy).allowed ? <ConnectedRelatedPanel key={app.userId + type + id} app={app} type={type} id={id} hidden={valuesHidden} /> : null;
}
function ConnectedRelatedPanel({ app, type, id, hidden }: { app: ReturnType<typeof useDemoApplication>; type: TipoVinculo; id: string; hidden: boolean }) {
  const [data, setData] = useState<RelacionadosDTO | null>(null), [targets, setTargets] = useState<AlvoRelacionado[]>([]);
  const [error, setError] = useState(""), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [target, setTarget] = useState("");
  const [closed, setClosed] = useState(false), lifetime = useRef({ generation: 0, closing: false, controllers: new Set<AbortController>() });
  const trigger = useRef<HTMLButtonElement>(null), intent = useRef<{ key: string; clientId: string } | null>(null);
  const readSequence = useRef(0);
  const end = useCallback(() => { const session = lifetime.current; session.closing = true; session.generation++; for (const controller of session.controllers) controller.abort(); session.controllers.clear(); intent.current = null; setData(null); setTargets([]); setTarget(""); setOpen(false); setBusy(false); setError(""); setClosed(true); }, []);
  useEffect(() => { lifetime.current.closing = false; lifetime.current.generation++; setClosed(false); const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (detail && typeof detail === "object" && "userId" in detail && detail.userId === app.userId) end(); }; window.addEventListener(DEMO_LOGOUT_EVENT, logout); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, logout); end(); }; }, [app.userId, end]);
  const alive = useCallback((generation: number, signal?: AbortSignal) => !lifetime.current.closing && !app.closing && generation === lifetime.current.generation && !signal?.aborted, [app.closing]);
  const label = (row: AlvoRelacionado) => row.type === "transaction" && hidden ? "Lançamento financeiro · valores ocultos" : row.title;
  const read = useCallback(async (signal?: AbortSignal) => {
    if (lifetime.current.closing || app.closing) return;
    const generation = lifetime.current.generation, sequence = ++readSequence.current, controller = new AbortController(), abort = () => controller.abort(); lifetime.current.controllers.add(controller); signal?.addEventListener("abort", abort, { once: true });
    try {
    const reply = await fetch(`/api/knowledge?related_type=${type}&related_id=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": app.userId }, signal: controller.signal });
    const value: unknown = await reply.json();
    if (!alive(generation, controller.signal) || sequence !== readSequence.current) return;
    if (!reply.ok || !value || typeof value !== "object" || !("source" in value) || !valid(value.source) || value.source.id !== id || value.source.type !== type || !("items" in value) || !Array.isArray(value.items) || !value.items.every(item => valid(item) && "link_id" in item && typeof item.link_id === "string")) throw new Error("Não foi possível carregar os vínculos.");
    setData(value as RelacionadosDTO); setError("");
    } catch (failure) { if (alive(generation, controller.signal) && sequence === readSequence.current) throw failure; }
    finally { signal?.removeEventListener("abort", abort); lifetime.current.controllers.delete(controller); }
  }, [alive, app.userId, app.closing, type, id]);
  useEffect(() => { const controller = new AbortController(); void read(controller.signal).catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar os vínculos."); }); return () => controller.abort(); }, [read]);
  useEffect(() => app.subscribeInvalidations?.(keys => {
    if (lifetime.current.closing || app.closing || !keys.some(key => key !== "settings" && key !== "vault")) return;
    void read().catch(() => { if (!lifetime.current.closing) { setData(null); setError("Os vínculos mudaram. Carregue novamente para continuar."); } });
  }), [app, read]);
  async function choose() {
    if (lifetime.current.closing || app.closing) return;
    const generation = lifetime.current.generation, controller = new AbortController(); lifetime.current.controllers.add(controller);
    setOpen(true); setError("");
    try {
      const reply = await fetch("/api/knowledge", { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": app.userId }, signal: controller.signal });
      const value: unknown = await reply.json();
      if (!alive(generation, controller.signal)) return;
      if (!reply.ok || !value || typeof value !== "object" || !("targets" in value) || !Array.isArray(value.targets) || !value.targets.every(valid)) throw new Error("Não foi possível carregar os destinos.");
      const available: AlvoRelacionado[] = [...value.targets];
      const collections = value as Record<string, unknown>;
      for (const [key, kind] of [["pages", "page"], ["notebooks", "notebook"]] as const) {
        const entries = collections[key];
        if (Array.isArray(entries)) for (const row of entries) {
          if (!row || typeof row !== "object" || row.user_id !== app.userId || typeof row.id !== "string" || row.deleted_at || row.archived_at) continue;
          const title = kind === "page" ? row.title : row.name;
          if (typeof title === "string") available.push({ type: kind, id: row.id, title, href: paths[kind] + encodeURIComponent(row.id) });
        }
      }
      const filtered = available.filter(row => !(row.type === type && row.id === id));
      setTargets(filtered); setTarget(filtered[0] ? JSON.stringify([filtered[0].type, filtered[0].id]) : "");
    } catch { if (alive(generation, controller.signal)) setError("Não foi possível carregar os destinos. Tente abrir novamente."); }
    finally { lifetime.current.controllers.delete(controller); }
  }
  async function write(command: string, input: Record<string, unknown>) {
    if (busy || lifetime.current.closing || app.closing) return; const generation = lifetime.current.generation; setBusy(true); setError("");
    const key = JSON.stringify([command, input]); if (intent.current?.key !== key) intent.current = { key, clientId: crypto.randomUUID() };
    try { await app.executeDomainCommand(command, { ...input, client_id: intent.current.clientId }); if (!alive(generation)) return; intent.current = null; await read(); if (alive(generation)) setOpen(false); }
    catch (failure) { if (alive(generation)) setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Confirme o envio pendente."); } finally { if (alive(generation)) setBusy(false); }
  }
  if (closed || app.closing) return null;
  return <section className="related-panel" aria-label="Itens relacionados"><h3>Relacionados</h3>
    {error && <p role="alert">{error}</p>}{!data ? <Button variant="ghost" onClick={() => void read().catch(() => setError("Não foi possível carregar os vínculos."))}>Carregar vínculos</Button> : data.items.length ? <ul>{data.items.map(row => <li key={row.link_id}><Link href={row.href}>{label(row)}</Link><Button variant="ghost" disabled={busy} aria-label={`Desvincular ${label(row)}`} onClick={() => void write("knowledge.link.delete", { id: row.link_id })}>Desvincular</Button></li>)}</ul> : <p>Nenhum vínculo neste registro.</p>}
    <Button variant="ghost" ref={trigger} disabled={busy} onClick={() => void choose()}>Vincular registro</Button>
    <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} title="Vincular registro" returnFocusRef={trigger}>
      <Field as="select" label="Registro" value={target} disabled={busy} onChange={event => setTarget(event.target.value)}>{targets.map(row => <option key={row.type + row.id} value={JSON.stringify([row.type, row.id])}>{label(row)}</option>)}</Field>
      {error && <p role="alert">{error}</p>}<Button variant="primary" loading={busy} disabled={!target} onClick={() => { const [to_type, to_id] = JSON.parse(target) as [TipoVinculo, string]; void write("knowledge.link.create", { from_type: type, from_id: id, to_type, to_id }); }}>Vincular</Button>
    </Dialog>
  </section>;
}
