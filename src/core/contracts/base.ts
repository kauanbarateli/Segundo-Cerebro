export type Canal = "web" | "api" | "cron";
/** Supplied by the authenticated channel; never copied from a form. */
export interface ContextoDeEscrita { user_id: string; canal: Canal }
export interface Relogio { now(): string }
export interface GeradorDeIds { next(): string }
export interface DependenciasDeDominio { clock: Relogio; ids: GeradorDeIds }
export interface EntidadeDoUsuario { id: string; user_id: string }
export type CodigoErro = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "TRANSACTION_CLOSED" | "EVENT_REQUIRED";
export class ErroDeDominio extends Error {
  constructor(public readonly code: CodigoErro, message: string) { super(message); this.name = "ErroDeDominio"; }
}
export function exigir(condicao: unknown, message: string): asserts condicao {
  if (!condicao) throw new ErroDeDominio("VALIDATION", message);
}
export function naoEncontrado(): never { throw new ErroDeDominio("NOT_FOUND", "Registro não encontrado."); }
/** Stable command identity: property order does not change the payload. */
export function assinatura(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(assinatura).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${assinatura(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function instanteValido(value: string | null) {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0) &&
    Number(hourText) < 24 && Number(minuteText) < 60 && Number(secondText) < 60 &&
    Number(offsetHourText ?? 0) < 24 && Number(offsetMinuteText ?? 0) < 60 && Number.isFinite(Date.parse(value));
}
