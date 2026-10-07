import { resolveAccess, type AccessPolicy, type FeatureKey } from "../../core/access/resolve-access";

export interface WorkspaceRoute {
  readonly feature: FeatureKey;
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
}

/** D-016 taxonomy. No demo records or unavailable domain actions live in the shell. */
export const WORKSPACE_ROUTES: readonly WorkspaceRoute[] = [
  { feature: "inicio", href: "/", label: "Início", description: "Um lugar para reunir o que importa no seu dia.", emptyTitle: "Seu espaço está ganhando forma", emptyDescription: "Explore os módulos pela navegação. As tarefas, notas e informações do seu dia chegarão nas próximas etapas." },
  { feature: "capturar", href: "/capturar", label: "Capturar", description: "Uma ideia agora. A organização vem depois.", emptyTitle: "O espaço das suas próximas ideias", emptyDescription: "Aqui você poderá registrar notas, ideias e lembretes antes de decidir o próximo passo. A captura será disponibilizada em uma próxima etapa." },
  { feature: "tarefas", href: "/tarefas", label: "Tarefas", description: "Dê um próximo passo ao que precisa ser feito.", emptyTitle: "As próximas ações ficam aqui", emptyDescription: "Você poderá acompanhar tarefas em lista ou quadro e conectar cada uma ao seu contexto. A gestão de tarefas ainda está em construção." },
  { feature: "calendario", href: "/calendario", label: "Calendário", description: "Veja os compromissos no contexto do seu dia.", emptyTitle: "Um lugar para a sua agenda", emptyDescription: "Aqui você poderá consultar compromissos e vinculá-los a tarefas e notas. A conexão com o Google Calendar ainda não está disponível." },
  { feature: "conhecimento", href: "/conhecimento", label: "Conhecimento", description: "Organize notas e reencontre suas conexões.", emptyTitle: "Conhecimento que cresce com você", emptyDescription: "Cadernos e páginas reunirão o que vale guardar, com referências entre notas. O editor e a organização de páginas chegarão nas próximas etapas." },
  { feature: "drive", href: "/drive", label: "Drive", description: "Seus arquivos, perto das informações a que pertencem.", emptyTitle: "Os seus arquivos terão lugar aqui", emptyDescription: "Pastas e vínculos ajudarão a encontrar documentos no contexto certo. Armazenamento e envio de arquivos ainda não estão disponíveis." },
  { feature: "projetos", href: "/projetos", label: "Projetos", description: "Reúna o que faz parte do mesmo esforço.", emptyTitle: "Um contexto para cada projeto", emptyDescription: "Tarefas, notas e arquivos poderão compartilhar um projeto sem serem duplicados. A organização por projetos ainda está em construção." },
  { feature: "habitos", href: "/habitos", label: "Hábitos", description: "Acompanhe as práticas que cabem na sua rotina.", emptyTitle: "Espaço para os seus hábitos", emptyDescription: "Você poderá definir cadências, registrar dias cumpridos e respeitar períodos de pausa. O acompanhamento de hábitos chegará em uma próxima etapa." },
  { feature: "financeiro", href: "/financeiro", label: "Financeiro", description: "Uma visão conectada do seu dinheiro.", emptyTitle: "Seu panorama financeiro começa aqui", emptyDescription: "Contas, cartões e lançamentos comporão a visão do mês. Os registros e cálculos financeiros ainda não estão disponíveis." },
  { feature: "cofre", href: "/cofre", label: "Cofre", description: "Um lugar reservado para informações sensíveis.", emptyTitle: "O Cofre está em preparação", emptyDescription: "A proteção com senha mestra e kit de recuperação será implementada em uma etapa própria. Ainda não é possível guardar segredos aqui." },
  { feature: "configuracoes", href: "/configuracoes", label: "Configurações", description: "Ajuste a navegação desta demonstração.", emptyTitle: "Preferências da demonstração", emptyDescription: "Estas escolhas pertencem somente à demonstração local." },
  { feature: "integracoes", href: "/integracoes", label: "Integrações", description: "Conexões que aproximam as suas informações.", emptyTitle: "As conexões chegarão por aqui", emptyDescription: "Esta área reunirá os serviços disponíveis para conectar ao Segundo Cérebro. Nenhuma conta externa está conectada nesta demonstração." },
  { feature: "admin", href: "/admin", label: "Admin", description: "Área de administração · privilégio de demonstração.", emptyTitle: "Administração em preparação", emptyDescription: "Esta página demonstra apenas a navegação com privilégio Admin. Não há usuários reais, métricas, dados pessoais ou operações administrativas disponíveis." },
];

export function getRouteByPath(pathname: string): WorkspaceRoute | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return WORKSPACE_ROUTES.find((route) => route.href === path);
}

export function getVisibleRoutes(policy: AccessPolicy): WorkspaceRoute[] {
  return WORKSPACE_ROUTES
    .map((route, index) => ({ route, index, order: policy.preferences[route.feature]?.order ?? index }))
    .filter(({ route }) => resolveAccess(route.feature, policy).visible)
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ route }) => route);
}

export function filterRoutes(routes: readonly WorkspaceRoute[], query: string): WorkspaceRoute[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const term = normalize(query);
  return routes.filter((route) => normalize(`${route.label} ${route.description}`).includes(term));
}
