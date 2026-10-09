import { describe, expect, it } from "vitest";
import { calendarDay, calendarDays, calendarView, eventsOnDay, meetingNoteFields, shiftPeriod, timedSegments } from "../../src/components/features/calendario/calendar-projections";
import { createDemoApplication } from "../../src/lib/demo/application";
import { draftFrom, validateDraft } from "../../src/components/features/capturar/model";
import type { AgendaEvent } from "../../src/lib/demo/types";

const event = (id: string, starts_at: string, ends_at: string, all_day = false): AgendaEvent => ({
  id, title: id, starts_at, ends_at, all_day, location: null, linked_capture_id: null, habit_id: null,
});
describe("Calendário: datas civis e intervalos", () => {
  it("nota de reunião longa conserva contexto e pode ser editada e convertida", async () => {
    const title = "Reunião com título extenso para registrar decisões e contexto: ".repeat(4);
    const fields = meetingNoteFields({ title, starts_at: "2026-09-23T12:00:00Z" });
    const app = createDemoApplication({ initial: {} });
    try {
      const note = await app.commands.captures.create({ ...fields, type: "note", category_id: null, project_id: null, client_id: "long-meeting" });
      expect(note.title).toHaveLength(120);
      expect(note.content).toContain(title);
      const draft = draftFrom(note);
      draft.content += "\nDecisão registrada.";
      expect(validateDraft(draft, [note])).toBeNull();
      await app.commands.captures.update({ id: note.id, client_id: "edit-meeting", patch: { content: draft.content } });
      const converted = await app.commands.captures.convert({ capture_id: note.id, client_id: "convert-meeting" });
      expect(converted.tarefa.title).toBe(note.title);
      expect(converted.tarefa.description).toContain(title);
      expect(converted.tarefa.description).toContain("Decisão registrada.");
      expect(converted.tarefa.origin_capture_id).toBe(note.id);
    } finally { app.dispose(); }
  });
  it("nota não divide um emoji no limite do título", async () => {
    const title = "a".repeat(119) + "🧠" + " contexto";
    const fields = meetingNoteFields({ title, starts_at: "2026-09-23T12:00:00Z" });
    expect(fields.title).toBe("a".repeat(119));
    expect(fields.title).not.toMatch(/[\uD800-\uDFFF]/);
    expect(fields.content).toContain(title);
    const app = createDemoApplication({ initial: {} });
    try {
      const note = await app.commands.captures.create({ ...fields, type: "note", category_id: null, project_id: null, client_id: "emoji-meeting" });
      expect(validateDraft(draftFrom(note), [note])).toBeNull();
    } finally { app.dispose(); }
  });
  it("valida dia sem normalização e limita os nomes de visão", () => {
    expect(calendarDay("2026-02-30", "2026-09-23")).toBe("2026-09-23");
    expect(calendarDay("2024-02-29", "2026-09-23")).toBe("2024-02-29");
    expect(calendarDay("2026-9-2", "2026-09-23")).toBe("2026-09-23");
    expect(calendarView("quarter")).toBe("month");
    expect(calendarView("day")).toBe("day");
  });
  it("semana começa segunda; mês inclui seis semanas sem repetir dia", () => {
    expect(calendarDays("2026-09-23", "week")).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    const month = calendarDays("2026-09-23", "month");
    expect(month).toHaveLength(42); expect(new Set(month).size).toBe(42);
    expect(month[0]).toBe("2026-08-31"); expect(month.at(-1)).toBe("2026-10-11");
  });
  it("muda mês sem estourar o dia31 e respeita anos bissextos", () => {
    expect(shiftPeriod("2026-01-31", "month", 1)).toBe("2026-02-01");
    expect(shiftPeriod("2026-01-31", "month", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2024-02-28", "day", 1)).toBe("2024-02-29");
    expect(shiftPeriod("2026-09-23", "week", -1)).toBe("2026-09-16");
  });
  it("evento multidiário usa fim exclusivo e não duplica na meia-noite", () => {
    const multi = event("multi", "2026-09-24T03:00:00Z", "2026-09-27T03:00:00Z", true);
    expect(eventsOnDay([multi], "2026-09-23")).toEqual([]);
    for (const day of ["2026-09-24", "2026-09-25", "2026-09-26"]) expect(eventsOnDay([multi], day)).toEqual([multi]);
    expect(eventsOnDay([multi], "2026-09-27")).toEqual([]);
  });
  it("virada UTC pertence ao dia local anterior", () => {
    const late = event("late", "2026-09-24T01:00:00Z", "2026-09-24T02:00:00Z");
    expect(eventsOnDay([late], "2026-09-23")).toEqual([late]);
    expect(eventsOnDay([late], "2026-09-24")).toEqual([]);
  });
  it("início de DST não cria lacuna entre os dias civis", () => {
    const overnight = event("dst", "2018-11-04T02:30:00Z", "2018-11-04T03:30:00Z");
    expect(eventsOnDay([overnight], "2018-11-03")).toEqual([overnight]);
    expect(eventsOnDay([overnight], "2018-11-04")).toEqual([overnight]);
    const boundary = event("boundary", "2018-11-04T03:00:00Z", "2018-11-04T03:30:00Z");
    expect(eventsOnDay([boundary], "2018-11-03")).toEqual([]);
    expect(eventsOnDay([boundary], "2018-11-04")).toEqual([boundary]);
  });
  it("clipa eventos que atravessam meia-noite e exclui all-day da grade horária", () => {
    const items = [event("overnight", "2026-09-23T02:30:00Z", "2026-09-23T03:30:00Z"), event("all", "2026-09-23T03:00:00Z", "2026-09-24T03:00:00Z", true)];
    expect(timedSegments(items, "2026-09-23")).toMatchObject([{ start: 0, end: 30, lane: 0, lanes: 1 }]);
  });
  it("distribui sobreposições em colunas e libera uma coluna depois do intervalo", () => {
    const items = [event("a", "2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z"), event("b", "2026-09-23T12:30:00Z", "2026-09-23T14:00:00Z"), event("c", "2026-09-23T13:30:00Z", "2026-09-23T14:00:00Z"), event("d", "2026-09-23T15:00:00Z", "2026-09-23T16:00:00Z")];
    expect(timedSegments(items, "2026-09-23").map(({ lane, lanes }) => [lane, lanes])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
  });
  it("eventos curtos adjacentes reservam espaço para o alvo de toque", () => {
    const items = [event("a", "2026-09-23T12:30:00Z", "2026-09-23T12:45:00Z"), event("b", "2026-09-23T12:45:00Z", "2026-09-23T13:00:00Z")];
    expect(timedSegments(items, "2026-09-23").map(({ lane, lanes }) => [lane, lanes])).toEqual([[0, 2], [1, 2]]);
  });
  it("ordena sem modificar eventos nem sua coleção", () => {
    const items = [event("b", "2026-09-23T15:00:00Z", "2026-09-23T16:00:00Z"), event("a", "2026-09-23T12:30:00Z", "2026-09-23T13:00:00Z")];
    const snapshot = structuredClone(items);
    expect(eventsOnDay(items, "2026-09-23").map((item) => item.id)).toEqual(["a", "b"]);
    timedSegments(items, "2026-09-23");
    expect(items).toEqual(snapshot);
  });
});
