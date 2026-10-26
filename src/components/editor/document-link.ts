import Link from "@tiptap/extension-link";
import type { Attributes } from "@tiptap/core";

/** Persist only the four link attributes already accepted by the domain/SQL.
 * TipTap3.31 adds title:null by default; that presentation attribute must not
 * widen the persisted document contract or make every new link invalid.
 */
export const DocumentLink = Link.extend({
  addAttributes() {
    const attributes: Attributes = this.parent?.() ?? {};
    if (!attributes?.href || !attributes.target || !attributes.rel || !attributes.class) throw new Error("The document link schema is unavailable.");
    return { href: attributes.href, target: attributes.target, rel: attributes.rel, class: attributes.class };
  },
});
