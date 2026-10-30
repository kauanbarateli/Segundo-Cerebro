import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/** Real nine-screen React/Core/HTTP port. Only Next navigation and HTTP are
 * synthetic. No Supabase SDK, real accounts, persistence or OAuth acceptance. */
export async function buildOnboardingWorkspaceBrowser() {
  const entry = resolve("tests/e2e/fixtures/onboarding-workspace-browser.tsx");
  const cssPaths = ["src/components/ui/brand.css", "src/components/ui/button.css", "src/components/ui/field.css", "src/components/theme/theme-toggle.css", "src/components/features/onboarding/onboarding.css"];
  const cssAbsolute = cssPaths.map(path => resolve(path)), discovered = new Set<string>();
  const build = await rolldown({ input: entry, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "onboarding-workspace-next-css-seams", resolveId(source, importer) {
      if (source.endsWith(".css")) {
        assert.ok(importer); const path = source.startsWith("@/") ? resolve("src", source.slice(2)) : resolve(dirname(importer), source);
        assert.ok(cssAbsolute.includes(path), "Undeclared onboarding CSS import"); discovered.add(path); return "\0onboarding-workspace-css";
      }
      if (source === "next/link") return "\0onboarding-workspace-link";
      if (source === "next/navigation") return "\0onboarding-workspace-navigation";
    }, load(id) {
      const fixture = JSON.stringify(entry.replaceAll("\\", "/"));
      if (id === "\0onboarding-workspace-css") return "export {};";
      if (id === "\0onboarding-workspace-link") return "export {FixtureLink as default} from " + fixture + ";";
      if (id === "\0onboarding-workspace-navigation") return "export {useFixtureRouter as useRouter, useFixturePathname as usePathname} from " + fixture + ";";
    } }] });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "OnboardingWorkspaceFixture" });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []);
    assert.deepEqual([...discovered].sort(), [...cssAbsolute].sort());
    const global = resolve("src/app/globals.css");
    let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
    css += "\n@font-face{font-family:OnboardingGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:OnboardingGeist}";
    return { code: chunk.code, css };
  } finally { await build.close(); }
}
