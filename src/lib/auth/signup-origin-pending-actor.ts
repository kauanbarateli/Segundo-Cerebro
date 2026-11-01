/** Contrato compatível com request.auth do client SSR atual; sem sessão de browser confiada. */
type AuthPort = {
  getUser(): Promise<{data:{user:{id:string;is_anonymous?:boolean;email_confirmed_at?:string|null}|null};error:unknown}>;
  getClaims(): Promise<{data:{claims:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readVerifiedActor(auth:AuthPort):Promise<{userId:string;sessionId:string}|null>{
 try {
  const user=await auth.getUser();if(user.error)throw Error("IDENTITY_UNAVAILABLE");if(!user.data.user||user.data.user.is_anonymous||!user.data.user.email_confirmed_at||!UUID.test(user.data.user.id))return null;
  const claims=await auth.getClaims(),sessionId=claims.data?.claims.session_id;
  if(claims.error)throw Error("IDENTITY_UNAVAILABLE");if(claims.data?.claims.sub!==user.data.user.id||typeof sessionId!=="string"||!UUID.test(sessionId))return null;
  return {userId:user.data.user.id,sessionId};
 }catch{throw Error("IDENTITY_UNAVAILABLE");}
}
