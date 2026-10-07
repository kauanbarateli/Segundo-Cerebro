import type { Database } from "../../lib/supabase/database.generated";
export type StoredProfile = Database["public"]["Tables"]["profiles"]["Row"];
