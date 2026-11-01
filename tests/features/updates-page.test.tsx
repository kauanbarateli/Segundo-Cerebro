import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const guards = vi.hoisted(() => ({ requireUser: vi.fn() }));
const capabilities = vi.hoisted(() => ({ frontB: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: guards.requireUser }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfiguration: () => ({ mode: "supabase" }) }));
vi.mock("@/lib/access/front-b-capabilities-server", () => ({ frontBCapabilities: capabilities.frontB }));
import UpdatesPage from "../../src/app/(workspace)/atualizacoes/page";
import { UpdatesBoard } from "../../src/components/features/atualizacoes/updates-board";
import { updateEvidenceHref, validateUpdateEntries, type UpdateItem } from "../../src/components/features/atualizacoes/content";

describe("atualizações autenticadas", () => {
  beforeEach(() => { guards.requireUser.mockReset(); capabilities.frontB.mockReturnValue({ schema: false }); });

  it("recusa a página quando a sessão é recusada", async () => {
    guards.requireUser.mockRejectedValue(new Error("redirect:/entrar"));
    await expect(UpdatesPage()).rejects.toThrow("redirect:/entrar");
    expect(guards.requireUser).toHaveBeenCalledOnce();
  });

  it("mostra os cinco estados e o vazio para uma sessão válida", async () => {
    guards.requireUser.mockResolvedValue({ userId: "test-user" });
    const html = renderToStaticMarkup(await UpdatesPage());
    for (const label of ["Planejado", "Em análise", "Em andamento", "Em fase de testes", "Lançado"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/Nenhuma atualização nesta etapa\./g)).toHaveLength(5);
    expect(html).toContain('for="updates-stage"');
    expect(html).toContain('id="updates-stage"');
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(html.match(/data-active="false"/g)).toHaveLength(4);
    expect(html).not.toContain("Enviar sugestão");
  });

  it("oferece sugestões apenas quando o feedback está disponível", async () => {
    guards.requireUser.mockResolvedValue({ userId: "test-user" });
    capabilities.frontB.mockReturnValue({ schema: true });
    const html = renderToStaticMarkup(await UpdatesPage());
    expect(html).toContain('href="/feedback"');
    expect(html).toContain("Enviar sugestão");
  });

  it("liga entregas lançadas à evidência segura", () => {
    const html = renderToStaticMarkup(<UpdatesBoard entries={[{ id: "u1", title: "Novo calendário", summary: "Disponível.", state: "released", updatedAt: "2026-10-31", order: 1, evidence: "/calendario" }]} />);
    expect(html).toContain('href="/calendario"');
    expect(html).toContain('aria-label="Ver entrega: Novo calendário"');
    expect(updateEvidenceHref("https://example.org/entrega")).toBe("https://example.org/entrega");
    for (const unsafe of ["javascript:alert(1)", "//example.org/", "https://user:secret@example.org/", "/\\example.org", "not-a-url"]) expect(updateEvidenceHref(unsafe)).toBeNull();
  });

  it("recusa conteúdo lançado sem uma referência segura", () => {
    for (const evidence of ["", "javascript:alert(1)", "//example.org/"]) {
      expect(() => renderToStaticMarkup(<UpdatesBoard entries={[{ id: "u1", title: "Entrega", summary: "Conteúdo", state: "released", updatedAt: "2026-10-31", order: 1, evidence }]} />)).toThrow("Atualização lançada exige um link de entrega válido.");
    }
  });

  it("valida datas reais e identificadores editoriais antes de renderizar", () => {
    const entry: UpdateItem = { id: "u1", title: "Planejamento", summary: "Em preparação.", state: "planned", updatedAt: "2028-02-29", order: 1 };
    expect(renderToStaticMarkup(<UpdatesBoard entries={[entry]} />)).toContain("29 de fev. de 2028");
    for (const updatedAt of ["2026-13-40", "2026-02-29", "2026-04-31", "2026-1-01", "0000-01-01"]) {
      expect(() => validateUpdateEntries([{ ...entry, updatedAt }])).toThrow("Atualização exige uma data válida.");
    }
    expect(() => validateUpdateEntries([entry, { ...entry }])).toThrow("Atualização exige identificador único e válido.");
    expect(() => validateUpdateEntries([{ ...entry, id: " " }])).toThrow("Atualização exige identificador único e válido.");
    expect(() => validateUpdateEntries([{ ...entry, order: Number.NaN }])).toThrow("Atualização exige etapa e ordem válidas.");
    expect(() => validateUpdateEntries([{ ...entry, state: "unknown" } as unknown as UpdateItem])).toThrow("Atualização exige etapa e ordem válidas.");
    expect(() => validateUpdateEntries([{ ...entry, title: " " }])).toThrow("Atualização exige título e resumo.");
  });
});
