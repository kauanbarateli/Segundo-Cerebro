import type { Tarefa } from "../../../core/tarefas";
import { ErroDeDominio } from "../../../core/contracts/base";
import { ConnectedApplicationError, isCommandOutcomeUnknown } from "../../../lib/demo/connected-application";

export type HomeTaskInput = Readonly<{ id: string; status: "todo" | "done"; client_id: string }>;
export interface HomeTaskCommandState {
  readonly input: HomeTaskInput;
  readonly pending: boolean;
  readonly uncertain: boolean;
}

/** Keep the original intention across query refreshes and retries after a lost response. */
export class HomeTaskCommand {
  private current: HomeTaskCommandState | null = null;
  constructor(private readonly makeId: () => string = () => crypto.randomUUID()) {}

  get state() { return this.current; }

  begin(task: Pick<Tarefa, "id" | "status">): HomeTaskInput | null {
    if (this.current) return null;
    const input: HomeTaskInput = Object.freeze({ id: task.id, status: task.status === "done" ? "todo" : "done", client_id: this.makeId() });
    this.current = Object.freeze({ input, pending: true, uncertain: false });
    return input;
  }

  retry(): HomeTaskInput | null {
    if (!this.current || this.current.pending) return null;
    this.current = Object.freeze({ ...this.current, pending: true });
    return this.current.input;
  }

  settled(clientId: string): boolean {
    if (this.current?.input.client_id !== clientId) return false;
    this.current = null;
    return true;
  }

  failed(error: unknown) {
    if (!this.current) return;
    const known = error instanceof ConnectedApplicationError || error instanceof ErroDeDominio;
    if (known && error.code === "VALIDATION") { this.current = null; return; }
    this.current = Object.freeze({ ...this.current, pending: false,
      uncertain: this.current.uncertain || isCommandOutcomeUnknown(error) || !known });
  }
}
