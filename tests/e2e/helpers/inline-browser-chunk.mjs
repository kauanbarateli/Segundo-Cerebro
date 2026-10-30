/** Standalone browser fixture guard. Rolldown metadata may retain one internal
 * self-edge after inlining; the emitted JavaScript must still contain no imports.
 * This does not rewrite metadata, transform the product or execute the bundle.
 */
import assert from "node:assert/strict";
import ts from "typescript";

export function assertInlineBrowserChunk(chunk) {
  assert.equal(typeof chunk.fileName, "string", "A named standalone chunk is required.");
  assert.match(chunk.fileName, /^[A-Za-z0-9][A-Za-z0-9_.-]*\.js$/, "A single relative JavaScript filename is required.");
  assert.ok(Array.isArray(chunk.dynamicImports), "Dynamic import metadata must be an array.");
  assert.ok(chunk.dynamicImports.length <= 1, "Only one internal self-edge is permitted.");
  assert.ok(chunk.dynamicImports.length === 0 || (Object.hasOwn(chunk.dynamicImports, 0) && chunk.dynamicImports[0] === chunk.fileName), "External, absent or substituted dynamic imports are refused.");
  assert.equal(typeof chunk.code, "string", "Emitted JavaScript is required.");
  assert.ok(chunk.code.length > 0, "An empty bundle is refused.");

  const source = ts.createSourceFile(chunk.fileName, chunk.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0, "Malformed emitted JavaScript is refused.");
  let containsImport = false;
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) ||
        (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) ||
        (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword)) containsImport = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(containsImport, false, "Runtime imports, import.meta and re-exports are refused.");
}
