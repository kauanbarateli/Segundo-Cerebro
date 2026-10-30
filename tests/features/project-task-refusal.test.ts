import { describe, expect, it, vi } from "vitest";
import { isDefiniteProjectTaskRefusal } from "../../src/components/features/projetos/task-refusal";
import { ConnectedApplicationError, createConnectedApplication } from "../../src/lib/demo/connected-application";
import { journalBrowser } from "./helpers/journal-browser";

const owner = "10000000-0000-4000-8000-000000000001";
const json = (status: number, code: string) => new Response(JSON.stringify({ ok: false, code }), { status, headers: { "Content-Type": "application/json" } });

describe("recusas de tarefas no contexto do Projeto", () => {
  it.each([400, 403, 404])("primeiro HTTP %i libera a intenção mesmo sem feedback terminal", async status => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(status, status === 400 ? "VALIDATION" : "REFUSAL"));
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: journalBrowser().tab().journal });
    try {
      const input = { id: "task-from-project", status: "done" as const, client_id: "first-refused-intent" };
      const error = await app.commands.tasks.status(input).catch(value => value);
      expect(error).toBeInstanceOf(ConnectedApplicationError);
      expect(app.getCommandSnapshot().status).toBe("idle"); // First rejection has no terminal publication.
      expect(isDefiniteProjectTaskRefusal(error, false)).toBe(true);
      // A separate intention reaches transport, rather than being stuck replaying.
      await app.commands.tasks.status({ ...input, client_id: "after-definite-refusal" }).catch(() => undefined);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { app.dispose(); }
  });

  it("resposta perdida seguida de 404 preserva o mesmo envio protegido", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("lost response")).mockImplementation(async () => json(404, "NOT_FOUND"));
    const app = createConnectedApplication(owner, { fetch: fetcher, journal: journalBrowser().tab().journal });
    try {
      const input = { id: "task-from-project", status: "done" as const, client_id: "uncertain-intent" };
      const first = await app.commands.tasks.status(input).catch(value => value);
      expect(isDefiniteProjectTaskRefusal(first, false)).toBe(false);
      expect(app.getCommandSnapshot().status).toBe("pending");
      const later = await app.commands.tasks.status(input).catch(value => value);
      expect(isDefiniteProjectTaskRefusal(later, true)).toBe(false);
      expect(app.getCommandSnapshot().status).toBe("pending");
      expect(fetcher.mock.calls.map(([, options]) => JSON.parse(String(options?.body)).input)).toEqual([input, input]);
    } finally { app.dispose(); }
  });

  it.each(["UNKNOWN", "PENDING", "SESSION_CHANGED", "CLOSED", "JOURNAL_UNAVAILABLE"])("não libera por código %s ou erro não tipado", code => {
    expect(isDefiniteProjectTaskRefusal(new ConnectedApplicationError(code, "Not definitive"), false)).toBe(false);
    expect(isDefiniteProjectTaskRefusal(new Error(code), false)).toBe(false);
    expect(isDefiniteProjectTaskRefusal(new ConnectedApplicationError("FORBIDDEN", "May already have committed", true), false)).toBe(false);
  });
  it("VALIDATION após resposta incerta usa a prova exata de recibo do canal", () => {
    expect(isDefiniteProjectTaskRefusal(new ConnectedApplicationError("VALIDATION", "Definitive receipt refusal"), true)).toBe(true);
  });
});
