import { describe, expect, it } from "vitest";
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseMetricQuery, parseSignupMetrics, parseWithheldSignupMetrics, parseCatalogSignupMetrics, catalogOriginLabel, prepareOriginDistribution } from "../../src/core/acquisition/signup-metrics";

describe("distribuição agregada de origens", () => {
  it("mantém a população completa e reúne grupos pequenos sem expor valores", () => {
    expect(prepareOriginDistribution(17, [{ value: "busca", count: 7 }, { value: null, count: 5 }, { value: "campanha privada", count: 3 }, { value: "outra", count: 2 }])).toEqual([
      { kind: "value", value: "busca", count: 7 }, { kind: "not-informed", value: null, count: 5 }, { kind: "other", value: null, count: 5 },
    ]);
  });
  it("não confunde origem não informada com tráfego direto ou um valor chamado Outros", () => {
    expect(prepareOriginDistribution(10, [{ value: null, count: 5 }, { value: "Outros", count: 5 }])).toEqual([{ kind: "not-informed", value: null, count: 5 }, { kind: "value", value: "Outros", count: 5 }]);
    expect(prepareOriginDistribution(0, [])).toEqual([]);
  });
  it("recusa populações incompletas, duplicadas ou com contagens inválidas", () => {
    expect(prepareOriginDistribution(6, [{ value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(4, [{ value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(10, [{ value: "a", count: 5 }, { value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(1, [{ value: "a", count: -1 }])).toBeNull();
    expect(prepareOriginDistribution(5, [{ value: "<script>", count: 5 }])).toBeNull();
  });
  it("recusa cardinalidade ilimitada e não supõe anonimato", () => {
    expect(prepareOriginDistribution(501, Array.from({ length: 501 }, (_, index) => ({ value: String(index), count: 1 })))).toBeNull();
    expect(prepareOriginDistribution(Number.MAX_SAFE_INTEGER + 1, [])).toBeNull();
  });
});

describe('contrato do relatório',()=>{
 const query={start:'2026-10-01',end:'2026-10-31',zone:'America/Fortaleza' as const,bucket:'month' as const};
 const rows=[{kind:'value',value:'busca',count:5},{kind:'other',value:null,count:2}];
 const result={...query,totalPublic:7,stock:{total:1,legacy:1,admin:0,public:0,unclassified:0},series:[{period:'2026-10-01',count:7}],distributions:{utm_source:rows,utm_medium:rows,utm_campaign:rows,utm_term:rows,utm_content:rows}};
 it('limita período, dimensão e parâmetros duplicados',()=>{
  expect(parseMetricQuery(new URLSearchParams(query))).toEqual(query);
  expect(parseMetricQuery(new URLSearchParams({...query,start:'2026-02-30'}))).toBeNull();
  expect(parseMetricQuery(new URLSearchParams({...query,start:'2020-01-01'}))).toBeNull();
  const extra=new URLSearchParams(query); extra.append('start','2026-10-02'); expect(parseMetricQuery(extra)).toBeNull();
 });
 it('recusa contagens divergentes, grupos pequenos revelados e campos inesperados',()=>{
  expect(parseSignupMetrics(result,query)).toEqual(result);
  expect(parseSignupMetrics({...result,series:[{period:'2026-10-01',count:6}]},query)).toBeNull();
  expect(parseSignupMetrics({...result,distributions:{...result.distributions,utm_source:[{kind:'value',value:'individual',count:2},{kind:'other',value:null,count:5}]}},query)).toBeNull();
  expect(parseSignupMetrics({...result,email:'privado'},query)).toBeNull();
 });
});


describe("contrato retido das métricas", () => {
 const query={start:"2026-10-01",end:"2026-10-31",zone:"UTC" as const,bucket:"month" as const};
 const dimensions=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"] as const;
 const report=(total:number) => ({...query,totalPublic:total,stock:{total,legacy:0,admin:0,public:total,unclassified:0},series:[{period:query.start,count:total}],distributions:Object.fromEntries(dimensions.map(d=>[d,total?[{kind:"other",value:null,count:total}]:[]]))});
 it("aceita apenas populações retidas, inclusive quando vazias", () => {
  expect(parseWithheldSignupMetrics(report(7),query)).toEqual(report(7));
  expect(parseWithheldSignupMetrics(report(0),query)).toEqual(report(0));
 });
 it("recusa valores livres ou grupos de ausência em qualquer dimensão", () => {
  for(const dimension of dimensions) for(const rows of [[{kind:"value",value:"private@example.invalid",count:7}],[{kind:"not-informed",value:null,count:7}],[{kind:"other",value:null,count:2},{kind:"other",value:null,count:5}]]) {
   const result=report(7); Object.assign(result.distributions,{[dimension]:rows});
   expect(parseWithheldSignupMetrics(result,query)).toBeNull();
  }
 });
});

import { ORIGIN_DICTIONARY, ORIGIN_DICTIONARY_VERSION } from '../../src/core/acquisition/origin-dictionary.generated';
describe('catálogo aprovado',()=>{
 const query={start:'2026-10-01',end:'2026-10-31',zone:'UTC' as const,bucket:'month' as const};
 const missing=[{kind:'not-informed' as const,value:null,count:6}],source=[{kind:'value' as const,value:'google',count:5},{kind:'not-informed' as const,value:null,count:1}];
 const good={...query,dictionaryVersion:ORIGIN_DICTIONARY_VERSION,totalPublic:6,stock:{total:6,legacy:0,admin:0,public:6,unclassified:0},series:[{period:query.start,count:6}],distributions:{utm_source:source,utm_medium:missing,utm_campaign:missing,utm_term:missing,utm_content:missing}};
 it('mantém catálogo, versão e SQL guardado alinhados',()=>{
  const bytes=readFileSync('scripts/verification/front-b-metrics-dictionary-draft/origin-dictionary.json');
  expect(ORIGIN_DICTIONARY_VERSION).toBe('sha256:'+createHash('sha256').update(bytes).digest('hex'));
  expect(ORIGIN_DICTIONARY).toEqual(JSON.parse(bytes.toString('utf8')).dimensions);
  const sql=readFileSync('scripts/verification/front-b-metrics-dictionary-draft/catalog-integration.sql.txt','utf8');
  expect(() => execFileSync(process.execPath, ['scripts/verification/front-b-metrics-dictionary-draft/catalog.mjs','--check'], {stdio:'pipe'})).not.toThrow();
  expect(sql).toContain(ORIGIN_DICTIONARY_VERSION);expect(sql).toMatch(/begin;\s*do \$\$ begin raise exception 'DRAFT_ONLY/);
 });
 it('aceita identificadores versionados e recusa aliases conflitantes ou sensíveis',async()=>{
  const url=new URL('../../scripts/verification/front-b-metrics-dictionary-draft/catalog.mjs',import.meta.url).href;
  const {compileApprovedCatalog}=await import(/* @vite-ignore */ url) as {compileApprovedCatalog:(bytes:Buffer,base:Buffer)=>unknown};
  const base=readFileSync('supabase/operations/candidates/20261101030000_signup_metrics.sql');
  const dictionary=JSON.parse(readFileSync('scripts/verification/front-b-metrics-dictionary-draft/origin-dictionary.json','utf8'));
  dictionary.dimensions.utm_campaign=[{code:'lancamento_2027',label:'Lançamento Campanha',aliases:['lancamento_2027','campanha_2027']}];
  expect(()=>compileApprovedCatalog(Buffer.from(JSON.stringify(dictionary)),base)).not.toThrow();
  dictionary.dimensions.utm_campaign.push({code:'outra',label:'Outra',aliases:['outra','campanha_2027']});
  expect(()=>compileApprovedCatalog(Buffer.from(JSON.stringify(dictionary)),base)).toThrow();
  dictionary.dimensions.utm_campaign=[{code:'pessoal',label:'Pessoal',aliases:['pessoal','pessoa@example.invalid']}];
  expect(()=>compileApprovedCatalog(Buffer.from(JSON.stringify(dictionary)),base)).toThrow();
  dictionary.dimensions.utm_campaign=[{code:'pessoal',label:'Outros',aliases:['pessoal']}];
  expect(()=>compileApprovedCatalog(Buffer.from(JSON.stringify(dictionary)),base)).toThrow();
 });
 it('aceita códigos conhecidos e distingue ausência de Outros',()=>{expect(parseCatalogSignupMetrics(good,query)).toEqual(good);expect(catalogOriginLabel('utm_source',source[0]!)).toBe('Google');expect(catalogOriginLabel('utm_source',source[1]!)).toBe('Não informada');});
 it('recusa versão antiga, códigos livres, grupos duplicados e contagens divergentes',()=>{
  expect(parseCatalogSignupMetrics({...good,dictionaryVersion:'old'},query)).toBeNull();
  expect(parseCatalogSignupMetrics({...good,distributions:{...good.distributions,utm_source:[{kind:'value',value:'pessoa@example.invalid',count:6}]}},query)).toBeNull();
  expect(parseCatalogSignupMetrics({...good,distributions:{...good.distributions,utm_source:[{kind:'not-informed',value:null,count:3},{kind:'not-informed',value:null,count:3}]}},query)).toBeNull();
  expect(parseCatalogSignupMetrics({...good,distributions:{...good.distributions,utm_source:[{kind:'other',value:null,count:5}]}},query)).toBeNull();
 });
});
