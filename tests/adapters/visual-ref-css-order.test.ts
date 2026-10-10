// Pure source graph/metadata contracts: no Git, IO, browser, server or pixel PASS.
import { describe, expect, it } from "vitest";
import { compareVisualPort, orderVisualCssImports, type TaskSummaryFlow, type VisualComparisonContext, type VisualMeasurements, type VisualMeasure } from "../e2e/helpers/issue22-visual-port";

const entry = 'import { App } from "../../../src/app.tsx";';
const css = "src/feature.css", buttonCss = "src/button.css";
const sources = () => new Map([
  ["src/app.tsx", 'import {Button} from "./button"; import "./feature.css"; export const App=()=> <Button/>;'],
  ["src/button.tsx", 'import "./button.css"; export const Button=()=> <button/>;'],
  [css, ".feature{padding-inline:0}"], [buttonCss, ".button{padding:8px 16px}"],
]);
const refused = (run: () => unknown) => expect(run).toThrow("VISUAL_CSS_GRAPH_REFUSED");
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
