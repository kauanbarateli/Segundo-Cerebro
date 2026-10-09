import { exigir } from "../contracts/base";
export const SEARCH_TYPES = ["task", "capture", "page", "transaction", "file", "project", "habit"] as const;
export type SearchType = typeof SEARCH_TYPES[number];
export interface SearchResult { id: string; type: SearchType; title: string; href: string; rank: number }
export interface SearchPort { query(term: string): Promise<SearchResult[]> }
export function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim(); }
export function searchTerm(value: unknown): string { exigir(typeof value === "string" && value.trim().length <= 120 && !/[\u0000-\u001f]/.test(value), "Busque com até 120 caracteres."); return value.trim(); }
export function searchRank(title: string, text: string, term: string) { const query = normalizeSearch(term), name = normalizeSearch(title); return name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : normalizeSearch(text).includes(query) ? 3 : 4; }
export function rankSearch(results: SearchResult[]) { return [...results].sort((a, b) => a.rank - b.rank || SEARCH_TYPES.indexOf(a.type) - SEARCH_TYPES.indexOf(b.type) || normalizeSearch(a.title).localeCompare(normalizeSearch(b.title), "pt-BR") || a.id.localeCompare(b.id)); }
export function search(port: SearchPort, term: unknown) { const query = searchTerm(term); return query ? port.query(query) : Promise.resolve([]); }
export const SEARCH_PATHS: Record<SearchType, string> = { task: "/tarefas?task=", capture: "/capturar?capture=", page: "/conhecimento?note=", transaction: "/financeiro?transaction=", file: "/drive?file=", project: "/projetos?project=", habit: "/habitos?habit=" };
export function validSearchResults(value: unknown): value is SearchResult[] {
  return Array.isArray(value) && value.length <= 70 && value.every(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== 5 || Object.keys(row).some(key => !["id", "type", "title", "href", "rank"].includes(key))) return false;
    return typeof row.id === "string" && row.id.length > 0 && row.id.length <= 200 && SEARCH_TYPES.includes(row.type as SearchType) &&
      typeof row.title === "string" && row.title.length <= 200 && typeof row.rank === "number" && Number.isInteger(row.rank) && row.rank >= 0 && row.rank <= 4 &&
      row.href === SEARCH_PATHS[row.type as SearchType] + encodeURIComponent(row.id);
  });
}
