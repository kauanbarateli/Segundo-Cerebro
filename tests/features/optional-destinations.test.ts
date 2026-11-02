import { describe, expect, it } from "vitest";
import { readOptionalDestinations, resolveOptionalNavigation } from "../../src/lib/navigation/optional-destinations";

describe("pontos opcionais de navegação", () => {
  it("nascem fechados: a composição atual não libera feedback nem atualizações", () => {
    expect(readOptionalDestinations()).toEqual({ feedback: false, updates: false });
  });

  it("fechados, o menu mantém Ajuda e não mostra links novos", () => {
    const navigation = resolveOptionalNavigation({ feedback: false, updates: false });
    expect(navigation.help).toEqual({ kind: "help", href: "/ajuda", label: "Ajuda" });
    expect(navigation.updates).toBeNull();
    expect(navigation.support).toBeNull();
    expect(navigation.helpPage).toBeNull();
  });

  it("com feedback operacional, Enviar feedback substitui Ajuda sem perder suporte nem a página de Ajuda", () => {
    const navigation = resolveOptionalNavigation({ feedback: true, updates: false });
    expect(navigation.help).toEqual({ kind: "feedback", href: "/feedback", label: "Enviar feedback" });
    expect(navigation.support?.href).toBe("mailto:suporte@segundocerebroapp.com.br");
    expect(navigation.helpPage).toEqual({ href: "/ajuda", label: "Ajuda" });
    expect(navigation.updates).toBeNull();
  });

  it("atualizações aparecem só quando liberadas, independentemente do feedback", () => {
    expect(resolveOptionalNavigation({ feedback: false, updates: true }).updates).toEqual({ href: "/atualizacoes", label: "Atualizações" });
    expect(resolveOptionalNavigation({ feedback: false, updates: true }).help.kind).toBe("help");
  });
});
