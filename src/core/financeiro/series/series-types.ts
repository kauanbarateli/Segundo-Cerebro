import type {Canal,EntidadeDoUsuario} from '../../contracts/base';
import type {EventoDominio} from '../../contracts/modules';
import type {SerieTipo} from '../types';

/** Separate v2 contract; the financial v1 rows, receipts and snapshots stay closed. */
export type SeriesFrequency='weekly'|'monthly'|'yearly';
export type SeriesState='active'|'paused'|'ended';
export type SeriesSuppression='none'|'series_pause'|'manual'|'ended';
export type SeriesStatementMode='none'|'account_cycle'|'explicit';
export interface SeriesTemplate {
 account_id:string;category_id:string|null;kind:'income'|'expense';amount_cents:number;
 description:string;payee:string|null;notes:string|null;tag_ids:string[];statement_mode:SeriesStatementMode;
}
export interface SeriesDefinition {
 kind:SerieTipo;frequency:SeriesFrequency;
 /** Date belonging to first_index, not evidence of any earlier paid installment. */
 anchor_on:string;first_index:number;total:number;ends_on:string|null;template:SeriesTemplate;
}
export interface ManagedFinanceSeries extends EntidadeDoUsuario,SeriesDefinition {
 version:2;state:SeriesState;revision:string;next_index:number;
 /** Last materialized date, not a promise that every prior installment was paid. */
 materialized_through:string|null;created_at:string;updated_at:string;
}
export interface ManagedSeriesOccurrence extends EntidadeDoUsuario {
 series_id:string;index:number;transaction_id:string;occurred_on:string;
 suppression:SeriesSuppression;configuration_revision:string;created_at:string;updated_at:string;
}
export interface SeriesHorizon {from_on:string;until_exclusive:string}
export interface SeriesStatementAssignment {index:number;statement_month:string}
export interface PlannedSeriesOccurrence {
 index:number;occurred_on:string;amount_cents:number;paid_cents:number;
 /** Card paid_cents is a projection; planned never means a realized payment. */
 status:'planned';statement_month:string|null;
}
export interface SeriesMaterializationPlan extends SeriesHorizon {
 occurrences:PlannedSeriesOccurrence[];skipped_before_horizon:number[];
 already_materialized:number[];next_index:number;exhausted:boolean;
}
export type SeriesEligibilityReason='eligible'|'before_boundary'|'recorded'|'paid_or_partial'|'cancelled'|'not_paused_by_series'|'already_suppressed'|'series_ended'|'series_not_active'|'series_not_paused';
export interface SeriesEligibility {allowed:boolean;reason:SeriesEligibilityReason}

interface ExistingSeriesCommand {client_id:string;expected_finance_revision:string;series_id:string;expected_revision:string}
export type FinanceSeriesCommand=
 |{command:'finance.recurring.create';input:{client_id:string;expected_finance_revision:string;definition:SeriesDefinition;horizon:SeriesHorizon;statement_assignments:SeriesStatementAssignment[]}}
 |{command:'finance.recurring.materialize'|'finance.recurring.resume';input:ExistingSeriesCommand&{horizon:SeriesHorizon;statement_assignments:SeriesStatementAssignment[]}}
 |{command:'finance.recurring.pause'|'finance.recurring.end';input:ExistingSeriesCommand&{from_on:string}}
 |{command:'finance.recurring.update_future';input:ExistingSeriesCommand&{from_on:string;patch:{template?:SeriesTemplate;ends_on?:string|null};statement_assignments:SeriesStatementAssignment[]}}
 |{command:'finance.recurring.occurrence.cancel';input:ExistingSeriesCommand&{occurrence_id:string}}
 |{command:'finance.recurring.occurrence.update';input:ExistingSeriesCommand&{occurrence_id:string;patch:{status:'confirmed'|'reconciled';paid_cents:number}}};
export interface FinanceSeriesResult {
 version:2;series:ManagedFinanceSeries;
 affected:{created:number;updated:number;suppressed:number;restored:number;skipped:number};
}

type MetadataEntities={finance_series:ManagedFinanceSeries;finance_series_occurrence:ManagedSeriesOccurrence};
type MetadataEvent={[K in keyof MetadataEntities]:{
 id:string;user_id:string;entity_type:K;entity_id:string;action:'created'|'updated'|'status_changed';
 canal:Canal;occurred_at:string;before:MetadataEntities[K]|null;after:MetadataEntities[K];
}}[keyof MetadataEntities];
export type FinanceSeriesEvent=MetadataEvent|Extract<EventoDominio,{entity_type:'finance_transaction'}>;

/** Minimal owner-scoped list; never includes the user's entire event/receipt log. */
export interface FinanceSeriesPage {version:2;finance_revision:string;items:ManagedFinanceSeries[];next_cursor:string|null}
