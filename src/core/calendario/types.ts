export interface CalendarEvent {
 id: string; user_id: string; account_id: string; calendar_id: string; title: string; starts_at: string; ends_at: string;
 location: string | null; linked_capture_id: string | null; habit_id: null; all_day: boolean;
 html_link: string | null; reminder_minutes: number | null;
}
export interface CalendarMetadata { id: string; user_id: string; account_id: string; name: string; color_key: string; selected: boolean }
export interface GoogleAccountMetadata { id: string; user_id: string; email: string; scopes: string[]; status: "connected" | "reauthorize" | "revocation_pending"; last_synced_at: string | null }
export interface CalendarWindow { start_day: string; end_day: string }
export interface CalendarSyncRun { id: string; user_id: string; account_id: string | null; channel: "web" | "cron"; status: "running" | "complete" | "failed"; calendar_count: number; event_count: number; started_at: string; finished_at: string | null }
export interface CalendarPreferences { default_calendar_view: "day" | "week" | "month"; meeting_reminders_enabled: boolean; meeting_reminder_minutes: number }
export interface CalendarSnapshot { items: CalendarEvent[]; calendars: CalendarMetadata[]; accounts: GoogleAccountMetadata[]; sync_runs: CalendarSyncRun[]; window: CalendarWindow | null; preferences: CalendarPreferences }
/** Server-only material. Never a browser snapshot, event payload or journal input. */
export interface EncryptedCalendarTokens { version: 1; key_id: string; iv: string; ciphertext: string; tag: string }
export interface CalendarTokens { access_token: string; refresh_token: string; expires_at: string; scopes: string[] }
export interface PrivateCalendar { id: string; google_id: string; selected: boolean; sync_token: string | null; window: CalendarWindow | null }
export interface PrivateGoogleAccount { id: string; user_id: string; google_sub: string; revision: string; credential_version: number; status: GoogleAccountMetadata["status"]; tokens: EncryptedCalendarTokens; calendars: PrivateCalendar[] }
export interface RemoteCalendar { google_id: string; name: string; color_key: string; deleted: boolean }
export interface RemoteCalendarEvent { google_id: string; cancelled: boolean; title: string; starts_at: string; ends_at: string; all_day: boolean; location: string | null; html_link: string | null; reminder_minutes: number | null }
export interface GoogleEventPage { items: RemoteCalendarEvent[]; next_page_token: string | null; next_sync_token: string | null }
export interface CalendarProvider {
 exchange(code: string, verifier: string): Promise<{ access_token: string; refresh_token: string | null; expires_at: string; scopes: string[] }>;
 profile(accessToken: string): Promise<{ sub: string; email: string }>;
 refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string | null; expires_at: string; scopes: string[] | null }>;
 calendars(accessToken: string): Promise<RemoteCalendar[]>;
 events(accessToken: string, calendarId: string, query: { window: CalendarWindow; sync_token: string | null; page_token: string | null }): Promise<GoogleEventPage>;
 revoke(token: string): Promise<void>;
}
export interface CalendarCipher { encrypt(owner: string, account: string, credentialVersion: number, tokens: CalendarTokens): EncryptedCalendarTokens; decrypt(owner: string, account: string, credentialVersion: number, tokens: EncryptedCalendarTokens): CalendarTokens }
export interface CalendarRepository {
 readonly userId: string;
 requireAccess(): Promise<void>; snapshot(): Promise<CalendarSnapshot>;
 beginFlow(flowId: string, digest: string, expiresAt: string, reconnectAccount: string | null): Promise<{ account_id: string }>;
 consumeFlow(flowId: string, digest: string): Promise<{ account_id: string; reconnect: boolean }>;
 failFlow(flowId: string): Promise<void>;
 privateAccount(accountId: string): Promise<PrivateGoogleAccount>;
 connect(input: { flow_id: string; account_id: string; google_sub: string; email: string; scopes: string[]; tokens: EncryptedCalendarTokens; credential_version: number; calendars: RemoteCalendar[] }): Promise<void>;
 saveTokens(account: PrivateGoogleAccount, tokens: EncryptedCalendarTokens, scopes: string[]): Promise<PrivateGoogleAccount>;
 resetCursor(account: PrivateGoogleAccount, calendarId: string): Promise<PrivateGoogleAccount>;
 commitEvents(input: { account: PrivateGoogleAccount; calendar_id: string; window: CalendarWindow; reset: boolean; events: RemoteCalendarEvent[]; sync_token: string }): Promise<PrivateGoogleAccount>;
 select(calendarId: string, selected: boolean, clientId: string): Promise<void>;
 disconnect(accountId: string, clientId: string): Promise<PrivateGoogleAccount | null>;
 finishDisconnect(account: PrivateGoogleAccount): Promise<void>;
 link(eventId: string, captureId: string | null, clientId: string): Promise<void>;
 run(accountId: string | null, clientId: string, window: CalendarWindow): Promise<CalendarSyncRun>; finishRun(id: string, status: "complete" | "failed", calendarCount: number, eventCount: number): Promise<void>;
 reauthorize(account: PrivateGoogleAccount): Promise<void>;
}
export class CalendarProviderError extends Error { constructor(public readonly kind: "expired_cursor" | "reauthorize" | "quota" | "unavailable") { super("O Google não confirmou esta operação."); this.name = "CalendarProviderError"; } }
