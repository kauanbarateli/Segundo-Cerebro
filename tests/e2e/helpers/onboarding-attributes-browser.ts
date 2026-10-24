import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/** Original controls, two real consumers and browser port. HTTP/Next Link only
 * are synthetic seams; this fixture does not certify Auth, SQL or persistence. */
export async function buildAttributesBrowser() {
  const entry = resolve("tests/e2e/fixtures/onboarding-attributes-browser.tsx"), cssPaths = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/layout/onboarding-attribute-select.css"], discovered = new Set<string>();
  const build = await rolldown({ input: entry, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "attributes-next-css-seams", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source); assert.ok(cssPaths.map(name => resolve(name)).includes(path)); discovered.add(path); return "\0attributes-css"; }
      if (source === "next/link") return "\0attributes-link";
    }, load(id) {
      if (id === "\0attributes-css") return "export {};";
      if (id === "\0attributes-link") return "export {FixtureLink as default} from " + JSON.stringify(entry.replaceAll("\\", "/")) + ";";
    } }] });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "OnboardingAttributesFixture" }); assert.equal(output.length, 1);
    const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.deepEqual([...discovered].sort(), cssPaths.map(path => resolve(path)).sort());
    const global = resolve("src/app/globals.css"); let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:AttributesGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:AttributesGeist}body{margin:0;padding:20px}main{max-width:800px;margin:auto;display:grid;gap:32px}main>section{min-width:0}.settings-text a{display:inline-flex;align-items:center;min-height:44px;text-decoration:underline}";
    return { code: chunk.code, css };
  } finally { await build.close(); }
}
