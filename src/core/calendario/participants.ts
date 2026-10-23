import { exigir } from "../contracts/base";

/** RECOMENDADO: application bound, not a Google guarantee about guest totals. */
export const CALENDAR_ATTENDEE_LIMIT = 200;
export const CALENDAR_RESPONSE_STATUSES = ["needsAction", "declined", "tentative", "accepted", "unknown"] as const;
export interface CalendarParticipant {
  name: string | null; email: string | null;
  response_status: typeof CALENDAR_RESPONSE_STATUSES[number];
  self: boolean; organizer: boolean; optional: boolean; resource: boolean;
}
export interface CalendarAttendeeState { attendees: CalendarParticipant[] | null; attendees_omitted: boolean | null }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = ["name", "email", "response_status", "self", "organizer", "optional", "resource"];
/** Match PostgreSQL char_length (codepoints), rejecting isolated UTF-16
 * surrogates that JSONB cannot store. The cheap unit bound precedes allocation. */
function validLabel(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length <= limit * 2 && Array.from(value).length <= limit && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value);
}
function label(value: unknown, limit: number): string | null {
  if (value === undefined) return null;
  exigir(validLabel(value, limit), "Participante Google inválido.");
  return value.trim() || null;
}
/** No profile ID, comment, photo lookup or arbitrary URL enters the private cache. */
export function googleAttendees(value: Record<string, unknown>): CalendarAttendeeState {
  exigir(value.attendeesOmitted === undefined || typeof value.attendeesOmitted === "boolean", "Lista de participantes Google inválida.");
  exigir(value.attendees === undefined || Array.isArray(value.attendees), "Lista de participantes Google inválida.");
  const rows = value.attendees ?? [];
  exigir(Array.isArray(rows) && rows.length <= CALENDAR_ATTENDEE_LIMIT, "A lista de participantes excede o limite permitido.");
  const attendees: CalendarParticipant[] = [], seen = new Set<string>();
  for (const row of rows) {
    exigir(record(row), "Participante Google inválido.");
    const name = label(row.displayName, 255), email = label(row.email, 254);
    for (const key of ["self", "organizer", "optional", "resource"]) exigir(row[key] === undefined || typeof row[key] === "boolean", "Participante Google inválido.");
    exigir(row.responseStatus === undefined || typeof row.responseStatus === "string" && CALENDAR_RESPONSE_STATUSES.includes(row.responseStatus as CalendarParticipant["response_status"]), "Resposta de participante inválida.");
    const identity = email ? "email:" + email.toLowerCase() + ":" + (row.resource === true) : null;
    if (identity && seen.has(identity)) continue;
    if (identity) seen.add(identity);
    attendees.push({ name, email, response_status: (row.responseStatus ?? "unknown") as CalendarParticipant["response_status"], self: row.self === true, organizer: row.organizer === true, optional: row.optional === true, resource: row.resource === true });
  }
  return { attendees, attendees_omitted: value.attendeesOmitted === true };
}
/** Legacy cache has neither field (or both null); never call it an empty roster. */
export function validCalendarAttendees(value: Record<string, unknown>): boolean {
  if (value.attendees === undefined && value.attendees_omitted === undefined) return true;
  if (value.attendees === null && value.attendees_omitted === null) return true;
  if (!Array.isArray(value.attendees) || value.attendees.length > CALENDAR_ATTENDEE_LIMIT || typeof value.attendees_omitted !== "boolean") return false;
  return value.attendees.every(row => record(row) && Object.keys(row).length === keys.length && Object.keys(row).every(key => keys.includes(key)) &&
    (row.name === null || validLabel(row.name, 255)) &&
    (row.email === null || validLabel(row.email, 254)) &&
    CALENDAR_RESPONSE_STATUSES.includes(row.response_status as CalendarParticipant["response_status"]) &&
    ["self", "organizer", "optional", "resource"].every(key => typeof row[key] === "boolean"));
}
