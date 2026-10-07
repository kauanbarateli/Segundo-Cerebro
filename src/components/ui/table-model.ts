export type TableValue = string | number | boolean | Date | null | undefined;

export interface TableModelColumn<T> {
  id: string;
  accessor: (row: T) => TableValue;
  sortable?: boolean;
  searchable?: boolean;
}

export interface TableSort {
  columnId: string;
  direction: "asc" | "desc";
}

export interface TableViewOptions<T> {
  rows: readonly T[];
  columns: readonly TableModelColumn<T>[];
  search?: string;
  sort?: TableSort | null;
  page?: number;
  pageSize?: number;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Search matches Portuguese text without requiring accents or exact casing. */
export function normalizeTableSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/** Default presentation and search share the same visible Portuguese value. */
export function tableValueText(value: TableValue): string {
  if (value == null) return "Não informado";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Data inválida" : value.toLocaleDateString("pt-BR");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function compareValues(a: TableValue, b: TableValue): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

/** One immutable view pipeline shared by the desktop and mobile renderers. */
export function buildTableView<T>({ rows, columns, search = "", sort, page = 1, pageSize = 5 }: TableViewOptions<T>) {
  const terms = normalizeTableSearch(search).split(/\s+/).filter(Boolean);
  const searchable = columns.filter((column) => column.searchable !== false);
  let processedRows = terms.length ? rows.filter((row) => {
    const text = normalizeTableSearch(searchable.map((column) => tableValueText(column.accessor(row))).join(" "));
    return terms.every((term) => text.includes(term));
  }) : [...rows];
  const sortColumn = sort && columns.find((column) => column.id === sort.columnId && column.sortable !== false);
  if (sortColumn && sort) {
    const direction = sort.direction === "asc" ? 1 : -1;
    processedRows = processedRows.sort((a, b) => {
      const left = sortColumn.accessor(a);
      const right = sortColumn.accessor(b);
      // Missing values stay last in both directions; equal values retain input order.
      if (left == null || right == null) return left == null ? right == null ? 0 : 1 : -1;
      return compareValues(left, right) * direction;
    });
  }
  const size = positiveInteger(pageSize, 5);
  const total = processedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(positiveInteger(page, 1), pageCount);
  const offset = (currentPage - 1) * size;
  return {
    rows: processedRows.slice(offset, offset + size),
    total,
    page: currentPage,
    pageSize: size,
    pageCount,
    from: total ? offset + 1 : 0,
    to: Math.min(offset + size, total),
  };
}
