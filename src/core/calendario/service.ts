import { exigir, instanteValido } from "../contracts/base";
import { diaCivilDe, instanteDe } from "../tempo";
import { somarDias } from "../habitos/habits";
import { CalendarProviderError, type CalendarCipher, type CalendarEvent, type CalendarPreferences, type CalendarProvider, type CalendarRepository, type CalendarTokens, type CalendarWindow, type PrivateGoogleAccount, type RemoteCalendarEvent } from "./types";
export const CALENDAR_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events.readonly"] as const;
export function sufficientCalendarScopes(scopes: readonly string[]) { return scopes.includes("openid") && (scopes.includes("email") || scopes.includes("https://www.googleapis.com/auth/userinfo.email")) && (scopes.includes("https://www.googleapis.com/auth/calendar.readonly") || CALENDAR_SCOPES.slice(2).every(scope => scopes.includes(scope))); }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function only(value: Record<string, unknown>, keys: string[]) { exigir(Object.keys(value).every(key => keys.includes(key)), "Campos de calendário não permitidos."); }
export function validWindow(value: unknown): value is CalendarWindow {
 if (!record(value) || Object.keys(value).some(key => !["start_day", "end_day"].includes(key)) || typeof value.start_day !== "string" || typeof value.end_day !== "string" || !instanteDe(value.start_day) || !instanteDe(value.end_day)) return false;
 const days = (Date.parse(value.end_day + "T00:00:00Z") - Date.parse(value.start_day + "T00:00:00Z")) / 86_400_000;
 return days > 0 && days <= 730;
}
export function defaultWindow(today: string): CalendarWindow { const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : diaCivilDe(today); exigir(instanteDe(day), "Data da agenda inválida."); return { start_day: somarDias(day, -45), end_day: somarDias(day, 180) }; }
export function extendsWindow(current: CalendarWindow | null, requested: CalendarWindow): boolean { return !current || requested.start_day < current.start_day || requested.end_day > current.end_day; }
export function unionWindow(current: CalendarWindow | null, requested: CalendarWindow): CalendarWindow { const result = current ? { start_day: current.start_day < requested.start_day ? current.start_day : requested.start_day, end_day: current.end_day > requested.end_day ? current.end_day : requested.end_day } : requested; exigir(validWindow(result), "A janela da agenda permite até dois anos por sincronização. Escolha um período menor."); return result; }
export function safeGoogleEventLink(value: unknown): string | null { if (typeof value !== "string" || value.length > 4096) return null; try { const url = new URL(value); return url.protocol === "https:" && ["www.google.com", "calendar.google.com"].includes(url.hostname) && !url.username && !url.password && !url.port && /^\/calendar\/event\/?$/.test(url.pathname) ? url.href : null; } catch { return null; } }
function remoteText(value: unknown, max: number, fallback: string | null = null) { return typeof value === "string" ? value.slice(0, max) : fallback; }
export function googleEvent(value: unknown, defaults: readonly { method: string; minutes: number }[] = []): RemoteCalendarEvent {
 exigir(record(value) && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 1024, "Evento Google inválido.");
 if (value.status === "cancelled") return { google_id: value.id, cancelled: true, title: "", starts_at: "1970-01-01T00:00:00Z", ends_at: "1970-01-01T00:00:01Z", all_day: false, location: null, html_link: null, reminder_minutes: null };
 exigir(record(value.start) && record(value.end), "Evento Google sem período.");
 const allDay = typeof value.start.date === "string", start = allDay ? instanteDe(value.start.date as string) : typeof value.start.dateTime === "string" && instanteValido(value.start.dateTime) ? value.start.dateTime : null;
 const end = allDay ? typeof value.end.date === "string" ? instanteDe(value.end.date) : null : typeof value.end.dateTime === "string" && instanteValido(value.end.dateTime) ? value.end.dateTime : null;
 exigir(start && end && Date.parse(end) > Date.parse(start), "Período Google inválido.");
 const reminders = record(value.reminders) ? value.reminders : null;
 const source = reminders && reminders.useDefault === false ? Array.isArray(reminders.overrides) ? reminders.overrides : [] : defaults;
 const minutes = source.filter(record).filter(item => item.method === "popup" && typeof item.minutes === "number" && Number.isInteger(item.minutes) && item.minutes >= 0 && item.minutes <= 40320).map(item => item.minutes as number);
 return { google_id: value.id, cancelled: false, title: remoteText(value.summary, 1000, "Compromisso sem título")!, starts_at: start, ends_at: end, all_day: allDay, location: remoteText(value.location, 2000), html_link: safeGoogleEventLink(value.htmlLink), reminder_minutes: minutes.length ? Math.min(...minutes) : null };
}
export function dueMeetingReminders(events: readonly CalendarEvent[], preferences: CalendarPreferences, now: string): CalendarEvent[] {
 if (!preferences.meeting_reminders_enabled) return [];
 const time = Date.parse(now), minutes = preferences.meeting_reminder_minutes;
 return events.filter(event => !event.all_day && Date.parse(event.starts_at) > time && time >= Date.parse(event.starts_at) - minutes * 60_000);
}
export type CalendarCommand =
 | { command: "calendar.select"; input: { client_id: string; calendar_id: string; selected: boolean } }
 | { command: "calendar.sync"; input: { client_id: string; account_id?: string; start_day: string; end_day: string } }
 | { command: "calendar.disconnect"; input: { client_id: string; account_id: string } }
 | { command: "calendar.event.link"; input: { client_id: string; event_id: string; capture_id: string | null } };
export function decodeCalendarCommand(value: unknown): CalendarCommand {
 exigir(record(value), "Operação inválida."); only(value, ["command", "input"]); exigir(record(value.input), "Informe a operação."); const input = value.input;
 exigir(typeof input.client_id === "string" && input.client_id.trim() && input.client_id.length <= 200, "Identificação de envio inválida.");
 if (value.command === "calendar.select") { only(input, ["client_id", "calendar_id", "selected"]); exigir(uuid(input.calendar_id) && typeof input.selected === "boolean", "Calendário inválido."); }
 else if (value.command === "calendar.sync") { only(input, ["client_id", "account_id", "start_day", "end_day"]); exigir((input.account_id === undefined || uuid(input.account_id)) && validWindow({ start_day: input.start_day, end_day: input.end_day }), "Período de sincronização inválido."); }
 else if (value.command === "calendar.disconnect") { only(input, ["client_id", "account_id"]); exigir(uuid(input.account_id), "Conta Google inválida."); }
 else { exigir(value.command === "calendar.event.link", "Operação de calendário inválida."); only(input, ["client_id", "event_id", "capture_id"]); exigir(uuid(input.event_id) && (input.capture_id === null || uuid(input.capture_id)), "Vínculo inválido."); }
 return structuredClone(value) as CalendarCommand;
}
export async function finishCalendarConnection(repo: CalendarRepository, provider: CalendarProvider, cipher: CalendarCipher, input: { flow_id: string; digest: string; code: string; verifier: string }) {
 await repo.requireAccess();
 const flow = await repo.consumeFlow(input.flow_id, input.digest);
 try {
  await repo.requireAccess(); const grant = await provider.exchange(input.code, input.verifier);
  exigir(sufficientCalendarScopes(grant.scopes), "Autorize os escopos de leitura necessários para conectar a agenda.");
  await repo.requireAccess(); const profile = await provider.profile(grant.access_token);
  let credentialVersion = 1, refreshToken = grant.refresh_token;
  if (flow.reconnect) { const previous = await repo.privateAccount(flow.account_id); exigir(previous.google_sub === profile.sub, "Reconecte a mesma conta Google."); const tokens = cipher.decrypt(repo.userId, previous.id, previous.credential_version, previous.tokens); refreshToken ??= tokens.refresh_token; credentialVersion = previous.credential_version + 1; }
  exigir(refreshToken, "O Google não concedeu acesso offline. Conecte novamente para consentir.");
  await repo.requireAccess(); const calendars = await provider.calendars(grant.access_token);
  const tokens: CalendarTokens = { access_token: grant.access_token, refresh_token: refreshToken, expires_at: grant.expires_at, scopes: grant.scopes };
  await repo.connect({ flow_id: input.flow_id, account_id: flow.account_id, google_sub: profile.sub, email: profile.email, scopes: grant.scopes, tokens: cipher.encrypt(repo.userId, flow.account_id, credentialVersion, tokens), credential_version: credentialVersion, calendars });
 } catch (error) { try { await repo.failFlow(input.flow_id); } catch { /* A consumed flow can never replay when permission disappeared. */ } throw error; }
}
async function activeToken(repo: CalendarRepository, provider: CalendarProvider, cipher: CalendarCipher, account: PrivateGoogleAccount, now: string): Promise<{ account: PrivateGoogleAccount; access: string }> {
 const stored = cipher.decrypt(repo.userId, account.id, account.credential_version, account.tokens);
 if (Date.parse(stored.expires_at) > Date.parse(now) + 60_000) return { account, access: stored.access_token };
 await repo.requireAccess(); const fresh = await provider.refresh(stored.refresh_token);
 const tokens = { access_token: fresh.access_token, refresh_token: fresh.refresh_token ?? stored.refresh_token, expires_at: fresh.expires_at, scopes: fresh.scopes ?? stored.scopes };
 exigir(sufficientCalendarScopes(tokens.scopes), "A conta Google precisa autorizar os escopos de leitura novamente.");
 account = await repo.saveTokens(account, cipher.encrypt(repo.userId, account.id, account.credential_version + 1, tokens), tokens.scopes);
 return { account, access: tokens.access_token };
}
export async function synchronizeCalendars(repo: CalendarRepository, provider: CalendarProvider, cipher: CalendarCipher, requested: CalendarWindow, now: string, clientId: string, accountId?: string) {
 await repo.requireAccess(); exigir(validWindow(requested), "Período inválido.");
 const snapshot = await repo.snapshot(), accounts = snapshot.accounts.filter(account => account.status === "connected" && (!accountId || account.id === accountId));
 exigir(!accountId || accounts.length === 1, "Conta Google indisponível."); const run = await repo.run(accountId ?? null, clientId, requested); if (run.status === "complete") return; const runId = run.id; let calendarCount = 0, eventCount = 0;
 try {
  for (const metadata of accounts) {
   let account = await repo.privateAccount(metadata.id);
   try {
    const token = await activeToken(repo, provider, cipher, account, now); account = token.account;
    for (const calendar of account.calendars.filter(row => row.selected)) {
     const window = unionWindow(calendar.window, requested); let reset = extendsWindow(calendar.window, window) || !calendar.sync_token, syncToken = reset ? null : calendar.sync_token, pages = 0, pageToken: string | null = null, nextSync: string | null = null;
     let events: RemoteCalendarEvent[] = []; const seenPages = new Set<string>();
     while (true) {
      await repo.requireAccess();
      let page;
      try { page = await provider.events(token.access, calendar.google_id, { window, sync_token: syncToken, page_token: pageToken }); }
      catch (error) { if (error instanceof CalendarProviderError && error.kind === "expired_cursor" && syncToken) { account = await repo.resetCursor(account, calendar.id); reset = true; syncToken = null; pageToken = null; events = []; pages = 0; seenPages.clear(); continue; } throw error; }
      events.push(...page.items); pages++; exigir(pages <= 8 && events.length <= 20_000, "A agenda excede o limite desta sincronização. Reduza o período.");
      pageToken = page.next_page_token; nextSync = page.next_sync_token;
      if (pageToken) { exigir(!seenPages.has(pageToken), "O Google repetiu uma página. Tente sincronizar novamente."); seenPages.add(pageToken); }
      else break;
     }
     exigir(nextSync, "O Google não confirmou o cursor final. Tente novamente.");
     account = await repo.commitEvents({ account, calendar_id: calendar.id, window, reset, events, sync_token: nextSync }); calendarCount++; eventCount += events.filter(event => !event.cancelled).length;
    }
   } catch (error) { if (error instanceof CalendarProviderError && error.kind === "reauthorize") await repo.reauthorize(account); throw error; }
  }
  await repo.finishRun(runId, "complete", calendarCount, eventCount);
 } catch (error) { try { await repo.finishRun(runId, "failed", calendarCount, eventCount); } catch { /* No unverified success when session is lost. */ } throw error; }
}
export async function executeCalendarCommand(repo: CalendarRepository, provider: CalendarProvider, cipher: CalendarCipher, value: unknown, now: string) {
 await repo.requireAccess(); const request = decodeCalendarCommand(value), input = request.input;
 if (request.command === "calendar.select") await repo.select(request.input.calendar_id, request.input.selected, input.client_id);
 else if (request.command === "calendar.event.link") await repo.link(request.input.event_id, request.input.capture_id, input.client_id);
 else if (request.command === "calendar.sync") await synchronizeCalendars(repo, provider, cipher, { start_day: request.input.start_day, end_day: request.input.end_day }, now, input.client_id, request.input.account_id);
 else {
  const account = await repo.disconnect(request.input.account_id, input.client_id); if (!account) return repo.snapshot();
  const tokens = cipher.decrypt(repo.userId, account.id, account.credential_version, account.tokens);
  await repo.requireAccess(); await provider.revoke(tokens.refresh_token); await repo.finishDisconnect(account);
 }
 return repo.snapshot();
}
