"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Field } from "./field";
import { buildTableView, tableValueText, type TableModelColumn, type TableSort } from "./table-model";
import "./data-table.css";

export interface DataTableColumn<T> extends TableModelColumn<T> {
  header: string;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  label: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  initialSort?: TableSort;
  searchLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function DataTable<T>({
  label, rows, columns, getRowId, pageSize = 5, initialSort,
  searchLabel = "Filtrar registros", emptyMessage = "Nenhum registro disponível.",
  loading = false, error, onRetry,
}: DataTableProps<T>) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<TableSort | null>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const view = buildTableView({ rows, columns, search, sort, page, pageSize });
  const sortableColumns = columns.filter((column) => column.sortable !== false);
  const unavailable = loading || Boolean(error);

  function changeSort(columnId: string, direction: "asc" | "desc" = "asc") {
    setSort(columnId ? { columnId, direction } : null);
    setPage(1);
  }

  return (
    <section className="ui-data-table" aria-label={label} aria-busy={loading || undefined}>
      <div className="ui-data-table__controls">
        <Field label={searchLabel} type="search" value={search} disabled={unavailable} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        {sortableColumns.length > 0 && <div className="ui-data-table__sort-controls">
          <Field as="select" label="Ordenar por" value={sort?.columnId ?? ""} disabled={unavailable} onChange={(event) => changeSort(event.target.value)}>
            <option value="">Ordem original</option>
            {sortableColumns.map((column) => <option key={column.id} value={column.id}>{column.header}</option>)}
          </Field>
          <Button disabled={unavailable || !sort} aria-label={sort?.direction === "desc" ? "Usar ordem crescente" : "Usar ordem decrescente"} onClick={() => sort && changeSort(sort.columnId, sort.direction === "asc" ? "desc" : "asc")}>
            {sort?.direction === "desc" ? "Decrescente" : "Crescente"}
          </Button>
        </div>}
      </div>

      {loading ? <div className="ui-data-table__loading" role="status"><p>Carregando registros…</p><div className="ui-data-table__skeleton" aria-hidden="true" /></div>
        : error ? <div className="ui-data-table__message" role="alert"><p>{error}</p>{onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}</div>
          : view.total === 0 ? <div className="ui-data-table__message"><p role="status">{search ? "Nenhum resultado para este filtro. Tente outro termo." : emptyMessage}</p>{search && <Button onClick={() => { setSearch(""); setPage(1); }}>Limpar filtro</Button>}</div>
            : <>
              <div className="ui-data-table__desktop">
                <table>
                  <caption>{label}</caption>
                  <thead><tr>{columns.map((column) => <th key={column.id} scope="col" aria-sort={sort?.columnId === column.id ? sort.direction === "asc" ? "ascending" : "descending" : undefined}>
                    {column.sortable === false ? column.header : <Button variant="ghost" className="ui-data-table__heading" aria-label={`Ordenar por ${column.header}${sort?.columnId === column.id && sort.direction === "asc" ? " em ordem decrescente" : " em ordem crescente"}`} onClick={() => changeSort(column.id, sort?.columnId === column.id && sort.direction === "asc" ? "desc" : "asc")}>{column.header}{sort?.columnId === column.id && <span className="ui-data-table__direction">{sort.direction === "asc" ? "Crescente" : "Decrescente"}</span>}</Button>}
                  </th>)}</tr></thead>
                  <tbody>{view.rows.map((row) => <tr key={getRowId(row)} data-row-id={getRowId(row)}>{columns.map((column) => <td key={column.id}>{column.render ? column.render(row) : tableValueText(column.accessor(row))}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <ul className="ui-data-table__cards" aria-label={label}>{view.rows.map((row) => <li key={getRowId(row)} data-row-id={getRowId(row)}><dl>{columns.map((column) => <div key={column.id}><dt>{column.header}</dt><dd>{column.render ? column.render(row) : tableValueText(column.accessor(row))}</dd></div>)}</dl></li>)}</ul>
            </>}

      {!unavailable && <div className="ui-data-table__footer">
        <p id={`${id}-count`} role="status" aria-live="polite" aria-atomic="true">{view.from}–{view.to} de {view.total} registros</p>
        <nav aria-label={`Paginação de ${label}`} className="ui-data-table__pagination" aria-describedby={`${id}-count`}>
          <Button aria-label="Página anterior" disabled={view.page === 1} onClick={() => setPage(view.page - 1)}>Anterior</Button>
          <span>Página {view.page} de {view.pageCount}</span>
          <Button aria-label="Próxima página" disabled={view.page === view.pageCount} onClick={() => setPage(view.page + 1)}>Próxima</Button>
        </nav>
      </div>}
    </section>
  );
}
