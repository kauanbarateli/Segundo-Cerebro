import { validActivityPage, type ActivityCursor, type ActivityPage, type ActivityQuery } from "../../../core/activity";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export interface ActivityState {
  status: "idle" | "loading" | "ready" | "error"; data: ActivityPage | null;
  error: string | null; page: number; canGoBack: boolean; closed: boolean; recovery: "retry" | "login" | "reload";
}
export const INITIAL_ACTIVITY: ActivityState = { status: "idle", data: null, error: null, page: 1, canGoBack: false, closed: false, recovery: "retry" };
class ActivityReadError extends Error {
  constructor(readonly clearData: boolean, message: string, readonly recovery: ActivityState["recovery"] = "retry") { super(message); }
}
export async function readActivityPage(fetcher: Fetcher, userId: string, query: ActivityQuery, signal: AbortSignal): Promise<ActivityPage> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.cursor) { params.set("before_time", query.cursor.occurred_at); params.set("before_id", query.cursor.id); }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  let rejectAbort: () => void = () => undefined;
  const interrupted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new ActivityReadError(false, "A leitura foi interrompida. Tente novamente."));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  if (signal.aborted) controller.abort();
  try {
    // Race also bounds injected transports or body readers that ignore abort.
    return await Promise.race([interrupted, (async () => {
      const response = await fetcher(`/api/activity?${params}`, { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal, headers: { "X-Expected-User-ID": userId } });
      if (!response.ok) {
        const clear = [401, 403, 409].includes(response.status);
        const message = response.status === 401 ? "Sua sessão terminou. Entre novamente para consultar a atividade." : response.status === 409 ? "A conta mudou em outra aba. Recarregue a página para continuar." : response.status === 403 ? "A atividade não está disponível para esta conta." : "Não foi possível carregar a atividade. Tente novamente.";
        throw new ActivityReadError(clear, message, response.status === 401 ? "login" : clear ? "reload" : "retry");
      }
      let value: unknown;
      try { value = await response.json(); }
      catch { throw new ActivityReadError(true, "Não foi possível confirmar os registros. Atualize a atividade."); }
      if (!validActivityPage(value, query)) throw new ActivityReadError(true, "Não foi possível confirmar os registros. Atualize a atividade.");
      return value;
    })()]);
  } finally {
    clearTimeout(timer); signal.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", rejectAbort);
  }
}

/** One mounted user's paginated view. No storage, cache across users or raw errors. */
export function createActivityReader(userId: string, fetcher: Fetcher = fetch) {
  let state = INITIAL_ACTIVITY;
  let trail: (ActivityCursor | null)[] = [null];
  let pendingTrail = trail;
  let generation = 0;
  let controller: AbortController | undefined;
  let closed = false;
  const listeners = new Set<() => void>();
  const publish = (next: ActivityState) => { state = next; listeners.forEach(listener => listener()); };
  async function load(nextTrail: (ActivityCursor | null)[]) {
    if (closed) return;
    const attempt = ++generation; controller?.abort(); controller = new AbortController();
    pendingTrail = [...nextTrail];
    publish({ ...state, status: "loading", error: null });
    try {
      const data = await readActivityPage(fetcher, userId, { limit: 20, cursor: nextTrail.at(-1) ?? null }, controller.signal);
      if (attempt !== generation || closed) return;
      trail = [...nextTrail];
      publish({ status: "ready", data, error: null, page: trail.length, canGoBack: trail.length > 1, closed: false, recovery: "retry" });
    } catch (error) {
      if (attempt !== generation || closed) return;
      const clear = error instanceof ActivityReadError && error.clearData;
      const recovery = error instanceof ActivityReadError ? error.recovery : "retry";
      if (recovery !== "retry") closed = true;
      publish({ ...state, status: "error", data: clear ? null : state.data, canGoBack: clear ? false : state.canGoBack,
        closed, recovery, error: error instanceof ActivityReadError ? error.message : "Não foi possível carregar a atividade. Tente novamente." });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => load([null]), retry: () => load(pendingTrail),
    next: () => state.status === "ready" && state.data?.next_cursor ? load([...trail, state.data.next_cursor]) : Promise.resolve(),
    previous: () => state.status !== "loading" && state.canGoBack ? load(trail.slice(0, -1)) : Promise.resolve(),
    cancel() { generation++; controller?.abort(); },
    close() { closed = true; generation++; controller?.abort(); publish({ ...INITIAL_ACTIVITY, status: "error", closed: true, recovery: "login", error: "Sua sessão terminou. Entre novamente para consultar a atividade." }); },
  };
}
