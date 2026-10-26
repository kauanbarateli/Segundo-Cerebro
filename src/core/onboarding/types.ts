/** Contrato do percurso introdutório. Escolhas não são entidades já criadas. */
export type OnboardingFocus = 'work' | 'study' | 'personal' | 'mixed';
export type OnboardingProjectContext = 'personal' | 'work' | 'study';
export type OnboardingStep = 'welcome' | 'profile' | 'calendar' | 'habits' | 'projects' | 'tasks' | 'notes' | 'spaces' | 'summary';
export type OnboardingRoundStatus = 'active' | 'paused' | 'executing' | 'partial' | 'complete' | 'expired';
export type OnboardingProjectRef = { kind: 'draft'; key: string } | { kind: 'existing'; id: string };

/** Missing version is the frozen legacy choice, never an implicit v2 upgrade. */
export type OnboardingHabitFrequency =
  | { version?: never; cadence: 'daily' | 'three_per_week' }
  | { version: 2; cadence: 'daily' }
  | { version: 2; cadence: 'weekdays'; weekdays: number[] }
  | { version: 2; cadence: 'weekly_target'; weeklyTarget: number };
export type OnboardingHabitChoice = { key: string; name: string; startedOn: string } & OnboardingHabitFrequency;
export interface OnboardingDraft {
  profile: { displayName?: string; focus?: OnboardingFocus };
  habits: OnboardingHabitChoice[];
  projects: { key: string; name: string; context?: OnboardingProjectContext }[];
  tasks: { key: string; title: string; project?: OnboardingProjectRef; due: { kind: 'none' } | { kind: 'day'; day: string } }[];
  notes: null | {
    notebook: { kind: 'new'; key: string; name: string } | { kind: 'existing'; id: string };
    page?: { key: string; title: string; text: string; project?: OnboardingProjectRef };
  };
}

export interface OnboardingIntentReceipt {
  intentId: string;
  itemKey: string;
  kind: 'profile' | 'habit' | 'project' | 'task' | 'notebook' | 'page' | 'link';
  status: 'ready' | 'pending' | 'confirmed' | 'blocked' | 'failed' | 'unknown' | 'omitted';
  entityId: string | null;
  reason: null | 'validation' | 'dependency' | 'forbidden' | 'conflict' | 'commit_unknown' | 'unavailable';
}

/** Uma emenda substitui somente a intenção ainda não confirmada deste slot. */
export type OnboardingReplacement =
  | { kind: 'profile'; patch: OnboardingDraft['profile']; expectedProfileRevision: string }
  | ({ kind: 'habit'; name: string; startedOn: string } & OnboardingHabitFrequency)
  | { kind: 'project'; name: string; context: OnboardingProjectContext | null }
  | { kind: 'task'; title: string; project: OnboardingProjectRef | null; due: OnboardingDraft['tasks'][number]['due'] }
  | { kind: 'notebook'; name: string }
  | { kind: 'page'; title: string; text: string; notebook: { kind: 'prepared'; key: string } | { kind: 'existing'; id: string } }
  | { kind: 'link'; project: OnboardingProjectRef };

export interface OnboardingRecoveryEntry {
  intentId: string;
  itemKey: string;
  kind: OnboardingIntentReceipt['kind'];
  status: Exclude<OnboardingIntentReceipt['status'], 'confirmed' | 'omitted'>;
  choice: OnboardingReplacement | null;
  canReplace: boolean;
  canOmit: boolean;
  dependentIntentIds: string[];
}

export interface OnboardingRound {
  id: string;
  /** Decimal de bigint; nunca converter para Number. */
  revision: string;
  status: OnboardingRoundStatus;
  step: OnboardingStep;
  /** null significa conteúdo removido/indisponível; não um rascunho vazio. */
  draft: OnboardingDraft | null;
  editedAt: string;
  expiresAt: string;
  receipts: OnboardingIntentReceipt[];
}

export interface OnboardingCalendarRead {
  status: 'ready' | 'not_configured' | 'forbidden' | 'unavailable';
  canConnect: boolean;
  accounts: { id: string; email: string; status: 'connected' | 'reauthorize' | 'revocation_pending' }[];
  sources: { id: string; accountId: string; name: string; selected: boolean }[];
}

export type OnboardingCapability = 'configuracoes' | 'calendario' | 'habitos' | 'projetos' | 'tarefas' | 'conhecimento' | 'financeiro' | 'cofre';

export interface OnboardingSnapshot {
  schemaVersion: 1;
  ownerId: string;
  today: string;
  timeZone: 'America/Sao_Paulo';
  eligibility: {
    kind: 'existing_opt_in' | 'new_explicit' | 'denied';
    canStart: boolean;
    offerPending: boolean;
    reason: null | 'unavailable' | 'forbidden';
  };
  capabilities: Record<OnboardingCapability, boolean>;
  profile: { displayName: string | null; focus: OnboardingFocus | null; revision: string };
  round: OnboardingRound | null;
  calendar: OnboardingCalendarRead;
  recovery: OnboardingRecoveryEntry[];
}

export interface OnboardingStartInput { clientId: string }
export interface OnboardingRoundInput { roundId: string; expectedRevision: string; clientId: string }
export interface OnboardingSaveInput extends OnboardingRoundInput { draft: OnboardingDraft; step: OnboardingStep }
export interface OnboardingAdvanceInput { roundId: string; clientId: string }
export interface OnboardingAmendInput extends OnboardingRoundInput {
  intentId: string;
  change: { kind: 'replace'; value: OnboardingReplacement } | { kind: 'omit'; dependents: 'deny' | 'omit_selected'; dependentIntentIds: string[] };
}
export interface OnboardingChoicesQuery { kind: 'projects' | 'notebooks'; query: string; cursor: string | null }
export interface OnboardingChoices { kind: 'projects' | 'notebooks'; items: { id: string; name: string }[]; nextCursor: string | null }

export type OnboardingCommand =
  | { command: 'onboarding.start'; input: OnboardingStartInput }
  | { command: 'onboarding.save'; input: OnboardingSaveInput }
  | { command: 'onboarding.pause' | 'onboarding.confirm'; input: OnboardingRoundInput }
  | { command: 'onboarding.advance'; input: OnboardingAdvanceInput }
  | { command: 'onboarding.amend'; input: OnboardingAmendInput };

export type OnboardingPortErrorCode = 'CONFLICT' | 'UNAVAILABLE' | 'FORBIDDEN' | 'COMMIT_UNKNOWN';

export class OnboardingPortError extends Error {
  constructor(readonly code: OnboardingPortErrorCode) {
    super(code);
    this.name = 'OnboardingPortError';
  }
}

/** Servidor revalida identidade, sessão e permissão em cada método. */
export interface OnboardingPort {
  load(): Promise<OnboardingSnapshot>;
  choices(input: OnboardingChoicesQuery): Promise<OnboardingChoices>;
  start(input: OnboardingStartInput): Promise<OnboardingSnapshot>;
  save(input: OnboardingSaveInput): Promise<OnboardingSnapshot>;
  pause(input: OnboardingRoundInput): Promise<OnboardingSnapshot>;
  confirm(input: OnboardingRoundInput): Promise<OnboardingSnapshot>;
  advance(input: OnboardingAdvanceInput): Promise<OnboardingSnapshot>;
  amend(input: OnboardingAmendInput): Promise<OnboardingSnapshot>;
}
