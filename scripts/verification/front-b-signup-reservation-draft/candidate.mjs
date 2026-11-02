/** REVIEW CANDIDATE ONLY. Pure orchestration with injected ports.
 * Not wired to the product, Auth, a database or a release gate. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=()=>({status:'unavailable'}),pending=()=>({status:'pending-reconciliation'});
/**
 * The reservation port MUST atomically verify trusted identity, session,
 * intent and consent and create a per-user/intent durable fence. Only the
 * invocation that created it may receive status=acquired. A replay or another
 * request never reacquires. These properties are NOT established by this JS.
 */
export async function candidateCompletion(ports,input){
 if(!input||typeof input.password!=='string'||!input.password||!UUID.test(input.requestId??''))return unavailable();
 let fence;
 try{
  const reservation=await ports.reserve(input.requestId);
  if(reservation?.status==='busy')return pending();
  if(!reservation||reservation.status!=='acquired'||reservation.requestId!==input.requestId||!UUID.test(reservation.generation??''))return unavailable();
  fence={requestId:reservation.requestId,generation:reservation.generation};
  // This committed transition must precede ANY external password call.
  if(await ports.markAuthStarting(fence)!==true)return pending();
 }catch{return unavailable();}

 let outcome;
 try{outcome=await ports.updatePassword(input.password);}catch{outcome='unknown';}
 if(outcome!=='updated'){
  // If this write fails, the previously committed in-flight state still fences.
  try{await ports.markUncertain(fence);}catch{/* Never release or retry Auth. */}
  return pending();
 }
 try{
  // A verified identity/session binding is required after Auth acknowledges.
  if(await ports.confirmIdentity(fence)!==true){try{await ports.markUncertain(fence);}catch{}return pending();}
  if(await ports.markPasswordAcknowledged(fence)!==true)return pending();
  if(await ports.finishAdmission(fence)!==true)return pending();
  return {status:'completed'};
 }catch{
  // The durable in-flight/acknowledged row survives a failed database response.
  // A separately reviewed recovery protocol must resolve the unknown state.
  try{await ports.markUncertain(fence);}catch{}return pending();
 }
}
