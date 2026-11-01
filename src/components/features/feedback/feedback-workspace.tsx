"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";

type Item = { id: string; category: string; text: string; status: "received"; createdAt: string };
type Cursor = { before: string; id: string };
type Pending = { readonly id: string; readonly category: string; readonly text: string; uncertain: boolean };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function feedbackItem(value: unknown): value is Item {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "category,createdAt,id,status,text"
    && uuid(item.id) && typeof item.category === "string" && ["suggestion", "complaint", "problem", "improvement", "other"].includes(item.category)
    && typeof item.text === "string" && item.text.length <= 10000 && item.status === "received" && timestamp(item.createdAt);
}
function feedbackPage(value: unknown): { items: Item[]; next: Cursor | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).sort().join(",") !== "ok,result" || envelope.ok !== true || !envelope.result || typeof envelope.result !== "object" || Array.isArray(envelope.result)) return null;
  const page = envelope.result as Record<string, unknown>;
  if (Object.keys(page).sort().join(",") !== "items,next" || !Array.isArray(page.items) || page.items.length > 50 || !page.items.every(feedbackItem)) return null;
  if (page.next === null) return { items: page.items, next: null };
  if (!page.next || typeof page.next !== "object" || Array.isArray(page.next)) return null;
  const next = page.next as Record<string, unknown>, last = page.items.at(-1);
  if (Object.keys(next).sort().join(",") !== "before,id" || !uuid(next.id) || !timestamp(next.before) || !last || next.id !== last.id || next.before !== last.createdAt) return null;
  return { items: page.items, next: { id: next.id, before: next.before } };
}
function confirmsAttempt(value: unknown, attempt: Pending): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  if (envelope.ok !== true || !envelope.result || typeof envelope.result !== "object" || Array.isArray(envelope.result)) return false;
  const item = envelope.result as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "category,createdAt,id,status,text"
    && uuid(item.id)
    && item.category === attempt.category && item.text === attempt.text.normalize("NFC").trim() && item.status === "received"
    && timestamp(item.createdAt);
}
const categories = [
  ["suggestion", "Sugestão"], ["complaint", "Reclamação"], ["problem", "Problema"],
  ["improvement", "Melhoria"], ["other", "Outro"],
] as const;

export function FeedbackWorkspace({ userId, supportEmail }: { userId: string; supportEmail: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState("suggestion"), [text, setText] = useState("");
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [uncertain, setUncertain] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [identityClosed, setIdentityClosed] = useState(false);
  const [next, setNext] = useState<Cursor | null>(null);
  const requestGeneration = useRef(0);
  const intent = useRef<Pending | null>(null);
  const closed = useRef(false), submitting = useRef(false), mounted = useRef(true);
  const closeIdentity = useCallback(() => {
    closed.current = true; requestGeneration.current++;
    setIdentityClosed(true); setItems([]); setNext(null); setLoading(false); setLoadError(false); setNotice(""); setError("");
  }, []);
  const load = useCallback(async (cursor?: Cursor, verifying = false) => {
    if (closed.current && !verifying) return;
    const generation = ++requestGeneration.current;
    setLoading(true); setLoadError(false);
    try {
      const query = cursor ? `?${new URLSearchParams(cursor)}` : "";
      const response = await fetch(`/api/feedback${query}`, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "x-expected-user-id": userId } });
      if ([401, 403, 409].includes(response.status)) {
        if (generation === requestGeneration.current) closeIdentity();
        return;
      }
      const result: unknown = await response.json();
      const page = response.ok ? feedbackPage(result) : null;
      if (!page) throw new Error("load");
      if (generation !== requestGeneration.current) return;
      if (verifying) { closed.current = false; setIdentityClosed(false); }
      setItems((current) => cursor ? [...current, ...page.items] : page.items); setNext(page.next);
    } catch { if (generation === requestGeneration.current) setLoadError(true); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [closeIdentity, userId]);
  useEffect(() => { mounted.current = true; const generation = requestGeneration; void load(); return () => { mounted.current = false; generation.current++; }; }, [load]);
  useEffect(() => {
    const verifyOnReturn = () => {
      if (document.visibilityState !== "visible" || !mounted.current) return;
      closeIdentity(); void load(undefined, true);
    };
    window.addEventListener("focus", verifyOnReturn);
    document.addEventListener("visibilitychange", verifyOnReturn);
    return () => { window.removeEventListener("focus", verifyOnReturn); document.removeEventListener("visibilitychange", verifyOnReturn); };
  }, [closeIdentity, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current || closed.current) return;
    submitting.current = true;
    setSending(true); setError(""); setNotice("");
    try { intent.current ??= { id: crypto.randomUUID(), category, text, uncertain: false }; }
    catch { submitting.current = false; setSending(false); setError("Não foi possível preparar o envio. Tente novamente."); return; }
    const attempt = intent.current;
    try {
      const response = await fetch("/api/feedback", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: JSON.stringify({ category: attempt.category, text: attempt.text, clientId: attempt.id }) });
      if (!mounted.current) return;
      if (closed.current) { attempt.uncertain = true; setUncertain(true); return; }
      if ([401, 403].includes(response.status)) {
        if (!attempt.uncertain) intent.current = null;
        closeIdentity(); return;
      }
      let result: unknown;
      try { result = await response.json(); }
      catch (error) {
        if (response.status === 409 && mounted.current) { if (!attempt.uncertain) intent.current = null; closeIdentity(); return; }
        throw error;
      }
      if (!mounted.current) return;
      if (closed.current) { attempt.uncertain = true; setUncertain(true); return; }
      if (!response.ok) {
        const code = result && typeof result === "object" && "code" in result ? result.code : null;
        if (response.status === 409 && code !== "CONFLICT") {
          if (!attempt.uncertain) intent.current = null;
          closeIdentity(); return;
        }
        if (code === "COMMIT_UNKNOWN" || response.status >= 500) { setUncertain(true); throw new Error("uncertain"); }
        if (!attempt.uncertain) intent.current = null;
        if (attempt.uncertain && code === "CONFLICT") throw new Error("conflict");
        throw new Error(attempt.uncertain ? "uncertain" : "rejected");
      }
      // The response has no clientId: matching content is necessary but does
      // not independently prove which idempotency key the server committed.
      if (!confirmsAttempt(result, attempt)) throw new Error("uncertain");
      intent.current = null; setUncertain(false); setText(""); setNotice("Mensagem recebida."); await load();
    } catch (cause) {
      if (!mounted.current) return;
      const unknown = cause instanceof Error && cause.message === "rejected" ? false : true;
      if (unknown) attempt.uncertain = true;
      setUncertain(unknown); setError(cause instanceof Error && cause.message === "conflict" ? "Não foi possível conciliar este envio. Confira o histórico ou fale com o suporte antes de descartar o rascunho." : unknown ? "Não foi possível confirmar o envio. Tente novamente para verificar a mesma mensagem." : "Não foi possível enviar. Confira a mensagem e tente novamente.");
    } finally { submitting.current = false; if (mounted.current) setSending(false); }
  }

  if (identityClosed) return <div className="feedback-panel" role="alert">
    <h1>Confirme sua conta</h1>
    <p>Não foi possível confirmar sua sessão ou conta. Entre na mesma conta em outra aba e volte para verificar a sessão aqui.</p>
    <a href="/entrar" target="_blank" rel="noopener noreferrer">Entrar em outra aba</a>
    <button type="button" disabled={loading} onClick={() => void load(undefined, true)}>{loading ? "Verificando…" : "Verificar sessão"}</button>
    {loadError && <p>Não foi possível verificar agora. Tente novamente.</p>}
  </div>;
  return <>
    <div className="shell-page-heading"><h1>Feedback</h1><p>Conte o que podemos melhorar.</p></div>
    <div className="feedback-layout">
      <form className="feedback-panel" onSubmit={submit}>
        <h2>Enviar mensagem</h2>
        <Field as="select" label="Categoria" id="feedback-category" value={category} disabled={sending || uncertain} onChange={(event) => { setCategory(event.target.value); intent.current = null; }}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <Field as="textarea" label="Mensagem" hint="Entre 10 e 5.000 caracteres. Sua mensagem é privada." id="feedback-text" value={text} disabled={sending || uncertain} onChange={(event) => { setText(event.target.value); intent.current = null; }} minLength={10} maxLength={5000} rows={7} required />
        {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button type="submit" disabled={sending}>{sending ? "Enviando…" : uncertain ? "Verificar envio" : "Enviar mensagem"}</button>
        {uncertain && <button type="button" disabled={sending} onClick={() => { setUncertain(false); intent.current = null; setText(""); setError(""); void load(); }}>Descartar rascunho e atualizar histórico</button>}
      </form>
      <section className="feedback-panel" aria-labelledby="feedback-history"><h2 id="feedback-history">Suas mensagens</h2>
        <p className="feedback-hint">Precisa de ajuda? <a href={`mailto:${supportEmail}`}>Falar com o suporte</a></p>
        {items.length > 0 && <ul className="feedback-list">{items.map((item) => <li key={item.id}><strong>{categories.find(([key]) => key === item.category)?.[1] ?? "Mensagem"}</strong><span>Recebida</span><p>{item.text}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></li>)}</ul>}
        {loading ? <p>Carregando mensagens…</p> : loadError ? <><p role="alert">Não foi possível carregar suas mensagens.</p><button type="button" onClick={() => void load()}>Tentar novamente</button></> : items.length === 0 ? <p>Nenhuma mensagem enviada ainda.</p> : next && <button type="button" onClick={() => void load(next)}>Carregar mais</button>}
      </section>
    </div>
  </>;
}
