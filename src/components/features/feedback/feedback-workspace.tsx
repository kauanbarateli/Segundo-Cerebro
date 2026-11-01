"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { inspectMarker, prepareMarker, reconcile, recoveryDisposition, submissionDisposition } from '@/core/feedback/reconciliation';
import { parseBarrierResult, type BarrierResult } from '@/core/feedback/barrier-contract';

type Item = { id: string; category: string; text: string; status: "received"; createdAt: string };
type Cursor = { before: string; id: string };
type Pending = { readonly id: string; readonly category: string; readonly text: string; uncertain: boolean; conflicted: boolean };
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
const categories = [
  ["suggestion", "Sugestão"], ["complaint", "Reclamação"], ["problem", "Problema"],
  ["improvement", "Melhoria"], ["other", "Outro"],
] as const;

export function FeedbackWorkspace({ userId, supportEmail, ownerBinding }: { userId: string; supportEmail: string; ownerBinding: string | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState("suggestion"), [text, setText] = useState("");
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [uncertain, setUncertain] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [identityClosed, setIdentityClosed] = useState(false);
  const [next, setNext] = useState<Cursor | null>(null);
  const [markerState,setMarkerState]=useState<'checking'|'none'|'pending'|'terminal'|'ready'|'blocked'|'different-owner'>('checking');
  const requestGeneration = useRef(0);
  const retryCursor = useRef<Cursor | undefined>(undefined);
  const operationGeneration = useRef(0);
  const intent = useRef<Pending | null>(null);
  const terminalReceipt = useRef<BarrierResult | null>(null);
  const closed = useRef(false), submitting = useRef(false), mounted = useRef(true);
  const closeIdentity = useCallback(() => {
    closed.current = true; terminalReceipt.current=null; retryCursor.current=undefined; requestGeneration.current++;operationGeneration.current++;
    submitting.current=false;if(intent.current){intent.current.uncertain=true;setUncertain(true);}
    setSending(false);setIdentityClosed(true); setItems([]); setNext(null); setLoading(false); setLoadError(false); setNotice(""); setError("");
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
      retryCursor.current=undefined;
      if (verifying) { closed.current = false; setIdentityClosed(false); }
      if(ownerBinding) { try { const marker=inspectMarker(sessionStorage,ownerBinding);setMarkerState(marker.status==='pending'&&marker.clientId===terminalReceipt.current?.clientId?'terminal':marker.status); } catch { setMarkerState('blocked'); } }
      setItems((current) => cursor ? [...current, ...page.items] : page.items); setNext(page.next);
    } catch { if (generation === requestGeneration.current) { retryCursor.current=cursor; setLoadError(true); } }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [closeIdentity, ownerBinding, userId]);
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
    event.preventDefault(); if (submitting.current || closed.current || !ownerBinding) return;
    submitting.current = true;const operation=++operationGeneration.current;
    setSending(true); setError(""); setNotice("");
    try {
      if(!intent.current){
        if(markerState!=='none'&&markerState!=='ready') throw new Error('marker');
        const candidate={id:crypto.randomUUID(),category,text,uncertain:false,conflicted:false};
        const prepared=prepareMarker(sessionStorage,{version:1,clientId:candidate.id,ownerBinding},markerState==='ready'?terminalReceipt.current:undefined);
        if(prepared.status!=='ready')throw new Error('marker');
        terminalReceipt.current=null;intent.current=candidate;setMarkerState('pending');
      }else{
        const existing=inspectMarker(sessionStorage,ownerBinding);
        if(existing.status!=='pending'||existing.clientId!==intent.current.id)throw new Error('marker');
      }
    } catch { submitting.current = false; setSending(false); setMarkerState('blocked'); setError("Não foi possível preparar o envio com segurança."); return; }
    const attempt = intent.current;
    const generation=requestGeneration.current;
    try {
      const response = await fetch("/api/feedback", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", "x-expected-user-id": userId }, body: JSON.stringify({ category: attempt.category, text: attempt.text, clientId: attempt.id }) });
      if (!mounted.current) return;
      if (closed.current || generation!==requestGeneration.current || operation!==operationGeneration.current) { attempt.uncertain = true; return; }
      if ([401, 403].includes(response.status)) {
        closeIdentity(); return;
      }
      let result: unknown;
      try { result = await response.json(); }
      catch (error) {
        if (response.status === 409 && mounted.current && !closed.current && generation===requestGeneration.current && operation===operationGeneration.current) { closeIdentity(); return; }
        throw error;
      }
      if (!mounted.current) return;
      if (closed.current || generation!==requestGeneration.current || operation!==operationGeneration.current) { attempt.uncertain = true; return; }
      if (!response.ok) {
        const code = result && typeof result === "object" && "code" in result ? result.code : null;
        if (response.status === 409 && code !== "CONFLICT") {
          closeIdentity(); return;
        }
        if (code === "COMMIT_UNKNOWN" || response.status >= 500) { setUncertain(true); throw new Error("uncertain"); }
        if(code === "CONFLICT")attempt.conflicted=true;
        throw new Error(code === "CONFLICT" ? "conflict" : "uncertain");
      }
      if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).length!==2||!('ok' in result)||result.ok!==true||!('result' in result))throw new Error('uncertain');
      const receipt=parseBarrierResult(result.result,attempt.id);
      if(!receipt||receipt.status==='unknown')throw new Error('uncertain');
      const terminal=reconcile(sessionStorage,ownerBinding,receipt);
      if(terminal.status!=='submitted'&&terminal.status!=='cancelled')throw new Error('uncertain');
      terminalReceipt.current=receipt;setUncertain(false);setMarkerState('terminal');
      if(submissionDisposition(terminal.status,attempt.conflicted)==='confirmed'){intent.current=null;setText('');setNotice('Mensagem recebida.');}
      else {setNotice(terminal.status==='cancelled'?'Tentativa cancelada. Seu texto continua disponível abaixo.':'Não foi possível confirmar o texto atual. Copie-o antes de iniciar outra tentativa.');}
      await load();
    } catch (cause) {
      attempt.uncertain = true;
      if (!mounted.current || closed.current || generation!==requestGeneration.current || operation!==operationGeneration.current) return;
      setUncertain(true); setError(cause instanceof Error && cause.message === "conflict" ? "Não foi possível conciliar este envio. Verifique ou cancele a tentativa anterior." : "Não foi possível confirmar o envio. Verifique a tentativa anterior.");
    } finally { if(operation===operationGeneration.current){submitting.current = false; if (mounted.current && !closed.current) setSending(false);} }
  }

  async function resolvePending(action:'status'|'cancel') {
    if(!ownerBinding||submitting.current||closed.current)return;
    submitting.current=true;const operation=++operationGeneration.current;setSending(true);setError('');setNotice('');
    const generation=requestGeneration.current;
    try {
      const marker=inspectMarker(sessionStorage,ownerBinding);
      if(marker.status!=='pending'){setMarkerState(marker.status==='none'?'blocked':marker.status);return;}
      const response=await fetch('/api/feedback/reconciliation',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20_000),headers:{'Content-Type':'application/json','x-expected-user-id':userId},body:JSON.stringify({action,clientId:marker.clientId})});
      if(!mounted.current||closed.current||generation!==requestGeneration.current||operation!==operationGeneration.current)return;
      if([401,403,409].includes(response.status)){closeIdentity();return;}
      const envelope:unknown=await response.json();
      if(!mounted.current||closed.current||generation!==requestGeneration.current||operation!==operationGeneration.current)return;
      if(!response.ok||!envelope||typeof envelope!=='object'||Array.isArray(envelope)||Object.keys(envelope).length!==2||!('ok' in envelope)||envelope.ok!==true||!('result' in envelope))throw new Error('unknown');
      const result=parseBarrierResult(envelope.result,marker.clientId);
      if(!result||result.status==='unknown')throw new Error('unknown');
      const terminal=reconcile(sessionStorage,ownerBinding,result);
      if(terminal.status!=='submitted'&&terminal.status!=='cancelled'){setMarkerState('blocked');throw new Error('unknown');}
      terminalReceipt.current=result;setUncertain(false);setMarkerState('terminal');
      if(recoveryDisposition(result.status,intent.current!==null,intent.current?.conflicted===true)==='preserve-draft')setNotice('Não foi possível confirmar o texto atual nesta tentativa. Copie-o ou revise antes de criar outra.');
      else setNotice(terminal.status==='submitted'?'Um envio anterior foi registrado. Confira o histórico.':'Tentativa cancelada. Você pode escrever novamente.');
      await load();
    }catch {if(mounted.current&&!closed.current&&generation===requestGeneration.current&&operation===operationGeneration.current)setError('Não foi possível verificar a tentativa. Tente novamente.');}
    finally{if(operation===operationGeneration.current){submitting.current=false;if(mounted.current&&!closed.current)setSending(false);}}
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
      {!ownerBinding ? <section className="feedback-panel"><h2>Enviar mensagem</h2><p>O envio está temporariamente indisponível. Você ainda pode consultar seu histórico.</p></section> : <form className="feedback-panel" onSubmit={submit}>
        <h2>Enviar mensagem</h2>
        {markerState==='different-owner' ? <p>Há uma tentativa pendente nesta aba. Entre na conta usada para verificá-la.</p> : markerState==='blocked' ? <><p>Não foi possível verificar esta aba com segurança. Fale com o suporte.</p>{text && <Field as="textarea" label="Texto para copiar (envio não confirmado)" value={text} readOnly rows={5} />}</> : markerState==='pending' ? <><p>Estamos verificando seu envio anterior.</p>{intent.current && <Field as="textarea" label="Texto atual (não confirmado)" value={text} readOnly rows={5} />}<button type="button" disabled={sending} onClick={()=>void resolvePending('status')}>Verificar novamente</button><button type="button" disabled={sending} onClick={()=>void resolvePending('cancel')}>Cancelar tentativa anterior</button></> : markerState==='terminal' ? <><p>Esta tentativa foi encerrada.</p>{intent.current && <Field as="textarea" label="Texto atual (não confirmado)" value={text} readOnly rows={5} />}<button type="button" disabled={sending} onClick={()=>{intent.current=null;setUncertain(false);setMarkerState('ready');setNotice('Revise a mensagem antes de enviar uma nova tentativa.');}}>Escrever outra mensagem</button></> : markerState==='checking' ? <p>Verificando a sessão…</p> : <>
        <Field as="select" label="Categoria" id="feedback-category" value={category} disabled={sending || uncertain} onChange={(event) => { setCategory(event.target.value); intent.current = null; }}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <Field as="textarea" label="Mensagem" hint="Entre 10 e 5.000 caracteres. Sua mensagem é privada." id="feedback-text" value={text} disabled={sending || uncertain} onChange={(event) => { setText(event.target.value); intent.current = null; }} minLength={10} maxLength={5000} rows={7} required />
        {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button type="submit" disabled={sending}>{sending ? "Enviando…" : uncertain ? "Verificar envio" : "Enviar mensagem"}</button>
        </>}
        {markerState!=='none' && markerState!=='ready' && <>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</>}
      </form>}
      <section className="feedback-panel" aria-labelledby="feedback-history"><h2 id="feedback-history">Suas mensagens</h2>
        <p className="feedback-hint">Precisa de ajuda? <a href={`mailto:${supportEmail}`}>Falar com o suporte</a></p>
        {items.length > 0 && <ul className="feedback-list">{items.map((item) => <li key={item.id}><strong>{categories.find(([key]) => key === item.category)?.[1] ?? "Mensagem"}</strong><span>Recebida</span><p>{item.text}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></li>)}</ul>}
        {loading ? <p>Carregando mensagens…</p> : loadError ? <><p role="alert">Não foi possível carregar suas mensagens.</p><button type="button" onClick={() => void load(retryCursor.current)}>Tentar novamente</button></> : items.length === 0 ? <p>Nenhuma mensagem enviada ainda.</p> : next && <button type="button" onClick={() => void load(next)}>Carregar mais</button>}
      </section>
    </div>
  </>;
}
