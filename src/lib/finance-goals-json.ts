/** Pure bounded duplicate-key scan. Native JSON.parse owns JSON syntax and
 * values; keys are compared AFTER decoding escapes, before trusting its result. */
export function parseGoalJson(text: string, limits: { maxDepth: number; maxProperties: number }): unknown {
  function refused(): never { throw new Error("GOAL_JSON_REFUSED"); }
  if (!Number.isSafeInteger(limits.maxDepth) || limits.maxDepth < 1 || limits.maxDepth > 64 || !Number.isSafeInteger(limits.maxProperties) || limits.maxProperties < 1 || limits.maxProperties > 4096) return refused();
  let value: unknown;
  try { value = JSON.parse(text); } catch { return refused(); }
  let index = 0, properties = 0;
  const space = () => { while (index < text.length && /[ \t\r\n]/.test(text[index]!)) index++; };
  function stringToken(): string {
    const start = index++;
    while (index < text.length) {
      if (text[index] === "\\") index += 2;
      else if (text[index++] === '"') return text.slice(start, index);
    }
    return refused();
  }
  function walk(depth: number): void {
    space(); const token = text[index];
    if (token === "{" || token === "[") {
      if (depth > limits.maxDepth) refused();
      const object = token === "{", close = object ? "}" : "]", names = new Set<string>(); index++; space();
      if (text[index] === close) { index++; return; }
      while (index < text.length) {
        if (object) {
          const name: unknown = JSON.parse(stringToken());
          if (typeof name !== "string" || names.has(name) || ++properties > limits.maxProperties) refused();
          names.add(name); space(); if (text[index++] !== ":") refused();
        }
        walk(depth + 1); space();
        if (text[index] === close) { index++; return; }
        if (text[index++] !== ",") refused(); space();
      }
      refused();
    } else if (token === '"') stringToken();
    else { while (index < text.length && !/[ \t\r\n,\]}]/.test(text[index]!)) index++; }
  }
  walk(1); space(); if (index !== text.length) refused(); return value;
}
