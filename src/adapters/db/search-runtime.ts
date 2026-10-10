import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SEARCH_PATHS, SEARCH_TYPES, type SearchPort, type SearchResult, type SearchType } from "../../core/busca";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import type { Database } from "../../lib/supabase/database.generated";
export function searchForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity): SearchPort {
  if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") throw new AuthGuardError("unavailable");
  const client = createClient<Database>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  return { async query(term) {
    const { data, error } = await client.rpc("global_search", { p_user: actor.userId, p_session: actor.sessionId, p_term: term } satisfies Database["public"]["Functions"]["global_search"]["Args"]);
    if (error?.code === "42501") throw new AuthGuardError("forbidden");
    if (error || !Array.isArray(data) || data.length > 70) throw new AuthGuardError("unavailable");
    return data.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["id", "user_id", "type", "title", "rank"].includes(key)) || value.user_id !== actor.userId || typeof value.id !== "string" || !/^[0-9a-f-]{36}$/.test(value.id) || !SEARCH_TYPES.includes(value.type as SearchType) || typeof value.title !== "string" || value.title.length > 200 || typeof value.rank !== "number" || !Number.isInteger(value.rank) || value.rank < 0 || value.rank > 4) throw new AuthGuardError("unavailable");
      const type = value.type as SearchType; return { id: value.id, type, title: value.title, rank: value.rank, href: SEARCH_PATHS[type] + encodeURIComponent(value.id) } satisfies SearchResult;
    });
  } };
}
