import { describe, expect, it, vi } from 'vitest';
import { awaitOnboardingOperation, OnboardingLifetime, StaleOnboardingOperation } from '../src/components/features/onboarding/lifetime';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';

describe('onboarding: lifetime de todas as respostas e efeitos', () => {
  it.each(['initial-load', 'save', 'pause', 'confirm', 'advance', 'amend', 'amend-retry', 'reload', 'google-start', 'calendar-select', 'theme-save', 'choices'])('%s antigo não repopula B, não envia próximo comando e não navega', async () => {
    const lifetime = new OnboardingLifetime(), identityA = {}, identityB = {};
    const operationA = lifetime.open(ownerA, identityA), response = deferred<string>();
    const apply = vi.fn(), failure = vi.fn(), releaseBusy = vi.fn(), navigate = vi.fn(), nextCommand = vi.fn();
    const pending = awaitOnboardingOperation(lifetime, operationA, () => response.promise)
      .then(value => { lifetime.commit(operationA, () => { apply(value); nextCommand(); navigate(); }); })
      .catch(error => { lifetime.commit(operationA, () => failure(error)); })
      .finally(() => { lifetime.commit(operationA, releaseBusy); });
    lifetime.bind(ownerB, identityB); const operationB = lifetime.open(ownerB, identityB);
    response.resolve('OLD_PRIVATE_RESPONSE'); await pending;
    expect(apply).not.toHaveBeenCalled(); expect(failure).not.toHaveBeenCalled();
    expect(releaseBusy).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled(); expect(nextCommand).not.toHaveBeenCalled();
    expect(lifetime.current(operationB)).toBe(true);
  });
  it.each(['server-error', 'timeout'])('erro antigo %s não limpa a sessão nem o lock de B', async kind => {
    const lifetime = new OnboardingLifetime(), response = deferred<string>();
    const operation = lifetime.open(ownerA, {}), clearSession = vi.fn(), releaseBusy = vi.fn();
    const pending = awaitOnboardingOperation(lifetime, operation, () => response.promise)
      .catch(error => { lifetime.commit(operation, () => clearSession(error)); })
      .finally(() => { lifetime.commit(operation, releaseBusy); });
    lifetime.open(ownerB, {}); response.reject(new Error(kind)); await pending;
    expect(clearSession).not.toHaveBeenCalled(); expect(releaseBusy).not.toHaveBeenCalled();
  });
  it('troca de service no mesmo owner e unmount também invalidam a resposta', async () => {
    for (const change of ['service', 'unmount']) {
      const lifetime = new OnboardingLifetime(), response = deferred<string>();
      const operation = lifetime.open(ownerA, {}), effect = vi.fn();
      const pending = awaitOnboardingOperation(lifetime, operation, () => response.promise);
      if (change === 'service') lifetime.bind(ownerA, {}); else lifetime.close(operation);
      response.resolve('late'); await expect(pending).rejects.toBeInstanceOf(StaleOnboardingOperation);
      expect(lifetime.commit(operation, effect)).toBe(false); expect(effect).not.toHaveBeenCalled();
    }
  });
  it('timeout real controlado depois da troca de owner não altera B', async () => {
    vi.useFakeTimers();
    try {
      const lifetime = new OnboardingLifetime(), operation = lifetime.open(ownerA, {});
      const failure = vi.fn(), release = vi.fn();
      const pending = awaitOnboardingOperation(lifetime, operation, () => new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 15_000);
      })).catch(error => { lifetime.commit(operation, () => failure(error)); })
        .finally(() => { lifetime.commit(operation, release); });
      lifetime.open(ownerB, {});
      await vi.advanceTimersByTimeAsync(15_000); await pending;
      expect(failure).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('cleanup de uma geração antiga não invalida a atual; operação já expirada não inicia transporte', async () => {
    const lifetime = new OnboardingLifetime(), identity = {};
    const old = lifetime.open(ownerA, identity), current = lifetime.open(ownerA, identity);
    lifetime.close(old); expect(lifetime.current(current)).toBe(true);
    const transport = vi.fn(async () => 'forbidden');
    await expect(awaitOnboardingOperation(lifetime, old, transport)).rejects.toBeInstanceOf(StaleOnboardingOperation);
    expect(transport).not.toHaveBeenCalled();
  });
  it('callback antigo não pode capturar uma geração nova com service trocado no mesmo owner', () => {
    const lifetime = new OnboardingLifetime(), oldService = {}, newService = {};
    lifetime.open(ownerA, oldService); lifetime.open(ownerA, newService);
    expect(lifetime.captureFor(ownerA, oldService)).toBeNull();
    expect(lifetime.captureFor(ownerA, newService)).not.toBeNull();
  });
});
