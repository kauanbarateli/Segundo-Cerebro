"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";

type Item = { id: string; category: string; text: string; status: "received"; createdAt: string };
type Cursor = { before: string; id: string };
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
  const [next, setNext] = useState<Cursor | null>(null);
  const requestGeneration = useRef(0);
  const intent = useRef<string | null>(null);
  const load = useCallback(async (cursor?: Cursor) => {
    const generation = ++requestGeneration.current;
    setLoading(true); setLoadError(false);
    try {
      const query = cursor ? `?${new URLSearchParams(cursor)}` : "";
      const response = await fetch(`/api/feedback${query}`, { cache: "no-store", headers: { "x-expected-user-id": userId } });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("result" in result) || !result.result || typeof result.result !== "object" || !("items" in result.result) || !Array.isArray(result.result.items) || !("next" in result.result)) throw new Error("load");
      if (generation !== requestGeneration.current) return;
      const page = result.result as { items: Item[]; next: Cursor | null };
      setItems((current) => cursor ? [...current, ...page.items] : page.items); setNext(page.next);
    } catch { if (generation === requestGeneration.current) setLoadError(true); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { const generation = requestGeneration; void load(); return () => { generation.current++; }; }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (sending) return;
    setSending(true); setError(""); setNotice("");
    intent.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: JSON.stringify({ category, text, clientId: intent.current }) });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code = result && typeof result === "object" && "code" in result ? result.code : null;
        if (code === "COMMIT_UNKNOWN" || response.status >= 500) { setUncertain(true); throw new Error("uncertain"); }
        intent.current = null; throw new Error("rejected");
      }
      intent.current = null; setUncertain(false); setText(""); setNotice("Mensagem recebida."); await load();
    } catch (cause) {
      const unknown = cause instanceof Error && cause.message === "rejected" ? false : true;
      setUncertain(unknown); setError(unknown ? "Não foi possível confirmar o envio. Tente novamente para verificar a mesma mensagem." : "Não foi possível enviar. Confira a mensagem e tente novamente.");
    } finally { setSending(false); }
  }

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
