"use client";
import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { HabitoDoUsuario } from "@/core/contracts";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function HabitEditor({ row, returnFocusRef, onClose, onSaved }: { row?: HabitoDoUsuario; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(): void }) {
  const app = useDemoApplication(), formId = useId(), firstRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(row?.name ?? ""), [cadence, setCadence] = useState(row?.schedule_kind ?? "daily"), [days, setDays] = useState(row?.weekdays ?? [1, 2, 3, 4, 5]), [target, setTarget] = useState(String(row?.weekly_target ?? 3)), [start, setStart] = useState(row?.started_on ?? app.today());
  const [pending, setPending] = useState(false), [failure, setFailure] = useState(""); const busy = useRef(false), receipt = useRef<{ value: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; setFailure("");
    if (!name.trim() || name.trim().length > 120 || cadence === "weekdays" && days.length === 0 || cadence === "weekly_target" && (!/^\d+$/.test(target) || Number(target) < 1 || Number(target) > 7)) { setFailure("Informe o nome e uma cadência válida, com dias selecionados ou meta de 1 a 7."); firstRef.current?.focus(); return; }
    const fields = { name: name.trim(), schedule_kind: cadence, weekdays: cadence === "weekdays" ? days : [], weekly_target: cadence === "weekly_target" ? Number(target) : null, started_on: start, color_key: row?.color_key ?? "personal", icon_key: row?.icon_key ?? null, position: row?.position ?? 0 };
    const value = JSON.stringify(fields); if (receipt.current?.value !== value) receipt.current = { value, id: crypto.randomUUID() }; busy.current = true; setPending(true);
    try { await app.executeDomainCommand(row ? "habit.update" : "habit.create", row ? { id: row.id, patch: fields, client_id: receipt.current.id } : { ...fields, client_id: receipt.current.id }); onSaved(); onClose(); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente."); } finally { busy.current = false; setPending(false); }
  }
  return <Drawer open title={row ? "Editar hábito" : "Novo hábito"} initialFocusRef={firstRef} returnFocusRef={returnFocusRef} onClose={onClose} dismissible={!pending} closeOnBackdrop={false} footer={<><Button onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit" form={formId} loading={pending}>{row ? "Salvar alterações" : "Criar hábito"}</Button></>}><form id={formId} className="habits-form" onSubmit={submit} noValidate>{failure && <p role="alert" className="habits-error">{failure}</p>}<Field ref={firstRef} label="Nome do hábito" value={name} maxLength={120} required disabled={pending} onChange={(event) => { setName(event.target.value); setFailure(""); }} /><Field as="select" label="Cadência do hábito" value={cadence} disabled={pending} onChange={(event) => setCadence(event.target.value as typeof cadence)}><option value="daily">Todos os dias</option><option value="weekdays">Dias da semana</option><option value="weekly_target">Meta por semana</option></Field>
    {cadence === "weekdays" && <div role="group" aria-label="Dias da semana" className="habits-weekdays">{DAYS.map((label, day) => <Button key={day} aria-pressed={days.includes(day)} disabled={pending} onClick={() => setDays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day])}>{label}</Button>)}</div>}
    {cadence === "weekly_target" && <Field label="Vezes por semana" type="number" min={1} max={7} step={1} value={target} required disabled={pending} onChange={(event) => setTarget(event.target.value)} />}
    <Field label="Início do hábito" type="date" value={start} disabled={pending || Boolean(row)} required onChange={(event) => setStart(event.target.value)} hint={row ? "A data inicial preserva as marcações anteriores." : "Os dias anteriores não contam como falhas."} />
    {row && <p className="habits-caption">Alterar a cadência conserva as marcações e recalcula a sequência usando a cadência atual.</p>}
  </form></Drawer>;
}
