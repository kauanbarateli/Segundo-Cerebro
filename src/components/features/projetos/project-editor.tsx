"use client";
import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Projeto } from "@/core/contracts";
import type { ProjectContainer } from "@/core/projetos";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

export type ProjectEditorTarget = { kind: "project"; row?: Projeto } | { kind: "container-create"; project: Projeto; containerKind: ProjectContainer["kind"] } | { kind: "container-link"; project: Projeto; containerKind: ProjectContainer["kind"] };
const LABELS = { capture: "captura", notebook: "caderno", folder: "pasta" };
export function ProjectEditor({ target, containers, returnFocusRef, onClose, onSaved }: { target: ProjectEditorTarget; containers: ProjectContainer[]; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(id?: string): void }) {
  const app = useDemoApplication(), formId = useId(), inputRef = useRef<HTMLInputElement>(null), selectRef = useRef<HTMLSelectElement>(null);
  const [name, setName] = useState(target.kind === "project" ? target.row?.name ?? "" : ""), [description, setDescription] = useState(target.kind === "project" ? target.row?.description ?? "" : ""), [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false), [failure, setFailure] = useState(""); const busy = useRef(false), receipt = useRef<{ fingerprint: string; id: string } | null>(null);
  const title = target.kind === "project" ? target.row ? "Editar projeto" : "Novo projeto" : `${target.kind === "container-create" ? "Criar" : "Vincular"} ${LABELS[target.containerKind]} neste projeto`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; setFailure("");
    if (target.kind !== "container-link" && (!name.trim() || name.trim().length > 120)) { setFailure("Informe um nome de até 120 caracteres."); inputRef.current?.focus(); return; }
    if (target.kind === "container-link" && !selected) { setFailure("Escolha um item disponível para vincular."); selectRef.current?.focus(); return; }
    const command = target.kind === "project" ? target.row ? "project.update" : "project.create" : target.kind === "container-create" ? "project.container.create" : "project.container.link";
    const fields = target.kind === "project" ? target.row ? { id: target.row.id, patch: { name: name.trim(), description: description.trim() || null } } : { name: name.trim(), description: description.trim() || null, color_key: "work", position: 0 } : target.kind === "container-create" ? { name: name.trim(), project_id: target.project.id, kind: target.containerKind } : { id: selected, project_id: target.project.id };
    const fingerprint = JSON.stringify({ command, fields }); if (receipt.current?.fingerprint !== fingerprint) receipt.current = { fingerprint, id: crypto.randomUUID() }; busy.current = true; setPending(true);
    try { const result = await app.executeDomainCommand(command, { ...fields, client_id: receipt.current.id }); const id = result && typeof result === "object" && "id" in result && typeof result.id === "string" ? result.id : undefined; onSaved(target.kind === "project" ? id : target.project.id); onClose(); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Seus campos foram preservados; tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  const available = target.kind === "project" ? [] : containers.filter(row => row.kind === target.containerKind && row.deleted_at === null && row.project_id !== target.project.id);
  return <Drawer open title={title} onClose={onClose} dismissible={!pending} closeOnBackdrop={false} initialFocusRef={target.kind === "container-link" ? selectRef : inputRef} returnFocusRef={returnFocusRef} footer={<><Button disabled={pending} onClick={onClose}>Cancelar</Button><Button variant="primary" loading={pending} type="submit" form={formId}>{target.kind === "container-link" ? "Vincular item" : target.kind === "container-create" ? "Criar aqui" : target.row ? "Salvar alterações" : "Criar projeto"}</Button></>}>
    <form id={formId} className="project-form" onSubmit={submit} noValidate>{failure && <p className="project-error" role="alert">{failure}</p>}
      {target.kind === "container-link" ? <><Field ref={selectRef} as="select" label="Item para vincular" value={selected} required disabled={pending} onChange={(event) => { setSelected(event.target.value); setFailure(""); }}><option value="">Selecione o item</option>{available.map(row => <option key={row.id} value={row.id}>{row.name}{row.project_id ? " · mover de outro projeto" : ""}</option>)}</Field><p className="project-note">O vínculo atual do item será substituído. O conteúdo do item será preservado.</p>{!available.length && <p className="project-note">Nenhum item disponível. Use Criar aqui para começar neste projeto.</p>}</> : <Field ref={inputRef} label={target.kind === "project" ? "Nome do projeto" : target.containerKind === "notebook" ? "Nome do caderno" : target.containerKind === "folder" ? "Nome da pasta" : "Nome da captura"} maxLength={120} required value={name} disabled={pending} onChange={(event) => { setName(event.target.value); setFailure(""); }} />}
      {target.kind === "project" && <Field as="textarea" label="Descrição do projeto" rows={4} maxLength={2000} value={description} disabled={pending} onChange={(event) => setDescription(event.target.value)} />}
      {target.kind === "container-create" && <p className="project-note">O item será criado em {target.project.name} e poderá ser aberto pelo projeto.</p>}
    </form>
  </Drawer>;
}
