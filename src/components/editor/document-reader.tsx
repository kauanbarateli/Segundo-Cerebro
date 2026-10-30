import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";
import { validarDocumento, type BlocoDocumento, type DocumentoPagina } from "@/core/contracts/rich-document";
import "./document-editor.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const alignments = ["left", "center", "right", "justify"];
function safeLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

/** Render the persisted allowlisted document as React nodes, without an editor or writes. */
export default function DocumentReader({ document, label = "Conteúdo da página" }: { document: DocumentoPagina; label?: string }) {
  try { validarDocumento(document); } catch { return <p role="alert">Não foi possível apresentar este conteúdo. Atualize a página para tentar novamente.</p>; }
  function render(node: BlocoDocumento, key: string): ReactNode {
    const children = node.content?.map((child, index) => render(child, `${key}.${index}`));
    const style: CSSProperties | undefined = alignments.includes(String(node.attrs?.textAlign)) ? { textAlign: node.attrs!.textAlign as CSSProperties["textAlign"] } : undefined;
    switch (node.type) {
      case "text": {
        let text: ReactNode = node.text;
        for (const [index, mark] of (node.marks ?? []).entries()) {
          const markKey = `${key}.mark${index}`;
          if (mark.type === "bold") text = <strong key={markKey}>{text}</strong>;
          else if (mark.type === "italic") text = <em key={markKey}>{text}</em>;
          else if (mark.type === "strike") text = <s key={markKey}>{text}</s>;
          else if (mark.type === "underline") text = <u key={markKey}>{text}</u>;
          else if (mark.type === "code") text = <code key={markKey}>{text}</code>;
          else if (mark.type === "link") { const href = safeLink(mark.attrs?.href); if (href) text = <a key={markKey} href={href} target="_blank" rel="noopener noreferrer">{text}</a>; }
        }
        return <Fragment key={key}>{text}</Fragment>;
      }
      case "paragraph": return <p key={key} style={style}>{children?.length ? children : <br />}</p>;
      case "heading": { const Heading = node.attrs?.level === 1 ? "h2" : node.attrs?.level === 2 ? "h3" : "h4"; return <Heading key={key} style={style}>{children}</Heading>; }
      case "bulletList": return <ul key={key}>{children}</ul>;
      case "orderedList": return <ol key={key} start={Number(node.attrs?.start) || 1}>{children}</ol>;
      case "listItem": return <li key={key}>{children}</li>;
      case "taskList": return <ul key={key} className="document-read-checklist">{children}</ul>;
      case "taskItem": return <li key={key}><span className="document-read-check" role="img" aria-label={node.attrs?.checked ? "Concluído" : "Não concluído"}>{node.attrs?.checked && <Icons.Check width={16} height={16} />}</span><div>{children}</div></li>;
      case "blockquote": return <blockquote key={key}>{children}</blockquote>;
      case "codeBlock": return <pre key={key}><code>{children}</code></pre>;
      case "hardBreak": return <br key={key} />;
      case "horizontalRule": return <hr key={key} />;
      case "wikiLink": case "captureLink": {
        const id = node.attrs?.target_id, alias = String(node.attrs?.alias ?? "");
        return typeof id === "string" && uuid.test(id) ? <Link key={key} href={node.type === "wikiLink" ? `/conhecimento?note=${encodeURIComponent(id)}` : `/capturar?capture=${encodeURIComponent(id)}`}>{alias}</Link> : <span key={key} className="document-unresolved" title="Referência ainda não conectada">{alias}</span>;
      }
      default: return <Fragment key={key}>{children}</Fragment>;
    }
  }
  return <div className="document-reader" aria-label={label}>{document.content.map((node, index) => render(node, String(index)))}</div>;
}
