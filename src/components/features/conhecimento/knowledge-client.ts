"use client";
import { validarDocumento, type ComandoConhecimento, type ConhecimentoDTO, type LeituraPaginaDTO } from "@/core/conhecimento";
export class KnowledgeClientError extends Error { constructor(public readonly code: string, message: string, public readonly unknownOutcome = false) { super(message); this.name = "KnowledgeClientError"; } }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
async function response(response: Response, write = false): Promise<unknown> {
  let value: unknown; try { value = await response.json(); } catch { throw new KnowledgeClientError("INVALID_RESPONSE", write ? "O envio ainda não foi confirmado. Confirme o mesmo envio." : "A resposta recebida é inválida. Tente carregar novamente.", write); }
  if (!response.ok) { const code = object(value) && typeof value.code === "string" ? value.code : "UNAVAILABLE"; const known = ["VALIDATION", "CONFLICT", "NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED", "SESSION_CHANGED", "RATE_LIMITED"].includes(code); throw new KnowledgeClientError(code, object(value) && typeof value.message === "string" ? value.message : "Não foi possível concluir a operação.", write && !known); }
  return value;
}
export function createKnowledgeClient(userId: string, fetcher: typeof fetch = fetch, sender?: (command: string, input: unknown) => Promise<unknown>) {
  const headers = () => ({ "X-Expected-User-ID": userId });
  return {
    async load(signal?: AbortSignal): Promise<ConhecimentoDTO> {
      const value = await response(await fetcher("/api/knowledge", { headers: headers(), cache: "no-store", credentials: "same-origin", signal }));
      if (!object(value) || typeof value.revision !== "string" || !["notebooks", "pages", "refs", "links", "targets"].every(key => Array.isArray(value[key]))) throw new KnowledgeClientError("INVALID_RESPONSE", "Não foi possível validar suas páginas.");
      for (const row of [...value.notebooks as unknown[], ...value.pages as unknown[], ...value.refs as unknown[], ...value.links as unknown[]]) if (!object(row) || row.user_id !== userId || typeof row.id !== "string") throw new KnowledgeClientError("SESSION_CHANGED", "A resposta pertence a outra conta. Recarregue a página.");
      for (const page of value.pages as Record<string, unknown>[]) validarDocumento(page.document);
      return value as unknown as ConhecimentoDTO;
    },
    async page(id: string): Promise<LeituraPaginaDTO> { const value = await response(await fetcher(`/api/knowledge?page=${encodeURIComponent(id)}`, { headers: headers(), cache: "no-store", credentials: "same-origin" })); if (!object(value) || !object(value.page) || value.page.user_id !== userId || value.page.id !== id || !Array.isArray(value.backlinks) || !Array.isArray(value.related)) throw new KnowledgeClientError("INVALID_RESPONSE", "Não foi possível validar a página."); validarDocumento(value.page.document); return value as unknown as LeituraPaginaDTO; },
    async command(request: ComandoConhecimento): Promise<unknown> {
      if (sender) {
        try { return await sender(request.command, request.input); }
        catch (failure) { const value = failure as { code?: string; message?: string; outcomeUnknown?: boolean }; throw new KnowledgeClientError(value.code ?? "UNAVAILABLE", value.message ?? "Não foi possível salvar.", value.outcomeUnknown === true); }
      }
      let reply: Response; try { reply = await fetcher("/api/knowledge", { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(request) }); } catch { throw new KnowledgeClientError("COMMIT_UNKNOWN", "O envio ainda não foi confirmado. Confirme o mesmo envio.", true); }
      const value = await response(reply, true); if (!object(value) || value.ok !== true || !Object.hasOwn(value, "result")) throw new KnowledgeClientError("COMMIT_UNKNOWN", "O envio ainda não foi confirmado. Confirme o mesmo envio.", true); return value.result;
    },
  };
}
