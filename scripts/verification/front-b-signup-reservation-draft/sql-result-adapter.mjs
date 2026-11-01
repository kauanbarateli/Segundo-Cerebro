/** Shape adapter only: not wired to SQL or the application. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function adaptReservationResult(value,expectedRequestId){
 if(!uuid.test(expectedRequestId) || !value || typeof value!=='object' || Array.isArray(value)) throw Error('invalid reservation response');
 const keys=Object.keys(value).sort().join(',');
 if(keys==='status' && value.status==='pending') return {status:'busy'};
 if(keys==='generation,requestId,status' && value.status==='acquired' && value.requestId===expectedRequestId && typeof value.generation==='string' && uuid.test(value.generation)) return {status:'acquired',requestId:value.requestId,generation:value.generation};
 throw Error('invalid reservation response');
}
