"use client";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Projeto } from "@/core/contracts";
import type { ProjectContainer } from "@/core/projetos";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { fileReadUrl } from "@/components/layout/file-upload";
import { EntityImageAttempt, definiteImageRefusal } from "@/components/layout/entity-image-attempt";
import { EntityImagePicker } from "@/components/layout/entity-image-picker";
import { useImagePreview } from "@/components/layout/use-image-preview";
import { PrivateImagePreview } from "@/components/layout/private-image";

export type ProjectEditorTarget = { kind: "project"; row?: Projeto } | { kind: "container-create"; project: Projeto; containerKind: ProjectContainer["kind"] } | { kind: "container-link"; project: Projeto; containerKind: ProjectContainer["kind"] };
const LABELS = { capture: "captura", notebook: "caderno", folder: "pasta" };
const projectUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function ProjectEditor({ target, containers, returnFocusRef, onClose, onSaved }: { target: ProjectEditorTarget; containers: ProjectContainer[]; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(id?: string): void }) {
  const app = useDemoApplication(), formId = useId(), inputRef = useRef<HTMLInputElement>(null), selectRef = useRef<HTMLSelectElement>(null);
  const [name, setName] = useState(target.kind === "project" ? target.row?.name ?? "" : ""), [description, setDescription] = useState(target.kind === "project" ? target.row?.description ?? "" : ""), [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false), [failure, setFailure] = useState(""); const busy = useRef(false), receipt = useRef<{ fingerprint: string; id: string } | null>(null);
  const [cover, setCover] = useState<File | null>(null), [removeCover, setRemoveCover] = useState(false);
  const coverPreview = useImagePreview(cover), [domainSaved, setDomainSaved] = useState(false);
  const imageAttempt = useRef<EntityImageAttempt | null>(null), domainPending = useRef(false), currentApp = useRef(app);
  const [protectedAttempt, setProtectedAttempt] = useState(false);
  useLayoutEffect(() => { currentApp.current = app; }, [app]);
  const savedProject = useRef<{ row: Projeto; fields: string } | null>(null);
  const currentCover = target.kind === "project" ? target.row?.cover_file_id ?? null : null;
  function requestClose() { if (!busy.current && !domainPending.current && (!imageAttempt.current || imageAttempt.current.canDiscard)) onClose(); }
  function chooseCover(file: File | null) {
    if (busy.current || domainPending.current || imageAttempt.current && !imageAttempt.current.canDiscard) return false;
    if (file && (!file.size || file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))) { setFailure("Escolha uma imagem PNG, JPG, WebP ou GIF de até 8 MiB."); return false; }
    setCover(file); setRemoveCover(false); imageAttempt.current = null; setProtectedAttempt(false); setFailure(""); return true;
  }
  const title = target.kind === "project" ? target.row ? "Editar projeto" : "Novo projeto" : `${target.kind === "container-create" ? "Criar" : "Vincular"} ${LABELS[target.containerKind]} neste projeto`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; setFailure("");
    if (target.kind !== "container-link" && (!name.trim() || name.trim().length > 120)) { setFailure("Informe um nome de até 120 caracteres."); inputRef.current?.focus(); return; }
    if (target.kind === "container-link" && !selected) { setFailure("Escolha um item disponível para vincular."); selectRef.current?.focus(); return; }
    const command = target.kind === "project" ? target.row ? "project.update" : "project.create" : target.kind === "container-create" ? "project.container.create" : "project.container.link";
    const fields = target.kind === "project" ? target.row ? { id: target.row.id, patch: { name: name.trim(), description: description.trim() || null } } : { name: name.trim(), description: description.trim() || null, color_key: "work", position: 0 } : target.kind === "container-create" ? { name: name.trim(), project_id: target.project.id, kind: target.containerKind } : { id: selected, project_id: target.project.id };
    const fingerprint = JSON.stringify({ command, fields });
    if (domainPending.current && receipt.current?.fingerprint !== fingerprint) { setFailure("Confirme os dados originais antes de alterar o projeto."); return; }
    if (receipt.current?.fingerprint !== fingerprint) receipt.current = { fingerprint, id: crypto.randomUUID() }; busy.current = true; setPending(true);
    try {
      if (target.kind === "project" && (cover || removeCover)) {
        imageAttempt.current ??= new EntityImageAttempt({ purpose: "project_cover", file: removeCover ? null : cover, application: () => currentApp.current, onPhase: () => setProtectedAttempt(true) });
        await imageAttempt.current.upload();
      }
      let result: unknown;
      if (target.kind === "project" && savedProject.current) {
        // A failed image binding cannot create a second project on retry.
        result = savedProject.current.row;
        if (savedProject.current.fields !== JSON.stringify(fields)) throw new Error("O projeto já foi salvo. Conclua a capa ou feche e reabra o projeto para editar seus campos.");
      } else {
        domainPending.current = true;
        result = await app.executeDomainCommand(command, { ...fields, client_id: receipt.current.id });
        if (target.kind === "project") {
          if (!result || typeof result !== "object" || Array.isArray(result) || !("id" in result) || typeof result.id !== "string" || !result.id || app.mode === "connected" && !projectUuid(result.id) || !("user_id" in result) || result.user_id !== app.userId) throw new Error("O projeto ainda não foi confirmado. Tente o mesmo envio.");
          // Connected IDs are UUIDs; demo fixtures retain their symbolic IDs.
          // Neither comparison rewrites the original journal intention.
          if (target.row && (app.mode === "connected" ? result.id.toLowerCase() !== target.row.id.toLowerCase() : result.id !== target.row.id)) throw new Error("A resposta não confirmou este projeto. Tente o mesmo envio.");
          savedProject.current = { row: result as Projeto, fields: JSON.stringify(fields) }; setDomainSaved(true);
        }
        domainPending.current = false;
      }
      const id = result && typeof result === "object" && "id" in result && typeof result.id === "string" ? result.id : undefined;
      if (target.kind === "project" && id && (cover || removeCover)) {
        await imageAttempt.current!.bind(id, currentCover);
      }
      onSaved(target.kind === "project" ? id : target.project.id); onClose();
    }
    catch (error) { if (definiteImageRefusal(error, app)) domainPending.current = false; setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente."); }
    finally { busy.current = false; setPending(false); setProtectedAttempt(domainPending.current || !!imageAttempt.current && !imageAttempt.current.canDiscard); }
  }
  const available = target.kind === "project" ? [] : containers.filter(row => row.kind === target.containerKind && row.deleted_at === null && row.project_id !== target.project.id);
  return <Drawer open title={title} onClose={requestClose} dismissible={!pending && !protectedAttempt} closeOnBackdrop={false} initialFocusRef={target.kind === "container-link" ? selectRef : inputRef} returnFocusRef={returnFocusRef} footer={<><Button disabled={pending || protectedAttempt} onClick={requestClose}>Cancelar</Button><Button variant="primary" loading={pending} type="submit" form={formId}>{failure && protectedAttempt ? "Tentar o mesmo envio" : target.kind === "container-link" ? "Vincular item" : target.kind === "container-create" ? "Criar aqui" : target.row ? "Salvar alterações" : "Criar projeto"}</Button></>}>
    <form id={formId} className="project-form" onSubmit={submit} noValidate>{failure && <p className="project-error" role="alert">{failure}</p>}
      {target.kind === "container-link" ? <><Field ref={selectRef} as="select" label="Item para vincular" value={selected} required disabled={pending || protectedAttempt} onChange={(event) => { setSelected(event.target.value); setFailure(""); }}><option value="">Selecione o item</option>{available.map(row => <option key={row.id} value={row.id}>{row.name}{row.project_id ? " · mover de outro projeto" : ""}</option>)}</Field><p className="project-note">O vínculo atual do item será substituído. O conteúdo do item será preservado.</p>{!available.length && <p className="project-note">Nenhum item disponível. Use Criar aqui para começar neste projeto.</p>}</> : <Field ref={inputRef} label={target.kind === "project" ? "Nome do projeto" : target.containerKind === "notebook" ? "Nome do caderno" : target.containerKind === "folder" ? "Nome da pasta" : "Nome da captura"} maxLength={120} required value={name} disabled={pending || protectedAttempt || target.kind === "project" && domainSaved} onChange={(event) => { setName(event.target.value); setFailure(""); }} />}
      {target.kind === "project" && <Field as="textarea" label="Descrição do projeto" rows={4} maxLength={2000} value={description} disabled={pending || protectedAttempt || domainSaved} onChange={(event) => setDescription(event.target.value)} />}
      {target.kind === "project" && <fieldset className="project-image-field"><legend>Capa opcional</legend>
        <PrivateImagePreview source={removeCover ? null : coverPreview ?? (currentCover ? fileReadUrl(currentCover, app.userId) : null)} label={coverPreview ? "Prévia da capa escolhida" : "Capa atual do projeto"} />
        <EntityImagePicker label="Escolher capa" hint="Até 8 MiB e 24 milhões de pixels. A capa é privada e só muda após confirmação." disabled={pending || protectedAttempt || app.mode !== "connected"} onChange={event => { chooseCover(event.target.files?.[0] ?? null); event.target.value = ""; }} />
        {cover && <p>{cover.name} · imagem escolhida</p>}
        {currentCover && <Button disabled={pending || protectedAttempt} onClick={() => { if (chooseCover(null)) setRemoveCover(true); }}>Remover capa</Button>}
        {(cover || removeCover) && <Button variant="ghost" disabled={pending || protectedAttempt} onClick={() => chooseCover(null)}>Desfazer escolha</Button>}
        {domainSaved && failure && <p className="project-note">Os dados do projeto já foram salvos. Tente concluir o vínculo da capa; o projeto não será criado novamente.</p>}
        {protectedAttempt && failure && <p className="project-note">O envio original está preservado nesta tela. Confirme antes de trocar ou fechar. Recarregar não preserva o arquivo escolhido.</p>}
      </fieldset>}
      {target.kind === "container-create" && <p className="project-note">O item será criado em {target.project.name} e poderá ser aberto pelo projeto.</p>}
    </form>
  </Drawer>;
}
