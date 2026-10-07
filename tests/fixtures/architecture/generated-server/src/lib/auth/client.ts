import type { Database } from "../supabase/database.generated";
export type AuthProfile = Database["public"]["Tables"]["profiles"]["Row"];
