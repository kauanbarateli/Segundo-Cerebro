import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarTimeline } from "../../../src/components/features/calendario/calendar-timeline";
import { Drawer } from "../../../src/components/ui/dialog";
import type { AgendaEvent } from "../../../src/lib/demo/types";

interface Options { view: "day" | "week"; count: number }
function CalendarFixture({ view, count }: Options) {
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const events: AgendaEvent[] = Array.from({ length: count }, (_, index) => ({
    id: "collision-" + index, title: "Reunião simultânea " + (index + 1),
    starts_at: "2026-09-23T12:00:00Z", ends_at: "2026-09-23T13:00:00Z",
    all_day: false, location: null, linked_capture_id: null, habit_id: null,
  }));
  return <main><h1>Agenda sintética de colisões</h1>
    <CalendarTimeline events={events} day="2026-09-23" today="2026-09-23" view={view} onSelect={setSelected} />
    <Drawer open={selected !== null} title={selected?.title ?? "Compromisso"} onClose={() => setSelected(null)}><p>Detalhes do compromisso sintético.</p></Drawer>
  </main>;
}

Object.assign(globalThis, { __calendarTimelineFixture: (options: Options) => {
  const root = document.getElementById("calendar-fixture");
  if (!root) throw new Error("Calendar fixture root missing.");
  createRoot(root).render(<CalendarFixture {...options} />);
} });
