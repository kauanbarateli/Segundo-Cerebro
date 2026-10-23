import { describe, expect, it } from "vitest";
import { CALENDAR_ATTENDEE_LIMIT, googleAttendees, googleEvent, validCalendarAttendees } from "../../src/core/calendario";

const person = { name: "Pessoa", email: "person@example.invalid", response_status: "accepted", self: false, organizer: false, optional: false, resource: false };
describe("Calendar participant projection, bounded and private", () => {
  it("keeps legacy unknown, known empty and provider-omitted distinct", () => {
    expect(validCalendarAttendees({})).toBe(true);
    expect(validCalendarAttendees({ attendees: null, attendees_omitted: null })).toBe(true);
    expect(googleAttendees({})).toEqual({ attendees: [], attendees_omitted: false });
    expect(googleAttendees({ attendeesOmitted: true })).toEqual({ attendees: [], attendees_omitted: true });
    for (const value of [{ attendees: [] }, { attendees_omitted: false }, { attendees: [], attendees_omitted: null }, { attendees: null, attendees_omitted: false }]) expect(validCalendarAttendees(value)).toBe(false);
  });
  it("projects only permitted event fields without comments, IDs or photo URLs", () => {
    const actual = googleAttendees({ attendees: [{ displayName: "  Pessoa  ", email: "person@example.invalid", responseStatus: "accepted", self: true, organizer: true, optional: true, resource: false, id: "PRIVATE_ID_CANARY", comment: "PRIVATE_COMMENT_CANARY", photoUrl: "https://private.invalid/CANARY" }] });
    expect(actual).toEqual({ attendees: [{ ...person, self: true, organizer: true, optional: true }], attendees_omitted: false });
    expect(JSON.stringify(actual)).not.toMatch(/CANARY|photo|comment/);
  });
  it("deduplicates email per resource class, never two people sharing a name", () => {
    const result = googleAttendees({ attendees: [{ displayName: "Ana", email: "A@example.invalid" }, { displayName: "Ana duplicada", email: "a@example.invalid" }, { displayName: "Ana", email: "b@example.invalid" }, { displayName: "Sala", email: "a@example.invalid", resource: true }] });
    expect(result.attendees).toHaveLength(3);
    expect(result.attendees?.map(row => row.resource)).toEqual([false, false, true]);
    expect(googleAttendees({ attendees: [{ displayName: "Sem e-mail" }, { displayName: "Sem e-mail" }] }).attendees).toHaveLength(2);
  });
  it("preserves attendee response states and uses unknown when absent", () => {
    for (const responseStatus of ["needsAction", "declined", "tentative", "accepted"]) expect(googleAttendees({ attendees: [{ responseStatus }] }).attendees?.[0]?.response_status).toBe(responseStatus);
    expect(googleAttendees({ attendees: [{}] }).attendees?.[0]).toEqual({ name: null, email: null, response_status: "unknown", self: false, organizer: false, optional: false, resource: false });
  });
  it("accepts the application cap and refuses overflow without silently setting omitted", () => {
    expect(googleAttendees({ attendees: Array.from({ length: CALENDAR_ATTENDEE_LIMIT }, () => ({})) }).attendees).toHaveLength(CALENDAR_ATTENDEE_LIMIT);
    expect(() => googleAttendees({ attendees: Array.from({ length: CALENDAR_ATTENDEE_LIMIT + 1 }, () => ({})) })).toThrow();
  });
  it("uses the same Unicode codepoint limits as SQL char_length, without splitting emoji or accepting isolated surrogates", () => {
    const name = "🧠".repeat(255), email = "á".repeat(254);
    const result = googleAttendees({ attendees: [{ displayName: name, email }] });
    expect(result.attendees?.[0]?.name).toBe(name);
    expect(validCalendarAttendees(result as unknown as Record<string, unknown>)).toBe(true);
    for (const displayName of ["🧠".repeat(256), "\uD800", "\uDFFF"]) {
      expect(() => googleAttendees({ attendees: [{ displayName }] })).toThrow();
      expect(validCalendarAttendees({ attendees: [{ ...person, name: displayName }], attendees_omitted: false })).toBe(false);
    }
    expect(() => googleAttendees({ attendees: [{ email: "á".repeat(255) }] })).toThrow();
    expect(validCalendarAttendees({ attendees: [{ ...person, email: "á".repeat(255) }], attendees_omitted: false })).toBe(false);
  });
  it.each([{ attendees: null }, { attendees: {} }, { attendees: [null] }, { attendeesOmitted: "false" }, { attendees: [{ responseStatus: "private-canary" }] }, { attendees: [{ resource: 1 }] }, { attendees: [{ displayName: "n".repeat(256) }] }, { attendees: [{ email: "a\nb" }] }])("rejects malformed provider roster %#", value => expect(() => googleAttendees(value)).toThrow());
  it("DTO rejects additional fields and malformed types, preserving the declared seven-field projection", () => {
    expect(validCalendarAttendees({ attendees: [person], attendees_omitted: true })).toBe(true);
    for (const attendee of [{ ...person, photo: "PRIVATE_CANARY" }, { ...person, response_status: "future" }, { ...person, optional: null }, { ...person, name: 1 }]) expect(validCalendarAttendees({ attendees: [attendee], attendees_omitted: false })).toBe(false);
  });
  it("active events include the roster; cancelled events remain tombstones even without fields", () => {
    expect(googleEvent({ id: "a", start: { date: "2026-10-10" }, end: { date: "2026-10-11" }, attendeesOmitted: true, attendees: [{ email: "self@example.invalid", self: true }] })).toMatchObject({ attendees_omitted: true, attendees: [{ email: "self@example.invalid", self: true }] });
    expect(googleEvent({ id: "a", status: "cancelled" })).toMatchObject({ google_id: "a", cancelled: true });
  });
});
