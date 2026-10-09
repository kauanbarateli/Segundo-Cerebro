import type { Captura } from "../capturas/types";
import type { Canal, ContextoDeEscrita, DependenciasDeDominio, EntidadeDoUsuario } from "../contracts/base";
import type { ReciboIdempotente } from "../contracts/unit-of-work";

export interface BlocoDocumento { type: string; text?: string; attrs?: Record<string, string | number | boolean | null>; marks?: { type: string; attrs?: Record<string, string | number | boolean | null> }[]; content?: BlocoDocumento[] }
export interface DocumentoPagina extends BlocoDocumento { type: "doc"; content: BlocoDocumento[] }
export interface Caderno extends EntidadeDoUsuario { name: string; project_id: string | null; position: number; deleted_at: string | null; deletion_batch_id: string | null; created_at: string; updated_at: string }
export interface Pagina extends EntidadeDoUsuario { notebook_id: string; parent_id: string | null; origin_capture_id: string | null; title: string; normalized_title: string; document: DocumentoPagina; content_text: string; version: number; position: number; archived_at: string | null; deleted_at: string | null; deletion_batch_id: string | null; created_at: string; updated_at: string }
export interface ReferenciaPagina extends EntidadeDoUsuario { page_id: string; target_id: string | null; alias: string; normalized_alias: string; created_at: string }
export type TipoVinculo = "page" | "notebook" | "task" | "capture" | "event" | "file" | "project" | "transaction" | "habit";
export interface Vinculo extends EntidadeDoUsuario { from_type: TipoVinculo; from_id: string; to_type: TipoVinculo; to_id: string; deleted_at: string | null; created_at: string; updated_at: string }
export interface AlvoRelacionado { type: TipoVinculo; id: string; title: string; href: string }
export type EntidadeConhecimento = Caderno | Pagina | ReferenciaPagina | Vinculo | Captura;
export interface EventoConhecimento extends EntidadeDoUsuario { entity_type: "knowledge_notebook" | "knowledge_page" | "knowledge_link" | "capture"; entity_id: string; action: "created" | "updated" | "deleted" | "restored" | "status_changed"; canal: Canal; occurred_at: string; before: EntidadeConhecimento | null; after: EntidadeConhecimento | null }
export interface SnapshotConhecimento { revision: string; notebooks: Caderno[]; pages: Pagina[]; refs: ReferenciaPagina[]; links: Vinculo[]; targets: AlvoRelacionado[]; captures: Captura[]; receipts: ReciboIdempotente[] }
export interface ConhecimentoDTO { revision: string; notebooks: Caderno[]; pages: Pagina[]; refs: ReferenciaPagina[]; links: Vinculo[]; targets: AlvoRelacionado[] }
export interface LeituraPaginaDTO { page: Pagina; backlinks: { id: string; title: string; notebook_id: string }[]; related: AlvoRelacionado[] }
export interface RelacionadosDTO { source: AlvoRelacionado; items: (AlvoRelacionado & { link_id: string })[] }
export interface MudancaConhecimento { type: EventoConhecimento["entity_type"]; before: EntidadeConhecimento | null; after: EntidadeConhecimento | null }
export interface TransacaoConhecimento { state: SnapshotConhecimento; events: EventoConhecimento[] }
export interface ConhecimentoStore { snapshot(): Promise<SnapshotConhecimento>; transaction<T>(context: ContextoDeEscrita, work: (tx: TransacaoConhecimento) => Promise<T>): Promise<T> }
export type DependenciasConhecimento = DependenciasDeDominio;
export interface BaseComandoConhecimento { client_id: string }
export type ComandoConhecimento =
  | { command: "knowledge.notebook.create"; input: BaseComandoConhecimento & { name: string; project_id?: string | null } }
  | { command: "knowledge.notebook.update"; input: BaseComandoConhecimento & { id: string; name: string; project_id?: string | null } }
  | { command: "knowledge.notebook.delete" | "knowledge.notebook.restore"; input: BaseComandoConhecimento & { id: string } }
  | { command: "knowledge.page.create"; input: BaseComandoConhecimento & { notebook_id: string; title: string; document?: DocumentoPagina; parent_id?: string | null } }
  | { command: "knowledge.page.update"; input: BaseComandoConhecimento & { id: string; expected_version: number; title: string; document: DocumentoPagina; notebook_id?: string; parent_id?: string | null } }
  | { command: "knowledge.page.delete" | "knowledge.page.restore" | "knowledge.page.archive" | "knowledge.page.unarchive"; input: BaseComandoConhecimento & { id: string } }
  | { command: "knowledge.page.resolve-ref"; input: BaseComandoConhecimento & { id: string; alias: string; notebook_id?: string } }
  | { command: "knowledge.page.promote-capture"; input: BaseComandoConhecimento & { capture_id: string; notebook_id: string; parent_id?: string | null } }
  | { command: "knowledge.link.create"; input: BaseComandoConhecimento & { from_type: TipoVinculo; from_id: string; to_type: TipoVinculo; to_id: string } }
  | { command: "knowledge.link.delete"; input: BaseComandoConhecimento & { id: string } };
