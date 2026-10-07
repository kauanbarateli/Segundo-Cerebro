import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "../src/lib/theme";

// SPEC-01 seam: execute the exact head script at the browser API boundary.
// Adapted from novo-segundo-cerebro@151b2db, tema-init.test.ts.
function runHeadScript(saved: string | null, darkSystem: boolean, storageBlocked = false) {
  const attributes = new Map<string, string>();
  const style = { colorScheme: "" };
  runInNewContext(THEME_INIT_SCRIPT, {
    localStorage: {
      getItem(key: string) {
        if (storageBlocked) throw new Error("Armazenamento bloqueado");
        return key === "segundo-cerebro-theme" ? saved : null;
      },
    },
    window: { matchMedia: () => ({ matches: darkSystem }) },
    document: {
      documentElement: { setAttribute: (key: string, value: string) => attributes.set(key, value), style },
      querySelector: () => null,
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  });
  return { theme: attributes.get("data-theme"), colorScheme: style.colorScheme };
}

describe("o script de tema antes da primeira pintura", () => {
  it("abre em claro quando não há preferência e o sistema é claro", () => {
    expect(runHeadScript(null, false)).toEqual({ theme: "light", colorScheme: "light" });
  });

  it("abre em escuro quando não há preferência e o sistema é escuro", () => {
    expect(runHeadScript(null, true)).toEqual({ theme: "dark", colorScheme: "dark" });
  });

  it("preserva escuro explícito quando o sistema é claro", () => {
    expect(runHeadScript("dark", false)).toEqual({ theme: "dark", colorScheme: "dark" });
  });

  it("acompanha o sistema escuro mesmo quando o armazenamento está bloqueado", () => {
    expect(runHeadScript(null, true, true)).toEqual({ theme: "dark", colorScheme: "dark" });
  });

  it.each([
    ["claro explícito com sistema claro", "light", false, "light"],
    ["claro explícito com sistema escuro", "light", true, "light"],
    ["escuro explícito com sistema escuro", "dark", true, "dark"],
    ["sistema explícito em claro", "system", false, "light"],
    ["sistema explícito em escuro", "system", true, "dark"],
    ["preferência inválida com sistema claro", "roxo", false, "light"],
    ["preferência inválida com sistema escuro", "roxo", true, "dark"],
  ])("resolve %s antes da hidratação", (_description, saved, darkSystem, expected) => {
    expect(runHeadScript(saved, darkSystem)).toEqual({ theme: expected, colorScheme: expected });
  });

  it("acompanha o sistema claro mesmo quando o armazenamento está bloqueado", () => {
    expect(runHeadScript(null, false, true)).toEqual({ theme: "light", colorScheme: "light" });
  });
});
