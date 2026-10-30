import { describe, expect, it, vi } from 'vitest';
import { OnboardingAmendAttempt } from '../src/components/features/onboarding/amendment-attempt';
import { OnboardingSessionChanged } from '../src/components/features/onboarding/http-port';
import { OnboardingPortError, type OnboardingAmendInput, type OnboardingSnapshot } from '../src/core/onboarding/types';

function input(): OnboardingAmendInput {
  return { roundId:'10000000-0000-4000-8000-000000000001',expectedRevision:'9007199254740993',clientId:'10000000-0000-4000-8000-000000000002',intentId:'10000000-0000-4000-8000-000000000003',change:{kind:'replace',value:{kind:'project',name:'Plano',context:null}} };
}
describe('onboarding: uma emenda incerta conserva a tentativa', () => {
  it.each(['CONFLICT','FORBIDDEN','UNAVAILABLE'] as const)('timeout seguido de %s não libera outro UUID/corpo', async code => {
    const original = input(), attempt = new OnboardingAmendAttempt(original);
    const result = { ownerId:'SERVER_CONFIRMED_RESULT' } as OnboardingSnapshot;
    const send = vi.fn().mockRejectedValueOnce(new OnboardingPortError('COMMIT_UNKNOWN')).mockRejectedValueOnce(new OnboardingPortError(code)).mockResolvedValueOnce(result);
    await expect(attempt.submit(send)).rejects.toMatchObject({code:'COMMIT_UNKNOWN'});
    original.clientId = '10000000-0000-4000-8000-000000000099'; original.change = {kind:'omit',dependents:'deny',dependentIntentIds:[]};
    await expect(attempt.submit(send)).rejects.toMatchObject({code:'COMMIT_UNKNOWN'});
    await expect(attempt.submit(send)).resolves.toBe(result);
    expect(send).toHaveBeenCalledTimes(3);
    for (const call of send.mock.calls) expect(call[0]).toEqual(input());
  });
  it('duplo clique compartilha a promessa e não envia duas emendas', async () => {
    let release!: (value: OnboardingSnapshot) => void;
    const send = vi.fn(() => new Promise<OnboardingSnapshot>(resolve => { release = resolve; }));
    const attempt = new OnboardingAmendAttempt(input());
    const first = attempt.submit(send), second = attempt.submit(send);
    expect(first).toBe(second); await Promise.resolve(); expect(send).toHaveBeenCalledTimes(1);
    release({ownerId:'RESULT'} as OnboardingSnapshot); await first;
  });
  it('uma mudança de sessão permanece explícita, sem afirmar ausência de commit', async () => {
    const attempt = new OnboardingAmendAttempt(input());
    await expect(attempt.submit(async () => { throw new OnboardingPortError('COMMIT_UNKNOWN'); })).rejects.toMatchObject({code:'COMMIT_UNKNOWN'});
    await expect(attempt.submit(async () => { throw new OnboardingSessionChanged(); })).rejects.toBeInstanceOf(OnboardingSessionChanged);
    expect(attempt.uncertain).toBe(true);
  });
});
