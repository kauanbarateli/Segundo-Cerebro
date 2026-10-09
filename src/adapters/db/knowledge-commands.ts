import "server-only";
import { exigir } from "../../core/contracts/base";
import { TIPOS_VINCULO, validarDocumento, type ComandoConhecimento } from "../../core/conhecimento";

const fields: Record<ComandoConhecimento["command"], string[]> = {
  "knowledge.notebook.create": ["name", "project_id"], "knowledge.notebook.update": ["id", "name", "project_id"], "knowledge.notebook.delete": ["id"], "knowledge.notebook.restore": ["id"],
  "knowledge.page.create": ["notebook_id", "title", "document", "parent_id"], "knowledge.page.update": ["id", "expected_version", "title", "document", "notebook_id", "parent_id"],
  "knowledge.page.delete": ["id"], "knowledge.page.restore": ["id"], "knowledge.page.archive": ["id"], "knowledge.page.unarchive": ["id"],
  "knowledge.page.resolve-ref": ["id", "alias", "notebook_id"], "knowledge.page.promote-capture": ["capture_id", "notebook_id", "parent_id"],
  "knowledge.link.create": ["from_type", "from_id", "to_type", "to_id"], "knowledge.link.delete": ["id"],
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function decodeKnowledgeCommand(value: unknown): ComandoConhecimento {
  exigir(object(value) && Object.keys(value).every(key => ["command", "input"].includes(key)), "Comando inválido.");
  exigir(typeof value.command === "string" && Object.hasOwn(fields, value.command) && object(value.input), "Comando inválido.");
  const input = value.input; const command = value.command as ComandoConhecimento["command"];
  exigir(Object.keys(input).every(key => ["client_id", ...fields[command]].includes(key)), "Campos não permitidos.");
  exigir(typeof input.client_id === "string" && input.client_id.trim().length > 0 && input.client_id.length <= 200, "Informe client_id.");
  for (const key of ["id", "notebook_id", "parent_id", "capture_id", "project_id", "from_id", "to_id"]) if (input[key] !== undefined && input[key] !== null) exigir(typeof input[key] === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input[key]), "Identificador inválido.");
  if (command.includes("notebook.") && ["create", "update"].some(suffix => command.endsWith(suffix))) exigir(typeof input.name === "string", "Informe o nome do caderno.");
  if (command === "knowledge.page.create" || command === "knowledge.page.update") { exigir(typeof input.title === "string" && typeof input.notebook_id === "string" || command.endsWith("update") && typeof input.title === "string", "Informe a página e o caderno."); if (input.document !== undefined) validarDocumento(input.document); }
  if (command === "knowledge.page.update") exigir(Number.isSafeInteger(input.expected_version) && input.document !== undefined, "Informe a versão e o documento.");
  if (command === "knowledge.page.resolve-ref") exigir(typeof input.alias === "string", "Informe a referência.");
  if (command === "knowledge.link.create") exigir(TIPOS_VINCULO.includes(input.from_type as never) && TIPOS_VINCULO.includes(input.to_type as never), "Tipo de vínculo inválido.");
  return structuredClone(value) as unknown as ComandoConhecimento;
}
