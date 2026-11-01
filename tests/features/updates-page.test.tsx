import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const guards = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireUser: guards.requireUser }));
import UpdatesPage from "../../src/app/(workspace)/atualizacoes/page";

describe("atualizações autenticadas", () => {
  beforeEach(() => { guards.requireUser.mockReset(); });

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
    expect(html).not.toContain("Enviar sugestão");
  });
});
