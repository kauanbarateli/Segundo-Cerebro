"use client";

import { Collapsible } from "@/components/ui/data-display";
import { Field } from "@/components/ui/field";
import type { DemoQueries } from "@/lib/demo/types";
import { TYPE_LABELS, type CaptureDraft } from "./model";

/** "Configurações da nota": type, category and project, on demand. */
export function CaptureSettings({ draft, categories, projects, onChange }: {
  draft: CaptureDraft;
  categories: DemoQueries["captures"]["categories"];
  projects: DemoQueries["captures"]["projects"];
  onChange(patch: Partial<CaptureDraft>): void;
}) {
  return <Collapsible title="Configurações da nota"><div className="capture-metadata">
    <Field as="select" label="Tipo" value={draft.type} onChange={(event) => onChange({ type: event.target.value as CaptureDraft["type"] })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Field>
    <Field as="select" label="Categoria" value={draft.category_id ?? ""} onChange={(event) => onChange({ category_id: event.target.value || null })}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Field>
    <Field as="select" label="Projeto" value={draft.project_id ?? ""} onChange={(event) => onChange({ project_id: event.target.value || null })}><option value="">Nenhum</option>{projects.filter((project) => !project.deleted_at || project.id === draft.project_id).map((project) => <option key={project.id} value={project.id}>{project.name}{project.deleted_at ? " · excluído" : ""}</option>)}</Field>
  </div>{draft.type === "reminder" && <p className="capture-hint">Lembrete classifica a anotação. Avisos agendados ainda não estão disponíveis.</p>}</Collapsible>;
}
