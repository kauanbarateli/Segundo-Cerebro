import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/** Browser bundle of tests/e2e/fixtures/issue34-settings-browser.tsx: original
 * Settings/Shell/providers with Next nav/link/dynamic/image and CSS as declared
 * seams. Shared by the Linux SQL journey and the synthetic presentation matrix. */
// Explicit controls -> layout -> domain; discovery checks the actual closure.
const cssPaths = ["src/components/ui/brand.css", "src/components/ui/button.css", "src/components/ui/card.css", "src/components/ui/data-display.css", "src/components/ui/dialog.css", "src/components/ui/field.css", "src/components/ui/switch.css", "src/components/ui/toast.css", "src/components/layout/workspace-shell.css", "src/components/layout/command-palette.css", "src/components/layout/connected-command-feedback.css", "src/components/pwa/pwa.css", "src/components/features/configuracoes/settings.css", "src/components/features/configuracoes/own-sessions.css"];
export async function buildSettingsBrowser() {
  const navigation = resolve("tests/e2e/fixtures/issue34-settings-browser.tsx").replaceAll("\\", "/"), discovered = new Set<string>();
  const build = await rolldown({ input: navigation, platform: "browser", tsconfig: false, resolve: { alias: { "next/navigation": navigation, "@": resolve("src") } }, transform: { jsx: "react-jsx", define: { "process.env.NODE_ENV": '"production"' } }, onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
    plugins: [{ name: "settings-next-css-boundaries", resolveId(source, importer) {
      if (source.endsWith(".css")) { assert.ok(importer && source.startsWith(".")); const path = resolve(dirname(importer), source), within = relative(resolve("src"), path); assert.ok(!within.startsWith("..") && !within.includes(":")); discovered.add(path); return "\0settings-css"; }
      if (source === "next/link") return "\0settings-link"; if (source === "next/dynamic") return "\0settings-dynamic"; if (source === "next/image") return "\0settings-unused-image";
      if (source.endsWith("illustrative-avatar.jpg")) { assert.equal(source, "./illustrative-avatar.jpg"); assert.equal(importer, resolve("src/components/layout/workspace-shell.tsx")); return "\0settings-unused-avatar"; }
    }, load(id) {
      if (id === "\0settings-css") return "export {};";
      if (id === "\0settings-link") return "export { NavigationLink as default } from " + JSON.stringify(navigation) + ";";
      if (id === "\0settings-dynamic") return "import {createElement,lazy,Suspense} from 'react';export default function dynamic(loader,options={}){const Component=lazy(loader);return function Dynamic(props){return createElement(Suspense,{fallback:options.loading?createElement(options.loading):null},createElement(Component,props));};}";
      if (id === "\0settings-unused-image") return "export default function UnusedNextImage(){throw new Error('Connected fixture must not mount illustrative Next Image.')}";
      if (id === "\0settings-unused-avatar") return "export default null;";
    } }] });
  try { const { output } = await build.generate({ format: "iife", codeSplitting: false, name: "Issue34SettingsFixture" }); assert.equal(output.length, 1); const chunk = output[0]; assert.ok(chunk?.type === "chunk"); assert.deepEqual(chunk.imports, []); assert.ok(chunk.dynamicImports.every(name => name === chunk.fileName)); assert.ok(!/\bimport\s*\(/.test(chunk.code)); assert.deepEqual([...discovered].sort(), cssPaths.map(path => resolve(path)).sort());
    const global = resolve("src/app/globals.css"); let css = (await postcss([tailwind()]).process(await readFile(global, "utf8"), { from: global })).css + "\n" + (await Promise.all(cssPaths.map(path => readFile(path, "utf8")))).join("\n");
    const font = await readFile("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"); css += "\n@font-face{font-family:Issue34Geist;src:url(data:font/woff2;base64," + font.toString("base64") + ") format('woff2');font-weight:100 900}:root{--font-geist-sans:Issue34Geist}";
    assert.ok(!/@import\s/.test(css)); for (const match of css.matchAll(/url\(([^)]*)\)/g)) assert.match(match[1]!.replaceAll(/["']/g, "").trim(), /^data:/); return { code: chunk.code, css, modules: Object.keys(chunk.modules) };
  } finally { await build.close(); }
}
