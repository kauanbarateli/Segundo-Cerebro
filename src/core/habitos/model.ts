import type { CadenciaHabito } from "./cadence";
import type { EstadoDaFrequenciaV1 } from "./frequency-state";
export type { CadenciaHabito } from "./cadence";
export interface Habito {
  id: string;
  user_id?: string;
  frequency_history?: EstadoDaFrequenciaV1;
  image_file_id?: string | null;
  name: string;
  schedule_kind: CadenciaHabito;
  weekdays: number[];
  weekly_target: number | null;
  started_on: string;
  archived_at: string | null;
}
export interface PausaHabito { habit_id: string | null; starts_on: string; ends_on: string | null }
