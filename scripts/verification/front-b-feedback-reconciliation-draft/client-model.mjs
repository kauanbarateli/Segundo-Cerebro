// Pure demonstrator; no browser integration and no credentials/feedback persisted.
const key='feedback-attempt-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const binding=/^[a-zA-Z0-9_-]{16,128}$/;
function parseMarker(raw){
 try {const x=JSON.parse(raw);return x && typeof x==='object' && !Array.isArray(x) && Object.keys(x).sort().join(',')==='clientId,ownerBinding,version' && x.version===1 && typeof x.clientId==='string' && uuid.test(x.clientId) && typeof x.ownerBinding==='string' && binding.test(x.ownerBinding) ? x : null;}catch{return null;}
}
export async function begin(storage,marker,payload,send){
 try {
  if(!marker) return {status:'blocked'};
  const raw=JSON.stringify(marker),snapshot=parseMarker(raw);
  if(!snapshot) return {status:'blocked'};
  if(storage.getItem(key)!==null)return {status:'blocked'};
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)return {status:'blocked'};
  try {await send(payload,snapshot.clientId);}catch{/* request may still commit */}
 } catch {return {status:'blocked'};}
 return {status:'unknown'};
}
export function inspect(storage,currentOwner){
 try {const raw=storage.getItem(key);if(raw===null)return {status:'none'};const marker=parseMarker(raw);if(!marker)return {status:'blocked'};return marker.ownerBinding===currentOwner ? {status:'pending',clientId:marker.clientId} : {status:'different-owner'};}catch{return {status:'blocked'};}
}
export function acceptReceipt(storage,currentOwner,envelope){
 const active=inspect(storage,currentOwner);if(active.status!=='pending')return active;
 if(!envelope || typeof envelope!=='object' || Array.isArray(envelope) || envelope.clientId!==active.clientId)return {status:'unknown'};
 const keys=Object.keys(envelope).sort().join(',');
 const valid=keys==='clientId,status' && envelope.status==='cancelled' || keys==='clientId,feedbackId,status' && envelope.status==='submitted' && typeof envelope.feedbackId==='string' && uuid.test(envelope.feedbackId);
 if(!valid)return {status:'unknown'};
 try {storage.removeItem(key);if(storage.getItem(key)!==null)return {status:'terminal-storage-uncertain',terminal:envelope.status};}catch{return {status:'terminal-storage-uncertain',terminal:envelope.status};}
 return {status:envelope.status};
}
