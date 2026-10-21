import { describe, expect, it, vi } from "vitest";
import { createConnectedApplication } from "../../src/lib/demo/connected-application";
import { journalBrowser } from "./helpers/journal-browser";
import type { HabitoDoUsuario } from "../../src/core/contracts";
import { frequenciaInicial } from "../../src/core/habitos";

const owner = "10000000-0000-4000-8000-000000000001";
const habit: HabitoDoUsuario = { id: "10000000-0000-4000-8000-000000000002", user_id: owner, name: "Ler", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: "2026-10-19", archived_at: null, color_key: "personal", icon_key: null, position: 0, created_at: "2026-10-21T15:00:00Z", updated_at: "2026-10-21T15:00:00Z" };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const input = { id: habit.id, patch: { name: habit.name }, client_id: "same-habit-update" };

describe("SPEC08 connected habit history boundary", () => {
  it("accepts legacy absence and canonical created history, including a private image reference", async () => {
    for (const row of [habit, { ...habit, frequency_history: frequenciaInicial(habit), image_file_id: owner }]) {
      const app = createConnectedApplication(owner, { journal: journalBrowser().tab().journal, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ items: [row], entries: [], pauses: [] })) });
      try { await app.load("habits"); expect(app.getSnapshot("habits")).toMatchObject({ status: "ready", data: { items: [row] } }); }
      finally { app.dispose(); }
    }
  });
  it.each([{ frequency_history: null }, { frequency_history: {} }, { image_file_id: "https://foreign.invalid/photo" }, { user_id: "foreign" }])("rejects corrupt/foreign read without fabricating a legacy habit %#", async patch => {
    const app = createConnectedApplication(owner, { journal: journalBrowser().tab().journal, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ items: [{ ...habit, ...patch }], entries: [], pauses: [] })) });
    try { await app.load("habits"); expect(app.getSnapshot("habits")).toMatchObject({ status: "error", data: null }); }
    finally { app.dispose(); }
  });
  it("malformed ACK keeps the exact intention pending until its valid replay", async () => {
    const browser = journalBrowser(), fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ok: true, result: { ...habit, frequency_history: null } })).mockResolvedValueOnce(json({ ok: true, result: { ...habit, frequency_history: frequenciaInicial(habit) } }));
    const app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: fetcher });
    try {
      await expect(app.executeDomainCommand("habit.update", input)).rejects.toMatchObject({ outcomeUnknown: true });
      expect(browser.entries()).toHaveLength(1);
      await expect(app.executeDomainCommand("habit.update", input)).resolves.toMatchObject({ id: habit.id });
      expect(fetcher.mock.calls).toHaveLength(2);
      expect(fetcher.mock.calls[1]![1]!.body).toBe(fetcher.mock.calls[0]![1]!.body);
      expect(browser.entries()).toHaveLength(0);
    } finally { app.dispose(); }
  });
});
