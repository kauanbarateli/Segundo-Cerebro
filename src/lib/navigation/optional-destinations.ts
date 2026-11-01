/**
 * Contract between the shell (Frente A) and the features that own their routes (Frente B).
 *
 * Both destinations are closed by default: the shell shows no link until the route works.
 * The server composition decides availability; the shell never infers it from a page, a
 * query string or a cookie. Server-side authorization stays with each route.
 */
export interface OptionalDestinations {
  feedback: boolean;
  updates: boolean;
}

export const FEEDBACK_PATH = "/feedback";
export const UPDATES_PATH = "/atualizacoes";
export const HELP_PATH = "/ajuda";
export const SUPPORT_MAILTO = "mailto:suporte@segundocerebroapp.com.br";

/** Replaced by the real server composition when the routes are operational. */
export function readOptionalDestinations(): OptionalDestinations {
  return { feedback: false, updates: false };
}

export interface ShellLink { href: string; label: string }
export interface OptionalNavigation {
  /** Header link to the updates board, present only when it works. */
  updates: ShellLink | null;
  /** Sidebar and account menu entry: Ajuda until feedback is operational, then Enviar feedback. */
  help: ShellLink & { kind: "help" | "feedback" };
  /** Support stays reachable once feedback replaces Ajuda in the shell. */
  support: ShellLink | null;
  /** Ajuda keeps its own page, so the account menu still offers it after the swap. */
  helpPage: ShellLink | null;
}

export function resolveOptionalNavigation(destinations: OptionalDestinations): OptionalNavigation {
  const updates = destinations.updates ? { href: UPDATES_PATH, label: "Atualizações" } : null;
  if (!destinations.feedback) return { updates, help: { kind: "help", href: HELP_PATH, label: "Ajuda" }, support: null, helpPage: null };
  return {
    updates,
    help: { kind: "feedback", href: FEEDBACK_PATH, label: "Enviar feedback" },
    support: { href: SUPPORT_MAILTO, label: "Falar com o suporte" },
    helpPage: { href: HELP_PATH, label: "Ajuda" },
  };
}
