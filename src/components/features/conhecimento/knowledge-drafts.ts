import type { ConhecimentoDTO, DocumentoPagina, Pagina } from "@/core/conhecimento";
import { DEMO_LOGOUT_EVENT } from "@/lib/demo/demo-provider";

/** Inputs are complete saved server snapshots, never editable draft fields. */
export function selectKnowledgeSavedPage(page: Pagina, adopted: Pagina | null): Pagina {
  return adopted?.id === page.id && adopted.user_id === page.user_id && adopted.version > page.version ? adopted : page;
}
/** Reconcile one confirmed/adopted page in the workspace owner, not an editor cache. */
export function adoptKnowledgeSavedPage(data: ConhecimentoDTO | null, page: Pagina, owner: string): ConhecimentoDTO | null {
  if (!data || page.user_id !== owner) return data;
  const previous = data.pages.find(item => item.id === page.id && item.user_id === owner);
  if (!previous || page.version <= previous.version) return data;
  return { ...data, pages: data.pages.map(item => item === previous ? page : item) };
}
/** Publish a validated read without regressing already known newer page versions.
 * Missing rows stay missing; this is not realtime, an extra read or a global cache. */
export function mergeKnowledgeSavedPages(current: ConhecimentoDTO | null, snapshot: ConhecimentoDTO, owner: string): ConhecimentoDTO {
  if (!current) return snapshot;
  let changed = false;
  const pages = snapshot.pages.map(page => {
    const previous = page.user_id === owner ? current.pages.find(item => item.id === page.id && item.user_id === owner) ?? null : null;
    const saved = selectKnowledgeSavedPage(page, previous); changed ||= saved !== page; return saved;
  });
  return changed ? { ...snapshot, pages } : snapshot;
}
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
