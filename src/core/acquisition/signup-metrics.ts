import { ORIGIN_DICTIONARY, ORIGIN_DICTIONARY_VERSION } from './origin-dictionary.generated';
/** Only already-aggregated rows belong here. This module never receives users. */
export type SignupOriginCount = Readonly<{ value: string | null; count: number }>;
export type DisplayOriginCount = Readonly<
  | { kind: "value"; value: string; count: number }
  | { kind: "not-informed"; value: null; count: number }
  | { kind: "other"; value: null; count: number }
>;

export const METRIC_DIMENSIONS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export type MetricDimension = (typeof METRIC_DIMENSIONS)[number];
export type MetricQuery = { start: string; end: string; zone: 'America/Fortaleza' | 'UTC'; bucket: 'day' | 'week' | 'month' };
export type SignupMetrics = MetricQuery & { totalPublic: number; stock: Record<'total' | 'legacy' | 'admin' | 'public' | 'unclassified', number>; series: {period: string; count: number}[]; distributions: Record<MetricDimension, DisplayOriginCount[]> };

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function parseMetricQuery(params: URLSearchParams): MetricQuery | null {
  const keys = ['start', 'end', 'zone', 'bucket'];
  if ([...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length !== 1)) return null;
  const start=params.get('start')!, end=params.get('end')!, zone=params.get('zone'), bucket=params.get('bucket');
  if (!validDate(start) || !validDate(end) || end < start || (Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000 > 365 || (zone !== 'America/Fortaleza' && zone !== 'UTC') || (bucket !== 'day' && bucket !== 'week' && bucket !== 'month')) return null;
  return {start,end,zone,bucket};
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join('|') === [...keys].sort().join('|');
/** Reject unexpected fields before a privileged database response reaches the client. */
export function parseSignupMetrics(value: unknown, query: MetricQuery): SignupMetrics | null {
  if (!object(value) || !exact(value,['start','end','zone','bucket','totalPublic','stock','series','distributions']) || Object.entries(query).some(([key,v])=>value[key]!==v) || !count(value.totalPublic)) return null;
  const total=value.totalPublic, stock=value.stock, series=value.series, dimensions=value.distributions;
  const stockKeys=['total','legacy','admin','public','unclassified'];
  if (!object(stock) || !exact(stock,stockKeys) || stockKeys.some(key=>!count(stock[key])) || stock.total !== (stock.legacy as number)+(stock.admin as number)+(stock.public as number)+(stock.unclassified as number)) return null;
  if (!Array.isArray(series) || !series.length || series.length>366 || series.some(row=>!object(row) || !exact(row,['period','count']) || typeof row.period!=='string' || !validDate(row.period) || !count(row.count)) || series.reduce((sum,row)=>sum+row.count,0)!==total) return null;
  if (!object(dimensions) || !exact(dimensions,[...METRIC_DIMENSIONS])) return null;
  for (const key of METRIC_DIMENSIONS) {
    const rows=dimensions[key];
    if (!Array.isArray(rows) || rows.length>101 || rows.some(row=>!object(row) || !exact(row,['kind','value','count']) || !count(row.count) || row.count===0 || (row.kind==='value' ? typeof row.value!=='string' || !row.value.trim() || [...row.value].length>200 || row.count<5 : (row.kind!=='other' && row.kind!=='not-informed') || row.value!==null || (row.kind==='not-informed' && row.count<5))) || rows.reduce((sum,row)=>sum+row.count,0)!==total) return null;
  }
  return value as SignupMetrics;
}

/** The browser accepts only the specific withheld representation sent by the API.
 * This check cannot retract bytes already received; the server must suppress them.
 */
export function parseWithheldSignupMetrics(value: unknown, query: MetricQuery): SignupMetrics | null {
  const metrics = parseSignupMetrics(value, query);
  if (!metrics) return null;
  for (const dimension of METRIC_DIMENSIONS) {
    const rows = metrics.distributions[dimension];
    if (metrics.totalPublic === 0) {
      if (rows.length !== 0) return null;
    } else {
      const row = rows[0];
      if (rows.length !== 1 || !row || row.kind !== "other" || row.value !== null || row.count !== metrics.totalPublic) return null;
    }
  }
  return metrics;
}

/**
 * Reject incomplete or duplicated populations before consolidating small groups.
 * Suppression reduces disclosure but cannot guarantee anonymity across queries.
 */
export function prepareOriginDistribution(total: number, groups: readonly SignupOriginCount[]): readonly DisplayOriginCount[] | null {
  if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(groups) || groups.length > 500) return null;
  const seen = new Set<string | null>(), visible: DisplayOriginCount[] = [];
  let sum = 0, other = 0;
  for (const group of groups) {
    if (!group || (group.value !== null && (typeof group.value !== "string" || !group.value.trim() || [...group.value].length > 200 || /[\u0000-\u001f\u007f-\u009f<>]/u.test(group.value))) || !Number.isSafeInteger(group.count) || group.count < 1 || seen.has(group.value)) return null;
    seen.add(group.value); sum += group.count;
    if (!Number.isSafeInteger(sum) || sum > total) return null;
    if (group.count < 5) other += group.count;
    else if (group.value === null) visible.push({ kind: "not-informed", value: null, count: group.count });
    else visible.push({ kind: "value", value: group.value, count: group.count });
  }
  if (sum !== total) return null;
  if (other) visible.push({ kind: "other", value: null, count: other });
  return visible;
}

/** Until a reviewed allowlist is deployed, do not disclose free-form campaign values.
 * The database response is privileged server input, not an anonymous payload.
 */
export function withholdOriginDistribution(metrics: SignupMetrics): SignupMetrics {
  const distributions = {} as SignupMetrics['distributions'];
  for (const dimension of METRIC_DIMENSIONS) {
    distributions[dimension] = metrics.totalPublic === 0
      ? []
      : [{ kind: "other", value: null, count: metrics.totalPublic }];
  }
  return { ...metrics, distributions };
}

/** Catalogued aggregates only: reject old SQL, unknown codes, extras and incomplete populations. */
export type CatalogSignupMetrics = SignupMetrics & { dictionaryVersion: string };
export function parseCatalogSignupMetrics(value: unknown, query: MetricQuery): CatalogSignupMetrics | null {
 if (!object(value) || !exact(value,['dictionaryVersion','start','end','zone','bucket','totalPublic','stock','series','distributions']) || value.dictionaryVersion !== ORIGIN_DICTIONARY_VERSION || !count(value.totalPublic) || !object(value.distributions)) return null;
 const total=value.totalPublic, dimensions=value.distributions;
 if (!exact(dimensions,[...METRIC_DIMENSIONS])) return null;
 // Reuse the existing strict metadata/series parser with a fabricated safe distribution.
 const held=Object.fromEntries(METRIC_DIMENSIONS.map(key=>[key,total?[{kind:'other',value:null,count:total}]:[]]));
 const base={start:value.start,end:value.end,zone:value.zone,bucket:value.bucket,totalPublic:total,stock:value.stock,series:value.series,distributions:held};
 if (!parseWithheldSignupMetrics(base,query)) return null;
 for (const dimension of METRIC_DIMENSIONS) {
  const rows=dimensions[dimension],seen=new Set<string>();
  if(!Array.isArray(rows)||rows.length>102)return null;
  for(const row of rows) {
   if(!object(row)||!exact(row,['kind','value','count'])||!count(row.count)||row.count===0)return null;
   if(row.kind==='value') {
    const entries=ORIGIN_DICTIONARY[dimension] as readonly {code:string;label:string}[];
    if(typeof row.value!=='string'||row.count<5||!entries.some(entry=>entry.code===row.value))return null;
   } else if((row.kind!=='other'&&row.kind!=='not-informed')||row.value!==null)return null;
   const key=String(row.kind)+':'+String(row.value);if(seen.has(key))return null;seen.add(key);
  }
  if(rows.reduce((sum,row)=>sum+row.count,0)!==total)return null;
 }
 return value as CatalogSignupMetrics;
}
export function catalogOriginLabel(dimension:MetricDimension, row:DisplayOriginCount):string {
 if(row.kind==='not-informed')return 'Não informada';
 if(row.kind==='other')return 'Outros';
 const entries=ORIGIN_DICTIONARY[dimension] as readonly {code:string;label:string}[];
 return entries.find(entry=>entry.code===row.value)?.label ?? 'Outros';
}
