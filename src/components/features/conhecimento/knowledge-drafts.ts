import type { DocumentoPagina } from "@/core/conhecimento";
import { DEMO_LOGOUT_EVENT } from "@/lib/demo/demo-provider";

export interface KnowledgeDraftFields {
  title: string;
  document: DocumentoPagina;
  notebook: string;
  parent: string;
}
export interface KnowledgeDraft extends KnowledgeDraftFields {
  version: number;
  saved: KnowledgeDraftFields;
}
export interface KnowledgeDraftSession {
  read(pageId: string): KnowledgeDraft | null;
  write(pageId: string, draft: KnowledgeDraft): void;
  remove(pageId: string): void;
  revoke(): void;
  isClosed(): boolean;
}
type Sender = (command: string, input: unknown) => Promise<unknown>;
type DraftScope = { owner: string; sender: Sender; target: Window; session: KnowledgeDraftSession; close(): void };
const scopes = new WeakMap<Sender, DraftScope>();
let active: WeakRef<DraftScope> | null = null;
const revoked = new WeakSet<Sender>();

function listenForLogout(owner: string, target: Window, scope: WeakRef<DraftScope>) {
  const listener = (event: Event) => {
    const current = scope.deref();
    if (!current) { target.removeEventListener(DEMO_LOGOUT_EVENT, listener); return; }
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (detail && typeof detail === "object" && "userId" in detail && detail.userId === owner) current.close();
  };
  target.addEventListener(DEMO_LOGOUT_EVENT, listener);
  return () => target.removeEventListener(DEMO_LOGOUT_EVENT, listener);
}

/** Navigation survives; reload and ending/changing the account discard clear text. */
export function knowledgeDraftSession(owner: string, sender: Sender): KnowledgeDraftSession {
  const target = typeof window === "undefined" ? null : window;
  const previous = active?.deref();
  if (target && previous?.owner === owner && previous.sender === sender && previous.target === target && !previous.session.isClosed()) return previous.session;
  if (target) { previous?.close(); active = null; }
  const drafts = new Map<string, KnowledgeDraft>();
  let closed = revoked.has(sender);
  const session: KnowledgeDraftSession = {
    read: pageId => !closed && drafts.has(pageId) ? structuredClone(drafts.get(pageId)!) : null,
    write(pageId, draft) { if (!closed) drafts.set(pageId, structuredClone(draft)); },
    remove(pageId) { drafts.delete(pageId); },
    revoke: () => close(),
    isClosed: () => closed,
  };
  let stopLogout: (() => void) | undefined;
  const close = () => { closed = true; drafts.clear(); revoked.add(sender); scopes.delete(sender); stopLogout?.(); if (active?.deref()?.session === session) active = null; };
  // Remains attached while another route is open so logout still clears drafts.
  // Removed on logout or when a different app session opens Knowledge.
  if (target && !closed) {
    const scope = { owner, sender, target, session, close };
    scopes.set(sender, scope); active = new WeakRef(scope);
    // A listener never keeps the app, sender or clear text alive after its
    // provider becomes unreachable, even if logout could not run first.
    stopLogout = listenForLogout(owner, target, new WeakRef(scope));
  }
  return session;
}
