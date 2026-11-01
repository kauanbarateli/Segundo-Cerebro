import { describe, expect, it } from "vitest";
import { parseMetricQuery, parseSignupMetrics, parseWithheldSignupMetrics, prepareOriginDistribution } from "../../src/core/acquisition/signup-metrics";

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
