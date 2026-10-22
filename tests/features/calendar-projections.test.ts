import { describe, expect, it } from "vitest";
import { agendaDays, allDaySegments, calendarDay, calendarDays, calendarListRows, calendarPreferenceView, calendarView, eventDateRange, eventsOnDay, eventTimeLabel, meetingNoteFields, periodHeading, populatedDays, recentCalendarEvents, segmentGeometry, shiftPeriod, sourceTones, timedSegments, timelineRange, weekNumber } from "../../src/components/features/calendario/calendar-projections";
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
  it("Lista é preferência aditiva, sem alterar o padrão semanal", () => {
    expect(calendarView("list")).toBe("list");
    expect(calendarPreferenceView("list")).toBe("list");
    expect(calendarPreferenceView("month")).toBe("month");
    expect(calendarPreferenceView("day")).toBe("day");
    expect(calendarPreferenceView(undefined)).toBe("week");
  });
  it("Lista inicia na data escolhida e anda por mês, inclusive dezembro→janeiro", () => {
    const october = calendarDays("2026-10-17", "list");
    expect(october).toHaveLength(15); expect(october[0]).toBe("2026-10-17"); expect(october.at(-1)).toBe("2026-10-31");
    expect(calendarDays("2024-02-10", "list")).toHaveLength(20);
    expect(shiftPeriod("2026-12-15", "list", 1)).toBe("2027-01-01");
    expect(shiftPeriod("2027-01-31", "list", -1)).toBe("2026-12-01");
    expect(shiftPeriod("2026-12-31", "month", 1)).toBe("2027-01-01");
    expect(agendaDays("2026-10-17", "month")).toEqual(calendarDays("2026-10-01", "list"));
    expect(agendaDays("2026-10-17", "week")).toEqual(calendarDays("2026-10-17", "week"));
    expect(periodHeading("2027-01-01", "list")).toEqual({ title: "janeiro", detail: "2027" });
  });
  it("lista deduplica por identidade e inclui uma vez o evento em andamento, com fim exclusivo", () => {
    const ongoing = event("ongoing", "2026-12-30T03:00:00Z", "2027-01-03T03:00:00Z", true);
    const expired = event("expired", "2026-12-31T01:00:00Z", "2027-01-01T03:00:00Z");
    const midnight = event("late", "2027-01-02T01:00:00Z", "2027-01-02T04:00:00Z");
    const nextMonth = event("next", "2027-02-01T03:00:00Z", "2027-02-01T04:00:00Z");
    const rows = calendarListRows([ongoing, expired, ongoing, nextMonth, midnight], "2027-01-01");
    expect(rows.map(row => ({ id: row.event.id, day: row.day, ongoing: row.ongoing }))).toEqual([{ id: "ongoing", day: "2027-01-01", ongoing: true }, { id: "late", day: "2027-01-01", ongoing: false }]);
    expect(calendarListRows([ongoing], "2027-01-03")).toEqual([]);
  });
  it("os dois recentes pertencem somente às fontes fornecidas e já terminaram antes da data", () => {
    const older = event("old", "2026-10-05T12:00:00Z", "2026-10-05T13:00:00Z"), latest = event("latest", "2026-10-09T01:00:00Z", "2026-10-09T02:00:00Z"), second = event("second", "2026-10-08T12:00:00Z", "2026-10-08T13:00:00Z"), ongoing = event("ongoing", "2026-10-09T02:00:00Z", "2026-10-11T13:00:00Z");
    expect(recentCalendarEvents([older, latest, second, latest, ongoing], "2026-10-10").map(row => row.id)).toEqual(["latest", "second"]);
    expect(recentCalendarEvents([], "2026-10-10")).toEqual([]);
  });
  it("lista mostra somente os dias com compromissos", () => {
    const items = [event("a", "2026-10-02T12:00:00Z", "2026-10-02T13:00:00Z"), event("b", "2026-10-20T03:00:00Z", "2026-10-22T03:00:00Z", true)];
    expect(populatedDays(items, calendarDays("2026-10-01", "list"))).toEqual(["2026-10-02", "2026-10-20", "2026-10-21"]);
    expect(populatedDays([], calendarDays("2026-10-01", "list"))).toEqual([]);
  });
  it("título do período: semana com número ISO, virada de ano e dia", () => {
    expect(periodHeading("2026-10-17", "week")).toEqual({ title: "12–18 de outubro", detail: "2026 · Semana 42" });
    expect(periodHeading("2026-12-30", "week")).toEqual({ title: "28 de dez. – 3 de jan.", detail: "2026–2027 · Semana 53" });
    expect(weekNumber("2027-01-04")).toBe(1); expect(weekNumber("2021-01-03")).toBe(53);
    expect(periodHeading("2026-10-10", "day").title).toBe("sábado, 10 de outubro");
    expect(periodHeading("2026-10-10", "month")).toEqual({ title: "outubro", detail: "2026" });
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
  it("faixa base 07–21h cresce para eventos fora dela; 80px por hora", () => {
    const early = timedSegments([event("early", "2026-09-23T08:30:00Z", "2026-09-23T09:00:00Z")], "2026-09-23");
    expect(timelineRange([])).toEqual({ startHour: 7, endHour: 21, height: 1120 });
    expect(timelineRange(early)).toEqual({ startHour: 5, endHour: 21, height: 1280 });
    const late = timedSegments([event("late", "2026-09-24T01:00:00Z", "2026-09-24T02:30:00Z")], "2026-09-23");
    expect(timelineRange(late)).toEqual({ startHour: 7, endHour: 24, height: 1360 });
  });
  it("evento curto mantém alvo de 44px; densidade curta e mínima pela duração", () => {
    const range = timelineRange([]);
    expect(segmentGeometry({ start: 9 * 60, end: 10 * 60 }, range)).toEqual({ top: 163, height: 74, density: "short" });
    expect(segmentGeometry({ start: 9 * 60, end: 9 * 60 + 15 }, range)).toEqual({ top: 163, height: 44, density: "tiny" });
    expect(segmentGeometry({ start: 9 * 60, end: 11 * 60 }, range)).toMatchObject({ height: 154, density: "regular" });
    // A 15-minute item at the end of the range stays inside the track.
    expect(segmentGeometry({ start: 20 * 60 + 45, end: 21 * 60 }, range)).toEqual({ top: 1076, height: 44, density: "tiny" });
  });
  it("dia inteiro: término exclusivo, faixa contínua e trilhas sem sobreposição", () => {
    const days = calendarDays("2026-10-10", "week");
    const retreat = event("retreat", "2026-10-09T03:00:00Z", "2026-10-12T03:00:00Z", true);
    const one = event("one", "2026-10-10T03:00:00Z", "2026-10-11T03:00:00Z", true);
    const next = event("next", "2026-10-12T03:00:00Z", "2026-10-13T03:00:00Z", true);
    const result = allDaySegments([one, retreat, next, event("timed", "2026-10-10T12:00:00Z", "2026-10-10T13:00:00Z")], days);
    expect(result.segments.map(({ event, first, last, lane }) => [event.id, first, last, lane])).toEqual([["retreat", 4, 6, 0], ["one", 5, 5, 1]]);
    expect(result.lanes).toBe(2);
    expect(allDaySegments([], days).lanes).toBe(1);
    expect(eventDateRange(retreat)).toEqual({ span: "sexta-feira, 9 de outubro até domingo, 11 de outubro", time: "Dia inteiro · 3 dias", exclusiveEnd: "12 de outubro" });
    expect(eventDateRange(one).span).toBe("sábado, 10 de outubro");
    expect(eventTimeLabel(retreat)).toBe("Dia inteiro");
  });
  it("travessia da meia-noite continua no dia seguinte com o horário real", () => {
    const overnight = event("overnight", "2026-09-24T02:00:00Z", "2026-09-24T04:00:00Z");
    expect(eventTimeLabel(overnight, "2026-09-23")).toBe("23:00 – 01:00");
    expect(eventTimeLabel(overnight, "2026-09-24")).toBe("Continua · até 01:00");
    expect(timedSegments([overnight], "2026-09-24")).toMatchObject([{ start: 0, end: 60 }]);
    expect(eventDateRange(overnight).span).toBe("quarta-feira, 23 de setembro até quinta-feira, 24 de setembro");
  });
  it("fontes de exemplo conservam significado; Google alterna tintas sem depender só da cor", () => {
    const tones = sourceTones([{ id: "w", name: "Trabalho", color_key: "work" }, { id: "p", name: "Pessoal", color_key: "personal" }, { id: "s", name: "Estudos", color_key: "study" }, { id: "g1", name: "Equipe", color_key: "calendar" }, { id: "g2", name: "Casa", color_key: "calendar" }]);
    expect([...tones]).toEqual([["w", "work"], ["p", "personal"], ["s", "info"], ["g1", "work"], ["g2", "personal"]]);
  });
  it("ordena sem modificar eventos nem sua coleção", () => {
    const items = [event("b", "2026-09-23T15:00:00Z", "2026-09-23T16:00:00Z"), event("a", "2026-09-23T12:30:00Z", "2026-09-23T13:00:00Z")];
    const snapshot = structuredClone(items);
    expect(eventsOnDay(items, "2026-09-23").map((item) => item.id)).toEqual(["a", "b"]);
    timedSegments(items, "2026-09-23");
    expect(items).toEqual(snapshot);
  });
});
