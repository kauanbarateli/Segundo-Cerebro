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

/** Editorial links may only point inside the app or to an HTTPS source. */
export function updateEvidenceHref(value: string): string | null {
  if (typeof value !== "string" || !value || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Reject malformed editorial content before it reaches the board. */
export function validateUpdateEntries(entries: readonly UpdateItem[]): readonly UpdateItem[] {
  const identifiers = new Set<string>();
  for (const item of entries) {
    if (typeof item.id !== "string" || !item.id.trim() || item.id !== item.id.trim() || identifiers.has(item.id)) throw new Error("Atualização exige identificador único e válido.");
    identifiers.add(item.id);
    if (typeof item.title !== "string" || !item.title.trim() || typeof item.summary !== "string" || !item.summary.trim()) throw new Error("Atualização exige título e resumo.");
    if (!updateStates.some(state => state.id === item.state) || typeof item.order !== "number" || !Number.isFinite(item.order)) throw new Error("Atualização exige etapa e ordem válidas.");
    if (typeof item.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.updatedAt) || item.updatedAt.startsWith("0000-")) throw new Error("Atualização exige uma data válida.");
    const date = new Date(`${item.updatedAt}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.updatedAt) throw new Error("Atualização exige uma data válida.");
    if (item.state === "released" && !updateEvidenceHref(item.evidence)) throw new Error("Atualização lançada exige um link de entrega válido.");
  }
  return entries;
}

// Somente conteúdo aprovado para publicação; vazio até haver conteúdo editorial.
export const updates: readonly UpdateItem[] = validateUpdateEntries([]);
