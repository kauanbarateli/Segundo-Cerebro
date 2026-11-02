import { describe, expect, it } from "vitest";
import { buildDockEntries, dockCapacity, DOCK_SLOT, isDockCurrent } from "../src/components/layout/desktop-dock";
import { DEFAULT_DEMO_POLICY } from "../src/lib/navigation/demo-state";
import { groupNavigationRoutes } from "../src/lib/navigation/groups";
import { getVisibleRoutes } from "../src/lib/navigation/routes";
import type { AccessPolicy } from "../src/core/access/resolve-access";

const sidebarOrder = (policy: AccessPolicy) => getVisibleRoutes(policy).map((route) => route.href);
const dockOrder = (policy: AccessPolicy, metrics = false) => {
  const { modules, pinned } = buildDockEntries(groupNavigationRoutes(getVisibleRoutes(policy)), metrics);
  return [...modules, ...pinned];
};

describe("doc21 N10: a dock usa a mesma navegação visível da lateral", () => {
  it("segue a ordem e as permissões do catálogo, sem lista fixa", () => {
    const entries = dockOrder(DEFAULT_DEMO_POLICY);
    expect(entries.map((entry) => entry.href)).toEqual(
      [...groupNavigationRoutes(getVisibleRoutes(DEFAULT_DEMO_POLICY)).groups.flatMap((group) => group.routes.map((route) => route.href)),
        ...groupNavigationRoutes(getVisibleRoutes(DEFAULT_DEMO_POLICY)).utility.map((route) => route.href)],
    );
    expect(new Set(entries.map((entry) => entry.href))).toEqual(new Set(sidebarOrder(DEFAULT_DEMO_POLICY)));
    expect(entries.some((entry) => entry.href === "/admin")).toBe(false);
  });

  it("módulo oculto ou vetado não aparece; Admin só com privilégio", () => {
    const hidden: AccessPolicy = { ...DEFAULT_DEMO_POLICY, preferences: { tarefas: { visible: false, order: 0 } } };
    expect(dockOrder(hidden).some((entry) => entry.key === "tarefas")).toBe(false);
    const vetoed: AccessPolicy = { ...DEFAULT_DEMO_POLICY, entitlements: { habitos: false } };
    expect(dockOrder(vetoed).some((entry) => entry.key === "habitos")).toBe(false);
    const admin: AccessPolicy = { ...DEFAULT_DEMO_POLICY, isAdmin: true, entitlements: { admin: true } };
    expect(dockOrder(admin).some((entry) => entry.href === "/admin")).toBe(true);
  });

  it("Métricas entra apenas quando disponível e fica entre os fixos", () => {
    expect(dockOrder(DEFAULT_DEMO_POLICY).some((entry) => entry.href === "/metricas")).toBe(false);
    const { pinned } = buildDockEntries(groupNavigationRoutes(getVisibleRoutes(DEFAULT_DEMO_POLICY)), true);
    expect(pinned.at(-1)?.href).toBe("/metricas");
  });

  it("separadores marcam só grupos reais; ordem intercalada vira uma sequência", () => {
    const { modules, pinned } = buildDockEntries(groupNavigationRoutes(getVisibleRoutes(DEFAULT_DEMO_POLICY)), false);
    expect(modules[0]?.separatorBefore).toBe(false);
    expect(modules.filter((entry) => entry.separatorBefore).length).toBe(groupNavigationRoutes(getVisibleRoutes(DEFAULT_DEMO_POLICY)).groups.length - 1);
    expect(pinned[0]?.separatorBefore).toBe(true);
    const routes = getVisibleRoutes(DEFAULT_DEMO_POLICY);
    const cofre = routes.find((route) => route.feature === "cofre")!;
    const interleaved = groupNavigationRoutes([cofre, ...routes.filter((route) => route !== cofre)]);
    expect(interleaved.labeled).toBe(false);
    const run = buildDockEntries(interleaved, false).modules;
    expect(run[0]?.key).toBe("cofre");
    expect(run.some((entry) => entry.separatorBefore)).toBe(false);
  });
});

describe("doc21 N09: capacidade sem encolher alvos nem quebrar linha", () => {
  it("tudo cabe em telas largas", () => {
    expect(dockCapacity(1920, 12, 3, 3)).toBe(12);
  });

  it("transborda para Mais áreas preservando os fixos e alvos de 52px", () => {
    const capacity = dockCapacity(1051, 20, 4, 3);
    expect(capacity).toBeLessThan(20);
    const used = 28 + 48 + 4 * DOCK_SLOT + 3 * 14 + (capacity + 1) * DOCK_SLOT;
    expect(used).toBeLessThanOrEqual(1051 - 32);
  });

  it("nunca devolve valor negativo nem maior que o total", () => {
    expect(dockCapacity(200, 10, 4, 3)).toBe(0);
    expect(dockCapacity(5000, 3, 0, 0)).toBe(3);
  });
});

describe("doc21: página atual", () => {
  it("compara rota exata e ignora barra final", () => {
    expect(isDockCurrent("/tarefas", "/tarefas")).toBe(true);
    expect(isDockCurrent("/tarefas/", "/tarefas")).toBe(true);
    expect(isDockCurrent("/tarefas/123", "/tarefas")).toBe(false);
    expect(isDockCurrent("/tarefas", "/")).toBe(false);
    expect(isDockCurrent("/", "/")).toBe(true);
  });
});
