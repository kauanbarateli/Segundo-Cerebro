import type { AgendaEvent } from "@/lib/demo/types";
import type { CalendarParticipant } from "@/core/calendario/participants";

const participantName = (person: CalendarParticipant) => person.name || person.email || "Participante sem identificação";
function initials(person: CalendarParticipant) {
  const parts = participantName(person).split(/\s+/);
  return [Array.from(parts[0]!)[0], parts.length > 1 ? Array.from(parts.at(-1)!)[0] : ""].join("").toLocaleUpperCase("pt-BR");
}
const responseLabels = { accepted: "Confirmado", declined: "Recusou", tentative: "Talvez", needsAction: "Aguardando resposta", unknown: "Resposta não informada" };
/** No People API, email hashing or remote portrait URL is used. */
export function CalendarPeopleStack({ event }: { event: AgendaEvent }) {
  const people = event.attendees?.filter(person => !person.resource) ?? [];
  if (people.length < 2) return null;
  return <span className="calendar-people-stack" role="img" aria-label={`${people.length}${event.attendees_omitted ? " ou mais" : ""} participantes informados`}>
    {people.slice(0, 4).map((person, index) => <span className="calendar-person-initials" aria-hidden="true" key={index}>{initials(person)}</span>)}
    {people.length > 4 && <span className="calendar-person-more" aria-hidden="true">+{people.length - 4}</span>}
  </span>;
}
export function CalendarPeopleDetail({ event }: { event: AgendaEvent }) {
  const people = event.attendees?.filter(person => !person.resource) ?? [], resources = event.attendees?.filter(person => person.resource) ?? [];
  const unknown = event.attendees == null || event.attendees_omitted == null;
  return <section className="calendar-people-detail" aria-label="Participantes do compromisso">
    <h3>Participantes</h3>
    {unknown ? <p>Participantes ainda não informados neste cache. Sincronize o período para consultar o Google.</p>
      : !people.length && !resources.length && !event.attendees_omitted ? <p>O Google não informou convidados para este compromisso.</p> : null}
    {!!people.length && <ul>{people.map((person, index) => <li key={index}><span className="calendar-person-initials" aria-hidden="true">{initials(person)}</span><div><strong>{participantName(person)}</strong>
      {person.name && person.email && <span>{person.email}</span>}<span>{[person.self ? "Você" : "", person.organizer ? "Organizador" : "", person.optional ? "Opcional" : "", responseLabels[person.response_status]].filter(Boolean).join(" · ")}</span></div></li>)}</ul>}
    {!!resources.length && <><h4>Salas e recursos</h4><ul>{resources.map((person, index) => <li key={index}><div><strong>{participantName(person)}</strong><span>{responseLabels[person.response_status]}</span></div></li>)}</ul></>}
    {event.attendees_omitted === true && <p>O Google retornou uma lista parcial de participantes. A quantidade total não está disponível.</p>}
  </section>;
}
