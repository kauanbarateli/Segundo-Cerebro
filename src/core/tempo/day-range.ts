/** Portado de segundo_cerebro@ffdf06435a5b8dcd047574172cddf1cc772dfd09. */
import { FUSO_DO_APP } from "./tempo";
import { chaveCivil, paredeNoFuso, resolverParede, utcCivil } from "./civil";

export interface DayRange {
  /** "AAAA-MM-DD" no fuso pedido. Compara direto com colunas date. */
  dayKey: string;
  /** Primeiro instante válido do dia. Inclusivo. */
  startIso: string;
  /** Primeiro instante válido a partir do dia seguinte. Exclusivo. */
  endIso: string;
}

export function dayRangeInTimeZone(reference: Date, timeZone: string = FUSO_DO_APP): DayRange {
  const p = paredeNoFuso(reference.getTime(), timeZone);
  const meiaNoite = { ...p, hora: 0, minuto: 0, segundo: 0 };
  const proximaData = new Date(utcCivil(p.ano, p.mes, p.dia + 1));
  const proximaMeiaNoite = {
    ano: proximaData.getUTCFullYear(), mes: proximaData.getUTCMonth() + 1,
    dia: proximaData.getUTCDate(), hora: 0, minuto: 0, segundo: 0,
  };
  return {
    dayKey: chaveCivil(p),
    startIso: new Date(resolverParede(meiaNoite, timeZone, true)).toISOString(),
    endIso: new Date(resolverParede(proximaMeiaNoite, timeZone, true)).toISOString(),
  };
}
