import { ErroDeDominio, exigir, instanteValido } from "../../contracts/base";
import { ultimoDiaDoMes } from "../credit";
import type { FinancialGoal, GoalCommand, GoalCommonInput, GoalExistingInput, GoalFields, GoalHighlight, GoalRelease, GoalReservation } from "./goal-types";

/** Copy data descriptors before inspecting fields: never invoke form getters. */
export function goalRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  try {
    exigir(value !== null && typeof value === "object" && !Array.isArray(value), "Objeto de meta inválido.");
    const prototype = Object.getPrototypeOf(value); exigir(prototype === Object.prototype || prototype === null, "Protótipo de meta inválido.");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    exigir(required.every(key => Object.hasOwn(descriptors, key)) && keys.every(key => typeof key === "string" && [...required, ...optional].includes(key) && Object.hasOwn(descriptors[key]!, "value")), "Campos de meta ausentes ou não permitidos.");
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of keys) copy[key as string] = descriptors[key as string]!.value;
    return copy;
  } catch { throw new ErroDeDominio("VALIDATION", "Objeto de meta inválido."); }
}
export function goalUuid(value: unknown): asserts value is string { exigir(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value), "Identificador de meta inválido."); }
export function goalRevision(value: unknown): asserts value is string { exigir(typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n, "Revisão de meta inválida."); }
export function goalCents(value: unknown, allowZero = false, signed = false): asserts value is number { exigir(typeof value === "number" && Number.isSafeInteger(value) && (signed || value >= (allowZero ? 0 : 1)), "Informe centavos inteiros dentro do intervalo permitido."); }
export function goalDay(value: unknown): asserts value is string {
  exigir(typeof value === "string" && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(value), "Data de meta inválida.");
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8));
  exigir(day >= 1 && day <= ultimoDiaDoMes(year, month), "Data de meta inexistente.");
}
export function goalTimestamp(value: unknown): asserts value is string { exigir(typeof value === "string" && !value.startsWith("0000-") && instanteValido(value), "Instante de meta inválido."); }
function nullableId(value: unknown): asserts value is string | null { if (value !== null) goalUuid(value); }
function fields(row: Record<string, unknown>): Partial<GoalFields> {
  const copy: Partial<GoalFields> = {};
  if (Object.hasOwn(row, "name")) { exigir(typeof row.name === "string" && row.name.length <= 160 && row.name.trim().length > 0, "Informe um nome de até160 caracteres."); copy.name = row.name; }
  if (Object.hasOwn(row, "target_cents")) { goalCents(row.target_cents); copy.target_cents = row.target_cents; }
  if (Object.hasOwn(row, "deadline")) { if (row.deadline !== null) goalDay(row.deadline); copy.deadline = row.deadline; }
  if (Object.hasOwn(row, "image_file_id")) { nullableId(row.image_file_id); copy.image_file_id = row.image_file_id; }
  return copy;
}
const common = ["client_id", "expected_finance_revision"], existing = [...common, "goal_id", "expected_revision"];
function commonInput(input: Record<string, unknown>): GoalCommonInput {
  goalUuid(input.client_id); goalRevision(input.expected_finance_revision);
  return { client_id: input.client_id, expected_finance_revision: input.expected_finance_revision };
}
function existingInput(input: Record<string, unknown>): GoalExistingInput {
  const shared = commonInput(input); goalUuid(input.goal_id); goalRevision(input.expected_revision);
  return { ...shared, goal_id: input.goal_id, expected_revision: input.expected_revision };
}
export function decodeGoalCommand(value: unknown): GoalCommand {
  const command = goalRecord(value, ["command", "input"]);
  if (command.command === "finance.goal.create") {
    const row = goalRecord(command.input, [...common, "name", "target_cents", "deadline", "image_file_id"]), prepared = fields(row);
    exigir(prepared.name !== undefined && prepared.target_cents !== undefined && prepared.deadline !== undefined && prepared.image_file_id !== undefined, "Campos de meta ausentes ou não permitidos.");
    return structuredClone({ command: command.command, input: { ...commonInput(row), name: prepared.name, target_cents: prepared.target_cents, deadline: prepared.deadline, image_file_id: prepared.image_file_id } });
  }
  if (command.command === "finance.goal.update") {
    const row = goalRecord(command.input, [...existing, "patch"]), patch = goalRecord(row.patch, [], ["name", "target_cents", "deadline", "image_file_id"]);
    exigir(Object.keys(patch).length > 0, "Informe o que deseja alterar."); const prepared = fields(patch);
    return structuredClone({ command: command.command, input: { ...existingInput(row), patch: prepared } });
  }
  if (command.command === "finance.goal.archive" || command.command === "finance.goal.restore") {
    const row = goalRecord(command.input, existing);
    return structuredClone({ command: command.command, input: existingInput(row) });
  }
  if (command.command === "finance.goal.highlight") {
    const row = goalRecord(command.input, [...common, "goal_id", "expected_highlight_revision"]); nullableId(row.goal_id); goalRevision(row.expected_highlight_revision);
    return structuredClone({ command: command.command, input: { ...commonInput(row), goal_id: row.goal_id, expected_highlight_revision: row.expected_highlight_revision } });
  }
  if (command.command === "finance.goal.contribute") {
    const row = goalRecord(command.input, [...existing, "account_id", "amount_cents", "occurred_on"]); goalUuid(row.account_id); goalCents(row.amount_cents); goalDay(row.occurred_on);
    return structuredClone({ command: command.command, input: { ...existingInput(row), account_id: row.account_id, amount_cents: row.amount_cents, occurred_on: row.occurred_on } });
  }
  if (command.command === "finance.goal.release") {
    const row = goalRecord(command.input, [...common, "reservation_id", "amount_cents", "occurred_on"]); goalUuid(row.reservation_id); goalCents(row.amount_cents); goalDay(row.occurred_on);
    return structuredClone({ command: command.command, input: { ...commonInput(row), reservation_id: row.reservation_id, amount_cents: row.amount_cents, occurred_on: row.occurred_on } });
  }
  throw new ErroDeDominio("VALIDATION", "Comando de meta indisponível.");
}
const identity = ["version", "id", "user_id", "created_at"];
function base(row: Record<string, unknown>) { exigir(row.version === 1, "Versão de meta inválida."); goalUuid(row.id); goalUuid(row.user_id); goalTimestamp(row.created_at); }
export function decodeFinancialGoal(value: unknown): FinancialGoal {
  const row = goalRecord(value, [...identity, "name", "target_cents", "deadline", "image_file_id", "archived_at", "revision", "updated_at"]); base(row); fields(row); goalRevision(row.revision); goalTimestamp(row.updated_at); if (row.archived_at !== null) goalTimestamp(row.archived_at); return structuredClone(row) as unknown as FinancialGoal;
}
export function decodeGoalReservation(value: unknown): GoalReservation {
  const row = goalRecord(value, [...identity, "goal_id", "account_id", "amount_cents", "occurred_on", "client_id"]); base(row); goalUuid(row.goal_id); goalUuid(row.account_id); goalUuid(row.client_id); goalCents(row.amount_cents); goalDay(row.occurred_on); return structuredClone(row) as unknown as GoalReservation;
}
export function decodeGoalRelease(value: unknown): GoalRelease {
  const row = goalRecord(value, [...identity, "reservation_id", "amount_cents", "occurred_on", "client_id"]); base(row); goalUuid(row.reservation_id); goalUuid(row.client_id); goalCents(row.amount_cents); goalDay(row.occurred_on); return structuredClone(row) as unknown as GoalRelease;
}
export function decodeGoalHighlight(value: unknown): GoalHighlight {
  const row = goalRecord(value, [...identity, "goal_id", "revision", "updated_at"]); base(row); exigir(row.id === row.user_id, "Destaque fora do Usuário."); nullableId(row.goal_id); goalRevision(row.revision); goalTimestamp(row.updated_at); return structuredClone(row) as unknown as GoalHighlight;
}
