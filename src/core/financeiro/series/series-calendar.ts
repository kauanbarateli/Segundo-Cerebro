import {exigir} from '../../contracts/base';
import {utcCivil} from '../../tempo/civil';
import {somaMesesNaData,ultimoDiaDoMes} from '../credit';
import type {SeriesDefinition,SeriesFrequency,SeriesHorizon} from './series-types';

export function seriesDay(value:unknown):string {
 exigir(typeof value==='string'&&/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(value),'Informe um dia civil entre os anos 0001 e 9999.');
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8));
 exigir(day>=1&&day<=ultimoDiaDoMes(year,month),'O dia da série não existe no calendário.');return value;
}
export function seriesMonth(value:unknown):string {const day=seriesDay(value);exigir(day.endsWith('-01'),'Informe a competência como AAAA-MM-01.');return day;}
function shiftedDays(anchor:string,days:number):string {
 const [year,month,day]=anchor.split('-').map(Number);
 const next=new Date(utcCivil(year!,month!,day!+days));
 exigir(next.getUTCFullYear()>=1&&next.getUTCFullYear()<=9999,'A série ultrapassa o intervalo civil permitido.');
 return seriesDay(next.toISOString().slice(0,10));
}
/** Every date is derived from the immutable original anchor, never a previous clamp. */
export function seriesOccurrenceDay(anchor:string,frequency:SeriesFrequency,offset:number):string {
 seriesDay(anchor);exigir(Number.isInteger(offset)&&offset>=0&&offset<120,'Índice de ocorrência inválido.');
 exigir(['weekly','monthly','yearly'].includes(frequency),'Frequência de série inválida.');
 if(frequency==='weekly')return shiftedDays(anchor,offset*7);
 return seriesDay(somaMesesNaData(anchor,offset*(frequency==='yearly'?12:1)));
}
export function seriesDayAt(definition:Pick<SeriesDefinition,'anchor_on'|'frequency'|'first_index'|'total'>,index:number):string {
 exigir(Number.isInteger(definition.total)&&definition.total>=2&&definition.total<=120,'A série precisa de 2 a 120 posições.');
 exigir(Number.isInteger(definition.first_index)&&definition.first_index>=1&&definition.first_index<=definition.total,'A primeira posição registrada precisa pertencer à série.');
 exigir(Number.isInteger(index)&&index>=definition.first_index&&index<=definition.total,'A posição não pertence à parte registrada da série.');
 return seriesOccurrenceDay(definition.anchor_on,definition.frequency,index-definition.first_index);
}
export function validateSeriesHorizon(horizon:SeriesHorizon,today:string):void {
 seriesDay(today);seriesDay(horizon.from_on);seriesDay(horizon.until_exclusive);
 exigir(horizon.from_on>=today&&horizon.until_exclusive>horizon.from_on,'O horizonte deve começar hoje ou no futuro e ter fim posterior.');
 if(Number(horizon.from_on.slice(0,4))<9999){
  const max=seriesDay(somaMesesNaData(horizon.from_on,12));
  exigir(horizon.until_exclusive<=max,'Uma ação prepara no máximo doze meses, com fim exclusivo.');
 }
}
