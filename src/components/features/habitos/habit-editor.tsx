"use client";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { HabitoDoUsuario } from "@/core/contracts";
import { conferirEstadoDaFrequencia, type CadenciaHabito } from "@/core/habitos";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { HabitFrequencyFields } from "@/components/layout/habit-frequency-fields";
import { EntityImageAttempt, definiteImageRefusal } from "@/components/layout/entity-image-attempt";
import { EntityImagePicker } from "@/components/layout/entity-image-picker";
import { PrivateImagePreview } from "@/components/layout/private-image";
import { fileReadUrl } from "@/components/layout/file-upload";
import { useImagePreview } from "@/components/layout/use-image-preview";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function HabitEditor({ row, returnFocusRef, onClose, onSaved }: { row?: HabitoDoUsuario; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(): void }) {
  const app = useDemoApplication(), formId = useId(), firstRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(row?.name ?? ""), [cadence, setCadence] = useState<CadenciaHabito>(row?.schedule_kind ?? "daily"), [days, setDays] = useState(row?.weekdays ?? [1, 2, 3, 4, 5]), [target, setTarget] = useState(String(row?.weekly_target ?? 3)), [start, setStart] = useState(row?.started_on ?? app.today());
  const [pending, setPending] = useState(false), [failure, setFailure] = useState("");
  const busy = useRef(false), receipt = useRef<{ value: string; id: string } | null>(null), domainPending = useRef(false);
  const [image, setImage] = useState<File | null>(null), [removeImage, setRemoveImage] = useState(false), [protectedAttempt, setProtectedAttempt] = useState(false), [domainSaved, setDomainSaved] = useState(false);
  const preview = useImagePreview(image), currentImage = row?.image_file_id ?? null;
  const attempt = useRef<EntityImageAttempt | null>(null), currentApp = useRef(app), savedHabit = useRef<{ row: HabitoDoUsuario; fields: string } | null>(null);
  useLayoutEffect(() => { currentApp.current = app; }, [app]);
  function requestClose() {
    if (busy.current || domainPending.current || attempt.current && !attempt.current.canDiscard) return;
    if (domainSaved) onSaved(); onClose();
  }
  function choose(file: File | null) {
    if (busy.current || domainPending.current || attempt.current && !attempt.current.canDiscard) return false;
    if (file && (!file.size || file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))) { setFailure("Escolha uma imagem PNG, JPG, WebP ou GIF de até 8 MiB."); return false; }
    setImage(file); setRemoveImage(false); setFailure(""); attempt.current = null; setProtectedAttempt(false); return true;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; setFailure("");
    if (!name.trim() || name.trim().length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(start) || cadence === "weekdays" && days.length === 0 || cadence === "weekly_target" && (!/^\d+$/.test(target) || Number(target) < 1 || Number(target) > 7)) { setFailure("Informe o nome, a data inicial e uma frequência válida."); firstRef.current?.focus(); return; }
    const fields = { name: name.trim(), schedule_kind: cadence, weekdays: cadence === "weekdays" ? [...days].sort((a, b) => a - b) : [], weekly_target: cadence === "weekly_target" ? Number(target) : null, started_on: start, color_key: row?.color_key ?? "personal", icon_key: row?.icon_key ?? null, position: row?.position ?? 0 };
    const value = JSON.stringify(fields);
    if (domainPending.current && receipt.current?.value !== value) { setFailure("Confirme o envio original antes de alterar os campos."); return; }
    if (receipt.current?.value !== value) receipt.current = { value, id: crypto.randomUUID() };
    busy.current = true; setPending(true);
    try {
      if (image || removeImage) {
        attempt.current ??= new EntityImageAttempt({ purpose: "habit_image", file: removeImage ? null : image, application: () => currentApp.current, onPhase: () => setProtectedAttempt(true) });
        await attempt.current.upload();
      }
      let saved = savedHabit.current?.row;
      if (savedHabit.current && savedHabit.current.fields !== value) throw new Error("O hábito já foi salvo. Conclua a imagem ou feche e reabra para editar os campos.");
      if (!saved) {
        domainPending.current = true;
        const result = await app.executeDomainCommand(row ? "habit.update" : "habit.create", row ? { id: row.id, patch: fields, client_id: receipt.current.id } : { ...fields, client_id: receipt.current.id });
        if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string" || !result.id || app.mode === "connected" && !uuid(result.id) || !("user_id" in result) || result.user_id !== app.userId || row && (app.mode === "connected" ? result.id.toLowerCase() !== row.id.toLowerCase() : result.id !== row.id)) throw new Error("A resposta ainda não confirmou este hábito. Tente o mesmo envio.");
        saved = result as HabitoDoUsuario; conferirEstadoDaFrequencia(saved);
        savedHabit.current = { row: saved, fields: value }; setDomainSaved(true); domainPending.current = false;
      }
      if (image || removeImage) await attempt.current!.bind(saved.id, currentImage);
      onSaved(); onClose();
    } catch (error) {
      if (app.mode === "demo" || definiteImageRefusal(error, app)) domainPending.current = false;
      setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente.");
    } finally { busy.current = false; setPending(false); setProtectedAttempt(domainPending.current || !!attempt.current && !attempt.current.canDiscard); }
  }
  const locked = pending || protectedAttempt || domainSaved;
  return <Drawer open title={row ? "Editar hábito" : "Novo hábito"} initialFocusRef={firstRef} returnFocusRef={returnFocusRef} onClose={requestClose} dismissible={!pending && !protectedAttempt} closeOnBackdrop={false} footer={<><Button onClick={requestClose} disabled={pending || protectedAttempt}>Cancelar</Button><Button variant="primary" type="submit" form={formId} loading={pending}>{failure && protectedAttempt ? "Tentar o mesmo envio" : row ? "Salvar alterações" : "Criar hábito"}</Button></>}>
    <form id={formId} className="habits-form" onSubmit={submit} noValidate>
      {failure && <p role="alert" className="habits-error">{failure}</p>}
      <Field ref={firstRef} label="Nome do hábito" value={name} maxLength={120} required disabled={locked} onChange={event => { setName(event.target.value); setFailure(""); }} />
      <HabitFrequencyFields cadence={cadence} days={days} target={target} disabled={locked} onCadence={setCadence} onDays={setDays} onTarget={setTarget} />
      <Field label="Início do hábito" type="date" value={start} disabled={locked || Boolean(row)} required onChange={event => setStart(event.target.value)} hint={row ? "A data inicial preserva o histórico e não muda." : "Criar não marca dias como cumpridos."} />
      <fieldset className="habits-image-field"><legend>Imagem do hábito (opcional)</legend>
        <PrivateImagePreview source={removeImage ? null : preview ?? (currentImage ? fileReadUrl(currentImage, app.userId) : null)} label={preview ? "Prévia da imagem escolhida" : "Imagem atual do hábito"} />
        <EntityImagePicker label="Escolher imagem" hint="Até 8 MiB e 24 milhões de pixels. A imagem é privada e só muda após confirmação." disabled={pending || protectedAttempt || app.mode !== "connected"} onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = ""; }} />
        {currentImage && <Button disabled={pending || protectedAttempt} onClick={() => { if (choose(null)) setRemoveImage(true); }}>Remover imagem</Button>}
        {(image || removeImage) && <Button variant="ghost" disabled={pending || protectedAttempt} onClick={() => choose(null)}>Desfazer escolha</Button>}
        {app.mode === "demo" && <p className="habits-caption">Entre na sua conta para guardar uma imagem privada.</p>}
        {domainSaved && failure && <p className="habits-caption">O hábito já foi salvo. Conclua a imagem pelo mesmo envio; o hábito não será criado novamente.</p>}
        {protectedAttempt && failure && <p className="habits-caption">Confirme o envio antes de trocar a imagem ou fechar. Recarregar não preserva o arquivo escolhido.</p>}
      </fieldset>
      {row && <p className="habits-caption">A nova frequência vale a partir de hoje, em São Paulo. Se o hábito ainda não começou, muda somente sua frequência inicial. Registros e expectativas anteriores são preservados.</p>}
    </form>
  </Drawer>;
}
