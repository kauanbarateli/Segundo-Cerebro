/** Scratch domain only: caller injects storage; no browser, transport or backend. */
export interface MarkerStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type Marker = Readonly<{version: 1; clientId: string; ownerBinding: string}>;
export type Inspection = {status:'none'|'blocked'|'different-owner'} | {status:'pending'; clientId:string};
export type Preparation = {status:'blocked'} | {status:'ready'; clientId:string};
export type Reconciliation = {status:'unknown'|'blocked'|'different-owner'|'none'} | {status:'submitted'|'cancelled'} | {status:'terminal-storage-uncertain';terminal:'submitted'|'cancelled'};

const key='feedback-attempt-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const binding=/^[a-zA-Z0-9_-]{16,128}$/;
function parseMarker(raw:string):Marker|null {
  try {
    const x:unknown=JSON.parse(raw);
    if(!x || typeof x!=='object' || Array.isArray(x) || Object.keys(x).sort().join(',')!=='clientId,ownerBinding,version')return null;
    const value=x as Record<string,unknown>;
    return value.version===1 && typeof value.clientId==='string' && uuid.test(value.clientId) && typeof value.ownerBinding==='string' && binding.test(value.ownerBinding)
      ? Object.freeze({version:1,clientId:value.clientId,ownerBinding:value.ownerBinding}) : null;
  } catch {return null;}
}

/** Store/read back one snapshot before networking. A failed write may be partial. */
export function prepareMarker(store:MarkerStore, input:Marker):Preparation {
  try {
    const raw=JSON.stringify(input),snapshot=parseMarker(raw);
    if(!snapshot || store.getItem(key)!==null)return {status:'blocked'};
    store.setItem(key,raw);
    if(store.getItem(key)!==raw)return {status:'blocked'};
    return {status:'ready',clientId:snapshot.clientId};
  } catch {return {status:'blocked'};}
}

/** ownerBinding is a server-issued pseudonym, never identity or authorization. */
export function inspectMarker(store:MarkerStore, ownerBinding:string):Inspection {
  try {
    const raw=store.getItem(key);if(raw===null)return {status:'none'};
    const marker=parseMarker(raw);if(!marker)return {status:'blocked'};
    return marker.ownerBinding===ownerBinding ? {status:'pending',clientId:marker.clientId} : {status:'different-owner'};
  } catch {return {status:'blocked'};}
}

/** Only an authenticated, origin-checked endpoint may supply terminal envelopes. */
export function reconcile(store:MarkerStore,ownerBinding:string,envelope:unknown):Reconciliation {
  const active=inspectMarker(store,ownerBinding);
  if(active.status!=='pending')return active;
  if(!envelope || typeof envelope!=='object' || Array.isArray(envelope))return {status:'unknown'};
  const value=envelope as Record<string,unknown>,keys=Object.keys(value).sort().join(',');
  if(value.clientId!==active.clientId)return {status:'unknown'};
  const cancelled=keys==='clientId,status' && value.status==='cancelled';
  const submitted=keys==='clientId,feedbackId,status' && value.status==='submitted' && typeof value.feedbackId==='string' && uuid.test(value.feedbackId);
  if(!cancelled && !submitted)return {status:'unknown'};
  const terminal=cancelled ? 'cancelled' : 'submitted';
  try {store.removeItem(key);if(store.getItem(key)!==null)return {status:'terminal-storage-uncertain',terminal};}
  catch {return {status:'terminal-storage-uncertain',terminal};}
  return {status:terminal};
}
