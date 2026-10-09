import type { EffectCallback, DependencyList, MutableRefObject } from "react";
export interface PrivacyHooks {
 states: unknown[]; refs: MutableRefObject<unknown>[]; memos: { deps: DependencyList | undefined; value: unknown }[];
 effects: { deps: DependencyList | undefined; cleanup?: () => void }[]; pending: (() => void)[];
 stateIndex: number; refIndex: number; memoIndex: number; effectIndex: number;
}
export function resetPrivacyHooks(h: PrivacyHooks) { h.states = []; h.refs = []; h.memos = []; h.effects = []; h.pending = []; beginPrivacyRender(h); }
export function beginPrivacyRender(h: PrivacyHooks) { h.stateIndex = 0; h.refIndex = 0; h.memoIndex = 0; h.effectIndex = 0; }
export function flushPrivacyEffects(h: PrivacyHooks) { const work = h.pending.splice(0); for (const effect of work) effect(); }
const same = (a: DependencyList | undefined, b: DependencyList | undefined) => !!a && !!b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
export function privacyHookMocks(h: PrivacyHooks) {
 const memo = <T>(factory: () => T, deps: DependencyList | undefined): T => { const index = h.memoIndex++, slot = h.memos[index]; if (!slot || !same(slot.deps, deps)) h.memos[index] = { deps, value: factory() }; return h.memos[index]!.value as T; };
 return {
  useState<T>(initial: T | (() => T)) { const index = h.stateIndex++; if (!Object.hasOwn(h.states, index)) h.states[index] = typeof initial === "function" ? (initial as () => T)() : initial; return [h.states[index] as T, (next: T | ((value: T) => T)) => { h.states[index] = typeof next === "function" ? (next as (value: T) => T)(h.states[index] as T) : next; }] as const; },
  useRef<T>(initial: T) { const index = h.refIndex++; h.refs[index] ??= { current: initial }; return h.refs[index] as MutableRefObject<T>; },
  useMemo: memo,
  useCallback<T>(callback: T, deps: DependencyList) { return memo(() => callback, deps); },
  useEffect(effect: EffectCallback, deps: DependencyList | undefined) { const index = h.effectIndex++, slot = h.effects[index]; if (!slot || !same(slot.deps, deps)) { h.effects[index] = { deps, cleanup: slot?.cleanup }; h.pending.push(() => { slot?.cleanup?.(); const cleanup = effect(); h.effects[index]!.cleanup = typeof cleanup === "function" ? cleanup : undefined; }); } },
 };
}
