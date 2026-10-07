"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/data-display";
import type { ReactNode } from "react";
import "./projects.css";

interface State { status: string; data: unknown; error: string | null; retry(): void }
function ProjectSection({ title, query, children }: { title: string; query: State; children: ReactNode }) {
  return <Card className="project-section"><h3>{title}</h3>{query.status === "error" ? <><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo: {title}</Button></> : !query.data ? <div className="project-section-skeleton" role="status" aria-label={"Carregando " + title}><i /><i /><i /></div> : children}</Card>;
}
export function ProjectsSkeleton() {
  return <div className="projects-grid" role="status" aria-label="Carregando projetos">{[0, 1].map((value) => <div className="project-skeleton" key={value} aria-hidden="true"><i /><i /><i /></div>)}</div>;
}
export function ProjectsWorkspace() {
  const query = useDemoQuery("projects"), params = useSearchParams(), id = params.get("project");
  const { policy, ready } = useDemoAccess();
  const enabled = (feature: FeatureKey) => !!query.data?.items.some((item) => item.id === id && item.deleted_at === null) && ready && resolveAccess(feature, policy).allowed && resolveAccess(feature, policy).visible;
  const tasks = useDemoQuery("tasks", enabled("tarefas")), captures = useDemoQuery("captures", enabled("capturar"));
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
  if (!project) return <div className="projects-workspace" data-access="allowed">{query.data.items.length ? <div className="projects-grid">{[...query.data.items].filter((item) => item.deleted_at === null).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map((item) => <Link className="project-card" key={item.id} href={"/projetos?project=" + encodeURIComponent(item.id)}><h2>{item.name}</h2><p>{item.description || "Um contexto para reunir informações."}</p><span>Abrir projeto →</span></Link>)}</div> : <Card className="project-message"><h2>Nenhum projeto por aqui</h2><p>A organização de projetos estará disponível em uma próxima etapa. Você pode explorar as tarefas e capturas existentes pela navegação.</p></Card>}</div>;
  return <div className="projects-workspace" data-access="allowed"><Link className="project-back" href="/projetos">← Todos os projetos</Link><div className="project-heading"><h2>{project.name}</h2><p>{project.description}</p>{enabled("tarefas") && tasks.data && taskItems.length > 0 && <ProgressBar label="Tarefas do projeto" value={taskItems.filter((item) => item.status === "done").length} max={taskItems.length} />}</div><div className="projects-grid project-detail-grid">
    {enabled("tarefas") && <ProjectSection title="Tarefas" query={tasks}>{taskItems.length ? <ul>{taskItems.map((item) => <li key={item.id}><Link href={"/tarefas?task=" + encodeURIComponent(item.id)}><strong>{item.title}</strong><span>{item.status === "done" ? "Concluída" : item.status === "in_progress" ? "Em andamento" : "A fazer"}</span></Link></li>)}</ul> : <p>Nenhuma tarefa neste projeto. <Link href="/tarefas">Abrir tarefas</Link></p>}</ProjectSection>}
    {enabled("capturar") && <ProjectSection title="Capturas" query={captures}>{captureItems.length ? <ul>{captureItems.map((item) => <li key={item.id}><Link href={"/capturar?capture=" + encodeURIComponent(item.id)}>{item.title || "Captura sem título"}</Link></li>)}</ul> : <p>Nenhuma captura neste projeto. <Link href="/capturar">Abrir Capturar</Link></p>}</ProjectSection>}
    {enabled("conhecimento") && <ProjectSection title="Cadernos" query={knowledge}>{notebooks.length ? <ul>{notebooks.map((item) => <li key={item.id}><Link href={"/conhecimento?notebook=" + encodeURIComponent(item.id)}>{item.name}</Link></li>)}</ul> : <p>Nenhum caderno neste projeto. <Link href="/conhecimento">Abrir Conhecimento</Link></p>}</ProjectSection>}
    {enabled("drive") && <ProjectSection title="Pastas" query={drive}>{folders.length ? <ul>{folders.map((item) => <li key={item.id}><Link href={"/drive?folder=" + encodeURIComponent(item.id)}>{item.name}</Link></li>)}</ul> : <p>Nenhuma pasta neste projeto. <Link href="/drive">Abrir Drive</Link></p>}</ProjectSection>}
    {enabled("calendario") && <ProjectSection title="Agenda vinculada" query={agenda}>{events.length ? <ul>{events.map((item) => <li key={item.id}><Link href={"/calendario?event=" + encodeURIComponent(item.id)}>{item.title}</Link></li>)}</ul> : <p>Nenhum evento vinculado às notas visíveis deste projeto. <Link href="/calendario">Abrir Calendário</Link></p>}</ProjectSection>}
  </div></div>;
}
