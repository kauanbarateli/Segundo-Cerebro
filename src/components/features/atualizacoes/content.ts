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

/** Released entries must link to a factual source before publication. */
export function validateUpdateEntries(entries: readonly UpdateItem[]): readonly UpdateItem[] {
  for (const item of entries) {
    if (item.state === "released" && !updateEvidenceHref(item.evidence)) throw new Error("Atualização lançada exige um link de entrega válido.");
  }
  return entries;
}

// Somente conteúdo aprovado para publicação; vazio até haver conteúdo editorial.
export const updates: readonly UpdateItem[] = validateUpdateEntries([]);
