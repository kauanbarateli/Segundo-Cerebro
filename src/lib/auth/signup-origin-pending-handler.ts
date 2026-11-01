/** Rascunho isolado: nenhum adapter real, rota ativa ou banco incluído. */
type Actor = Readonly<{ userId: string; sessionId: string }>;
type Ports = Readonly<{
  allowedOrigin(origin: string | null): boolean;
  /** Derivado no servidor por getUser/getClaims; nunca do cabeçalho cliente. */
  verifiedActor(): Promise<Actor | null>;
  /** Banco revalida usuário, sessão, moderação e serializa a retirada. */
  withdraw(actor: Actor): Promise<unknown>;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Type": "application/json; charset=utf-8" };
function reply(status: number, value: object): Response { return new Response(JSON.stringify(value), {status, headers}); }
async function emptyJson(request: Request): Promise<boolean> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return false;
  const reader=request.body?.getReader(); if (!reader) return false;
  const chunks: Uint8Array[]=[]; let length=0;
  try { while(true){const part=await reader.read(); if(part.done)break; length+=part.value.byteLength;if(length>1024){await reader.cancel();return false;} chunks.push(part.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const value:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return !!value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===0;
  }catch{return false;}finally{reader.releaseLock();}
}
/** Não informar concluído em timeout, erro ou resposta ambígua. */
export async function withdrawPendingOrigin(request:Request,ports:Ports):Promise<Response>{
  const failure=()=>reply(503,{ok:false,status:"unknown"});
  try {
    if(request.method!=="POST"||!ports.allowedOrigin(request.headers.get("origin"))) return reply(403,{ok:false,status:"refused"});
    const expected=request.headers.get("x-expected-user-id");
    if(!expected||!UUID.test(expected)||!await emptyJson(request))return reply(400,{ok:false,status:"refused"});
    const actor=await ports.verifiedActor();if(!actor)return reply(401,{ok:false,status:"unauthenticated"});
    if(!UUID.test(actor.userId)||!UUID.test(actor.sessionId))return failure();
    if(actor.userId.toLowerCase()!==expected.toLowerCase())return reply(409,{ok:false,status:"account_changed"});
    const value=await ports.withdraw(Object.freeze({userId:actor.userId,sessionId:actor.sessionId}));
    if(!value||typeof value!=="object"||Array.isArray(value))return failure();
    const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors),descriptor=descriptors.status;
    if(keys.length!==1||keys[0]!=="status"||!descriptor||!Object.hasOwn(descriptor,"value"))return failure();
    const status:unknown=descriptor.value;
    if(status!=="withdrawn"&&status!=="absent")return failure();
    return reply(200,{ok:true,status});
  } catch{return failure();}
}
