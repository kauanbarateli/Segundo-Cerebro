import { validActivityCursor, type ActivityQuery } from "../../core/activity";
import { exigir } from "../../core/contracts/base";

/** HTTP decoding stays outside the domain's cursor/projection contract. */
export function activityQuery(params: URLSearchParams): ActivityQuery {
  const allowed = ["limit", "before_time", "before_id"];
  exigir([...params.keys()].every(key => allowed.includes(key)) && allowed.every(key => params.getAll(key).length <= 1), "Consulta de atividade inválida.");
  const raw = params.get("limit") ?? "20";
  exigir(/^[1-9]\d?$/.test(raw) && Number(raw) <= 50, "Escolha entre 1 e 50 registros.");
  const time = params.get("before_time"), id = params.get("before_id");
  if (time === null && id === null) return { limit: Number(raw), cursor: null };
  const cursor = { occurred_at: time, id };
  exigir(validActivityCursor(cursor), "A página de atividade é inválida. Volte aos registros recentes.");
  return { limit: Number(raw), cursor };
}
