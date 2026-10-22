import type { StatusTarefa, Tarefa } from "../../../core/tarefas";
import { ErroDeDominio } from "../../../core/contracts/base";
import { ConnectedApplicationError, isCommandOutcomeUnknown, type CommandFeedback, type CommandSession } from "../../../lib/demo/connected-application";

export type TaskItemAction = "complete" | "start" | "reopen" | "archive" | "remove" | "restore";
export const TASK_STATUS_ACTION: Record<StatusTarefa, TaskItemAction> = { todo: "reopen", in_progress: "start", done: "complete", archived: "archive" };
export const TASK_ACTION_STATUS: Partial<Record<TaskItemAction, StatusTarefa>> = { complete: "done", start: "in_progress", reopen: "todo", archive: "archived" };

export interface TaskActionCommandState {
  readonly task: Tarefa;
  readonly action: TaskItemAction;
  readonly input: Readonly<{ id: string; client_id: string }>;
  readonly pending: boolean;
  readonly uncertain: boolean;
}

/** The request retains the user's destination even if a refresh shows its commit already. */
export class TaskActionCommand {
  private current: TaskActionCommandState | null = null;
  constructor(private readonly makeId: () => string = () => crypto.randomUUID()) {}

  get state() { return this.current; }

  begin(task: Tarefa, action: TaskItemAction): TaskActionCommandState | null {
    if (this.current?.pending || this.current?.uncertain) return null;
    if (task.deleted_at && action !== "restore") return null;
    const previous = this.current;
    const input = previous?.task.id === task.id && previous.action === action ? previous.input
      : Object.freeze({ id: task.id, client_id: this.makeId() });
    this.current = Object.freeze({ task, action, input, pending: true, uncertain: false });
    return this.current;
  }

  retry(): TaskActionCommandState | null {
    if (!this.current || this.current.pending) return null;
    this.current = Object.freeze({ ...this.current, pending: true });
    return this.current;
  }

  settled(clientId: string): boolean {
    if (this.current?.input.client_id !== clientId) return false;
    this.current = null;
    return true;
  }

  /** A shared receipt can resolve uncertainty, never an owner still awaiting its request. */
  settleFeedback(feedback: CommandFeedback, userId: string): TaskActionCommandState | null {
    const retained = this.current;
    if (!retained || retained.pending || !retained.uncertain || retained.task.user_id !== userId ||
      (feedback.status !== "confirmed" && feedback.status !== "rejected") || feedback.clientId !== retained.input.client_id) return null;
    this.current = null;
    return retained;
  }

  failed(error: unknown) {
    if (!this.current) return;
    const known = error instanceof ConnectedApplicationError || error instanceof ErroDeDominio;
    if (known && error.code === "VALIDATION") { this.current = null; return; }
    this.current = Object.freeze({ ...this.current, pending: false,
      uncertain: this.current.uncertain || isCommandOutcomeUnknown(error) || !known });
  }
}

/** Consume every terminal before a subsequent journal entry replaces the shared snapshot. */
export function subscribeTaskActionSettlements(
  source: Pick<CommandSession, "subscribeCommands" | "getCommandSnapshot"> & { readonly userId: string },
  command: TaskActionCommand,
  onSettled: (retained: TaskActionCommandState, feedback: Extract<CommandFeedback, { status: "confirmed" | "rejected" }>) => void,
): () => void {
  const receive = () => {
    const feedback = source.getCommandSnapshot();
    if (feedback.status !== "confirmed" && feedback.status !== "rejected") return;
    const retained = command.settleFeedback(feedback, source.userId);
    if (retained) onSettled(retained, feedback);
  };
  const stop = source.subscribeCommands(receive);
  receive();
  return stop;
}
