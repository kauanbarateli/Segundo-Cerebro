import type { ContextoDeEscrita, DependenciasDeDominio, EntidadeDoUsuario } from "../contracts/base";
import type { ReciboIdempotente } from "../contracts/unit-of-work";
export type TipoArquivo = "drive" | "capture_image" | "avatar";
export interface Pasta extends EntidadeDoUsuario { name: string; parent_id: string | null; project_id: string | null; deleted_at: string | null; deletion_batch_id: string | null; position: number; created_at: string; updated_at: string }
export interface Arquivo extends EntidadeDoUsuario { kind: TipoArquivo; folder_id: string | null; name: string; mime: string; bytes: number; sha256: string; width: number | null; height: number | null; starred: boolean; deleted_at: string | null; deletion_batch_id: string | null; created_at: string; updated_at: string; modified_at: string }
export interface DriveDTO { folders: Pasta[]; files: Arquivo[]; usage_bytes: number; capacity_bytes: number; max_file_bytes: number; projects: { id: string; name: string }[] }
export interface SnapshotDrive extends DriveDTO { revision: string; receipts: ReciboIdempotente[] }
export interface EventoDrive extends EntidadeDoUsuario { entity_type: "drive_folder" | "drive_file"; entity_id: string; action: "created" | "updated" | "deleted" | "restored"; canal: ContextoDeEscrita["canal"]; occurred_at: string; before: Pasta | Arquivo | null; after: Pasta | Arquivo }
export interface TransacaoDrive { state: SnapshotDrive; events: EventoDrive[] }
export interface DriveStore { snapshot(): Promise<SnapshotDrive>; transaction<T>(context: ContextoDeEscrita, work: (tx: TransacaoDrive) => Promise<T>): Promise<T> }
export type DependenciasDrive = DependenciasDeDominio;
export type ComandoDrive =
 | { command: "drive.folder.create"; input: { name: string; parent_id?: string | null; project_id?: string | null; client_id: string } }
 | { command: "drive.folder.update"; input: { id: string; name: string; client_id: string } }
 | { command: "drive.folder.move"; input: { id: string; parent_id: string | null; client_id: string } }
 | { command: "drive.folder.delete" | "drive.folder.restore"; input: { id: string; client_id: string } }
 | { command: "drive.file.update"; input: { id: string; name: string; client_id: string } }
 | { command: "drive.file.move"; input: { id: string; folder_id: string | null; client_id: string } }
 | { command: "drive.file.delete" | "drive.file.restore"; input: { id: string; client_id: string } }
 | { command: "drive.file.star"; input: { id: string; starred: boolean; client_id: string } };
export interface PoliticaArquivos { quota_bytes: number; drive_max_bytes: number; image_max_bytes: number; max_pixels: number; lease_seconds: number }
export interface ReservaUpload extends EntidadeDoUsuario { kind: TipoArquivo; name: string; folder_id: string | null; staging_path: string; final_path: string; max_bytes: number; quota_bytes: number; expires_at: string; status: "reserved" | "processing" | "finalized" | "expired"; lease_id: string | null; lease_until: string | null; file_id: string | null }
export interface ArquivoPreparado { bytes: Uint8Array; mime: string; name: string; width: number | null; height: number | null; sha256: string }
