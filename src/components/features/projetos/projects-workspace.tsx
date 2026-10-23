"use client";
import { RelatedPanel } from "@/components/layout/related-panel";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data-display";
import { useRef, useState, type ReactNode } from "react";
import type { Projeto } from "@/core/contracts";
import type { ProjectContainer } from "@/core/projetos";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { ProjectEditor, type ProjectEditorTarget } from "./project-editor";
import { ProjectContextSection } from "./project-context-section";
import { PrivateImage } from "@/components/layout/private-image";
import { EntityImageEditor } from "@/components/layout/entity-image-editor";
import "./projects.css";

interface State { status: string; data: unknown; error: string | null; retry(): void }
function ProjectSection({ title, query, children }: { title: string; query: State; children: ReactNode }) {
  return <Card className="project-section"><h3>{title}</h3>{query.status === "error" ? <><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo: {title}</Button></> : !query.data ? <div className="project-section-skeleton" role="status" aria-label={"Carregando " + title}><i /><i /><i /></div> : children}</Card>;
}
/** INFERIDO: `color_key` do projeto usa as tintas de categoria; chave desconhecida fica neutra. */
const TONES: Record<string, string> = { work: "work", personal: "personal", study: "info", info: "info", fin: "fin" };
const toneOf = (key: string) => TONES[key] ? ` is-${TONES[key]}` : "";
export function ProjectsSkeleton() {
  return <div className="projects-grid" role="status" aria-label="Carregando projetos">{[0, 1, 2].map((value) => <div className="project-skeleton" key={value} aria-hidden="true"><i /><i /><i /></div>)}</div>;
}
export function ProjectsWorkspace() {
  const app = useDemoApplication(), query = useDemoQuery("projects"), params = useSearchParams(), id = params.get("project"), trash = params.get("trash") === "1", { toast } = useToast();
  const [editor, setEditor] = useState<ProjectEditorTarget | null>(null), [removing, setRemoving] = useState<Projeto | null>(null), [pending, setPending] = useState(false), [failure, setFailure] = useState("");
  const [imageProject, setImageProject] = useState<Projeto | null>(null);
  const trigger = useRef<HTMLElement | null>(null), busy = useRef(false), receipt = useRef<{ fingerprint: string; id: string } | null>(null);
  const containers = query.data?.containers ?? [];
  function edit(target: ProjectEditorTarget, element: HTMLElement) { trigger.current = element; setFailure(""); setEditor(target); }
  async function mutate(command: "project.delete" | "project.restore" | "project.container.unlink", targetId: string) {
    if (busy.current) return; const fingerprint = JSON.stringify([command, targetId]); if (receipt.current?.fingerprint !== fingerprint) receipt.current = { fingerprint, id: crypto.randomUUID() }; busy.current = true; setPending(true); setFailure("");
    try { await app.executeDomainCommand(command, { id: targetId, client_id: receipt.current.id }); receipt.current = null; setRemoving(null); if (command !== "project.container.unlink") window.history.pushState(null, "", "/projetos"); toast({ message: command === "project.delete" ? "Projeto movido para a lixeira. Os itens foram preservados." : command === "project.restore" ? "Projeto restaurado com seus vínculos." : "Item desvinculado. O conteúdo foi preservado." }); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente."); } finally { busy.current = false; setPending(false); }
  }
  const { policy, ready } = useDemoAccess();
  const moduleOn = (feature: FeatureKey) => ready && resolveAccess(feature, policy).allowed && resolveAccess(feature, policy).visible;
  const enabled = (feature: FeatureKey) => !!query.data?.items.some((item) => item.id === id && item.deleted_at === null) && moduleOn(feature);
  // Layout Codex: active cards show done/total from the same task collection (no new project fields).
  const listProgress = !id && !trash && !!query.data && moduleOn("tarefas");
  const tasks = useDemoQuery("tasks", enabled("tarefas") || listProgress), captures = useDemoQuery("captures", enabled("capturar"));
  const knowledge = useDemoQuery("knowledge", enabled("conhecimento")), drive = useDemoQuery("drive", enabled("drive")), agenda = useDemoQuery("agenda", enabled("calendario"));
  const project = query.data?.items.find((item) => item.id === id && item.deleted_at === null);
  const taskItems = tasks.data?.items.filter((item) => item.project_id === id && item.deleted_at === null && item.archived_at === null && item.status !== "archived") ?? [];
  const captureItems = captures.data?.items.filter((item) => item.project_id === id && item.deleted_at === null && item.archived_at === null && item.status !== "archived" && item.status !== "draft") ?? [];
  const notebooks = knowledge.data?.notebooks.filter((item) => item.project_id === id) ?? [];
  const folders = drive.data?.folders.filter((item) => item.project_id === id && item.deleted_at === null) ?? [];
  const linkedNoteIds = new Set([...(knowledge.data?.items ?? []), ...captureItems].filter((item) => item.project_id === id).map((item) => item.id));
  const events = agenda.data?.items.filter((item) => item.linked_capture_id && linkedNoteIds.has(item.linked_capture_id)) ?? [];
  if (query.status === "error") return <Card className="project-message" data-access="allowed"><h2>Não foi possível abrir os projetos</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!query.data) return <ProjectsSkeleton />;
  if (id && !project) return <Card className="project-message" data-access="allowed"><h2>Projeto não encontrado</h2><p>Este projeto não está disponível na coleção atual.</p><Link href="/projetos">Voltar aos projetos</Link></Card>;
  const overlays = <>{editor && <ProjectEditor key={editor.kind + (editor.kind === "project" ? editor.row?.id ?? "new" : editor.containerKind)} target={editor} containers={containers} returnFocusRef={trigger} onClose={() => setEditor(null)} onSaved={(savedId) => { if (savedId) window.history.pushState(null, "", "/projetos?project=" + encodeURIComponent(savedId)); toast({ message: "Projeto atualizado." }); }} />}{removing && <ConfirmDialog open title="Excluir projeto?" description={`“${removing.name}” irá para a lixeira. Os itens e seus vínculos serão preservados.`} confirmLabel="Mover projeto para a lixeira" loading={pending} error={failure || undefined} returnFocusRef={trigger} onClose={() => setRemoving(null)} onConfirm={() => { void mutate("project.delete", removing.id); }} />}</>;
  if (!project) {
    const items = [...query.data.items].filter(item => trash ? item.deleted_at !== null : item.deleted_at === null).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return <div className="projects-workspace" data-access="allowed">
      <div className="projects-toolbar"><p>{items.length} {trash ? items.length === 1 ? "projeto na lixeira" : "projetos na lixeira" : items.length === 1 ? "projeto ativo" : "projetos ativos"}</p>
        <div className="project-actions"><Link className="project-back" href={trash ? "/projetos" : "/projetos?trash=1"}>{trash ? "Projetos ativos" : "Lixeira de projetos"}</Link><Button variant="primary" onClick={(event) => edit({ kind: "project" }, event.currentTarget)}><Icons.Capture width={17} height={17} />Novo projeto</Button></div></div>
      {failure && <p className="project-error" role="alert">{failure}</p>}
      {items.length ? <div className="projects-grid">{items.map((item) => {
        if (trash) return <Card className="project-card project-card--trash" key={item.id}><div className="project-card-top"><span className={`project-symbol${toneOf(item.color_key)}`} aria-hidden="true"><Icons.Folder width={24} height={24} /></span></div><Badge>Na lixeira</Badge><h2>{item.name}</h2><p>Itens e vínculos preservados.</p><footer><Button disabled={pending} onClick={() => { void mutate("project.restore", item.id); }}>Restaurar {item.name}</Button></footer></Card>;
        const projectTasks = tasks.data?.items.filter((task) => task.project_id === item.id && task.deleted_at === null && task.archived_at === null && task.status !== "archived") ?? [];
        const done = projectTasks.filter((task) => task.status === "done").length, percent = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0;
        const linked = containers.filter((row) => row.project_id === item.id && row.deleted_at === null);
        const counts = ([["capture", "captura", "capturas"], ["notebook", "caderno", "cadernos"], ["folder", "pasta", "pastas"]] as const).map(([kind, one, many]) => { const total = linked.filter((row) => row.kind === kind).length; return total ? `${total} ${total === 1 ? one : many}` : null; }).filter(Boolean);
        return <Link className="project-card" key={item.id} href={"/projetos?project=" + encodeURIComponent(item.id)}>
          <PrivateImage fileId={item.cover_file_id} userId={app.userId} className="project-cover" />
          <div className="project-card-top"><span className={`project-symbol${toneOf(item.color_key)}`} aria-hidden="true"><Icons.Folder width={24} height={24} /></span><Icons.ArrowUpRight width={20} height={20} /></div>
          <h2>{item.name}</h2>
          <p>{item.description || "Um contexto para reunir informações."}</p>
          {listProgress && tasks.data && <div className="project-progress"><div className="project-progress-label"><span>{projectTasks.length ? `${done} de ${projectTasks.length} ${projectTasks.length === 1 ? "tarefa" : "tarefas"}` : "Sem tarefas ainda"}</span>{projectTasks.length > 0 && <b>{percent}%</b>}</div><span className="project-progress-track" aria-hidden="true"><span style={{ inlineSize: `${percent}%` }} /></span></div>}
          <footer>{counts.length ? <span>{counts.join(" · ")}</span> : <span>Nenhum item vinculado</span>}<span className="project-card-open">Abrir projeto</span></footer>
        </Link>;
      })}</div> : <Card className="project-message"><h2>{trash ? "Lixeira vazia" : "Nenhum projeto por aqui"}</h2><p>{trash ? "Projetos excluídos podem ser restaurados aqui." : "Crie um projeto para reunir capturas, cadernos e pastas do mesmo esforço."}</p></Card>}
      {overlays}</div>;
  }
  function managedContainers(kind: ProjectContainer["kind"]) {
    const rows = containers.filter(row => row.kind === kind && row.project_id === project!.id && row.deleted_at === null), destination = kind === "capture" ? "/capturar?capture=" : kind === "notebook" ? "/conhecimento?notebook=" : "/drive?folder=";
    return <><div className="project-actions"><Button disabled={pending} onClick={(event) => edit({ kind: "container-create", project: project!, containerKind: kind }, event.currentTarget)}>Criar aqui</Button><Button disabled={pending} onClick={(event) => edit({ kind: "container-link", project: project!, containerKind: kind }, event.currentTarget)}>Vincular existente</Button></div>{rows.length ? <ul>{rows.map(row => <li className="project-container-row" key={row.id}><Link href={destination + encodeURIComponent(row.id)}>{row.name}</Link><Button variant="ghost" disabled={pending} aria-label={`Desvincular ${row.name}`} onClick={() => { void mutate("project.container.unlink", row.id); }}>Desvincular</Button></li>)}</ul> : <p>Nenhum item vinculado neste projeto.</p>}</>;
  }
  const doneTasks = taskItems.filter((item) => item.status === "done").length;
  const sideSections = [enabled("capturar"), enabled("conhecimento"), enabled("drive"), enabled("calendario")].some(Boolean);
  return <div className="projects-workspace" data-access="allowed"><Link className="project-back" href="/projetos"><Icons.ChevronLeft width={17} height={17} />Todos os projetos</Link>{failure && !removing && <p className="project-error" role="alert">{failure}</p>}
    <section className="project-heading project-hero" aria-labelledby="project-title"><PrivateImage fileId={project.cover_file_id} userId={app.userId} className="project-detail-cover" /><div className="project-hero-copy"><span className={`project-symbol${toneOf(project.color_key)}`} aria-hidden="true"><Icons.Folder width={24} height={24} /></span><h2 id="project-title">{project.name}</h2>{project.description && <p>{project.description}</p>}{enabled("tarefas") && tasks.data && taskItems.length > 0 && <ProgressBar label="Tarefas do projeto" value={doneTasks} max={taskItems.length} />}</div>
      <div className="project-actions"><Button disabled={pending} onClick={(event) => edit({ kind: "project", row: project }, event.currentTarget)}>Editar projeto</Button><Button disabled={pending} onClick={(event) => { trigger.current = event.currentTarget; setImageProject(project); }}>Editar capa</Button><Button variant="danger" disabled={pending} onClick={(event) => { trigger.current = event.currentTarget; setFailure(""); setRemoving(project); }}>Excluir projeto</Button></div></section>
    {app.mode === "connected" && enabled("configuracoes") && <Card><ProjectContextSection key={app.userId + ":" + project.id} userId={app.userId} projectId={project.id} /></Card>}
    {imageProject && <EntityImageEditor purpose="project_cover" entityId={imageProject.id} currentFileId={imageProject.cover_file_id ?? null} title="Capa do projeto" returnFocusRef={trigger} onClose={() => setImageProject(null)} onSaved={() => { query.retry(); toast({ message: "Capa do projeto atualizada." }); }} />}
    <div className="project-detail-grid" data-single={!enabled("tarefas") || !sideSections || undefined}>
    {enabled("tarefas") && <ProjectSection title="Tarefas" query={tasks}>{taskItems.length ? <ul>{taskItems.map((item) => <li key={item.id}><Link href={"/tarefas?task=" + encodeURIComponent(item.id)}><strong className={item.status === "done" ? "project-done" : undefined}>{item.title}</strong><span>{item.status === "done" ? "Concluída" : item.status === "in_progress" ? "Em andamento" : "A fazer"}</span></Link></li>)}</ul> : <p>Nenhuma tarefa neste projeto. <Link href="/tarefas">Abrir tarefas</Link></p>}</ProjectSection>}
    {sideSections && <div className="project-detail-side">
    {enabled("capturar") && <ProjectSection title="Capturas" query={query.data.containers ? query : captures}>{query.data.containers ? managedContainers("capture") : captureItems.length ? <ul>{captureItems.map((item) => <li key={item.id}><Link href={"/capturar?capture=" + encodeURIComponent(item.id)}>{item.title || "Captura sem título"}</Link></li>)}</ul> : <p>Nenhuma captura neste projeto. <Link href="/capturar">Abrir Capturar</Link></p>}</ProjectSection>}
    {enabled("conhecimento") && <ProjectSection title="Cadernos" query={query.data.containers ? query : knowledge}>{query.data.containers ? managedContainers("notebook") : notebooks.length ? <ul>{notebooks.map((item) => <li key={item.id}><Link href={"/conhecimento?notebook=" + encodeURIComponent(item.id)}>{item.name}</Link></li>)}</ul> : <p>Nenhum caderno neste projeto. <Link href="/conhecimento">Abrir Conhecimento</Link></p>}</ProjectSection>}
    {enabled("drive") && <ProjectSection title="Pastas" query={query.data.containers ? query : drive}>{query.data.containers ? managedContainers("folder") : folders.length ? <ul>{folders.map((item) => <li key={item.id}><Link href={"/drive?folder=" + encodeURIComponent(item.id)}>{item.name}</Link></li>)}</ul> : <p>Nenhuma pasta neste projeto. <Link href="/drive">Abrir Drive</Link></p>}</ProjectSection>}
    {enabled("calendario") && <ProjectSection title="Agenda vinculada" query={agenda}>{events.length ? <ul>{events.map((item) => <li key={item.id}><Link href={"/calendario?event=" + encodeURIComponent(item.id)}>{item.title}</Link></li>)}</ul> : <p>Nenhum evento vinculado às notas visíveis deste projeto. <Link href="/calendario">Abrir Calendário</Link></p>}</ProjectSection>}
  </div>}
  </div><RelatedPanel type="project" id={project.id} />{overlays}</div>;
}
