import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginPrivacyRender, flushPrivacyEffects, privacyHookMocks, type PrivacyHooks } from "../helpers/privacy-hooks";
import type { OwnSessionsReadResult, OwnSessionsReader, OwnSessionsView } from "../../src/components/features/configuracoes/own-sessions-types";
const seam=vi.hoisted<{hooks:PrivacyHooks|null}>(()=>({hooks:null}));
vi.mock("react",async original=>{
  const actual=await original<typeof import("react")>();
  return {...actual,useState<T>(initial:T|(()=>T)){return seam.hooks?privacyHookMocks(seam.hooks).useState(initial):actual.useState(initial);},useEffect(effect:Parameters<typeof actual.useEffect>[0],deps:Parameters<typeof actual.useEffect>[1]){return seam.hooks?privacyHookMocks(seam.hooks).useEffect(effect,deps):actual.useEffect(effect,deps);}};
});
import { OwnSessionsPanel, OwnSessionsSection } from "../../src/components/features/configuracoes/own-sessions-section";

const snapshot:OwnSessionsView={sessions:[{isCurrent:true,createdAt:"2026-10-11T12:00:00Z",refreshedAt:null},{isCurrent:false,createdAt:null,refreshedAt:"2026-10-11T15:30:00Z"}],hasMore:false};
const reload=()=>{};
const hooks=():PrivacyHooks=>({states:[],refs:[],memos:[],effects:[],pending:[],stateIndex:0,refIndex:0,memoIndex:0,effectIndex:0});
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred(){let resolve:(result:OwnSessionsReadResult)=>void=()=>{};const promise=new Promise<OwnSessionsReadResult>(done=>{resolve=done;});return{promise,resolve};}
afterEach(()=>{seam.hooks=null;});

describe("own-session UI with validated injected DTO",()=>{
  it("loading announces status, preserves disclosure and prevents a second refresh",()=>{
    const html=renderToStaticMarkup(<OwnSessionsPanel state={{status:"loading"}} onReload={reload}/>);
    expect(html).toContain('role="status"');expect(html).toContain('aria-busy="true"');expect(html).toContain("Carregando suas sessões");expect(html).toContain('aria-hidden="true"');expect(html).toContain('disabled=""');expect(html).toContain('aria-expanded="true"');expect(html).not.toContain("Esta sessão");
  });
  it("ready uses list/definition/time semantics and nullable dates without identity or inferred use",()=>{
    const html=renderToStaticMarkup(<OwnSessionsPanel state={{status:"ready",snapshot}} onReload={reload} timeZone="America/Sao_Paulo"/>);
    expect(html).toContain('aria-label="Sessões cadastradas"');expect(html).toContain("<dl>");expect(html).toContain("<dt>Criada em</dt>");expect(html).toContain("<dt>Última renovação</dt>");expect(html).toContain('dateTime="2026-10-11T15:30:00Z"');expect(html).toContain("12:30");expect(html).toContain("Esta sessão");expect(html).toContain("Outra sessão");expect(html).toContain("Data indisponível");expect(html).toContain("Renovação não informada");expect(html).not.toContain("Último uso");expect(html).not.toContain("Último acesso");expect(html).not.toContain("expired");
  });
  it("empty, reader error and session change remain separate, with useful recovery controls",()=>{
    const empty=renderToStaticMarkup(<OwnSessionsPanel state={{status:"ready",snapshot:{sessions:[],hasMore:false}}} onReload={reload}/>);
    expect(empty).toContain("Nenhuma sessão disponível");expect(empty).not.toContain('role="alert"');
    const error=renderToStaticMarkup(<OwnSessionsPanel state={{status:"error",reason:"unavailable"}} onReload={reload}/>);
    expect(error).toContain('role="alert"');expect(error).toContain("Tentar novamente");expect(error).not.toContain("Nenhuma sessão");
    const changed=renderToStaticMarkup(<OwnSessionsPanel state={{status:"error",reason:"session-changed"}} onReload={reload}/>);
    expect(changed).toContain("Entrar novamente");expect(changed).toContain('href="/entrar?notice=session-required"');expect(changed).not.toContain("Tentar novamente");expect(changed).not.toContain("Esta sessão");
  });
  it("bounded hundred-row view labels truncation without inventing the total or device names",()=>{
    const hundred:OwnSessionsView={sessions:Array.from({length:100},(_,index)=>({isCurrent:index===0,createdAt:null,refreshedAt:null})),hasMore:true};
    const html=renderToStaticMarkup(<OwnSessionsPanel state={{status:"ready",snapshot:hundred}} onReload={reload}/>);
    expect(html).toContain("Mostrando 100 sessões, incluindo esta sessão");expect(html).toContain("Há outras sessões cadastradas");expect(html.match(/<li>/g)).toHaveLength(100);expect(html.match(/Esta sessão/g)).toHaveLength(1);expect(html).not.toContain("101 sessões");expect(html).not.toContain("iPhone");expect(html).not.toContain("Chrome");
  });
  it("navigation retains only the existing password change and never offers individual revocation",()=>{
    const html=renderToStaticMarkup(<OwnSessionsPanel state={{status:"ready",snapshot}} onReload={reload}/>);
    expect(html).toContain('href="/trocar-senha"');expect(html).toContain("A troca exige sua senha atual");expect(html).not.toContain("Revogar");expect(html).not.toContain("Encerrar esta sessão");
  });
  it("invalid date text is never used as content or datetime, and timestamps are not fabricated",()=>{
    const html=renderToStaticMarkup(<OwnSessionsPanel state={{status:"ready",snapshot:{sessions:[{isCurrent:true,createdAt:"PRIVATE_DATE_CANARY",refreshedAt:null}],hasMore:false}}} onReload={reload}/>);
    expect(html).toContain("Data indisponível");expect(html).not.toContain("PRIVATE_DATE_CANARY");expect(html).not.toContain("dateTime=");
  });
  it("scope switch removes old metadata synchronously and ignores a late aborted reader",async()=>{
    const h=hooks();seam.hooks=h;const old=deferred();let oldSignal:AbortSignal|undefined;
    const first:OwnSessionsReader=signal=>{oldSignal=signal;return old.promise;},second:OwnSessionsReader=async()=>({ok:true,snapshot});
    const render=(scopeKey:string,read:OwnSessionsReader)=>{beginPrivacyRender(h);return OwnSessionsSection({scopeKey,read});};
    expect(render("scope-a",first).props.state.status).toBe("loading");flushPrivacyEffects(h);await settle();
    const switchBeforeEffects=render("scope-b",second);expect(switchBeforeEffects.props.state.status).toBe("loading");flushPrivacyEffects(h);await settle();
    expect(oldSignal?.aborted).toBe(true);old.resolve({ok:true,snapshot:{sessions:[{isCurrent:true,createdAt:"2000-01-01T00:00:00Z",refreshedAt:null}],hasMore:false}});await settle();
    expect(render("scope-b",second).props.state).toEqual({status:"ready",snapshot});
  });
  it("a loaded account is hidden before the new account effects or request settle",async()=>{
    const h=hooks();seam.hooks=h;const next=deferred();
    const first:OwnSessionsReader=async()=>({ok:true,snapshot}),second:OwnSessionsReader=()=>next.promise;
    const render=(scopeKey:string,read:OwnSessionsReader)=>{beginPrivacyRender(h);return OwnSessionsSection({scopeKey,read});};
    render("scope-a",first);flushPrivacyEffects(h);await settle();expect(render("scope-a",first).props.state).toEqual({status:"ready",snapshot});
    expect(render("scope-b",second).props.state).toEqual({status:"loading"});flushPrivacyEffects(h);await settle();expect(render("scope-b",second).props.state).toEqual({status:"loading"});
    next.resolve({ok:true,snapshot:{sessions:[{isCurrent:true,createdAt:null,refreshedAt:null}],hasMore:false}});await settle();expect(render("scope-b",second).props.state.status).toBe("ready");
  });
  it("unknown reader errors are closed without invoking private message getters, and retry reads anew",async()=>{
    const h=hooks();seam.hooks=h;let calls=0,getters=0;
    const read:OwnSessionsReader=async()=>{if(++calls===1)throw Object.defineProperty({},"message",{get(){getters++;return"PRIVATE_CANARY";}});return{ok:true,snapshot};};
    const render=()=>{beginPrivacyRender(h);return OwnSessionsSection({scopeKey:"same-scope",read});};
    render();flushPrivacyEffects(h);await settle();const failed=render();expect(failed.props.state).toEqual({status:"error",reason:"unavailable"});expect(getters).toBe(0);
    failed.props.onReload();render();flushPrivacyEffects(h);await settle();expect(render().props.state).toEqual({status:"ready",snapshot});expect(calls).toBe(2);
  });
  it("unmount aborts the reader and does not adopt data after its actual late settlement",async()=>{
    const h=hooks();seam.hooks=h;const pending=deferred();let signal:AbortSignal|undefined;
    const read:OwnSessionsReader=current=>{signal=current;return pending.promise;};beginPrivacyRender(h);OwnSessionsSection({scopeKey:"scope",read});flushPrivacyEffects(h);await settle();
    for(const effect of h.effects)effect.cleanup?.();expect(signal?.aborted).toBe(true);const before=structuredClone(h.states);pending.resolve({ok:true,snapshot});await settle();expect(h.states).toEqual(before);
  });
  it("unmount before the first microtask starts no reader or transport",async()=>{
    const h=hooks();seam.hooks=h;let calls=0;const read:OwnSessionsReader=async()=>{calls++;return{ok:true,snapshot};};
    beginPrivacyRender(h);OwnSessionsSection({scopeKey:"scope",read});flushPrivacyEffects(h);for(const effect of h.effects)effect.cleanup?.();await settle();expect(calls).toBe(0);
  });
});
