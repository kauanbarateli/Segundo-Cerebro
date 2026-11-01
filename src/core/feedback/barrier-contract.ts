export type BarrierResult = { status: 'unknown'|'cancelled'; clientId: string } | { status: 'submitted'; clientId: string; feedbackId: string };
const uuid=(x:unknown):x is string=>typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const exact=(o:Record<string,unknown>,keys:string[])=>Object.keys(o).length===keys.length && keys.every(key=>Object.hasOwn(o,key));
/** The request id is correlation, not authentication or proof of ownership. */
export function parseBarrierResult(value:unknown,clientId:string):BarrierResult|null {
  if(!uuid(clientId)||!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  if(row.clientId!==clientId)return null;
  if((row.status==='unknown'||row.status==='cancelled')&&exact(row,['status','clientId']))return {status:row.status,clientId};
  if(row.status==='submitted'&&exact(row,['status','clientId','feedbackId'])&&uuid(row.feedbackId))return {status:'submitted',clientId,feedbackId:row.feedbackId};
  return null;
}

export function parseBarrierCommand(value:unknown):{ action:'status'|'cancel';clientId:string }|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  if(!exact(row,['action','clientId'])||(row.action!=='status'&&row.action!=='cancel')||!uuid(row.clientId))return null;
  return {action:row.action,clientId:row.clientId.toLowerCase()};
}
