import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: auth.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: auth.services }));

// The route, gateway, store, Core projections and installed SDK remain real.
// Only Auth/configuration and the SDK network transport are substituted.
import { GET } from "../../src/app/api/knowledge/route";
import type { AlvoRelacionado, LeituraPaginaDTO, Pagina, RelacionadosDTO, SnapshotConhecimento } from "../../src/core/conhecimento";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";

const id = (value: number) => `28000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
const owner = id(1), session = id(2), book = id(3), destination = id(4);
const now = "2026-10-10T08:00:00Z";
const config: SupabaseAuthConfig = {
  mode: "supabase", appOrigin: "https://example.invalid",
  supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co",
  publishableKey: `sb_publishable_${"P".repeat(32)}`, secretKey: `sb_secret_${"S".repeat(32)}`,
  stateSecret: "a".repeat(32), rateLimitSecret: "b".repeat(32), secureCookies: true,
};
const identity: AuthenticatedIdentity = { userId: owner, sessionId: session, role: "user", mustChangePassword: false, entitlements: {} };

function page(pageId: string, title: string): Pagina {
  return {
    id: pageId, user_id: owner, notebook_id: book, parent_id: null, origin_capture_id: null,
    title, normalized_title: title.toLowerCase(),
    document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: title }] }] },
    content_text: title, version: 1, position: 0, archived_at: null, deleted_at: null, deletion_batch_id: null,
    created_at: now, updated_at: now,
  };
}

function fixture(size: number) {
  const state: SnapshotConhecimento = {
    revision: "8",
    notebooks: [{ id: book, user_id: owner, name: "Caderno", project_id: null, position: 0, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now }],
    pages: [page(destination, "Destino")], refs: [], links: [], targets: [], captures: [], receipts: [],
  };
  const backlinks: LeituraPaginaDTO["backlinks"] = [];
  const related: AlvoRelacionado[] = [];
  const items: RelacionadosDTO["items"] = [];
  for (let index = 0; index < size; index++) {
    const source = page(id(1000 + index), `Fonte ${index}`);
    source.document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "wikiLink", attrs: { target_id: destination, alias: "Destino" } }] }] };
    source.content_text = "Destino";
    state.pages.push(source);
    state.refs.push({ id: id(2000 + index), user_id: owner, page_id: source.id, target_id: destination, alias: "Destino", normalized_alias: "destino", created_at: now });
    backlinks.push({ id: source.id, title: source.title, notebook_id: book });

    const type = index % 2 === 0 ? "task" : "file";
    const target: AlvoRelacionado = { type, id: id(3000 + index), title: `Relacionado ${index}`, href: type === "task" ? `/tarefas?task=${id(3000 + index)}` : `/drive?file=${id(3000 + index)}` };
    const linkId = id(4000 + index);
    // Both incoming and outgoing links must be resolved from the same batch.
    state.links.push({ id: linkId, user_id: owner, from_type: index % 2 === 0 ? "page" : type, from_id: index % 2 === 0 ? destination : target.id, to_type: index % 2 === 0 ? type : "page", to_id: index % 2 === 0 ? target.id : destination, deleted_at: null, created_at: now, updated_at: now });
    state.targets.push(target); related.push(target); items.push({ ...target, link_id: linkId });
  }

  // Nonempty decoys prevent a one-request-but-empty/overbroad projection passing.
  const archived = { ...page(id(20000), "Fonte arquivada"), archived_at: now };
  const deleted = { ...page(id(20001), "Fonte na lixeira"), deleted_at: now, deletion_batch_id: id(20002) };
  const unrelated = page(id(20003), "Outra pagina"), otherDestination = page(id(20004), "Outro destino");
  state.pages.push(archived, deleted, unrelated, otherDestination);
  state.refs.push(
    { id: id(21000), user_id: owner, page_id: archived.id, target_id: destination, alias: "Destino", normalized_alias: "destino", created_at: now },
    { id: id(21001), user_id: owner, page_id: deleted.id, target_id: destination, alias: "Destino", normalized_alias: "destino", created_at: now },
    { id: id(21002), user_id: owner, page_id: unrelated.id, target_id: otherDestination.id, alias: "Outro destino", normalized_alias: "outro destino", created_at: now },
  );
  const ignored: AlvoRelacionado = { type: "task", id: id(22000), title: "Vinculo inativo", href: `/tarefas?task=${id(22000)}` };
  state.targets.push(ignored);
  state.links.push(
    { id: id(23000), user_id: owner, from_type: "page", from_id: destination, to_type: "task", to_id: ignored.id, deleted_at: now, created_at: now, updated_at: now },
    { id: id(23001), user_id: owner, from_type: "page", from_id: unrelated.id, to_type: "task", to_id: ignored.id, deleted_at: null, created_at: now, updated_at: now },
    { id: id(23002), user_id: owner, from_type: "page", from_id: destination, to_type: "file", to_id: id(24000), deleted_at: null, created_at: now, updated_at: now },
  );
  return { state, backlinks, related, items };
}

type Call = { pathname: string; body: unknown; method: string | undefined; cache: RequestCache | undefined };
let snapshot: SnapshotConhecimento;
const calls: Call[] = [];
const transport = vi.fn<typeof fetch>(async (input, options) => {
  const url = new URL(String(input));
  if (url.origin !== config.supabaseUrl || url.pathname !== "/rest/v1/rpc/knowledge_snapshot" || url.search) throw new Error("Unexpected fake Knowledge transport target");
  calls.push({ pathname: url.pathname, body: JSON.parse(String(options?.body)), method: options?.method, cache: options?.cache });
  return Response.json(snapshot);
});
const read = (query: string) => new Request(`${config.appOrigin}/api/knowledge?${query}`, { headers: { "X-Expected-User-ID": owner } });
const expectedCall: Call = { pathname: "/rest/v1/rpc/knowledge_snapshot", body: { p_user: owner, p_session: session, p_operation: "read.knowledge" }, method: "POST", cache: "no-store" };

beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0;
  auth.config.mockReturnValue(config);
  auth.services.mockResolvedValue({ gateway: { readIdentity: async () => identity } });
  vi.stubGlobal("fetch", transport);
});
afterEach(() => vi.unstubAllGlobals());

describe("Knowledge batch query contract through the installed SDK", () => {
  it.each([1, 150])("page backlinks and Related keep one adapter query each with %i active edges", async size => {
    const expected = fixture(size); snapshot = expected.state;
    const pageReply = await GET(read(`page=${destination}`));
    expect(pageReply.status).toBe(200);
    expect(await pageReply.json()).toEqual({ page: expected.state.pages[0], backlinks: expected.backlinks, related: expected.related });
    expect(calls).toEqual([expectedCall]);
    expect(transport).toHaveBeenCalledTimes(1);

    const relatedReply = await GET(read(`related_type=page&related_id=${destination}`));
    expect(relatedReply.status).toBe(200);
    expect(await relatedReply.json()).toEqual({ source: { type: "page", id: destination, title: "Destino", href: `/conhecimento?note=${destination}` }, items: expected.items });
    expect(calls).toEqual([expectedCall, expectedCall]);
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
