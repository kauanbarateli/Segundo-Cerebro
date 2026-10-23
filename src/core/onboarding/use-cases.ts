import {
  OnboardingPortError,
  type OnboardingAdvanceInput, type OnboardingAmendInput, type OnboardingDraft, type OnboardingPort,
  type OnboardingRoundInput, type OnboardingSaveInput, type OnboardingStartInput,
} from './types';
import {
  decodeOnboardingChoices, decodeOnboardingChoicesQuery, decodeOnboardingCommand,
  decodeOnboardingSnapshot, OnboardingValidationError,
} from './validation';

/** Novo rascunho explícito; nunca usar como fallback de uma leitura ausente. */
export function newOnboardingDraft(): OnboardingDraft {
  return { profile: {}, habits: [], projects: [], tasks: [], notes: null };
}

/** Orquestra somente o port. A execução de comandos dos módulos é do servidor. */
export function createOnboardingService(port: OnboardingPort, ownerId: string) {
  async function read(operation: () => Promise<unknown>) {
    try {
      return decodeOnboardingSnapshot(await operation(), ownerId);
    } catch (error) {
      if (error instanceof OnboardingPortError) throw error;
      // Uma resposta inválida não é prova de persistência ou de conta nova.
      throw new OnboardingPortError('UNAVAILABLE');
    }
  }

  async function write(command: Parameters<typeof decodeOnboardingCommand>[0]) {
    const parsed = decodeOnboardingCommand(command);
    try {
      let result: unknown;
      switch (parsed.command) {
        case 'onboarding.start': result = await port.start(parsed.input); break;
        case 'onboarding.save': result = await port.save(parsed.input); break;
        case 'onboarding.pause': result = await port.pause(parsed.input); break;
        case 'onboarding.confirm': result = await port.confirm(parsed.input); break;
        case 'onboarding.advance': result = await port.advance(parsed.input); break;
        case 'onboarding.amend': result = await port.amend(parsed.input); break;
      }
      const snapshot = decodeOnboardingSnapshot(result, ownerId);
      if (parsed.command === 'onboarding.start' && !snapshot.round) throw new OnboardingPortError('COMMIT_UNKNOWN');
      if ('roundId' in parsed.input && snapshot.round?.id !== parsed.input.roundId) throw new OnboardingPortError('COMMIT_UNKNOWN');
      if (parsed.command === 'onboarding.save' && JSON.stringify(snapshot.round?.draft) !== JSON.stringify(parsed.input.draft)) throw new OnboardingPortError('COMMIT_UNKNOWN');
      if ((parsed.command === 'onboarding.confirm' || parsed.command === 'onboarding.advance' || parsed.command === 'onboarding.amend') && !['executing', 'partial', 'complete', 'expired'].includes(snapshot.round?.status ?? '')) throw new OnboardingPortError('COMMIT_UNKNOWN');
      return snapshot;
    } catch (error) {
      if (error instanceof OnboardingPortError) throw error;
      // O transporte pode ter perdido a resposta depois do commit. Sem retry.
      throw new OnboardingPortError('COMMIT_UNKNOWN');
    }
  }

  return {
    load: () => read(() => port.load()),
    async choices(value: Parameters<OnboardingPort['choices']>[0]) {
      const input = decodeOnboardingChoicesQuery(value);
      try {
        return decodeOnboardingChoices(await port.choices(input), input.kind);
      } catch (error) {
        if (error instanceof OnboardingPortError || error instanceof OnboardingValidationError) throw error;
        throw new OnboardingPortError('UNAVAILABLE');
      }
    },
    start: (input: OnboardingStartInput) => write({ command: 'onboarding.start', input }),
    save: (input: OnboardingSaveInput) => write({ command: 'onboarding.save', input }),
    pause: (input: OnboardingRoundInput) => write({ command: 'onboarding.pause', input }),
    confirm: (input: OnboardingRoundInput) => write({ command: 'onboarding.confirm', input }),
    advance: (input: OnboardingAdvanceInput) => write({ command: 'onboarding.advance', input }),
    amend: (input: OnboardingAmendInput) => write({ command: 'onboarding.amend', input }),
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
