import type { FeatureKey } from "../../core/access/resolve-access";
import type { WorkspaceRoute } from "./routes";

export type NavigationGroupKey = "dia" | "contexto" | "pessoal";

export interface NavigationGroup {
  readonly key: NavigationGroupKey;
  /** Null when the person's own order interleaves groups: no misleading headings. */
  readonly label: string | null;
  readonly routes: readonly WorkspaceRoute[];
}

export interface GroupedNavigation {
  readonly groups: readonly NavigationGroup[];
  /** Integrações, Configurações and Admin live in the sidebar footer. */
  readonly utility: readonly WorkspaceRoute[];
  /** False when a custom order mixes groups and the list keeps that order unlabeled. */
  readonly labeled: boolean;
}

/** Layout Codex default grouping (doc 15 §3); visibility and order still come from policy. */
export const NAVIGATION_GROUPS: Readonly<Record<NavigationGroupKey, string>> = {
  dia: "Meu dia",
  contexto: "Meu contexto",
  pessoal: "Vida pessoal",
};

const groupOf: Readonly<Partial<Record<FeatureKey, NavigationGroupKey>>> = {
  inicio: "dia", capturar: "dia", tarefas: "dia", calendario: "dia",
  conhecimento: "contexto", drive: "contexto", projetos: "contexto",
  habitos: "pessoal", financeiro: "pessoal", cofre: "pessoal",
};

/**
 * Receives `getVisibleRoutes(policy)` and never reorders it. Each group keeps its
 * label only while the custom order keeps the group contiguous; otherwise the
 * whole list is rendered as one unlabeled group in the person's order.
 */
export function groupNavigationRoutes(routes: readonly WorkspaceRoute[]): GroupedNavigation {
  const utility = routes.filter((route) => !groupOf[route.feature]);
  const modules = routes.filter((route) => groupOf[route.feature]);
  const runs: { key: NavigationGroupKey; routes: WorkspaceRoute[] }[] = [];
  for (const route of modules) {
    const key = groupOf[route.feature]!;
    const last = runs.at(-1);
    if (last?.key === key) last.routes.push(route);
    else runs.push({ key, routes: [route] });
  }
  const labeled = new Set(runs.map((run) => run.key)).size === runs.length;
  if (!labeled) return { groups: modules.length ? [{ key: "dia", label: null, routes: modules }] : [], utility, labeled };
  return { groups: runs.map((run) => ({ key: run.key, label: NAVIGATION_GROUPS[run.key], routes: run.routes })), utility, labeled };
}
