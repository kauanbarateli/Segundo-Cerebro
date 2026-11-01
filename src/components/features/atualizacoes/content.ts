export const updateStates = [
  { id: "planned", label: "Planejado" },
  { id: "analysis", label: "Em análise" },
  { id: "progress", label: "Em andamento" },
  { id: "testing", label: "Em fase de testes" },
  { id: "released", label: "Lançado" },
] as const;

interface UpdateItemBase {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly order: number;
}
export type UpdateItem = UpdateItemBase & (
  | { readonly state: "released"; readonly evidence: string }
  | { readonly state: Exclude<(typeof updateStates)[number]["id"], "released">; readonly evidence?: never }
);

// Somente conteúdo aprovado para publicação; vazio até haver conteúdo editorial.
export const updates: readonly UpdateItem[] = [];
