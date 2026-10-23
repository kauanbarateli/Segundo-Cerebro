import {describe,expect,it} from 'vitest';
import {seriesDay,seriesDayAt,seriesOccurrenceDay,validateSeriesHorizon} from '../../src/core/financeiro/series';
describe('T053-B1: calendário de séries finitas',()=>{
 it.each([['2026-01-31','2026-02-28','2026-03-31'],['2024-01-30','2024-02-29','2024-03-30'],['2024-01-29','2024-02-29','2024-03-29']])('restaura a âncora mensal de %s', (anchor,february,march)=>{
  expect(seriesOccurrenceDay(anchor,'monthly',1)).toBe(february);expect(seriesOccurrenceDay(anchor,'monthly',2)).toBe(march);
 });
 it('define28/fev no ano comum e restaura29/fev no próximo bissexto',()=>{
  expect(seriesOccurrenceDay('2024-02-29','yearly',1)).toBe('2025-02-28');expect(seriesOccurrenceDay('2024-02-29','yearly',4)).toBe('2028-02-29');
 });
 it('semanal soma dias civis durante transição histórica de horário e de ano',()=>{
  expect(seriesOccurrenceDay('2018-10-28','weekly',1)).toBe('2018-11-04');expect(seriesOccurrenceDay('2026-12-28','weekly',1)).toBe('2027-01-04');
 });
 it('a âncora é da posição informada; não deduz datas das posições não registradas',()=>{
  const definition={anchor_on:'2026-10-31',frequency:'monthly' as const,first_index:5,total:12};
  expect(seriesDayAt(definition,5)).toBe('2026-10-31');expect(seriesDayAt(definition,6)).toBe('2026-11-30');expect(()=>seriesDayAt(definition,4)).toThrow();
 });
 it.each(['0000-01-01','2025-02-29','2026-04-31','2026-1-01','10000-01-01'])('recusa dia inválido %s',day=>expect(()=>seriesDay(day)).toThrow());
 it('limita o horizonte a12 meses com fim exclusivo, sem deslocar pelo fuso do servidor',()=>{
  expect(()=>validateSeriesHorizon({from_on:'2024-02-29',until_exclusive:'2025-02-28'},'2024-02-29')).not.toThrow();
  expect(()=>validateSeriesHorizon({from_on:'2024-02-29',until_exclusive:'2025-03-01'},'2024-02-29')).toThrow();
  expect(()=>validateSeriesHorizon({from_on:'2026-10-22',until_exclusive:'2026-11-01'},'2026-10-23')).toThrow();
  expect(()=>validateSeriesHorizon({from_on:'9999-06-01',until_exclusive:'9999-12-31'},'9999-06-01')).not.toThrow();
 });
 it('recusa qualquer data de ocorrência fora do intervalo1…9999',()=>{
  expect(()=>seriesOccurrenceDay('9999-12-31','weekly',1)).toThrow();expect(()=>seriesOccurrenceDay('9999-12-31','monthly',1)).toThrow();expect(()=>seriesOccurrenceDay('9999-12-31','yearly',1)).toThrow();
 });
});
