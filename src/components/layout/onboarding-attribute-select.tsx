"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createAttributesClient, type AttributeAttempt, type AttributeSnapshot, type AttributeTarget, type AttributesClient, type PersonalFocus, type ProjectContext } from "@/lib/onboarding-attributes-client";
import "./onboarding-attribute-select.css";

type Choice = PersonalFocus | ProjectContext;
type Props = { userId: string; target: AttributeTarget; title: string; description: string; label: string; choices: readonly { value: Choice; label: string }[]; savedMessage: string };
const selected = (value: AttributeSnapshot) => ("focus" in value ? value.focus : value.context) ?? "";

/** Explicit read keeps this optional preference out of ordinary module loads. */
export function OnboardingAttributeSelect({ userId, target, title, description, label, choices, savedMessage }: Props) {
  const panelId = useId(), titleId = useId();
  const client = useRef<AttributesClient | null>(null), busy = useRef(false), attempt = useRef<AttributeAttempt | null>(null);
  const [open, setOpen] = useState(false), [snapshot, setSnapshot] = useState<AttributeSnapshot | null>(null), [value, setValue] = useState<Choice | "">("");
  const [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false), [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => {
    const owned = createAttributesClient(userId); client.current = owned;
    return () => { owned.dispose(); if (client.current === owned) client.current = null; };
  }, [userId]);
  useEffect(() => {
    if (!uncertain) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uncertain]);
  function clearSession() {
    setSnapshot(null); setValue(""); attempt.current = null; setUncertain(false); setConflict(false); setBlocked(true); setMessage("");
  }
  async function load(preserveChoice = false) {
    const owned = client.current;
    if (!owned || busy.current || uncertain || blocked) return;
    busy.current = true; setPending(true); setError(""); setMessage("");
    try {
      const reply = await owned.read(target);
      if (client.current !== owned) return;
      if (!reply.ok) { if (reply.reason === "session-changed") clearSession(); setError(reply.message); return; }
      setSnapshot(reply.result); if (!preserveChoice) setValue(selected(reply.result));
      attempt.current = null; setConflict(false);
      if (preserveChoice) setMessage("Valor atual recarregado. Sua escolha foi preservada; compare antes de salvar.");
    } finally { if (client.current === owned) { busy.current = false; setPending(false); } }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const owned = client.current;
    if (!owned || !snapshot || busy.current || blocked || conflict) return;
    busy.current = true; setPending(true); setError(""); setMessage("");
    try {
      attempt.current ??= owned.prepare(target, snapshot.revision, value || null);
      const reply = await attempt.current.submit();
      if (client.current !== owned) return;
      if (reply.ok) {
        setSnapshot(reply.result); setValue(selected(reply.result)); attempt.current = null; setUncertain(false); setMessage(savedMessage);
      } else {
        setError(reply.message);
        if (reply.reason === "session-changed") clearSession();
        else if (reply.reason === "uncertain") setUncertain(true);
        else { attempt.current = null; setUncertain(false); setConflict(reply.reason === "conflict"); }
      }
    } catch { if (client.current === owned) setError("Revise sua escolha antes de salvar."); }
    finally { if (client.current === owned) { busy.current = false; setPending(false); } }
  }
  const current = snapshot ? selected(snapshot) : "", currentLabel = choices.find(choice => choice.value === current)?.label ?? "Não informado";
  return <div className="attribute-editor" aria-labelledby={titleId}>
    <div className="attribute-editor__heading"><h3 id={titleId}>{title}</h3><p>{description}</p></div>
    <Button aria-expanded={open} aria-controls={panelId} disabled={pending || uncertain || blocked} onClick={() => { if (open) setOpen(false); else { setOpen(true); if (!snapshot) void load(); } }}>{open ? "Recolher" : "Consultar ou editar"}</Button>
    <div id={panelId} hidden={!open}>
      {pending && !snapshot && <p role="status">Carregando…</p>}
      {error && <p className="attribute-editor__error" role="alert">{error}</p>}
      {snapshot && !blocked && <form className="attribute-editor__form" onSubmit={save} aria-busy={pending}>
        <p className="attribute-editor__current">Valor salvo: <strong>{currentLabel}</strong></p>
        <Field as="select" label={label} value={value} disabled={pending || uncertain || conflict} hint="Opcional. Escolha Não informado para remover esta classificação." onChange={event => { setValue(event.target.value as Choice | ""); setError(""); setMessage(""); }}>
          <option value="">Não informado</option>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </Field>
        <div className="attribute-editor__actions"><Button type="submit" variant="primary" loading={pending} disabled={blocked || conflict || !uncertain && value === current}>{uncertain ? "Tentar o mesmo envio" : "Salvar escolha"}</Button>
          {conflict && <Button onClick={() => void load(true)} disabled={pending}>Recarregar valor atual</Button>}</div>
        {uncertain && <p className="attribute-editor__note">Sua intenção original está preservada nesta tela. Confirme o mesmo envio antes de alterar a escolha, sair ou recarregar.</p>}
      </form>}
      {!snapshot && error && !blocked && <Button disabled={pending} onClick={() => void load()}>Tentar novamente</Button>}
      <p className="attribute-editor__feedback" role="status">{message}</p>
    </div>
  </div>;
}
