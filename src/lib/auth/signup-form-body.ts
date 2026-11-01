/** Bounded urlencoded form parser. Never include received values in errors. */
export async function readSignupForm(request: Request, allowed: readonly string[]): Promise<Record<string, string> | null> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") return null;
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) return null;
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes), fields: Record<string, string> = Object.create(null);
    for (const pair of text.split("&")) {
      if (!pair) continue;
      const index = pair.indexOf("="); if (index < 0) return null;
      const key = decodeURIComponent(pair.slice(0, index).replace(/\+/g, " "));
      const value = decodeURIComponent(pair.slice(index + 1).replace(/\+/g, " "));
      if (!allowed.includes(key) || Object.hasOwn(fields, key)) return null;
      fields[key] = value;
    }
    return fields;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
