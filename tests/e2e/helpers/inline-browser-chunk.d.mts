/** Checks emitted JavaScript and finite self-only dynamic-import metadata.
 * Other standalone-output guards remain at the original fixture call site.
 */
export function assertInlineBrowserChunk(chunk: {
  readonly fileName: string;
  readonly dynamicImports: readonly string[];
  readonly code: string;
}): void;
