import { describe, expect, it } from "vitest";
import { buildTableView, type TableModelColumn } from "../src/components/ui/table-model";

const rows = [
  { id: "a", title: "Árvore", status: "Pendente", order: 10 },
  { id: "b", title: "Estudo", status: "Concluída", order: 2 },
  { id: "c", title: "ação", status: "Concluída", order: 1 },
  { id: "d", title: "Revisão", status: "Pendente", order: 2 },
] as const;
type Row = typeof rows[number];
const columns: TableModelColumn<Row>[] = [
  { id: "title", accessor: (row) => row.title },
  { id: "status", accessor: (row) => row.status },
  { id: "order", accessor: (row) => row.order, searchable: false },
];
const ids = (view: ReturnType<typeof buildTableView<Row>>) => view.rows.map((row) => row.id);

describe("coleção compartilhada da tabela e dos cartões", () => {
  it("filtra sem acento/caixa e aceita termos entre campos antes de ordenar e paginar", () => {
    const view = buildTableView({ rows, columns, search: " CONCLUIDA   aCao ", sort: { columnId: "order", direction: "desc" }, pageSize: 1 });
    expect(ids(view)).toEqual(["c"]);
    expect(view).toMatchObject({ total: 1, page: 1, pageCount: 1, from: 1, to: 1 });
    expect(buildTableView({ rows, columns, search: "10" }).total).toBe(0);
  });

  it("ordena números numericamente, conserva empates e pagina depois da ordenação", () => {
    expect(ids(buildTableView({ rows, columns, sort: { columnId: "order", direction: "asc" }, pageSize: 2 }))).toEqual(["c", "b"]);
    expect(ids(buildTableView({ rows, columns, sort: { columnId: "order", direction: "asc" }, pageSize: 2, page: 2 }))).toEqual(["d", "a"]);
    expect(ids(buildTableView({ rows, columns, sort: { columnId: "order", direction: "desc" }, pageSize: 4 }))).toEqual(["a", "b", "d", "c"]);
  });

  it("preserva a origem e a identidade dos objetos para ações iguais nos dois renderizadores", () => {
    const immutableRows = Object.freeze([...rows]);
    const before = [...immutableRows];
    const view = buildTableView({ rows: immutableRows, columns, sort: { columnId: "order", direction: "asc" } });
    expect(immutableRows).toEqual(before);
    expect(view.rows[0]).toBe(rows[2]);
    expect(view.rows[1]).toBe(rows[1]);
  });

  it("restringe a página quando o conjunto encolhe e informa o intervalo correto", () => {
    const last = buildTableView({ rows, columns, page: 8, pageSize: 3 });
    expect(last).toMatchObject({ page: 2, pageCount: 2, total: 4, from: 4, to: 4 });
    expect(ids(last)).toEqual(["d"]);
    const filtered = buildTableView({ rows, columns, page: 2, pageSize: 3, search: "concluida" });
    expect(filtered).toMatchObject({ page: 1, pageCount: 1, total: 2, from: 1, to: 2 });
  });

  it("expõe um vazio consistente e recupera parâmetros inválidos sem páginas impossíveis", () => {
    expect(buildTableView({ rows, columns, search: "não existe", page: 5 })).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1, from: 0, to: 0 });
    expect(buildTableView({ rows, columns, page: Number.NaN, pageSize: Number.POSITIVE_INFINITY })).toMatchObject({ page: 1, pageSize: 5 });
    expect(buildTableView({ rows, columns, page: -2, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 1 });
  });

  it("ignora ordenação desconhecida ou explicitamente indisponível", () => {
    expect(ids(buildTableView({ rows, columns, sort: { columnId: "missing", direction: "desc" } }))).toEqual(["a", "b", "c", "d"]);
    expect(ids(buildTableView({ rows, columns: columns.map((column) => ({ ...column, sortable: false })), sort: { columnId: "title", direction: "desc" } }))).toEqual(["a", "b", "c", "d"]);
  });

  it("ordena datas e mantém valores ausentes por último em ambas as direções", () => {
    const dates = [{ id: "late", date: new Date("2026-10-09") }, { id: "empty", date: null }, { id: "early", date: new Date("2026-10-01") }];
    const dateColumns = [{ id: "date", accessor: (row: typeof dates[number]) => row.date }];
    expect(buildTableView({ rows: dates, columns: dateColumns, sort: { columnId: "date", direction: "asc" } }).rows.map((row) => row.id)).toEqual(["early", "late", "empty"]);
    expect(buildTableView({ rows: dates, columns: dateColumns, sort: { columnId: "date", direction: "desc" } }).rows.map((row) => row.id)).toEqual(["late", "early", "empty"]);
  });

  it("busca datas e booleanos pelo texto português apresentado nas células", () => {
    const records = [{ date: new Date(2026, 9, 7), done: true }, { date: new Date(2026, 9, 8), done: false }];
    const fields = [{ id: "date", accessor: (row: typeof records[number]) => row.date }, { id: "done", accessor: (row: typeof records[number]) => row.done }];
    expect(buildTableView({ rows: records, columns: fields, search: "07/10/2026 sim" }).rows).toEqual([records[0]]);
    expect(buildTableView({ rows: records, columns: fields, search: "nao" }).rows).toEqual([records[1]]);
  });
});
