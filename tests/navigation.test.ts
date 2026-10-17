import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, resolveAccess, type AccessPolicy } from "../src/core/access/resolve-access";
import { DEFAULT_DEMO_POLICY, parseDemoPolicy, serializeDemoPolicy } from "../src/lib/navigation/demo-state";
import { filterRoutes, getRouteByPath, getVisibleRoutes, WORKSPACE_ROUTES } from "../src/lib/navigation/routes";
import { groupNavigationRoutes } from "../src/lib/navigation/groups";
import { parseSidebarState, resolveSidebarState } from "../src/lib/navigation/sidebar-preference";

describe("ADR-0003: direito e preferência independentes", () => {
  it("concede o Plano Pessoal implícito, sem privilégio Admin", () => {
    for (const feature of FEATURE_KEYS.filter((key) => key !== "admin")) {
      expect(resolveAccess(feature, DEFAULT_DEMO_POLICY)).toEqual({ allowed: true, visible: true, reason: "allowed" });
    }
    expect(resolveAccess("admin", DEFAULT_DEMO_POLICY)).toEqual({ allowed: false, visible: false, reason: "admin-required" });
  });

  it("ocultar preserva o direito de abrir diretamente", () => {
    const policy: AccessPolicy = { ...DEFAULT_DEMO_POLICY, preferences: { tarefas: { visible: false, order: 0 } } };
    expect(resolveAccess("tarefas", policy)).toEqual({ allowed: true, visible: false, reason: "allowed" });
    expect(getVisibleRoutes(policy).some((route) => route.feature === "tarefas")).toBe(false);
    expect(getRouteByPath("/tarefas")?.feature).toBe("tarefas");
  });

  it("veto prevalece sobre preferência visível e privilégio", () => {
    const policy: AccessPolicy = { isAdmin: true, entitlements: { tarefas: false, admin: false }, preferences: { tarefas: { visible: true, order: 0 } } };
    expect(resolveAccess("tarefas", policy)).toEqual({ allowed: false, visible: false, reason: "entitlement-denied" });
    expect(resolveAccess("admin", policy).allowed).toBe(false);
  });

  it("concessão Admin sem privilégio não eleva o acesso", () => {
    expect(resolveAccess("admin", { ...DEFAULT_DEMO_POLICY, entitlements: { admin: true } }).allowed).toBe(false);
    expect(resolveAccess("admin", { ...DEFAULT_DEMO_POLICY, isAdmin: true }).allowed).toBe(true);
  });

  it("as quatro combinações preservam a preferência ao aplicar e remover veto", () => {
    for (const visible of [false, true]) {
      for (const allowed of [false, true]) {
        const policy: AccessPolicy = { isAdmin: false, entitlements: { tarefas: allowed }, preferences: { tarefas: { visible, order: 1 } } };
        const previous = JSON.stringify(policy);
        expect(resolveAccess("tarefas", policy)).toMatchObject({ allowed, visible: allowed && visible });
        expect(JSON.stringify(policy)).toBe(previous);
      }
    }
  });
});

describe("taxonomia compartilhada", () => {
  it("possui exatamente as 13 capacidades, com endereços e nomes únicos", () => {
    expect(WORKSPACE_ROUTES.map((route) => route.feature).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(new Set(WORKSPACE_ROUTES.map((route) => route.href)).size).toBe(13);
    expect(new Set(WORKSPACE_ROUTES.map((route) => route.label)).size).toBe(13);
    expect(getRouteByPath("/tarefas/")?.label).toBe("Tarefas");
    expect(getRouteByPath("/rota-ausente")).toBeUndefined();
    expect(getRouteByPath("/tarefas-outro")).toBeUndefined();
  });

  it("ordena sem mutar o catálogo e mantém desempate determinístico", () => {
    const original = WORKSPACE_ROUTES.map((route) => route.feature);
    const policy: AccessPolicy = { ...DEFAULT_DEMO_POLICY, preferences: { cofre: { visible: true, order: -1 }, drive: { visible: true, order: -1 } } };
    expect(getVisibleRoutes(policy).slice(0, 2).map((route) => route.feature)).toEqual(["drive", "cofre"]);
    expect(WORKSPACE_ROUTES.map((route) => route.feature)).toEqual(original);
  });

  it("a busca não reintroduz rotas ocultas ou vetadas e normaliza acentos", () => {
    const policy: AccessPolicy = { ...DEFAULT_DEMO_POLICY, entitlements: { cofre: false }, preferences: { tarefas: { visible: false, order: 0 } } };
    const routes = getVisibleRoutes(policy);
    expect(filterRoutes(routes, "  CALENDARIO ").map((route) => route.feature)).toEqual(["calendario"]);
    expect(filterRoutes(routes, "Cofre")).toEqual([]);
    expect(filterRoutes(routes, "próximo passo").map((route) => route.feature)).not.toContain("tarefas");
    expect(filterRoutes(routes, "")).toEqual(routes);
  });
});

describe("armazenamento exclusivo da demonstração", () => {
  it.each([null, "", "{", "null", "[]", '{"version":2}', '{"isAdmin":true}'])("recupera com segurança um estado inválido: %s", (raw) => {
    expect(parseDemoPolicy(raw)).toEqual(DEFAULT_DEMO_POLICY);
  });

  it("aceita somente chaves conhecidas, booleanos reais e ordem finita", () => {
    const raw = '{"version":1,"isAdmin":"true","entitlements":{"cofre":false,"tarefas":"false","desconhecido":true},"preferences":{"cofre":{"visible":false,"order":1e400},"drive":{"visible":false,"order":3},"tarefas":{"visible":"true","order":1}}}';
    expect(parseDemoPolicy(raw)).toEqual({ entitlements: { cofre: false }, preferences: { drive: { visible: false, order: 3 } }, isAdmin: false });
  });

  it("restaura direitos e escolhas sem confundir seus significados", () => {
    const policy: AccessPolicy = { isAdmin: true, entitlements: { tarefas: false }, preferences: { tarefas: { visible: true, order: 2 }, cofre: { visible: false, order: 3 } } };
    expect(parseDemoPolicy(serializeDemoPolicy(policy))).toEqual(policy);
  });
});

describe("layout Codex: grupos da lateral sem reordenar a escolha da pessoa", () => {
  const labels = (policy: AccessPolicy) => groupNavigationRoutes(getVisibleRoutes(policy));

  it("agrupa a ordem padrão em Meu dia, Meu contexto e Vida pessoal, com utilitários no rodapé", () => {
    const navigation = labels(DEFAULT_DEMO_POLICY);
    expect(navigation.labeled).toBe(true);
    expect(navigation.groups.map((group) => [group.label, group.routes.map((route) => route.feature)])).toEqual([
      ["Meu dia", ["inicio", "capturar", "tarefas", "calendario"]],
      ["Meu contexto", ["conhecimento", "drive", "projetos"]],
      ["Vida pessoal", ["habitos", "financeiro", "cofre"]],
    ]);
    expect(navigation.utility.map((route) => route.feature)).toEqual(["configuracoes", "integracoes"]);
  });

  it("mantém rótulos quando a ordem personalizada conserva cada grupo contíguo", () => {
    const policy: AccessPolicy = { ...DEFAULT_DEMO_POLICY, preferences: { calendario: { visible: true, order: -1 } } };
    const navigation = labels(policy);
    expect(navigation.labeled).toBe(true);
    expect(navigation.groups[0]?.routes.map((route) => route.feature)).toEqual(["calendario", "inicio", "capturar", "tarefas"]);
  });

  it("intercalar grupos mostra uma lista única, sem rótulos, exatamente na ordem escolhida", () => {
    const policy: AccessPolicy = { ...DEFAULT_DEMO_POLICY, preferences: { financeiro: { visible: true, order: -1 } } };
    const navigation = labels(policy);
    expect(navigation.labeled).toBe(false);
    expect(navigation.groups).toHaveLength(1);
    expect(navigation.groups[0]?.label).toBeNull();
    expect(navigation.groups[0]?.routes.map((route) => route.feature)).toEqual(
      getVisibleRoutes(policy).map((route) => route.feature).filter((feature) => !["configuracoes", "integracoes", "admin"].includes(feature)));
  });

  it("ocultar e vetar continuam valendo dentro dos grupos e Admin vai ao rodapé com privilégio", () => {
    const policy: AccessPolicy = { isAdmin: true, entitlements: { drive: false }, preferences: { cofre: { visible: false, order: 9 } } };
    const navigation = labels(policy);
    const features = navigation.groups.flatMap((group) => group.routes.map((route) => route.feature));
    expect(features).not.toContain("drive");
    expect(features).not.toContain("cofre");
    expect(navigation.utility.map((route) => route.feature)).toContain("admin");
  });
});

describe("preferência de apresentação da lateral", () => {
  it("escolha manual prevalece; sem escolha, recolhe somente na largura compacta", () => {
    expect(resolveSidebarState("expanded", true)).toBe("expanded");
    expect(resolveSidebarState("collapsed", false)).toBe("collapsed");
    expect(resolveSidebarState(null, true)).toBe("collapsed");
    expect(resolveSidebarState(null, false)).toBe("expanded");
    expect(parseSidebarState("aberta")).toBeNull();
  });
});
