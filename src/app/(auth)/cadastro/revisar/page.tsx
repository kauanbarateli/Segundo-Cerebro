import type {Metadata} from "next";
import {cookies} from "next/headers";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {SignupLegal,SignupOriginConfirmation} from "@/components/features/auth/signup-fields";
import {readAuthConfiguration} from "@/lib/auth/config";
import {SIGNUP_RECONSENT_COOKIE,verifySignupReconsent,signupReconsentFormTag} from "@/lib/auth/signup-reconsent-checkpoint";
import {SIGNUP_CONTEXT_COOKIE,verifySignupContext} from "@/lib/auth/signup-provisional";
import {signupSameBrowserEnabled} from "@/lib/auth/signup-http";
import {LEGAL_DOCUMENTS} from "@/lib/legal/documents";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Revisar cadastro · Segundo Cérebro",robots:{index:false,follow:false}};
export default async function SignupReviewPage({searchParams}:{searchParams:Promise<{status?:string|string[]}>}) {
 let checkpoint=null,reviewTag="",cleanupTag="";
 try {
  const config=readAuthConfiguration();
  if(config.mode==="supabase" && signupSameBrowserEnabled(config)) {
   const all=(await cookies()).getAll(),values=all.filter(cookie=>cookie.name===SIGNUP_RECONSENT_COOKIE);
   const contexts=all.filter(cookie=>cookie.name===SIGNUP_CONTEXT_COOKIE),context=contexts.length===1?contexts[0]?.value:undefined;
   if(context && verifySignupContext(context,config.stateSecret))cleanupTag=signupReconsentFormTag(context,config.stateSecret);
   if(values.length===1){const token=values[0]?.value,proof=verifySignupReconsent(token,config.stateSecret,Date.now());if(token && proof?.terms===LEGAL_DOCUMENTS.termos.version && proof.privacy===LEGAL_DOCUMENTS.privacidade.version){checkpoint=proof.checkpoint;reviewTag=signupReconsentFormTag(token,config.stateSecret);}}
  }
 }catch{/* fail closed */}
 const status=(await searchParams).status;
 return <>
  <header className="auth-heading"><h1 id="auth-title">Revise seu cadastro</h1><p>Confirme os documentos atuais para continuar.</p></header>
  {status==="unknown" || status==="expired" ? <>
   <p className="auth-feedback" role="alert">{status==="expired"?"A confirmação expirou.":"Não foi possível confirmar a revisão."} Encerre esta sessão provisória para pedir um novo link.</p>
   {cleanupTag ? <form className="auth-form" action="/auth/limpar-revisao" method="post">
    {/* eslint-disable-next-line no-restricted-syntax -- Vincula a ação à prova desta aba. */}
    <input type="hidden" name="reviewTag" value={cleanupTag}/><Button type="submit">Encerrar sessão provisória e pedir novo link</Button>
   </form> : null}
   <p>Se não for possível confirmar a saída, <Link href="/cadastro/reenviar">solicite outra mensagem</Link>.</p>
  </> : !checkpoint ? <>
   <p className="auth-feedback" role="status">A confirmação expirou. Encerre a sessão provisória para solicitar outra mensagem.</p>
   {cleanupTag ? <form className="auth-form" action="/auth/limpar-revisao" method="post">
    {/* eslint-disable-next-line no-restricted-syntax -- Vincula a ação ao contexto verificado. */}
    <input type="hidden" name="reviewTag" value={cleanupTag}/><Button type="submit">Encerrar sessão provisória e pedir novo link</Button>
   </form> : null}
   <p>Se não for possível confirmar a saída, <Link href="/cadastro/reenviar">solicite outra mensagem</Link>.</p>
  </> : <>
   {status && <p className="auth-feedback" role="alert">{status==="rate-limited"?"Aguarde um pouco antes de tentar novamente.":"Confira os termos e tente novamente."}</p>}
   <form className="auth-form" action="/auth/revisar-cadastro" method="post">
    {/* eslint-disable-next-line no-restricted-syntax -- Vincula a revisão à prova desta aba. */}
    <input type="hidden" name="reviewTag" value={reviewTag}/>
    <SignupLegal termsVersion={LEGAL_DOCUMENTS.termos.version} privacyVersion={LEGAL_DOCUMENTS.privacidade.version}/>
    {checkpoint.originPending ? <><p>Você pode manter a origem informada antes. Se não escolher, ela será descartada.</p><SignupOriginConfirmation/></> : <p>A origem anterior não está disponível e não será registrada.</p>}
    <Button type="submit" variant="primary">Confirmar e continuar</Button>
   </form>
  </>}
  <p className="auth-registration"><Link href="/entrar">Voltar para entrar</Link></p>
 </>;
}
