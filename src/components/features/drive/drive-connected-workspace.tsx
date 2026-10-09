"use client";
import { RelatedPanel } from "@/components/layout/related-panel";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ProgressBar } from "@/components/ui/data-display";
import { Icons } from "@/components/ui/icons";
import { fileReadUrl, uploadFile, type UploadPhase } from "@/components/layout/file-upload";
import { arvorePastas, caminhoPasta, type Arquivo, type DriveDTO, type Pasta } from "@/core/drive";
import { FUSO_DO_APP } from "@/core/tempo";
import { formatFileBytes } from "./projections";
import { createDriveClient } from "./drive-client";

type Request = { command: string; input: Record<string, unknown> };
type Form = { kind: "create" | "rename-folder" | "move-folder" | "rename-file" | "move-file"; item?: Pasta | Arquivo };
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
const dateText = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, dateStyle: "short" }).format(new Date(value));
const phases: Record<UploadPhase, string> = { reserving: "Preparando envio", uploading: "Enviando arquivo", validating: "Validando e salvando arquivo" };

export function ConnectedDriveWorkspace() {
  const { userId, executeDomainCommand } = useDemoApplication(), router = useRouter(), params = useSearchParams();
  const client = useMemo(() => createDriveClient(userId), [userId]);
  const [data, setData] = useState<DriveDTO | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [pending, setPending] = useState<Request | null>(null);
  const [form, setForm] = useState<Form | null>(null), [name, setName] = useState(""), [destination, setDestination] = useState(""), [project, setProject] = useState("");
  const [uploadStatus, setUploadStatus] = useState(""), [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null), active = useRef(false), generation = useRef(0);
  const folderId = params.get("folder"), trash = params.get("view") === "trash", fileId = params.get("file");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++generation.current; setLoading(true);
    try { const next = await client.load(signal); if (!signal?.aborted && generation.current === version) { setData(next); setError(""); } }
    catch (failure) { if (!signal?.aborted && generation.current === version) setError(message(failure)); }
    finally { if (!signal?.aborted && generation.current === version) setLoading(false); }
  }, [client]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  function navigate(change: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString()); for (const [key, value] of Object.entries(change)) { if (value) next.set(key, value); else next.delete(key); }
    router.replace(`/drive${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  async function dispatch(command: string, values: unknown): Promise<unknown> {
    const request = { command, input: values as Record<string, unknown> };
    try { const result = await executeDomainCommand(command, values); setPending(null); return result; }
    catch (failure) { if ((failure as { outcomeUnknown?: boolean }).outcomeUnknown) setPending(request); throw failure; }
  }
  async function send(request: Request, success: string) {
    if (active.current) return; active.current = true; setBusy(true); setError("");
    try { await dispatch(request.command, request.input); await refresh(); setNotice(success); setForm(null); return true; }
    catch (failure) { setError(message(failure)); return false; }
    finally { active.current = false; setBusy(false); }
  }
  const operation = (command: string, values: Record<string, unknown>, success: string) => send({ command, input: { ...values, client_id: crypto.randomUUID() } }, success);
  async function upload(files: File[]) {
    if (active.current || pending || trash || !files.length || !data) return;
    if (files.some(file => file.size > data.max_file_bytes)) { setError(`Cada arquivo pode ter até ${formatFileBytes(data.max_file_bytes)}.`); return; }
    active.current = true; setBusy(true); setError(""); let completed = 0;
    try {
      for (const file of files) {
        await uploadFile({ file, kind: "drive", userId, folderId, sender: dispatch, onPhase: phase => setUploadStatus(`${phases[phase]}: ${file.name}`) }); completed++;
      }
      await refresh(); setNotice(completed === 1 ? "Arquivo salvo." : `${completed} arquivos salvos.`);
    } catch (failure) { if (completed) { await refresh(); setNotice(`${completed} arquivos salvos.`); } setError(message(failure)); }
    finally { active.current = false; setBusy(false); setUploadStatus(""); if (input.current) input.current.value = ""; }
  }
  function open(next: Form) {
    setForm(next); setName(next.item?.name ?? "");
    setDestination(next.item ? "parent_id" in next.item ? next.item.parent_id ?? "" : next.item.folder_id ?? "" : folderId ?? "");
    setProject(params.get("project") ?? ""); setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!form) return;
    const command = form.kind === "create" ? "drive.folder.create" : `drive.${form.kind.endsWith("folder") ? "folder" : "file"}.${form.kind.startsWith("rename") ? "update" : "move"}`;
    const values = form.kind === "create" ? { name, parent_id: folderId, project_id: project || null }
      : form.kind.startsWith("rename") ? { id: form.item!.id, name }
        : { id: form.item!.id, [form.kind.endsWith("folder") ? "parent_id" : "folder_id"]: destination || null };
    void operation(command, values, form.kind === "create" ? "Pasta criada." : form.kind.startsWith("rename") ? "Nome salvo." : "Local alterado.");
  }
  if (!data) return error ? <Card className="drive-message"><h2>Não foi possível abrir seus arquivos</h2><p role="alert">{error}</p><Button onClick={() => void refresh()}>Tentar de novo</Button></Card> : <div className="drive-skeleton" role="status" aria-label="Carregando Drive"><div className="drive-skeleton-breadcrumb" /><div className="drive-skeleton-summary"><div className="drive-skeleton-folders">{[0, 1, 2].map(value => <i key={value} />)}</div><i className="drive-skeleton-usage" /></div></div>;
  const trail = caminhoPasta(data.folders, folderId), selected = data.files.find(file => file.id === fileId), current = trail?.at(-1);
  if (!trash && !trail) return <Card className="drive-message"><h2>Pasta indisponível</h2><p>A pasta pode estar na lixeira ou não estar disponível para sua conta.</p><Link href="/drive">Voltar ao Meu Drive</Link><Link href="/drive?view=trash">Abrir lixeira</Link></Card>;
  const parentById = new Map(data.folders.map(folder => [folder.id, folder]));
  const folders = data.folders.filter(folder => trash ? !!folder.deleted_at && (!folder.parent_id || parentById.get(folder.parent_id)?.deletion_batch_id !== folder.deletion_batch_id) : !folder.deleted_at && folder.parent_id === folderId).sort((a, b) => a.position - b.position);
  const files = data.files.filter(file => trash ? !!file.deleted_at && (!file.folder_id || parentById.get(file.folder_id)?.deletion_batch_id !== file.deletion_batch_id) : !file.deleted_at && file.folder_id === folderId);
  const trashCount = data.files.filter(file => file.deleted_at).length + data.folders.filter(folder => folder.deleted_at).length;
  const blocked = busy || !!pending;
  const forbiddenFolders = form?.kind === "move-folder" && form.item ? new Set(arvorePastas(data.folders, form.item.id).map(folder => folder.id)) : new Set<string>();
  const columns: DataTableColumn<Arquivo>[] = [
    { id: "name", header: "Nome", accessor: file => file.name, render: file => <Button variant="ghost" className="drive-file-name" onClick={() => navigate({ file: file.id })}><Icons.File />{file.name}</Button> },
    { id: "size", header: "Tamanho", accessor: file => file.bytes, render: file => <span className="drive-size">{formatFileBytes(file.bytes)}</span> },
    { id: "modified", header: "Modificado", accessor: file => dateText(file.modified_at), sortable: false },
    { id: "starred", header: "Destaque", accessor: file => file.starred ? "Destacado" : "Sem destaque", render: file => <Button variant="ghost" disabled={blocked || !!file.deleted_at} aria-label={`${file.starred ? "Retirar destaque de" : "Destacar"} ${file.name}`} aria-pressed={file.starred} onClick={() => void operation("drive.file.star", { id: file.id, starred: !file.starred }, file.starred ? "Destaque removido." : "Arquivo destacado.")}><Icons.Star />{file.starred ? "Destacado" : "Destacar"}</Button> },
  ];
  return <div className="drive-workspace" data-access="allowed" aria-busy={loading || busy || undefined}>
    <div className="drive-top"><nav className="drive-breadcrumb" aria-label="Caminho da pasta"><Link href="/drive" aria-current={!folderId && !trash ? "page" : undefined}>Meu Drive</Link>{trash ? <><span aria-hidden="true">/</span><span aria-current="page">Lixeira</span></> : trail!.map(folder => <Fragment key={folder.id}><span className="drive-breadcrumb-separator" aria-hidden="true">/</span><Link href={`/drive?folder=${folder.id}`} aria-current={folder.id === folderId ? "page" : undefined}>{folder.name}</Link></Fragment>)}</nav><Link className="drive-trash-link" href={trash ? "/drive" : "/drive?view=trash"}>{trash ? "Voltar aos arquivos" : `Lixeira · ${trashCount}`}</Link></div>
    <div className="drive-toolbar"><p className="drive-note">{trash ? "Restaurar uma pasta devolve os itens removidos junto com ela. O espaço inclui a lixeira." : `Arquivos privados. Envie documentos, imagens e mídia de até ${formatFileBytes(data.max_file_bytes)} por arquivo.`}</p>{!trash && <div className="drive-actions"><Button disabled={blocked} onClick={() => open({ kind: "create" })}>Nova pasta</Button><Button variant="primary" disabled={blocked} onClick={() => input.current?.click()}>Enviar arquivos</Button>
      {/* Field does not support hidden native file controls; the visible button names this picker. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input ref={input} type="file" multiple hidden aria-label="Escolher arquivos" onChange={event => void upload(Array.from(event.target.files ?? []))} /></div>}</div>
    {notice && <p className="drive-feedback" role="status">{notice}</p>}
    {uploadStatus && <p className="drive-feedback" role="status" aria-live="polite">{uploadStatus}</p>}
    {error && <div className="drive-feedback"><p role="alert">{error}</p>{pending ? <Button disabled={busy} onClick={() => void send(pending, "Envio confirmado.")}>Confirmar o mesmo envio</Button> : <Button disabled={busy} onClick={() => void refresh()}>Atualizar dados</Button>}</div>}
    <div className="drive-summary"><Card className="drive-folders"><h2>{trash ? "Pastas na lixeira" : "Pastas"}</h2>{folders.length ? <ul>{folders.map(folder => <li key={folder.id}><div className="drive-folder-card">{trash ? <div className="drive-folder"><Icons.Folder /><strong>{folder.name}</strong></div> : <Link className="drive-folder" href={`/drive?folder=${folder.id}`}><Icons.Folder /><div><strong>{folder.name}</strong><span>{data.files.filter(file => file.folder_id === folder.id && !file.deleted_at).length} arquivos · {data.folders.filter(child => child.parent_id === folder.id && !child.deleted_at).length} pastas</span></div></Link>}<div className="drive-folder-actions">{trash ? <Button disabled={blocked} onClick={() => void operation("drive.folder.restore", { id: folder.id }, "Pasta e itens restaurados.")}>Restaurar</Button> : <><Button disabled={blocked} onClick={() => open({ kind: "rename-folder", item: folder })} aria-label={`Renomear ${folder.name}`}>Renomear</Button><Button disabled={blocked} onClick={() => open({ kind: "move-folder", item: folder })} aria-label={`Mover ${folder.name}`}>Mover</Button><Button disabled={blocked} onClick={() => void operation("drive.folder.delete", { id: folder.id }, "Pasta e itens enviados para a lixeira.")} aria-label={`Mover ${folder.name} para lixeira`}>Lixeira</Button></>}</div></div></li>)}</ul> : <p>{trash ? "Nenhuma pasta na lixeira." : "Nenhuma subpasta neste local."}</p>}{current && <div className="drive-current-actions"><Button disabled={blocked} onClick={() => open({ kind: "rename-folder", item: current })}>Renomear esta pasta</Button><Button disabled={blocked} onClick={() => open({ kind: "move-folder", item: current })}>Mover esta pasta</Button><Button disabled={blocked} onClick={() => void operation("drive.folder.delete", { id: current.id }, "Pasta enviada para a lixeira.").then(saved => { if (saved) navigate({ folder: current.parent_id }); })}>Enviar esta pasta para lixeira</Button></div>}</Card>
      <Card className="drive-usage"><h2>Espaço utilizado</h2><p><strong>{formatFileBytes(data.usage_bytes)}</strong> de {formatFileBytes(data.capacity_bytes)}</p><ProgressBar label="Espaço usado" value={data.usage_bytes} max={data.capacity_bytes} valueText={`${formatFileBytes(data.usage_bytes)} de ${formatFileBytes(data.capacity_bytes)}`} /><p className="drive-note">Inclui arquivos, lixeira, anexos das capturas e avatar.</p></Card></div>
    <Card className={`drive-files${dragging ? " drive-files--drop" : ""}`} onDragOver={event => { if (!trash && !blocked) { event.preventDefault(); setDragging(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}><h2>{trash ? "Arquivos na lixeira" : current?.name ?? "Arquivos"}</h2>{!trash && <p className="drive-note">Solte arquivos nesta lista ou use “Enviar arquivos”.</p>}<DataTable key={`${trash}:${folderId ?? "root"}`} label={trash ? "Arquivos na lixeira" : "Seus arquivos"} rows={files} columns={columns} getRowId={file => file.id} searchLabel="Filtrar arquivos" pageSize={10} emptyMessage={trash ? "A lixeira está vazia." : "Nenhum arquivo neste local."} /></Card>
    <Drawer open={!!fileId} onClose={() => navigate({ file: null })} title={selected?.name ?? "Arquivo indisponível"} description={selected ? "Detalhes do arquivo privado" : "O arquivo pode ter sido removido ou pertencer a outra conta."} dismissible={!busy}>
      {selected && <><dl className="drive-detail"><div><dt>Tipo</dt><dd>{selected.mime}</dd></div><div><dt>Tamanho</dt><dd>{formatFileBytes(selected.bytes)}</dd></div><div><dt>Local</dt><dd>{parentById.get(selected.folder_id ?? "")?.name ?? "Meu Drive"}{selected.deleted_at ? " · lixeira" : ""}</dd></div><div><dt>Modificado</dt><dd>{dateText(selected.modified_at)}</dd></div></dl><div className="drive-detail-actions">{selected.deleted_at ? <Button disabled={blocked} onClick={() => void operation("drive.file.restore", { id: selected.id }, "Arquivo restaurado.")}>Restaurar arquivo</Button> : <><a className="drive-download" href={fileReadUrl(selected.id, userId, true)}>Baixar arquivo</a><Button disabled={blocked} onClick={() => open({ kind: "rename-file", item: selected })}>Renomear</Button><Button disabled={blocked} onClick={() => open({ kind: "move-file", item: selected })}>Mover</Button><Button disabled={blocked} onClick={() => void operation("drive.file.delete", { id: selected.id }, "Arquivo enviado para a lixeira.")}>Mover para lixeira</Button></>}</div></>}
      {selected && !selected.deleted_at && <RelatedPanel type="file" id={selected.id} />}</Drawer>
    <Dialog open={!!form} onClose={() => setForm(null)} title={form?.kind === "create" ? "Nova pasta" : form?.kind.startsWith("rename") ? "Renomear" : "Mover para outra pasta"} dismissible={!blocked}>
      <form className="drive-form" onSubmit={submit}>{form?.kind === "create" || form?.kind.startsWith("rename") ? <Field label={form.kind.endsWith("file") ? "Nome do arquivo" : "Nome da pasta"} value={name} maxLength={200} required disabled={blocked} onChange={event => setName(event.target.value)} /> : <Field as="select" label="Pasta de destino" value={destination} disabled={blocked} onChange={event => setDestination(event.target.value)}><option value="">Meu Drive</option>{data.folders.filter(folder => !folder.deleted_at && !forbiddenFolders.has(folder.id)).map(folder => <option key={folder.id} value={folder.id}>{caminhoPasta(data.folders, folder.id)?.map(item => item.name).join(" / ")}</option>)}</Field>}{form?.kind === "create" && <Field as="select" label="Projeto" value={project} onChange={event => setProject(event.target.value)} disabled={blocked}><option value="">Sem projeto</option>{data.projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Field>}{error && <p role="alert">{error}</p>}<Button type="submit" variant="primary" loading={busy} disabled={!!pending}>{form?.kind === "create" ? "Criar pasta" : form?.kind.startsWith("rename") ? "Salvar nome" : "Mover"}</Button>{pending && <Button type="button" disabled={busy} onClick={() => void send(pending, "Envio confirmado.")}>Confirmar o mesmo envio</Button>}</form>
    </Dialog>
  </div>;
}
