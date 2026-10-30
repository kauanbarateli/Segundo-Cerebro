export interface OnboardingOperation { readonly ownerId: string; readonly generation: number }

export class StaleOnboardingOperation extends Error {
  constructor() { super('ONBOARDING_OPERATION_EXPIRED'); this.name = 'StaleOnboardingOperation'; }
}

/** An old response must never update a new owner, clear its lock, or navigate. */
export class OnboardingLifetime {
  private ownerId: string | null = null;
  private identity: object | null = null;
  private generation = 0;
  private active = false;

  bind(ownerId: string, identity: object): boolean {
    if (ownerId === this.ownerId && identity === this.identity) return false;
    this.ownerId = ownerId; this.identity = identity; this.active = false; this.generation++;
    return true;
  }
  open(ownerId: string, identity: object): OnboardingOperation {
    this.bind(ownerId, identity); this.active = true; this.generation++;
    return { ownerId, generation: this.generation };
  }
  capture(): OnboardingOperation | null {
    return this.active && this.ownerId ? { ownerId: this.ownerId, generation: this.generation } : null;
  }
  captureFor(ownerId: string, identity: object): OnboardingOperation | null {
    return ownerId === this.ownerId && identity === this.identity ? this.capture() : null;
  }
  current(operation: OnboardingOperation): boolean {
    return this.active && operation.ownerId === this.ownerId && operation.generation === this.generation;
  }
  close(operation: OnboardingOperation): void {
    if (!this.current(operation)) return;
    this.active = false; this.generation++;
  }
  assert(operation: OnboardingOperation): void {
    if (!this.current(operation)) throw new StaleOnboardingOperation();
  }
  commit(operation: OnboardingOperation, effect: () => void): boolean {
    if (!this.current(operation)) return false;
    effect(); return true;
  }
}

/** Checks before transport, after success, and after error/timeout. No retries. */
export async function awaitOnboardingOperation<T>(lifetime: OnboardingLifetime, operation: OnboardingOperation, action: () => Promise<T>): Promise<T> {
  lifetime.assert(operation);
  try {
    const result = await action();
    lifetime.assert(operation);
    return result;
  } catch (error) {
    lifetime.assert(operation);
    throw error;
  }
}
