import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarList } from "../../src/components/features/calendario/calendar-list";
import { CalendarDateStrip, CalendarDayAgenda } from "../../src/components/features/calendario/calendar-agenda";
import { CalendarPeopleDetail, CalendarPeopleStack } from "../../src/components/features/calendario/calendar-people";
import type { AgendaEvent } from "../../src/lib/demo/types";
const event = (index: number): AgendaEvent => ({ id: "event-" + index, title: "Evento " + index, starts_at: `2026-10-${String(index + 10).padStart(2, "0")}T12:00:00Z`, ends_at: `2026-10-${String(index + 10).padStart(2, "0")}T13:00:00Z`, all_day: false, location: null, linked_capture_id: null, habit_id: null });
const people = Array.from({ length: 6 }, (_, index) => ({ name: "Pessoa " + index, email: `p${index}@example.invalid`, response_status: "accepted" as const, self: index === 0, organizer: index === 0, optional: false, resource: false }));
describe("Calendar list and participant presentation (static markup, no browser)", () => {
  it.each([0, 1, 5, 6])("renders a maximum of five event identities for %s rows", count => {
    const html = renderToStaticMarkup(<CalendarList events={Array.from({ length: count }, (_, i) => event(i))} day="2026-10-10" today="2026-10-10" confirmed onSelect={vi.fn()} onDate={vi.fn()} describe={() => ({ source: "Agenda" })} />);
    expect(html.match(/class="calendar-list-event"/g) ?? []).toHaveLength(Math.min(5, count));
    if (count) expect(html).toContain(`de ${count} compromissos`);
    if (count > 5) expect(html).toContain("Página 1 de 2");
  });
  it("partial cache never claims a confirmed empty period", () => {
    const html = renderToStaticMarkup(<CalendarList events={[]} day="2026-10-10" today="2026-10-10" confirmed={false} onSelect={vi.fn()} onDate={vi.fn()} describe={() => ({})} />);
    expect(html).toContain("no cache parcial"); expect(html).not.toContain("Nenhum compromisso neste período");
  });
  it("uses initials for two or more people, four avatars and a remaining count, excluding rooms", () => {
    expect(renderToStaticMarkup(<CalendarPeopleStack event={{ ...event(0), attendees: people.slice(0, 1), attendees_omitted: false }} />)).toBe("");
    const html = renderToStaticMarkup(<CalendarPeopleStack event={{ ...event(0), attendees: [...people, { ...people[0]!, resource: true }], attendees_omitted: true }} />);
    expect(html).toContain("6 ou mais participantes informados"); expect(html).toContain("+2");
    expect(html.match(/class="calendar-person-initials"/g)).toHaveLength(4); expect(html).not.toMatch(/<img|https:|p0@example/);
  });
  it("detail distinguishes unknown, empty, partial, participants and resources", () => {
    const unknown = renderToStaticMarkup(<CalendarPeopleDetail event={event(0)} />);
    const empty = renderToStaticMarkup(<CalendarPeopleDetail event={{ ...event(0), attendees: [], attendees_omitted: false }} />);
    const partial = renderToStaticMarkup(<CalendarPeopleDetail event={{ ...event(0), attendees: [], attendees_omitted: true }} />);
    expect(unknown).toContain("ainda não informados"); expect(unknown).not.toContain("não informou convidados");
    expect(empty).toContain("não informou convidados"); expect(empty).not.toContain("lista parcial");
    expect(partial).toContain("quantidade total não está disponível"); expect(partial).not.toContain("não informou convidados");
    const html = renderToStaticMarkup(<CalendarPeopleDetail event={{ ...event(0), attendees: [...people, { ...people[0]!, name: "Sala A", resource: true }], attendees_omitted: false }} />);
    expect(html).toContain("p0@example.invalid"); expect(html).toContain("Você · Organizador · Confirmado"); expect(html).toContain("Salas e recursos"); expect(html).toContain("Sala A");
  });
  it("linear day uses the real event identity, source and participants without inventing text or Google mutations", () => {
    const item = { ...event(0), location: "Sala sintética", attendees: people, attendees_omitted: true };
    const create = vi.fn(), select = vi.fn();
    const html = renderToStaticMarkup(<CalendarDayAgenda events={[item]} day="2026-10-10" today="2026-10-10" label="Agenda do dia" onSelect={select} describe={() => ({ source: "Agenda", tone: "work" })} canCreateNote={false} canReadNote={false} busy={false} onCreateNote={create} onReviewSources={vi.fn()} />);
    expect(html).toContain('data-event="event-0"'); expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Sala sintética"); expect(html).toContain("6 ou mais participantes informados");
    expect(html).not.toContain("Criar nota"); expect(html).not.toContain("Editar compromisso"); expect(html).not.toContain("<img");
    expect(create).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  });
  it("month picker retains42 civil days and the exclusive all-day end; week uses7 dates", () => {
    const item = { ...event(0), starts_at: "2026-10-09T03:00:00Z", ends_at: "2026-10-12T03:00:00Z", all_day: true };
    const date = vi.fn();
    const month = renderToStaticMarkup(<CalendarDateStrip day="2026-10-10" today="2026-10-10" events={[item]} view="month" onDate={date} />);
    const week = renderToStaticMarkup(<CalendarDateStrip day="2026-10-10" today="2026-10-10" events={[item]} view="week" onDate={date} />);
    expect(month.match(/class="calendar-picker-date"/g)).toHaveLength(42);
    expect(week.match(/class="calendar-strip-day"/g)).toHaveLength(7);
    expect(month).toContain('aria-label="domingo, 11 de outubro, 1 compromisso"');
    expect(month).toContain('aria-label="segunda-feira, 12 de outubro, 0 compromissos"');
    expect(date).not.toHaveBeenCalled();
  });
  it("linear empty day distinguishes incomplete cache, hidden sources and confirmed emptiness", () => {
    const render = (confirmed: boolean, hiddenSources: boolean) => renderToStaticMarkup(<CalendarDayAgenda events={[]} day="2026-10-10" today="2026-10-10" label="Agenda do dia" onSelect={vi.fn()} describe={() => ({})} canCreateNote={false} canReadNote={false} busy={false} onCreateNote={vi.fn()} onReviewSources={vi.fn()} confirmed={confirmed} hiddenSources={hiddenSources} />);
    expect(render(false, false)).toContain("no cache parcial");
    expect(render(false, false)).not.toContain("Nada agendado");
    expect(render(true, true)).not.toContain("Nada agendado");
    expect(render(true, false)).toContain("Nada agendado para este dia");
  });
});
