import { ErroDeDominio, exigir } from "../contracts/base";
import { centavosSeguros } from "./arithmetic";
import { somaMeses } from "./credit";

export interface IntencaoDePlanoMensalV1 {
  readonly ordinal: number;
  readonly month: string;
  readonly category_id: null;
  readonly limit_cents: number;
  /** Serialized intention only; never a receipt, UUID or command client_id. */
  readonly intent_key: string;
}
export interface PlanoDeCopiaMensalV1 {
  readonly version: 1;
  readonly batch_id: string;
  readonly month: string;
  readonly category_id: null;
  readonly limit_cents: number;
  readonly items: readonly IntencaoDePlanoMensalV1[];
}

const FIELDS = ["batch_id", "month", "category_id", "limit_cents"];
function conferirMes(value: unknown): asserts value is string {
  exigir(typeof value === "string" && value.length === 10 && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value) && Number(value.slice(0, 4)) >= 1, "Mês do plano inválido.");
}

/** Plans the selected month plus eleven, without reading or changing budgets. */
export function planejarCopiaDoPlanoMensal(input: unknown): PlanoDeCopiaMensalV1 {
  try {
    exigir(input !== null && typeof input === "object" && !Array.isArray(input), "Informe o plano mensal.");
    const prototype = Object.getPrototypeOf(input);
    exigir(prototype === Object.prototype || prototype === null, "Objeto de plano inválido.");
    const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(descriptors);
    exigir(keys.length === FIELDS.length && keys.every(key => typeof key === "string" && FIELDS.includes(key) && Object.hasOwn(descriptors[key]!, "value")) && FIELDS.every(key => Object.hasOwn(descriptors, key)), "Campos do plano inválidos.");
    const fields: Record<string, unknown> = Object.create(null);
    for (const key of FIELDS) fields[key] = descriptors[key]!.value;
    const batch_id = fields.batch_id, month = fields.month, limit_cents = fields.limit_cents;
    // Refuse surrounding whitespace explicitly; never normalize the identity.
    exigir(typeof batch_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(batch_id) && batch_id.trim() === batch_id, "Identidade do lote inválida.");
    conferirMes(month);
    exigir(fields.category_id === null, "O plano total exige categoria nula explícita.");
    exigir(typeof limit_cents === "number", "Limite do plano inválido.");
    centavosSeguros(limit_cents, "Limite do plano");
    exigir(limit_cents > 0, "O limite do plano deve ser positivo.");
    const months = Array.from({ length: 12 }, (_, offset) => somaMeses(month, offset));
    // Validate the complete horizon before constructing or returning a plan.
    for (const value of months) conferirMes(value);
    const items: IntencaoDePlanoMensalV1[] = months.map((value, index) => ({
      ordinal: index + 1, month: value, category_id: null, limit_cents,
      intent_key: JSON.stringify([batch_id, index + 1, value, null, limit_cents]),
    }));
    return { version: 1, batch_id, month, category_id: null, limit_cents, items };
  } catch {
    // Reflection can throw arbitrary values; never inspect or propagate them.
    throw new ErroDeDominio("VALIDATION", "Plano de cópia mensal inválido.");
  }
}
