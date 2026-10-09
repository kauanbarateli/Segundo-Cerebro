"use client";

import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { normalizarTituloPagina, type DocumentoPagina, type Pagina } from "@/core/conhecimento";

const WikiLink = Node.create({
  name: "wikiLink", group: "inline", inline: true, atom: true,
  addAttributes() { return { target_id: { default: null }, alias: { default: "" } }; },
  parseHTML() { return [{ tag: "a[data-wiki]", getAttrs: element => ({ alias: (element as HTMLElement).textContent ?? "", target_id: (element as HTMLElement).dataset.wiki || null }) }]; },
  renderHTML({ node, HTMLAttributes }) { const id = node.attrs.target_id as string | null; return ["a", mergeAttributes(HTMLAttributes, { "data-wiki": id ?? "", href: id ? `/conhecimento?note=${encodeURIComponent(id)}` : undefined }), String(node.attrs.alias)]; },
});
export default function KnowledgeEditor({ document, pages, disabled, onChange, onCreateReference }: { document: DocumentoPagina; pages: Pagina[]; disabled?: boolean; onChange(value: DocumentoPagina): void; onCreateReference(alias: string, document: DocumentoPagina): Promise<void> }) {
  const [suggestion, setSuggestion] = useState<{ query: string; from: number; to: number } | null>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } } }), WikiLink],
    content: document, immediatelyRender: false, editable: !disabled,
    editorProps: { attributes: { "aria-label": "Conteúdo da página", role: "textbox", "aria-multiline": "true", spellcheck: "true" } },
    onUpdate({ editor: current }) {
      onChange(current.getJSON() as DocumentoPagina);
      const { $from } = current.state.selection; const before = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc"); const match = /\[\[([^\]\n]{0,200})$/.exec(before);
      setSuggestion(match ? { query: match[1]!, from: $from.pos - match[0].length, to: $from.pos } : null);
    },
    onSelectionUpdate({ editor: current }) { const { $from } = current.state.selection; const before = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc"); const match = /\[\[([^\]\n]{0,200})$/.exec(before); setSuggestion(match ? { query: match[1]!, from: $from.pos - match[0].length, to: $from.pos } : null); },
  });
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  const matches = suggestion ? pages.filter(page => !page.deleted_at && !page.archived_at && normalizarTituloPagina(page.title).includes(normalizarTituloPagina(suggestion.query))).slice(0, 8) : [];
  function choose(page: Pagina) { if (!editor || !suggestion) return; editor.chain().focus().insertContentAt({ from: suggestion.from, to: suggestion.to }, { type: "wikiLink", attrs: { target_id: page.id, alias: page.title } }).run(); setSuggestion(null); }
  async function create() { if (!editor || !suggestion?.query.trim()) return; const alias = suggestion.query.trim(); editor.chain().focus().insertContentAt({ from: suggestion.from, to: suggestion.to }, { type: "text", text: `[[${alias}]]` }).run(); setSuggestion(null); await onCreateReference(alias, editor.getJSON() as DocumentoPagina); }
  return <div className="knowledge-editor">
    <div className="knowledge-toolbar" role="toolbar" aria-label="Formatação do texto">
      <Button variant="ghost" disabled={disabled || !editor} aria-pressed={editor?.isActive("bold") ?? false} onClick={() => editor?.chain().focus().toggleBold().run()}>Negrito</Button>
      <Button variant="ghost" disabled={disabled || !editor} aria-pressed={editor?.isActive("italic") ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()}>Itálico</Button>
      <Button variant="ghost" disabled={disabled || !editor} aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>Título</Button>
      <Button variant="ghost" disabled={disabled || !editor} aria-pressed={editor?.isActive("bulletList") ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()}>Lista</Button>
      <Button variant="ghost" disabled={disabled || !editor} onClick={() => editor?.chain().focus().undo().run()}>Desfazer</Button>
      <Button variant="ghost" disabled={disabled || !editor} onClick={() => editor?.chain().focus().redo().run()}>Refazer</Button>
    </div>
    <EditorContent editor={editor} />
    <p className="knowledge-editor-hint">Digite [[ para conectar uma página. Confirme um destino existente ou crie a página pela sugestão.</p>
    {suggestion && <div className="knowledge-wiki-suggestions" role="region" aria-label="Sugestões de páginas">
      {matches.map(page => <Button key={page.id} variant="ghost" onClick={() => choose(page)}>{page.title}</Button>)}
      {suggestion.query.trim() && !pages.some(page => !page.deleted_at && page.normalized_title === normalizarTituloPagina(suggestion.query)) && <Button variant="primary" disabled={disabled} onClick={() => void create()}>Criar página “{suggestion.query.trim()}”</Button>}
      {!matches.length && !suggestion.query.trim() && <p>Digite o nome da página.</p>}
      <Button variant="ghost" onClick={() => setSuggestion(null)}>Fechar sugestões</Button>
    </div>}
  </div>;
}
