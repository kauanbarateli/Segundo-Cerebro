import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable } from "../../src/components/ui/data-table";

describe("DataTable com barra externa controlada", () => {
  const rows = [{ id: "a", title: "Primeira" }, { id: "b", title: "Segunda" }];
  const columns = [{ id: "title", header: "Título", accessor: (row: typeof rows[number]) => row.title }];
  it("mantém controles por padrão e os omite de fato quando a superfície oferece sua própria barra", () => {
    const defaultHtml = renderToStaticMarkup(<DataTable label="Itens" rows={rows} columns={columns} getRowId={row => row.id} />);
    expect(defaultHtml).toContain('type="search"'); expect(defaultHtml).toContain("ui-data-table__sort-controls");
    const external = renderToStaticMarkup(<DataTable controls={false} label="Itens" rows={rows} columns={columns} getRowId={row => row.id} pageSize={1} state={{ search: "Segunda", sort: { columnId: "title", direction: "desc" }, page: 1 }} />);
    expect(external).not.toContain('type="search"'); expect(external).not.toContain("ui-data-table__sort-controls");
    expect(external).toContain("Segunda"); expect(external).not.toContain("Primeira"); expect(external).toContain("Paginação de Itens");
  });
  it("encaixa filtros da superfície entre busca e ordem, sem renderizá-los quando controls=false", () => {
    const filters = <span data-testid="surface-filter">Filtro da superfície</span>;
    const html = renderToStaticMarkup(<DataTable filters={filters} label="Itens" rows={rows} columns={columns} getRowId={row => row.id} />);
    expect(html.indexOf('type="search"')).toBeLessThan(html.indexOf('data-testid="surface-filter"'));
    expect(html.indexOf('data-testid="surface-filter"')).toBeLessThan(html.indexOf("ui-data-table__sort-controls"));
    const external = renderToStaticMarkup(<DataTable controls={false} filters={filters} label="Itens" rows={rows} columns={columns} getRowId={row => row.id} />);
    expect(external).not.toContain("surface-filter");
  });
});
