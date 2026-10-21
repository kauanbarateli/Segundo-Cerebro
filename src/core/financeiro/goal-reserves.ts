import { ErroDeDominio, exigir } from "../contracts/base";
import { centavosSeguros, totalExato } from "./arithmetic";

/** Calculation only: declared identities do not establish authority or completeness. */
export interface ApuracaoDeReservasV1 {
  readonly version: 1;
  readonly user_id: string;
  readonly reservations: readonly {
    readonly reservation_id: string;
    readonly goal_id: string;
    readonly account_id: string;
    readonly remaining_cents: number;
  }[];
  readonly by_account: readonly { readonly account_id: string; readonly reserved_cents: number }[];
  readonly by_goal: readonly { readonly goal_id: string; readonly reserved_cents: number }[];
}

const ENVELOPE = ["version", "user_id", "reservations", "releases"];
const RESERVATION = ["id", "user_id", "goal_id", "account_id", "amount_cents"];
const RELEASE = ["id", "user_id", "reservation_id", "amount_cents"];
const MAX_ROWS = 10_000;

function objeto(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  exigir(value !== null && typeof value === "object" && !Array.isArray(value), "Objeto de reserva inválido.");
  const prototype = Object.getPrototypeOf(value);
  exigir(prototype === Object.prototype || prototype === null, "Protótipo de reserva inválido.");
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  exigir(keys.length === allowed.length && keys.every(key => typeof key === "string" && allowed.includes(key) && Object.hasOwn(descriptors[key]!, "value")) && allowed.every(key => Object.hasOwn(descriptors, key)), "Campos de reserva inválidos.");
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of allowed) snapshot[key] = descriptors[key]!.value;
  return snapshot;
}

function lista(value: unknown): unknown[] {
  exigir(Array.isArray(value), "Lista de reservas inválida.");
  const prototype = Object.getPrototypeOf(value);
  exigir(prototype === Array.prototype || prototype === null, "Protótipo da lista inválido.");
  const descriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length: unknown = descriptor?.value;
  exigir(descriptor && Object.hasOwn(descriptor, "value") && typeof length === "number" && Number.isSafeInteger(length) && length >= 0 && length <= MAX_ROWS, "Limite da lista inválido.");
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value as object);
  exigir(Object.hasOwn(fields, "length") && fields.length?.value === length && Reflect.ownKeys(fields).length === length + 1, "Lista de reservas incompleta.");
  const copy: unknown[] = [];
  for (let index = 0; index < length; index++) {
    exigir(Object.hasOwn(fields, String(index)), "Índice próprio de reserva ausente.");
    const field = fields[String(index)];
    exigir(field && Object.hasOwn(field, "value"), "Elemento de reserva inválido.");
    copy.push(field.value);
  }
  return copy;
}

function identidade(value: unknown): string {
  exigir(typeof value === "string" && value.length >= 1 && value.length <= 128 && !/[^A-Za-z0-9_-]/.test(value), "Identidade de reserva inválida.");
  return value;
}
function valor(value: unknown): number {
  exigir(typeof value === "number", "Valor de reserva inválido.");
  centavosSeguros(value, "Reserva");
  exigir(value > 0, "A reserva exige valor positivo.");
  return value;
}
const ascii = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Apura somente os aportes/liberações fornecidos; não autoriza novas operações. */
export function apurarReservasParaMetas(input: unknown): ApuracaoDeReservasV1 {
  try {
    const envelope = objeto(input, ENVELOPE);
    exigir(envelope.version === 1, "Versão de apuração inválida.");
    const userId = identidade(envelope.user_id);
    const reservations = lista(envelope.reservations), releases = lista(envelope.releases);
    const rows = new Map<string, { id: string; goal_id: string; account_id: string; amount: bigint; released: bigint }>();
    for (const entry of reservations) {
      const row = objeto(entry, RESERVATION);
      const id = identidade(row.id), goal_id = identidade(row.goal_id), account_id = identidade(row.account_id);
      exigir(identidade(row.user_id) === userId && !rows.has(id), "Dono ou identidade de aporte divergente.");
      rows.set(id, { id, goal_id, account_id, amount: BigInt(valor(row.amount_cents)), released: 0n });
    }
    const releaseIds = new Set<string>();
    for (const entry of releases) {
      const release = objeto(entry, RELEASE);
      const id = identidade(release.id), reservationId = identidade(release.reservation_id);
      exigir(identidade(release.user_id) === userId && !releaseIds.has(id), "Dono ou identidade de liberação divergente.");
      releaseIds.add(id);
      const reservation = rows.get(reservationId);
      exigir(reservation, "Liberação sem aporte.");
      reservation.released += BigInt(valor(release.amount_cents));
      exigir(reservation.released <= reservation.amount, "Liberação excede o aporte.");
    }
    const byAccount = new Map<string, bigint>(), byGoal = new Map<string, bigint>();
    const remaining = [...rows.values()].sort((a, b) => ascii(a.id, b.id)).map(row => {
      const amount = row.amount - row.released;
      byAccount.set(row.account_id, (byAccount.get(row.account_id) ?? 0n) + amount);
      byGoal.set(row.goal_id, (byGoal.get(row.goal_id) ?? 0n) + amount);
      return { reservation_id: row.id, goal_id: row.goal_id, account_id: row.account_id, remaining_cents: totalExato(amount, "Reserva restante") };
    });
    return {
      version: 1, user_id: userId, reservations: remaining,
      by_account: [...byAccount].sort(([a], [b]) => ascii(a, b)).map(([account_id, amount]) => ({ account_id, reserved_cents: totalExato(amount, "Reservado na conta") })),
      by_goal: [...byGoal].sort(([a], [b]) => ascii(a, b)).map(([goal_id, amount]) => ({ goal_id, reserved_cents: totalExato(amount, "Reservado na meta") })),
    };
  } catch {
    // Proxy introspection can throw arbitrary values; do not inspect them.
    throw new ErroDeDominio("VALIDATION", "Apuração de reservas inválida.");
  }
}
