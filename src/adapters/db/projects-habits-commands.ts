import { exigir, type ContextoDeEscrita, type DependenciasDeDominio } from "../../core/contracts/base";
import { criarProjeto, editarProjeto, excluirProjeto, restaurarProjeto, criarContainerProjeto, vincularContainerProjeto, desvincularContainerProjeto, type CamposProjeto, type ProjectContainer } from "../../core/projetos";
import { criarHabito, editarHabito, arquivarHabito, restaurarHabito, marcarHabito, registrarPausaHabito, removerPausaHabito, type CamposHabito, type MarcacaoDeHabito, type NovaPausaHabito } from "../../core/habitos";
import type { RoutineUnitOfWork } from "./projects-habits-store";
type Id = { id: string; client_id: string };
export type RoutineRequest =
 | { command: "project.create"; input: CamposProjeto & { client_id: string } }
 | { command: "project.update"; input: Id & { patch: Partial<CamposProjeto> } }
 | { command: "project.delete" | "project.restore"; input: Id }
 | { command: "project.container.create"; input: { kind: ProjectContainer["kind"]; name: string; project_id: string; parent_id?: string | null; client_id: string } }
 | { command: "project.container.link"; input: Id & { project_id: string } }
 | { command: "project.container.unlink"; input: Id }
 | { command: "habit.create"; input: CamposHabito & { client_id: string } }
 | { command: "habit.update"; input: Id & { patch: Partial<CamposHabito> } }
 | { command: "habit.archive" | "habit.restore" | "habit.pause.delete"; input: Id }
 | { command: "habit.mark"; input: MarcacaoDeHabito }
 | { command: "habit.pause.create"; input: NovaPausaHabito };
export const ROUTINE_COMMANDS = ["project.create", "project.update", "project.delete", "project.restore", "project.container.create", "project.container.link", "project.container.unlink", "habit.create", "habit.update", "habit.archive", "habit.restore", "habit.mark", "habit.pause.create", "habit.pause.delete"] as const;
export type RoutineCommand = typeof ROUTINE_COMMANDS[number];
const projectFields = ["name", "description", "color_key", "position"], habitFields = ["name", "schedule_kind", "weekdays", "weekly_target", "started_on", "color_key", "icon_key", "position"];
const inputs: Record<RoutineCommand, readonly string[]> = { "project.create": [...projectFields, "client_id"], "project.update": ["id", "patch", "client_id"], "project.delete": ["id", "client_id"], "project.restore": ["id", "client_id"], "project.container.create": ["kind", "name", "project_id", "parent_id", "client_id"], "project.container.link": ["id", "project_id", "client_id"], "project.container.unlink": ["id", "client_id"], "habit.create": [...habitFields, "client_id"], "habit.update": ["id", "patch", "client_id"], "habit.archive": ["id", "client_id"], "habit.restore": ["id", "client_id"], "habit.mark": ["habit_id", "done_on", "done", "client_id"], "habit.pause.create": ["habit_id", "starts_on", "ends_on", "reason", "client_id"], "habit.pause.delete": ["id", "client_id"] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function decodeRoutineRequest(value: unknown): RoutineRequest {
  exigir(record(value) && Object.keys(value).every(key => ["command", "input"].includes(key)) && typeof value.command === "string" && ROUTINE_COMMANDS.includes(value.command as RoutineCommand) && record(value.input), "Informe uma operação válida.");
  const command = value.command as RoutineCommand, input = value.input;
  exigir(Object.keys(input).every(key => inputs[command].includes(key)) && typeof input.client_id === "string" && input.client_id.trim().length > 0 && input.client_id.length <= 200, "Campos ou identificador de envio inválidos.");
  if (command.endsWith(".update")) exigir(record(input.patch) && Object.keys(input.patch).every(key => (command.startsWith("habit.") ? habitFields : projectFields).includes(key)), "Campos de edição inválidos.");
  return structuredClone(value) as RoutineRequest;
}
export function executeRoutineCommand(store: RoutineUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, request: RoutineRequest): Promise<unknown> {
  switch (request.command) {
    case "project.create": return criarProjeto(store, deps, context, request.input);
    case "project.update": return editarProjeto(store, deps, context, request.input);
    case "project.delete": return excluirProjeto(store, deps, context, request.input);
    case "project.restore": return restaurarProjeto(store, deps, context, request.input);
    case "project.container.create": return criarContainerProjeto(store, deps, context, request.input);
    case "project.container.link": return vincularContainerProjeto(store, deps, context, request.input);
    case "project.container.unlink": return desvincularContainerProjeto(store, deps, context, request.input);
    case "habit.create": return criarHabito(store, deps, context, request.input);
    case "habit.update": return editarHabito(store, deps, context, request.input);
    case "habit.archive": return arquivarHabito(store, deps, context, request.input);
    case "habit.restore": return restaurarHabito(store, deps, context, request.input);
    case "habit.mark": return marcarHabito(store, deps, context, request.input);
    case "habit.pause.create": return registrarPausaHabito(store, deps, context, request.input);
    case "habit.pause.delete": return removerPausaHabito(store, deps, context, request.input);
  }
}
