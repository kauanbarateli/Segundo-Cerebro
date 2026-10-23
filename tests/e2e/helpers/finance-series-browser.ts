import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/** Compiles the real feature in a browser fixture. This intentionally neither
 * imports an application provider/SDK nor changes production source/config. */
export async function buildFinanceSeriesBrowser() {
  const entry = resolve("tests/e2e/fixtures/finance-series-browser.tsx");
  const provider = resolve("src/lib/demo/demo-provider.tsx");
  const cssPaths = ["src/components/ui/button.css", "src/components/ui/field.css", "src/components/ui/dialog.css", "src/components/ui/badge.css", "src/components/features/financeiro/finance.css", "src/components/features/financeiro/finance-competence-chart.css", "src/components/features/financeiro/series/series.css"];
  const cssAbsolute = cssPaths.map(path => resolve(path)), discovered = new Set<string>();
  const build = await rolldown({ input: entry, platform: "browser", tsconfig: false, resolve: { alias: { "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } },
    onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "finance-series-provider-css-seams", resolveId(source, importer) {
      const normalized = source.replaceAll("\\", "/").replace(/\.tsx?$/, "");
      if (source === "@/lib/demo/demo-provider" || normalized === provider.replaceAll("\\", "/").replace(/\.tsx$/, "")) return "\0finance-series-provider";
      assert.ok(!source.startsWith("@supabase/") && source !== "server-only" && !source.startsWith("node:"), "Infrastructure reached the finance-series browser bundle");
      if (source.endsWith(".css")) {
        assert.ok(importer); const path = source.startsWith("@/") ? resolve("src", source.slice(2)) : resolve(dirname(importer), source);
        assert.ok(cssAbsolute.includes(path), "Undeclared finance-series CSS import: " + path); discovered.add(path); return "\0finance-series-css";
      }
    }, load(id) {
      if (id === "\0finance-series-css") return "export {};";
      if (id === "\0finance-series-provider") return "export {useDemoApplication,useDemoPrivacy} from " + JSON.stringify(entry.replaceAll("\\", "/")) + ";";
    } }] });
  try {
    const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "FinanceSeriesBrowserFixture" });
    assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []);
    assert.deepEqual([...discovered].sort(), [...cssAbsolute].sort());
    const global = resolve("src/app/globals.css");
    let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
    css += "\n@font-face{font-family:FinanceSeriesGeist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:FinanceSeriesGeist}";
    return { code: chunk.code, css };
  } finally { await build.close(); }
}
