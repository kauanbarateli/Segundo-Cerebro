import { OnboardingPortError, type OnboardingAmendInput, type OnboardingSnapshot } from '@/core/onboarding/types';
import { decodeOnboardingCommand } from '@/core/onboarding/validation';
import { OnboardingSessionChanged } from './http-port';

/** Uma tentativa conserva corpo/UUID, inclusive se uma negação vier após timeout. */
export class OnboardingAmendAttempt {
  private readonly encoded: string;
  private inFlight: Promise<OnboardingSnapshot> | null = null;
  private wasUncertain = false;
  constructor(input: OnboardingAmendInput) {
    const command = decodeOnboardingCommand({ command: 'onboarding.amend', input });
    this.encoded = JSON.stringify(command.input);
  }
  get uncertain() { return this.wasUncertain; }
  submit(send: (input: OnboardingAmendInput) => Promise<OnboardingSnapshot>): Promise<OnboardingSnapshot> {
    if (this.inFlight) return this.inFlight;
    const input = JSON.parse(this.encoded) as OnboardingAmendInput;
    this.inFlight = Promise.resolve().then(() => send(input)).catch((error: unknown) => {
      if (error instanceof OnboardingSessionChanged) throw error;
      if (this.wasUncertain || !(error instanceof OnboardingPortError) || error.code === 'COMMIT_UNKNOWN') {
        this.wasUncertain = true;
        throw new OnboardingPortError('COMMIT_UNKNOWN');
      }
      throw error;
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}
