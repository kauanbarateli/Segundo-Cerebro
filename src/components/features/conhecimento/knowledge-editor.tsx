"use client";

import DocumentEditor from "@/components/editor/document-editor";
import type { DocumentoPagina, Pagina } from "@/core/conhecimento";

export default function KnowledgeEditor({ document, pages, disabled, onChange, onCreateReference }: {
  document: DocumentoPagina; pages: Pagina[]; disabled?: boolean; onChange(value: DocumentoPagina): void;
  onCreateReference(alias: string, document: DocumentoPagina): Promise<void>;
}) {
  return <div className="knowledge-editor"><DocumentEditor document={document} label="Conteúdo da página" referenceKind="page"
    references={pages.filter(page => !page.deleted_at && !page.archived_at).map(page => ({ id: page.id, title: page.title }))}
    disabled={disabled} onChange={onChange} onCreateReference={onCreateReference} /></div>;
}
