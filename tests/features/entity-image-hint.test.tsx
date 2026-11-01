import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../../src/lib/demo/demo-provider", () => ({ useDemoApplication: () => ({ mode: "connected", userId: "25000000-0000-4000-8000-000000000001" }) }));
import { EntityImageEditor } from "../../src/components/layout/entity-image-editor";

const render = (purpose: "home_focus_image" | "project_cover") => renderToStaticMarkup(
  <EntityImageEditor purpose={purpose} entityId="25000000-0000-4000-8000-000000000001" currentFileId={null} title="Imagem" returnFocusRef={{ current: null }} onClose={() => undefined} onSaved={() => undefined} />);

describe("A05: ajuda do seletor de imagem", () => {
  it("a imagem do Início mostra só o limite; a validação técnica continua no código", () => {
    const html = render("home_focus_image");
    expect(html).toContain("Limite de 8 MB.");
    expect(html).not.toContain("24 milhões de pixels");
    expect(html).not.toContain("conserva proporção própria");
  });
  it("outras imagens conservam a ajuda completa", () => {
    expect(render("project_cover")).toContain("Até 8 MiB e 24 milhões de pixels");
  });
});
