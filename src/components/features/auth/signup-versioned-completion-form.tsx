"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignupLegal, SignupOriginConfirmation, SignupPassword } from "./signup-fields";
import { parseSignupOriginSnapshot, type SignupOriginSnapshot } from "@/lib/auth/signup-origin-snapshot";

type State = { status:"loading"|"error" } | { status:"ready"; snapshot:SignupOriginSnapshot };
export function SignupVersionedCompletionForm({userId,passwordConfirmed,termsVersion,privacyVersion}:{userId:string;passwordConfirmed:boolean;termsVersion:string;privacyVersion:string}) {
 const [state,setState]=useState<State>({status:"loading"}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),10_000);let current=true;
  setState({status:"loading"});
  void (async()=>{
   try {
    const response=await fetch('/api/signup-origin-pending-v2',{method:'GET',cache:'no-store',headers:{'x-expected-user-id':userId},signal:controller.signal});
    if(!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw Error('unavailable');
    const body:unknown=await response.json();if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='ok,result'||(body as {ok:unknown}).ok!==true)throw Error('unavailable');
    const snapshot=parseSignupOriginSnapshot((body as {result:unknown}).result);if(!snapshot)throw Error('unavailable');
    if(current)setState({status:'ready',snapshot});
   } catch {if(current)setState({status:'error'});} finally {window.clearTimeout(timer);}
  })();
  return ()=>{current=false;window.clearTimeout(timer);controller.abort();};
 },[userId,attempt]);
 if(state.status==='loading')return <><p className="auth-feedback" role="status">Conferindo sua escolha sobre a origem…</p><noscript><p className="auth-feedback">Para continuar, ative o JavaScript e recarregue a página. Se precisar de ajuda, procure o suporte.</p></noscript></>;
 if(state.status==='error')return <div className="auth-feedback" role="alert"><p>Não foi possível conferir sua escolha sobre a origem.</p><Button type="button" variant="secondary" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</Button></div>;
 return <form className="auth-form" action="/auth/finalizar-cadastro" method="post">
  {!passwordConfirmed && <SignupPassword />}
  <SignupLegal termsVersion={termsVersion} privacyVersion={privacyVersion} />
  {/* eslint-disable-next-line no-restricted-syntax -- Revisão opaca vinculada à escolha apresentada. */}
  <input type="hidden" name="originRevision" value={state.snapshot.revision ?? 'absent'} />
  {state.snapshot.revision!==null && <SignupOriginConfirmation />}
  <Button type="submit" variant="primary">Concluir cadastro</Button>
 </form>;
}
