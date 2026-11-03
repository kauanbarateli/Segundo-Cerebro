import { resolveAccess, type AccessPolicy, type FeatureKey } from "../../core/access/resolve-access";

export interface WorkspaceRoute {
  readonly feature: FeatureKey;
  readonly href: string;
  readonly label: string;
  readonly description: string;
  /** Layout Codex page subtitle (snapshot copy); module purpose, not demo state. */
  readonly subtitle: string;
}

/** D-016 taxonomy. No demo records or unavailable domain actions live in the shell. */
export const WORKSPACE_ROUTES: readonly WorkspaceRoute[] = [
  { feature: "inicio", href: "/", label: "Início", description: "Um lugar para reunir o que importa no seu dia.", subtitle: "O que importa hoje, em um só lugar." },
  { feature: "capturar", href: "/capturar", label: "Capturar", description: "Uma ideia agora. A organização vem depois.", subtitle: "Tire da cabeça. Organize quando fizer sentido." },
  { feature: "tarefas", href: "/tarefas", label: "Tarefas", description: "Dê um próximo passo ao que precisa ser feito.", subtitle: "Menos pendências na cabeça. Mais clareza para agir." },
  { feature: "calendario", href: "/calendario", label: "Calendário", description: "Veja os compromissos no contexto do seu dia.", subtitle: "Encontre espaço para o que importa." },
  { feature: "conhecimento", href: "/conhecimento", label: "Conhecimento", description: "Organize notas e reencontre suas conexões.", subtitle: "Guarde ideias. Construa conexões." },
  { feature: "drive", href: "/drive", label: "Drive", description: "Seus arquivos, perto das informações a que pertencem.", subtitle: "Seus arquivos, perto das informações a que pertencem." },
  { feature: "projetos", href: "/projetos", label: "Projetos", description: "Reúna o que faz parte do mesmo esforço.", subtitle: "Dê contexto ao que você quer realizar." },
  { feature: "habitos", href: "/habitos", label: "Hábitos", description: "Acompanhe as práticas que cabem na sua rotina.", subtitle: "Pequenos passos, todos os dias." },
  { feature: "financeiro", href: "/financeiro", label: "Financeiro", description: "Uma visão conectada do seu dinheiro.", subtitle: "Entenda seu dinheiro e planeje com calma." },
  { feature: "cofre", href: "/cofre", label: "Cofre", description: "Um lugar reservado para informações sensíveis.", subtitle: "Suas informações reservadas, em um lugar só." },
  { feature: "configuracoes", href: "/configuracoes", label: "Configurações", description: "Aparência, módulos, perfil e sessões da sua conta.", subtitle: "Um Segundo Cérebro do seu jeito." },
  { feature: "integracoes", href: "/integracoes", label: "Integrações", description: "Conexões que aproximam as suas informações.", subtitle: "Conecte o seu contexto." },
  { feature: "admin", href: "/admin", label: "Admin", description: "Administração de contas, restrita ao privilégio Master.", subtitle: "Saúde da operação, sem acesso ao conteúdo pessoal." },
];

/** D-032: availability is a product boundary, independent of a person's preference.
 * Keep the legacy catalog/address and permissions intact for existing data. */
export const MVP_WORKSPACE_ROUTES: readonly WorkspaceRoute[] = WORKSPACE_ROUTES.filter((route) => route.feature !== "drive");

/** The mobile quick actions follow the prototype; custom ordering remains in the menu. */
export function getMobileRoutes(routes: readonly WorkspaceRoute[]): WorkspaceRoute[] {
  return (["inicio", "tarefas", "capturar", "calendario"] as const)
    .flatMap((feature) => routes.filter((route) => route.feature === feature));
}

export function getRouteByPath(pathname: string): WorkspaceRoute | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return WORKSPACE_ROUTES.find((route) => route.href === path);
}

export function getVisibleRoutes(policy: AccessPolicy): WorkspaceRoute[] {
  return MVP_WORKSPACE_ROUTES
    .map((route, index) => ({ route, index, order: policy.preferences[route.feature]?.order ?? index }))
    .filter(({ route }) => resolveAccess(route.feature, policy).visible)
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ route }) => route);
}

/**
 * Shell navigation (sidebar, desktop dock and phone menu). Admin opens from its own
 * view, never from a navigation item; its access rules and the route stay unchanged.
 */
export function getNavigationRoutes(policy: AccessPolicy): WorkspaceRoute[] {
  return getVisibleRoutes(policy).filter((route) => route.feature !== "admin");
}

export function filterRoutes(routes: readonly WorkspaceRoute[], query: string): WorkspaceRoute[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const term = normalize(query);
  return routes.filter((route) => normalize(`${route.label} ${route.description}`).includes(term));
}
