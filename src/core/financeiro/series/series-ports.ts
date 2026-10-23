import type {ContextoDeEscrita} from '../../contracts/base';
import type {ReciboIdempotente} from '../../contracts/unit-of-work';
import type {ContaFinanceira,CategoriaFinanceira,EtiquetaFinanceira,LancamentoFinanceiro} from '../fused';
import type {FinanceSeriesEvent,FinanceSeriesPage,ManagedFinanceSeries,ManagedSeriesOccurrence} from './series-types';

interface SeriesReader<T> {get(id:string):Promise<T|null>}
interface SeriesWriter<T> extends SeriesReader<T> {insert(row:T):Promise<void>;replace(row:T):Promise<void>}
export interface FinanceSeriesRead {
 series:SeriesReader<ManagedFinanceSeries>&{page(query:{cursor:string|null;limit:number}):Promise<FinanceSeriesPage>};
 occurrences:SeriesReader<ManagedSeriesOccurrence>&{forSeries(seriesId:string):Promise<ManagedSeriesOccurrence[]>};
 accounts:SeriesReader<ContaFinanceira>;categories:SeriesReader<CategoriaFinanceira>;tags:SeriesReader<EtiquetaFinanceira>;
 transactions:SeriesReader<LancamentoFinanceiro>;
}
export interface FinanceSeriesTransaction {
 /** Decimal monotonic financial revision from the same owner lock used by v1. */
 readonly financeRevision:string;
 series:SeriesWriter<ManagedFinanceSeries>;
 occurrences:SeriesWriter<ManagedSeriesOccurrence>&{forSeries(seriesId:string):Promise<ManagedSeriesOccurrence[]>};
 accounts:SeriesReader<ContaFinanceira>;categories:SeriesReader<CategoriaFinanceira>;tags:SeriesReader<EtiquetaFinanceira>;
 transactions:SeriesWriter<LancamentoFinanceiro>;
 events:{append(event:FinanceSeriesEvent):Promise<void>};
 receipts:{get(command:string,clientId:string):Promise<ReciboIdempotente|null>;insert(receipt:ReciboIdempotente):Promise<void>};
}
/** Adapter must commit metadata, map, real ledger rows, events and receipt atomically. */
export interface FinanceSeriesUnitOfWork {
 read(userId:string):FinanceSeriesRead;
 transaction<T>(context:ContextoDeEscrita,work:(tx:FinanceSeriesTransaction)=>Promise<T>):Promise<T>;
}
