import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { assertInlineBrowserChunk } from "../e2e/helpers/inline-browser-chunk.mjs";

const fileName = "issue26-27-finance-browser.js";
const iife = '(function(){ const namespace = Object.freeze({ value: 1 }); Promise.resolve().then(() => namespace); })();';
const chunk = (code = iife, dynamicImports = []) => ({ fileName, code, dynamicImports });

test("an import-free IIFE accepts empty metadata without rewriting it", () => {
  const value = chunk(), before = structuredClone(value);
  assertInlineBrowserChunk(value); assert.deepEqual(value, before);
});

test("one literal self-edge is accepted only with import-free emitted JavaScript", () => {
  const value = chunk(iife, [fileName]), before = structuredClone(value);
  assertInlineBrowserChunk(value); assert.deepEqual(value, before);
});

test("external, substituted, duplicate, mixed and malformed metadata is refused", () => {
  for (const dynamicImports of [["other.js"], ["./" + fileName], [fileName, fileName], [fileName, "other.js"], [undefined], [1], null, {}, ""]) {
    const value = chunk(iife, dynamicImports), before = structuredClone(value);
    assert.throws(() => assertInlineBrowserChunk(value)); assert.deepEqual(value, before);
  }
  const sparse = Array(1);
  assert.throws(() => assertInlineBrowserChunk(chunk(iife, sparse)));
  assert.equal(Object.hasOwn(sparse, 0), false);
  const inherited = Array(1);
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 0: fileName }));
  assert.equal(inherited[0], fileName); assert.equal(Object.hasOwn(inherited, 0), false);
  assert.throws(() => assertInlineBrowserChunk(chunk(iife, inherited)));
  assert.equal(Object.hasOwn(inherited, 0), false);
  for (const name of [undefined, "", "../" + fileName, "/" + fileName, "https://example.invalid/a.js", "bundle.css"]) {
    assert.throws(() => assertInlineBrowserChunk({ ...chunk(), fileName: name }));
  }
});

test("literal, computed and lexically separated dynamic imports are refused even with self metadata", () => {
  for (const code of ['(function(){ return import("./part.js"); })();', '(function(name){ return import(name); })("./part.js");', '(function(){ return import /* separation */ ("./part.js"); })();', '(function(){ return import\n("./part.js"); })();']) {
    assert.equal(ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS).parseDiagnostics.length, 0);
    for (const metadata of [[], [fileName]]) assert.throws(() => assertInlineBrowserChunk(chunk(code, metadata)));
  }
});

test("static imports and external re-exports are refused with empty metadata", () => {
  for (const code of ['import "./part.js";', 'import value from "./part.js";', 'import { value } from "./part.js";', 'export * from "./part.js";', 'export { value } from "./part.js";', 'import value = require("./part.js");']) {
    assert.throws(() => assertInlineBrowserChunk(chunk(code)));
  }
});

test("import.meta is refused without relying on a dynamic-import call regex", () => {
  for (const code of ['(function(){ return import.meta.url; })();', '(function(){ return import.meta.resolve("./part.js"); })();']) {
    assert.throws(() => assertInlineBrowserChunk(chunk(code, [fileName])));
  }
});

test("empty, malformed and non-string output is refused", () => {
  for (const code of ["", "(function(){", "import(\"./part.js\"", undefined, null, {}, 1]) assert.throws(() => assertInlineBrowserChunk({ fileName, dynamicImports: [], code }));
});
