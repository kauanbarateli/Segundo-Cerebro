import type { DemoApplication } from "./application";
import { validDomainCommandInput } from "./client-command-specs";
/** The explicit demonstration executes the same pure domain rules in memory. */
export function executeDemoDomainCommand(app: DemoApplication, name: string, value: unknown): Promise<unknown> {
  if (!validDomainCommandInput(name, value)) return Promise.reject(new Error("Operação de demonstração inválida."));
  const commands = {
    "project.create": app.commands.projects.create, "project.update": app.commands.projects.update,
    "project.delete": app.commands.projects.remove, "project.restore": app.commands.projects.restore,
    "project.container.create": app.commands.projects.containers.create,
    "project.container.link": app.commands.projects.containers.link, "project.container.unlink": app.commands.projects.containers.unlink,
    "habit.create": app.commands.habits.create, "habit.update": app.commands.habits.update,
    "habit.archive": app.commands.habits.archive, "habit.restore": app.commands.habits.restore,
    "habit.mark": app.commands.habits.mark, "habit.pause.create": app.commands.habits.pause, "habit.pause.delete": app.commands.habits.removePause,
  };
  if (!Object.hasOwn(commands, name)) return Promise.reject(new Error("Esta operação exige uma conta conectada."));
  // Exact shape was checked above and each domain validates its own values.
  const execute = commands[name as keyof typeof commands] as (input: unknown) => Promise<unknown>;
  return execute(value);
}
