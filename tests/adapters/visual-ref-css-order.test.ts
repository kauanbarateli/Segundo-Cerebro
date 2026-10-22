// Pure source graph/metadata contracts: no Git, IO, browser, server or pixel PASS.
import { describe, expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { compareVisualPort, measureVisualPort, orderVisualCssImports, qualifyVisualLandingTokens, qualifyVisualStableSource, visualCanonicalMigrationInventory, type TaskSummaryFlow, type VisualComparisonContext, type VisualMeasurements, type VisualMeasure, type VisualTree } from "../e2e/helpers/issue22-visual-port";
import canonicalManifest from "../../supabase/sql-editor/manifest.json";

const entry = 'import { App } from "../../../src/app.tsx";';
const css = "src/feature.css", buttonCss = "src/button.css";
const sources = () => new Map([
  ["src/app.tsx", 'import {Button} from "./button"; import "./feature.css"; export const App=()=> <Button/>;'],
  ["src/button.tsx", 'import "./button.css"; export const Button=()=> <button/>;'],
  [css, ".feature{padding-inline:0}"], [buttonCss, ".button{padding:8px 16px}"],
]);
const refused = (run: () => unknown) => expect(run).toThrow("VISUAL_CSS_GRAPH_REFUSED");

describe("only C accepts the exact approved landing additions without changing historical contracts", () => {
  const tokensPath = "design-system/tokens/tokens.json";
  const oldTokensHash = "9e75b6a70d442a0e78199c10cddac0e3b2e7bb9535766a479f9b2b3e6f516ded", newTokensHash = "1aed0fb69db845288070e30c3ba7e6eb22dc10c7af907413181e6084891ca208";
  const oldDesignHash = "f8358b0ffd7fe442ae516eb06a264482018b30605350cbeec671cd07b8c3e1c0", newDesignHash = "295cfffd3c2be542787d4896efea2439553205b4a962ac0dab067ae1f10b2f93";
  const baseline = () => ({ meta: { classification: { prototype: "OBSERVADO synthetic", recommended: "RECOMENDADO synthetic" } },
    color: { light: { canvas: "#f5f5f2" }, dark: { canvas: "#0d0d0c" } },
    typography: { family: "Synthetic Geist", scale: { h2: { fontSize: "28px", status: "OBSERVADO" } } },
    spacing: { order: [4, 8, 12], optional: null } });
  const landing = () => {
    const value = baseline();
    return { ...value, meta: { ...value.meta, classification: { ...value.meta.classification,
      persuasion: "RECOMENDADO: papéis vitrine (título de apresentação, teto de 96px) e chamada (parágrafo de abertura) atendem a superfície comercial /conheca, aprovados pelo mantenedor em 12/10/2026. Não substituem display/h2 nas telas operacionais." } },
    typography: { ...value.typography, scale: { ...value.typography.scale,
      vitrine: { fontSize: "clamp(40px, 7.4vw, 96px)", lineHeight: "1.04", fontWeight: "600", letterSpacing: "-0.035em", status: "RECOMENDADO" },
      chamada: { fontSize: "clamp(18px, 1.5vw, 22px)", lineHeight: "1.45", fontWeight: "400", letterSpacing: "-0.01em", status: "RECOMENDADO" } } } };
  };
  const reject = (run: () => unknown) => expect(run).toThrow("VISUAL_STABLE_SOURCE_CHANGED");
  it("accepts old hashes for every tree and the two reviewed new hashes only for C", () => {
    for (const tree of ["B", "P", "C"] as const) {
      expect(qualifyVisualStableSource(tree, tokensPath, oldTokensHash)).toBe("baseline");
      expect(qualifyVisualStableSource(tree, "DESIGN.md", oldDesignHash)).toBe("baseline");
    }
    expect(qualifyVisualStableSource("C", tokensPath, newTokensHash)).toBe("landing");
    expect(qualifyVisualStableSource("C", "DESIGN.md", newDesignHash)).toBe("landing");
    for (const tree of ["B", "P"] as const) {
      reject(() => qualifyVisualStableSource(tree, tokensPath, newTokensHash));
      reject(() => qualifyVisualStableSource(tree, "DESIGN.md", newDesignHash));
    }
  });
  it("rejects unknown hashes, paths, trees and reviewed hashes attached to another path", () => {
    for (const hash of ["0".repeat(64), newTokensHash.toUpperCase(), newTokensHash + "0"]) reject(() => qualifyVisualStableSource("C", tokensPath, hash));
    reject(() => qualifyVisualStableSource("C", "src/app/globals.css", newDesignHash));
    reject(() => qualifyVisualStableSource("C", "DESIGN.md", newTokensHash));
    reject(() => qualifyVisualStableSource("C", "other.md", oldDesignHash));
    reject(() => qualifyVisualStableSource("unknown" as VisualTree, tokensPath, oldTokensHash));
    reject(() => qualifyVisualStableSource("C", "DESIGN.md", "0".repeat(64)));
  });
  it("accepts the reviewed layout Codex sources only for C and only on their own path", () => {
    const layout = { "src/app/globals.css": "aa336f005def50c4fa98477342414f47137fe376af75addc9c8543733bccb5ef",
      "DESIGN.md": "7596001a608df62b3b2d0db4d351a3af8af168994a196bdfaa63b8928b42e811",
      "src/components/features/capturar/capture.css": "b8733bda20b8f1a0dba4e17dcf3c1d01e78bb82040df6ba988d75fc997bc357a",
      "src/components/features/tarefas/tasks.css": "04027f2a365b5c4f84b7c91aa23681edf175e9ff4b904805e8fcde73a648ed36" } as const;
    for (const [path, hash] of Object.entries(layout)) {
      expect(qualifyVisualStableSource("C", path, hash)).toBe("layout");
      for (const tree of ["B", "P"] as const) reject(() => qualifyVisualStableSource(tree, path, hash));
    }
    reject(() => qualifyVisualStableSource("C", "src/app/globals.css", layout["DESIGN.md"]));
    reject(() => qualifyVisualStableSource("C", tokensPath, layout["src/app/globals.css"]));
    // A previous C stylesheet cannot silently stand in for the rich editor.
    reject(() => qualifyVisualStableSource("C", "src/components/features/capturar/capture.css", "6e1e5a8509fe70aaed1ec03170ca554825948be5ee73fc88c3d2f2cb561eabf8"));
    // The superseded C task stylesheet is not a fallback for the Kanban source.
    reject(() => qualifyVisualStableSource("C", "src/components/features/tarefas/tasks.css", "b8761b0d51dad1a1c69737ddeedbeff884944a6ce6f7d06977efea0ef50aaa65"));
    reject(() => qualifyVisualStableSource("C", "src/components/features/tarefas/tasks.css", "8c41974b318c3d94f618dc8ae08982f7fef5217f642fec7ed30a158b93da3816"));
    expect(qualifyVisualStableSource("C", "DESIGN.md", newDesignHash)).toBe("landing");
  });
  it("qualifies only the reviewed product planning blob for C and preserves both historical refs", () => {
    const historical = "286c22f061519355978ac2fe51e99860cf88e551027025b9e8e1c247df17a7cb";
    const approved = "de22bc82a696ff491b34463abac104b42708621bcc49c0ada668c0d73d021939";
    for (const tree of ["B", "P", "C"] as const) expect(qualifyVisualStableSource(tree, "PRODUCT.md", historical)).toBe("baseline");
    expect(qualifyVisualStableSource("C", "PRODUCT.md", approved)).toBe("planning");
    for (const tree of ["B", "P"] as const) reject(() => qualifyVisualStableSource(tree, "PRODUCT.md", approved));
    for (const hash of ["0".repeat(64), approved.toUpperCase(), approved + "0"]) reject(() => qualifyVisualStableSource("C", "PRODUCT.md", hash));
    for (const path of ["DESIGN.md", "src/app/globals.css", tokensPath, "other.md"]) reject(() => qualifyVisualStableSource("C", path, approved));
  });
  it("removes only the three exact additions and compares the whole historical object without mutating inputs", () => {
    const old = baseline(), current = landing(), before = structuredClone(current), oldBefore = structuredClone(old);
    expect(() => qualifyVisualLandingTokens(current, old)).not.toThrow();
    expect(current).toEqual(before); expect(old).toEqual(oldBefore);
    expect(() => qualifyVisualLandingTokens({ typography: current.typography, color: current.color, spacing: current.spacing, meta: current.meta }, old)).not.toThrow();
  });
  it("rejects changes in old colors, themes, typography, classification, array order and value types", () => {
    for (const mutate of [(value: ReturnType<typeof landing>) => { value.color.light.canvas = "#ffffff"; },
      (value: ReturnType<typeof landing>) => { value.color.dark.canvas = "#000000"; },
      (value: ReturnType<typeof landing>) => { value.typography.scale.h2.fontSize = "29px"; },
      (value: ReturnType<typeof landing>) => { value.meta.classification.prototype = "changed"; },
      (value: ReturnType<typeof landing>) => { value.spacing.order.reverse(); },
      (value: ReturnType<typeof landing>) => { Object.assign(value.spacing, { optional: "null" }); }]) {
      const value = landing(); mutate(value); reject(() => qualifyVisualLandingTokens(value, baseline()));
    }
  });
  it("rejects extra fields anywhere and every change or omission in an approved role", () => {
    for (const target of ["root", "classification", "oldRole", "newRole"] as const) {
      const value = landing(); Object.assign(target === "root" ? value : target === "classification" ? value.meta.classification
        : target === "oldRole" ? value.typography.scale.h2 : value.typography.scale.vitrine, { extra: "unreviewed" });
      reject(() => qualifyVisualLandingTokens(value, baseline()));
    }
    for (const role of ["vitrine", "chamada"] as const) for (const key of ["fontSize", "lineHeight", "fontWeight", "letterSpacing", "status"] as const) {
      const changed = landing(); changed.typography.scale[role][key] = "changed"; reject(() => qualifyVisualLandingTokens(changed, baseline()));
      const missing = landing(); Reflect.deleteProperty(missing.typography.scale[role], key); reject(() => qualifyVisualLandingTokens(missing, baseline()));
    }
    const changed = landing(); changed.meta.classification.persuasion += " changed"; reject(() => qualifyVisualLandingTokens(changed, baseline()));
    const missing = landing(); Reflect.deleteProperty(missing.meta.classification, "persuasion"); reject(() => qualifyVisualLandingTokens(missing, baseline()));
  });
  it("rejects invalid historical shape, preextended baseline and non-JSON providers without reading getters", () => {
    for (const old of [null, [], {}, landing()]) reject(() => qualifyVisualLandingTokens(landing(), old));
    const current = landing(); let reads = 0;
    Object.defineProperty(current.meta.classification, "persuasion", { enumerable: true, get() { reads++; throw new Error("unread"); } });
    reject(() => qualifyVisualLandingTokens(current, baseline())); expect(reads).toBe(0);
    const cyclic = landing(); Object.assign(cyclic, { cycle: cyclic }); reject(() => qualifyVisualLandingTokens(cyclic, baseline()));
  });
});

describe("the visual backend records the current canonical SQL inputs, not an application ledger", () => {
  const names = canonicalManifest.installation.map(row => row.source.split("/").at(-1)!);
  const refuseInventory = (run: () => unknown) => expect(run).toThrow("VISUAL_MIGRATION_INVENTORY_CHANGED");
  it("accepts the real22-file manifest and preserves018/019/020/021 beside reviewed022 bytes and digest", () => {
    const plan = visualCanonicalMigrationInventory(names, canonicalManifest);
    expect(plan).toHaveLength(22);
    expect(plan[17]).toEqual({ source: "supabase/migrations/20261011071500_admin_auth_creation_order.sql", bytes: 4717,
      sha256: "91d91aa94883f803139f30c250fc92322de31cc6c29df293462eac8e459c4a99" });
    expect(plan[18]).toEqual({ source: "supabase/migrations/20261011113751_own_sessions.sql", bytes: 4115,
      sha256: "0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57" });
    expect(plan[19]).toEqual({ source: "supabase/migrations/20261021045700_spec08_private_entity_images.sql", bytes: 17601,
      sha256: "385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2" });
    expect(plan[20]).toEqual({ source: "supabase/migrations/20261021144650_spec08_habit_frequency_history.sql", bytes: 23511,
      sha256: "90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e" });
    expect(plan[21]).toEqual({ source: "supabase/migrations/20261021171416_spec08_capture_document_write.sql", bytes: 32167,
      sha256: "431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38" });
  });
  it("rejects19/20/21,23,duplicate,substituted or reordered inventories even with valid-looking filenames", () => {
    for (const changed of [names.slice(0, 19), names.slice(0, 20), names.slice(0, 21), [...names, "20261022000000_foreign.sql"], [...names.slice(0, 21), names[0]!],
      [...names.slice(0, 21), "20261021171416_foreign.sql"], [...names].reverse()]) refuseInventory(() => visualCanonicalMigrationInventory(changed, canonicalManifest));
  });
  it("rejects altered manifest order, version, source, digest, bytes and generated-copy identity", () => {
    for (const index of [18, 20, 21]) for (const field of ["order", "version", "source", "sha256", "bytes", "file"] as const) {
      const changed = structuredClone(canonicalManifest);
      Object.assign(changed.installation[index]!, { [field]: field === "order" ? index : field === "bytes" ? 0 : "foreign" });
      refuseInventory(() => visualCanonicalMigrationInventory(names, changed));
    }
    refuseInventory(() => visualCanonicalMigrationInventory(names, { ...canonicalManifest, formatVersion: 2 }));
    refuseInventory(() => visualCanonicalMigrationInventory(names, { ...canonicalManifest, hashAlgorithm: "sha1" }));
    refuseInventory(() => visualCanonicalMigrationInventory(names, { ...canonicalManifest, installation: canonicalManifest.installation.slice(0, 18) }));
    for (const index of [18, 20, 21]) {
      const wrongCopyName = structuredClone(canonicalManifest);
      wrongCopyName.installation[index]!.file = index === 18
        ? "installation/019_20261011113751_foreign.sql"
        : index === 20 ? "installation/021_20261021144650_foreign.sql"
        : "installation/022_20261021171416_foreign.sql";
      refuseInventory(() => visualCanonicalMigrationInventory(names, wrongCopyName));
    }
  });
});
describe("CSS from one ref is ordered by declarations rather than async discovery", () => {
  it("visits dependency CSS before the importing component CSS", () => {
    expect(orderVisualCssImports(entry, sources(), [css, buttonCss])).toEqual([buttonCss, css]);
  });
  it("map insertion and resolver discovery order cannot change the cascade", () => {
    const forward = sources(), reverse = new Map([...forward].reverse());
    expect(orderVisualCssImports(entry, forward, [css, buttonCss])).toEqual(orderVisualCssImports(entry, reverse, [buttonCss, css]));
  });
  it("CSS deduplication and a runtime module cycle remain finite and ordered", () => {
    const graph = sources(); graph.set("src/app.tsx", 'import {Button} from "./button"; import "./button.css"; import "./feature.css"; export const App=()=> <Button/>;');
    graph.set("src/button.tsx", 'import {App} from "./app"; import "./button.css"; export const Button=()=> <button/>;');
    expect(orderVisualCssImports(entry, graph, [css, buttonCss])).toEqual([buttonCss, css]);
  });
  it("type-only imports and reexports are excluded without reading their missing sources", () => {
    const graph = sources(); graph.set("src/app.tsx", 'import type {Hidden} from "./missing"; import {type Other} from "./also-missing"; export type {X} from "./third-missing"; export {type Y} from "./fourth-missing"; import {Button} from "./button"; import "./feature.css"; export const App=()=> <Button/>; type Lazy=import("./type-only-lazy").Value;');
    expect(orderVisualCssImports(entry, graph, [css, buttonCss])).toEqual([buttonCss, css]);
  });
  it("mixed value/type imports and runtime reexports retain their side-effect CSS", () => {
    const graph = sources(); graph.set("src/app.tsx", 'import {type Hidden,Button} from "./barrel"; import "./feature.css"; export const App=()=> <Button/>;');
    graph.set("src/barrel.ts", 'export {type Hidden,Button} from "./button";');
    expect(orderVisualCssImports(entry, graph, [css, buttonCss])).toEqual([buttonCss, css]);
  });
  it("unknown modules, ambiguous ref paths and external dependencies refuse", () => {
    for (const value of ['import "./missing";', 'import "unexpected-package";', 'import "next/unregistered";']) {
      const graph = sources(); graph.set("src/app.tsx", value); refused(() => orderVisualCssImports(entry, graph, []));
    }
    const ambiguous = sources(); ambiguous.set("src/button.ts", "export const Button=1;"); refused(() => orderVisualCssImports(entry, ambiguous, [css, buttonCss]));
  });
  it("qualifies the neutral editor's exact SDK imports only for C, preserving historical and path boundaries", () => {
    const editor = "src/components/editor/document-editor.tsx", editorCss = "src/components/editor/document-editor.css";
    const source = 'import {Node} from "@tiptap/core"; import {useEditor} from "@tiptap/react"; import StarterKit from "@tiptap/starter-kit"; import "./document-editor.css"; export default function Editor(){return null;}';
    const graph = new Map([[editor, source], [editorCss, ".document-editor{font-size:16px}"]]);
    const editorEntry = 'import Editor from "@/components/editor/document-editor";';
    expect(orderVisualCssImports(editorEntry, graph, [editorCss], "C")).toEqual([editorCss]);
    for (const tree of ["B", "P"] as const) refused(() => orderVisualCssImports(editorEntry, graph, [editorCss], tree));
    refused(() => orderVisualCssImports(editorEntry, graph, [editorCss]));
    for (const dependency of ["@tiptap/core/", "@tiptap/core/../../escape", "@tiptap/extension-link", "unexpected-package"]) {
      const invalid = new Map(graph); invalid.set(editor, source.replace('"@tiptap/core"', JSON.stringify(dependency)));
      refused(() => orderVisualCssImports(editorEntry, invalid, [editorCss], "C"));
    }
    const moved = new Map([["src/other.tsx", 'import {Node} from "@tiptap/core"; export default null;']]);
    refused(() => orderVisualCssImports('import Other from "@/other";', moved, [], "C"));
    const dynamic = new Map(graph); dynamic.set(editor, source + ' import("@tiptap/core");');
    refused(() => orderVisualCssImports(editorEntry, dynamic, [editorCss], "C"));
  });
  it("path escapes and runtime dynamic imports refuse without a source fallback", () => {
    for (const value of ['import "../../outside";', 'import "@/../outside";', 'import("./button");', 'const target="./button"; import(target);', 'import button = require("./button");']) {
      const graph = sources(); graph.set("src/app.tsx", value); refused(() => orderVisualCssImports(entry, graph, []));
    }
  });
  it("missing, extra or duplicate discovered CSS refuse even if parsing succeeds", () => {
    refused(() => orderVisualCssImports(entry, sources(), [css]));
    refused(() => orderVisualCssImports(entry, sources(), [css, buttonCss, "src/unused.css"]));
    refused(() => orderVisualCssImports(entry, sources(), [css, buttonCss, css]));
  });
  it("malformed source, CSS imports and bounded graph/source overflow refuse", () => {
    const malformed = sources(); malformed.set("src/app.tsx", 'import {Button from "./button";'); refused(() => orderVisualCssImports(entry, malformed, [css, buttonCss]));
    const nested = sources(); nested.set(css, '@import "./extra.css";'); refused(() => orderVisualCssImports(entry, nested, [css, buttonCss]));
    const huge = sources(); huge.set("src/app.tsx", " ".repeat(2 * 1024 * 1024 + 1)); refused(() => orderVisualCssImports(entry, huge, [css, buttonCss]));
    const oversized = sources(); for (let index = 0; index < 901; index++) oversized.set(`src/unseen-${index}.ts`, "export {};");
    refused(() => orderVisualCssImports(entry, oversized, [css, buttonCss]));
  });
});

const summaryText = "5 abertas · 1 atrasada · 2 concluídas", beforeNote = "Dia de exemplo: 23/09/2026. Alterações valem nesta sessão.", afterNote = "Hoje: 23/09/2026. Tarefas salvas na sua conta.";
const context: VisualComparisonContext = { from: "B", to: "P", scene: "tasks", taskSummaryCopy: { summaryText, beforeNote, afterNote } };
// Invoke the actual measurement callback with synthetic DOM geometry only.
// This checks Range fragment semantics; it is not a browser or visual PASS.
async function measureNoteFragments(yValues: number[]) {
  const rect = { x: 300, y: 224, width: 330, height: yValues.length ? 18 : 0 };
  const note = { textContent: beforeNote, getBoundingClientRect: () => rect };
  const parent = { tagName: "DIV", style: { width: "" }, querySelector: () => note, getBoundingClientRect: () => ({ ...rect, y: 200, height: 47 }) };
  const summary = { parentElement: parent }, computed = { display: "block", flexBasis: "auto", flexGrow: "0", fontFamily: "FixtureGeist", fontSize: "12px", lineHeight: "18px", letterSpacing: "normal", getPropertyValue: () => "" };
  vi.stubGlobal("document", { querySelector: () => summary, querySelectorAll: () => [], documentElement: { getAttribute: () => "light" },
    createRange: () => ({ selectNodeContents() {}, getClientRects: () => [...yValues.map(y => ({ ...rect, y, width: 80 })), { ...rect, width: 0 }] }) });
  vi.stubGlobal("getComputedStyle", () => computed); vi.stubGlobal("location", { pathname: "/tarefas", search: "" });
  try {
    const page = { evaluate: async (callback: (args: unknown) => unknown, args: unknown) => callback(args) } as unknown as Page;
    return (await measureVisualPort(page)).taskSummaryFlow!.noteLineCount;
  } finally { vi.unstubAllGlobals(); }
}
describe("the real measurement counts physical text lines rather than React fragments", () => {
  it("three text fragments at the same vertical position form one line", async () => {
    expect(await measureNoteFragments([225, 225, 225])).toBe(1);
  });
  it("wrapped fragments retain every distinct line and zero-size fragments are excluded", async () => {
    expect(await measureNoteFragments([225, 225, 243, 243])).toBe(2);
    expect(await measureNoteFragments([225, 243, 261])).toBe(3);
    expect(await measureNoteFragments([])).toBe(0);
  });
});
function measurements(width: number, noteText: string): VisualMeasurements {
  const rect = { x: 300, y: 200, width, height: 24 };
  const summary: VisualMeasure = { selector: ".tasks-summary:0", tag: "P", text: summaryText, role: "status", label: null, href: null, value: null, rect,
    styles: { display: "block", fontFamily: "FixtureGeist", fontSize: "16px", lineHeight: "24px", paddingLeft: "0px", paddingRight: "0px", justifyContent: "normal", textAlign: "start" } };
  const taskSummaryFlow: TaskSummaryFlow = { parentTag: "DIV", parentDisplay: "block", parentInlineWidth: "", parentFlexBasis: "auto", parentFlexGrow: "0",
    parentRect: { x: 300, y: 200, width, height: 44 }, summaryDisplay: "block", noteText, noteRect: { x: 300, y: 224, width, height: 20 }, noteLineCount: 1,
    noteStyles: { fontFamily: "FixtureGeist", fontSize: "14px", lineHeight: "20px", letterSpacing: "normal" } };
  return { theme: "light", tokens: { "--target": "44px" }, duplicateIds: [], brokenAssociations: [], domainUrl: "/tarefas", elements: [summary], taskSummaryFlow };
}
describe("only a proven B to P summary copy reflow remains a raw review difference", () => {
  it("no context keeps summary width strict; valid evidence never auto-accepts visual appearance", () => {
    const before = measurements(330, beforeNote), after = measurements(260, afterNote);
    expect(compareVisualPort(before, after).violations).toHaveLength(1);
    const result = compareVisualPort(before, after, context);
    expect(result.violations).toEqual([]); expect(result.differences).toEqual([{ selector: ".tasks-summary:0", field: "rect.width", before: 330, after: 260, disposition: "review-required" }]);
    expect(result.visualAcceptance).toBe("INDEPENDENT_REVIEW_REQUIRED");
  });
  it("other pairs/scenes, missing proof and changed copy/summary keep width strict", () => {
    const before = measurements(330, beforeNote), after = measurements(260, afterNote);
    for (const changed of [{ ...context, from: "P" as const, to: "C" as const }, { ...context, scene: "capture" as const }, { from: "B", to: "P", scene: "tasks" } as const]) expect(compareVisualPort(before, after, changed).violations).toHaveLength(1);
    for (const mutate of [(value: VisualMeasurements) => { value.taskSummaryFlow = null; }, (value: VisualMeasurements) => { value.taskSummaryFlow!.noteText = "Unreviewed copy"; }, (value: VisualMeasurements) => { value.elements[0]!.text = "Different total"; }]) {
      const altered = structuredClone(after); mutate(altered); expect(compareVisualPort(before, altered, context).violations.some(delta => delta.field === "rect.width")).toBe(true);
    }
  });
  it("changed x/style, fixed parent, wrapping note or mismatched widths invalidate the copy explanation", () => {
    const before = measurements(330, beforeNote), after = measurements(260, afterNote);
    for (const mutate of [(value: VisualMeasurements) => { value.elements[0]!.rect.x++; }, (value: VisualMeasurements) => { value.elements[0]!.styles.textAlign = "center"; },
      (value: VisualMeasurements) => { value.taskSummaryFlow!.parentInlineWidth = "260px"; }, (value: VisualMeasurements) => { value.taskSummaryFlow!.parentFlexGrow = "1"; },
      (value: VisualMeasurements) => { value.taskSummaryFlow!.noteRect.height = 40; }, (value: VisualMeasurements) => { value.taskSummaryFlow!.noteLineCount = 2; }, (value: VisualMeasurements) => { value.taskSummaryFlow!.parentRect.width = 259; },
      (value: VisualMeasurements) => { value.taskSummaryFlow!.noteStyles.fontSize = "13px"; }]) {
      const altered = structuredClone(after); mutate(altered); expect(compareVisualPort(before, altered, context).violations.some(delta => delta.field === "rect.width")).toBe(true);
    }
  });
  it("table/title/button widths and padding/alignment are never exempted by summary copy", () => {
    const before = measurements(330, beforeNote), after = measurements(260, afterNote);
    for (const selector of [".ui-data-table td:0", ".tasks-title-button:0", ".ui-data-table__cards > li:0", ".capture-chip:0", ".capture-save:0"]) {
      const left = structuredClone(before), right = structuredClone(after); left.elements[0]!.selector = selector; right.elements[0]!.selector = selector;
      right.elements[0]!.styles.paddingLeft = "16px"; right.elements[0]!.styles.justifyContent = "center";
      const result = compareVisualPort(left, right, context);
      expect(result.violations.map(delta => delta.field)).toEqual(["rect.width", "style.paddingLeft", "style.justifyContent"]);
    }
  });
});
