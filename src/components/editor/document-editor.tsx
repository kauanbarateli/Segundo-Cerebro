"use client";

import { useEffect, useRef, useState } from "react";
import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { DocumentoPagina } from "@/core/contracts/rich-document";
import "./document-editor.css";

const alignments = ["left", "center", "right", "justify"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function safeDocumentLink(value: string): string | null {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
const Alignment = Extension.create({
  name: "documentAlignment",
  addGlobalAttributes() { return [{ types: ["paragraph", "heading"], attributes: { textAlign: {
    default: null,
    parseHTML: element => alignments.includes(element.style.textAlign) ? element.style.textAlign : null,
    renderHTML: attributes => alignments.includes(attributes.textAlign) ? { style: `text-align: ${attributes.textAlign}` } : {},
  } } }]; },
});
const CaptureLink = Node.create({
  name: "captureLink", group: "inline", inline: true, atom: true,
  addAttributes() { return { target_id: { default: null }, alias: { default: "" } }; },
  parseHTML() { return [{ tag: "a[data-capture-link]", getAttrs: element => { const dom = element as HTMLElement; return { alias: dom.textContent ?? "", target_id: uuid.test(dom.dataset.captureLink ?? "") ? dom.dataset.captureLink : null }; } }]; },
  renderHTML({ node }) { const id = typeof node.attrs.target_id === "string" && uuid.test(node.attrs.target_id) ? node.attrs.target_id : null;
    return ["a", { "data-capture-link": id ?? "", href: id ? `/capturar?capture=${encodeURIComponent(id)}` : undefined }, String(node.attrs.alias)]; },
});
const WikiLink = Node.create({
  name: "wikiLink", group: "inline", inline: true, atom: true,
  addAttributes() { return { target_id: { default: null }, alias: { default: "" } }; },
  parseHTML() { return [{ tag: "a[data-wiki]", getAttrs: element => { const dom = element as HTMLElement; return { alias: dom.textContent ?? "", target_id: uuid.test(dom.dataset.wiki ?? "") ? dom.dataset.wiki : null }; } }]; },
  renderHTML({ node }) { const id = typeof node.attrs.target_id === "string" && uuid.test(node.attrs.target_id) ? node.attrs.target_id : null;
    return ["a", { "data-wiki": id ?? "", href: id ? `/conhecimento?note=${encodeURIComponent(id)}` : undefined }, String(node.attrs.alias)]; },
});
const TaskList = Node.create({
  name: "taskList", group: "block list", content: "taskItem+",
  parseHTML() { return [{ tag: 'ul[data-type="taskList"]', priority: 100 }]; },
  renderHTML({ HTMLAttributes }) { return ["ul", mergeAttributes(HTMLAttributes, { "data-type": "taskList" }), 0]; },
});
const TaskItem = Node.create({
  name: "taskItem", defining: true, content: "paragraph block*",
  addAttributes() { return { checked: { default: false, parseHTML: element => element.getAttribute("data-checked") === "true" } }; },
  parseHTML() { return [{ tag: 'li[data-type="taskItem"]', priority: 100 }]; },
  renderHTML({ node }) { return ["li", { "data-type": "taskItem", "data-checked": node.attrs.checked ? "true" : "false" }, ["label", { contenteditable: "false" }, ["input", { type: "checkbox", checked: node.attrs.checked ? "checked" : undefined, "aria-label": "Item concluído" }]], ["div", {}, 0]]; },
  addKeyboardShortcuts() { return { Enter: () => this.editor.commands.splitListItem(this.name), "Shift-Tab": () => this.editor.commands.liftListItem(this.name), Tab: () => this.editor.commands.sinkListItem(this.name) }; },
  addNodeView() { return ({ node, editor, getPos }) => {
    let current = node;
    const dom = globalThis.document.createElement("li"), label = globalThis.document.createElement("label"), checkbox = globalThis.document.createElement("input"), contentDOM = globalThis.document.createElement("div");
    dom.dataset.type = "taskItem"; dom.dataset.checked = node.attrs.checked ? "true" : "false"; label.contentEditable = "false"; checkbox.type = "checkbox"; checkbox.setAttribute("aria-label", "Item concluído");
    checkbox.checked = node.attrs.checked === true; checkbox.disabled = !editor.isEditable; label.append(checkbox); dom.append(label, contentDOM);
    const change = () => { const position = getPos(); if (!editor.isEditable || typeof position !== "number") { checkbox.checked = current.attrs.checked === true; return; }
      editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(position, undefined, { ...current.attrs, checked: checkbox.checked }); return true; }).run(); };
    const editable = () => { checkbox.disabled = !editor.isEditable; };
    checkbox.addEventListener("change", change); editor.on("update", editable); editor.on("transaction", editable);
    return { dom, contentDOM, update(next) { if (next.type !== current.type) return false; current = next; checkbox.checked = next.attrs.checked === true; checkbox.disabled = !editor.isEditable; dom.dataset.checked = next.attrs.checked ? "true" : "false"; return true; },
      stopEvent: event => event.target === checkbox || event.target === label, destroy() { checkbox.removeEventListener("change", change); editor.off("update", editable); editor.off("transaction", editable); } };
  }; },
});
type Reference = { id: string; title: string };
export type DocumentReferenceCommand = (reference: Reference) => boolean;
type Suggestion = { query: string; from: number; to: number };
export interface DocumentEditorProps {
  document: DocumentoPagina; references: Reference[]; referenceKind: "page" | "capture"; disabled?: boolean; label: string;
  onChange(document: DocumentoPagina): void;
  onCreateReference?(alias: string, document: DocumentoPagina): Promise<void>;
  onReferenceCommand?(command: DocumentReferenceCommand | null): void;
}
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** One editor/schema for both surfaces; no feature, storage, HTML payload or SDK. */
export default function DocumentEditor({ document, references, referenceKind, disabled, label, onChange, onCreateReference, onReferenceCommand }: DocumentEditorProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null), [linkOpen, setLinkOpen] = useState(false), [href, setHref] = useState(""), [error, setError] = useState("");
  const [, renderToolbar] = useState(0);
  const linkInput = useRef<HTMLInputElement>(null), openLink = useRef<() => void>(() => {});
  const updateSuggestion = (current: Editor) => { const { $from } = current.state.selection; const before = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc"), match = /\[\[([^\]\n]{0,200})$/.exec(before);
    setSuggestion(match ? { query: match[1]!, from: $from.pos - match[0].length, to: $from.pos } : null); };
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: url => safeDocumentLink(url) !== null, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }), Alignment, TaskList, TaskItem, WikiLink, CaptureLink],
    content: document, immediatelyRender: false, editable: !disabled,
    editorProps: { attributes: { "aria-label": label, role: "textbox", "aria-multiline": "true", spellcheck: "true" },
      handleKeyDown(_view, event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); openLink.current(); return true; } return false; },
    },
    onUpdate({ editor: current }) { onChange(current.getJSON() as DocumentoPagina); updateSuggestion(current); },
    onSelectionUpdate({ editor: current }) { updateSuggestion(current); },
    onTransaction() { renderToolbar(value => value + 1); },
  });
  openLink.current = () => { if (!editor || disabled) return; setHref(String(editor.getAttributes("link").href ?? "")); setError(""); setLinkOpen(true); };
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Editability is UI state, never a content update/autosave. Node views own
    // their native controls, so update disabled without emitting onChange.
    editor.setEditable(!disabled, false);
    for (const control of editor.view.dom.querySelectorAll<HTMLInputElement>('li[data-type="taskItem"] > label > input[type="checkbox"]')) control.disabled = !editor.isEditable;
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor || !onReferenceCommand) return;
    onReferenceCommand(reference => !disabled && editor.chain().focus().insertContent(uuid.test(reference.id) ? { type: referenceKind === "page" ? "wikiLink" : "captureLink", attrs: { target_id: reference.id, alias: reference.title } } : { type: "text", text: `[[${reference.title}]]` }).run());
    return () => onReferenceCommand(null);
  }, [editor, disabled, referenceKind, onReferenceCommand]);
  useEffect(() => { if (linkOpen) linkInput.current?.focus(); }, [linkOpen]);
  const matches = suggestion ? references.filter(item => normalized(item.title).includes(normalized(suggestion.query))).slice(0, 8) : [];
  function choose(item: Reference) { if (!editor || !suggestion || disabled) return;
    editor.chain().focus().insertContentAt({ from: suggestion.from, to: suggestion.to }, uuid.test(item.id) ? { type: referenceKind === "page" ? "wikiLink" : "captureLink", attrs: { target_id: item.id, alias: item.title } } : { type: "text", text: `[[${item.title}]]` }).run(); setSuggestion(null); }
  async function createReference() { if (!editor || !suggestion?.query.trim() || !onCreateReference || disabled) return; const alias = suggestion.query.trim();
    editor.chain().focus().insertContentAt({ from: suggestion.from, to: suggestion.to }, { type: "text", text: `[[${alias}]]` }).run(); setSuggestion(null); await onCreateReference(alias, editor.getJSON() as DocumentoPagina); }
  function link() { const destination = safeDocumentLink(href); if (!destination) { setError("Use um endereço HTTP ou HTTPS, sem credenciais ou espaços."); linkInput.current?.focus(); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: destination, target: "_blank", rel: "noopener noreferrer" }).run(); setLinkOpen(false); }
  const commands: { label: string; active?: boolean; run(): void }[] = [
    { label: "Negrito", active: editor?.isActive("bold"), run: () => { editor?.chain().focus().toggleBold().run(); } },
    { label: "Itálico", active: editor?.isActive("italic"), run: () => { editor?.chain().focus().toggleItalic().run(); } },
    { label: "Sublinhado", active: editor?.isActive("underline"), run: () => { editor?.chain().focus().toggleUnderline().run(); } },
    { label: "Tachado", active: editor?.isActive("strike"), run: () => { editor?.chain().focus().toggleStrike().run(); } },
    { label: "Título", active: editor?.isActive("heading", { level: 2 }), run: () => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); } },
    { label: "Lista", active: editor?.isActive("bulletList"), run: () => { editor?.chain().focus().toggleBulletList().run(); } },
    { label: "Lista numerada", active: editor?.isActive("orderedList"), run: () => { editor?.chain().focus().toggleOrderedList().run(); } },
    { label: "Checklist", active: editor?.isActive("taskList"), run: () => { editor?.chain().focus().toggleList("taskList", "taskItem").run(); } },
    { label: "Citação", active: editor?.isActive("blockquote"), run: () => { editor?.chain().focus().toggleBlockquote().run(); } },
  ];
  return <div className="document-editor">
    <div className="document-toolbar" role="toolbar" aria-label="Formatação do texto">
      {commands.map(command => <Button key={command.label} variant="ghost" disabled={disabled || !editor} aria-pressed={command.active ?? false} onMouseDown={event => event.preventDefault()} onClick={command.run}>{command.label}</Button>)}
      <label className="document-alignment">Alinhamento<select aria-label="Alinhamento do parágrafo" value={editor?.getAttributes("paragraph").textAlign ?? editor?.getAttributes("heading").textAlign ?? "left"} disabled={disabled || !editor} onChange={event => { const type = editor?.isActive("heading") ? "heading" : "paragraph"; editor?.chain().focus().updateAttributes(type, { textAlign: event.target.value }).run(); }}><option value="left">À esquerda</option><option value="center">Centralizado</option><option value="right">À direita</option><option value="justify">Justificado</option></select></label>
      <Button variant="ghost" disabled={disabled || !editor} aria-expanded={linkOpen} onMouseDown={event => event.preventDefault()} onClick={() => openLink.current()}>Link</Button>
      <Button variant="ghost" disabled={disabled || !editor || !editor.can().undo()} onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}>Desfazer</Button>
      <Button variant="ghost" disabled={disabled || !editor || !editor.can().redo()} onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}>Refazer</Button>
    </div>
    {linkOpen && <div className="document-link" role="group" aria-label="Editar link" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setLinkOpen(false); editor?.commands.focus(); } }}>
      <Field ref={linkInput} label="Endereço do link" type="url" value={href} onChange={event => setHref(event.target.value)} error={error || undefined} disabled={disabled} />
      <Button disabled={disabled} onClick={link}>Aplicar link</Button><Button variant="ghost" disabled={disabled} onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>Remover link</Button><Button variant="ghost" onClick={() => { setLinkOpen(false); editor?.commands.focus(); }}>Cancelar link</Button>
    </div>}
    <EditorContent editor={editor} />
    <p className="document-hint">Digite [[ para conectar {referenceKind === "page" ? "uma página" : "uma captura"}. Ctrl/Cmd + K insere um link.</p>
    {suggestion && <div className="document-suggestions" role="region" aria-label={referenceKind === "page" ? "Sugestões de páginas" : "Sugestões de capturas"}>
      {matches.map(item => <Button key={item.id} variant="ghost" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>{item.title}</Button>)}
      {onCreateReference && suggestion.query.trim() && !references.some(item => normalized(item.title) === normalized(suggestion.query.trim())) && <Button disabled={disabled} onClick={() => void createReference()}>Criar página “{suggestion.query.trim()}”</Button>}
      {!matches.length && <p>{suggestion.query.trim() ? "Nenhum destino encontrado. Você pode manter o texto e conectar depois." : "Digite o nome do destino."}</p>}
      <Button variant="ghost" onClick={() => { setSuggestion(null); editor?.commands.focus(); }}>Fechar sugestões</Button>
    </div>}
  </div>;
}
