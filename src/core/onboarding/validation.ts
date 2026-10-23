import { instanteValido } from '../contracts/base';
import type {
  OnboardingChoices, OnboardingChoicesQuery, OnboardingCommand, OnboardingDraft,
  OnboardingFocus, OnboardingIntentReceipt, OnboardingProjectContext, OnboardingProjectRef,
  OnboardingRound, OnboardingSnapshot, OnboardingStep,
  OnboardingReplacement, OnboardingRecoveryEntry,
} from './types';

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['welcome', 'profile', 'calendar', 'habits', 'projects', 'tasks', 'notes', 'spaces', 'summary'];
const FOCUS: readonly OnboardingFocus[] = ['work', 'study', 'personal', 'mixed'];
const CONTEXT: readonly OnboardingProjectContext[] = ['personal', 'work', 'study'];
const CAPABILITIES = ['configuracoes', 'calendario', 'habitos', 'projetos', 'tarefas', 'conhecimento', 'financeiro', 'cofre'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Issue = { step: OnboardingStep; field: string; reason: 'invalid' | 'required' | 'limit' | 'reference' | 'version' };

export class OnboardingValidationError extends Error {
  readonly issues: readonly Issue[];
  constructor(issue: Issue) {
    super('ONBOARDING_VALIDATION');
    this.name = 'OnboardingValidationError';
    this.issues = [issue];
  }
}

function fail(step: OnboardingStep, field: string, reason: Issue['reason'] = 'invalid'): never {
  throw new OnboardingValidationError({ step, field, reason });
}

/** Own data properties only: no getters, prototype tricks or unknown fields. */
function record(value: unknown, allowed: readonly string[], required: readonly string[], step: OnboardingStep, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(step, field);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail(step, field);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key))) fail(step, field);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) fail(step, field);
      result[key] = descriptor.value;
    }
    if (required.some(key => !Object.hasOwn(result, key))) fail(step, field, 'required');
    return result;
  } catch (error) {
    if (error instanceof OnboardingValidationError) throw error;
    return fail(step, field);
  }
}

function list(value: unknown, max: number, step: OnboardingStep, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(step, field, 'limit');
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail(step, field);
    result.push(descriptor.value);
  }
  if (Reflect.ownKeys(value).length !== value.length + 1) fail(step, field);
  return result;
}

function text(value: unknown, max: number, step: OnboardingStep, field: string, empty = false, preserve = false): string {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail(step, field);
  const canonical = preserve ? value : value.trim();
  if ((!empty && canonical.length === 0) || [...canonical].length > max) fail(step, field, canonical.length ? 'limit' : 'required');
  return canonical;
}

function id(value: unknown, step: OnboardingStep, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) fail(step, field);
  return value.toLowerCase();
}

function choice<T extends string>(value: unknown, choices: readonly T[], step: OnboardingStep, field: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) fail(step, field);
  return value as T;
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail('welcome', field);
  return value;
}

function day(value: unknown, step: OnboardingStep, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !instanteValido(`${value}T00:00:00.000Z`)) fail(step, field);
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !instanteValido(value)) fail('welcome', field);
  return value;
}

function revision(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value) || BigInt(value) > 9_223_372_036_854_775_807n) fail('welcome', 'revision');
  return value;
}

function projectRef(value: unknown, step: OnboardingStep): OnboardingProjectRef {
  const row = record(value, ['kind', 'key', 'id'], ['kind'], step, 'project');
  if (row.kind === 'draft') {
    record(value, ['kind', 'key'], ['kind', 'key'], step, 'project');
    return { kind: 'draft', key: id(row.key, step, 'project') };
  }
  if (row.kind === 'existing') {
    record(value, ['kind', 'id'], ['kind', 'id'], step, 'project');
    return { kind: 'existing', id: id(row.id, step, 'project') };
  }
  return fail(step, 'project');
}

export function decodeOnboardingDraft(value: unknown): OnboardingDraft {
  const row = record(value, ['profile', 'habits', 'projects', 'tasks', 'notes'], ['profile', 'habits', 'projects', 'tasks', 'notes'], 'welcome', 'draft');
  const profile = record(row.profile, ['displayName', 'focus'], [], 'profile', 'profile');
  const draft: OnboardingDraft = {
    profile: {
      ...(profile.displayName !== undefined ? { displayName: text(profile.displayName, 120, 'profile', 'displayName', true, true) } : {}),
      ...(profile.focus !== undefined ? { focus: choice(profile.focus, FOCUS, 'profile', 'focus') } : {}),
    },
    habits: list(row.habits, 5, 'habits', 'habits').map(value => {
      const item = record(value, ['key', 'name', 'cadence', 'startedOn'], ['key', 'name', 'cadence', 'startedOn'], 'habits', 'habit');
      return { key: id(item.key, 'habits', 'key'), name: text(item.name, 120, 'habits', 'name', true, true), cadence: choice(item.cadence, ['daily', 'three_per_week'] as const, 'habits', 'cadence'), startedOn: day(item.startedOn, 'habits', 'startedOn') };
    }),
    projects: list(row.projects, 5, 'projects', 'projects').map(value => {
      const item = record(value, ['key', 'name', 'context'], ['key', 'name'], 'projects', 'project');
      return { key: id(item.key, 'projects', 'key'), name: text(item.name, 120, 'projects', 'name', true, true), ...(item.context !== undefined ? { context: choice(item.context, CONTEXT, 'projects', 'context') } : {}) };
    }),
    tasks: list(row.tasks, 5, 'tasks', 'tasks').map(value => {
      const item = record(value, ['key', 'title', 'project', 'due'], ['key', 'title', 'due'], 'tasks', 'task');
      const due = record(item.due, ['kind', 'day'], ['kind'], 'tasks', 'due');
      const canonicalDue: OnboardingDraft['tasks'][number]['due'] = due.kind === 'none'
        ? (record(item.due, ['kind'], ['kind'], 'tasks', 'due'), { kind: 'none' })
        : due.kind === 'day' ? { kind: 'day', day: day(due.day, 'tasks', 'due') } : fail('tasks', 'due');
      return { key: id(item.key, 'tasks', 'key'), title: text(item.title, 200, 'tasks', 'title', true, true), due: canonicalDue, ...(item.project !== undefined ? { project: projectRef(item.project, 'tasks') } : {}) };
    }),
    notes: null,
  };
  if (row.notes !== null) {
    const notes = record(row.notes, ['notebook', 'page'], ['notebook'], 'notes', 'notes');
    const notebook = record(notes.notebook, ['kind', 'key', 'name', 'id'], ['kind'], 'notes', 'notebook');
    let canonicalNotebook: NonNullable<OnboardingDraft['notes']>['notebook'];
    if (notebook.kind === 'new') {
      record(notes.notebook, ['kind', 'key', 'name'], ['kind', 'key', 'name'], 'notes', 'notebook');
      canonicalNotebook = { kind: 'new', key: id(notebook.key, 'notes', 'key'), name: text(notebook.name, 120, 'notes', 'name', true, true) };
    } else if (notebook.kind === 'existing') {
      record(notes.notebook, ['kind', 'id'], ['kind', 'id'], 'notes', 'notebook');
      canonicalNotebook = { kind: 'existing', id: id(notebook.id, 'notes', 'notebook') };
    } else return fail('notes', 'notebook');
    draft.notes = { notebook: canonicalNotebook };
    if (notes.page !== undefined) {
      const page = record(notes.page, ['key', 'title', 'text', 'project'], ['key', 'title', 'text'], 'notes', 'page');
      draft.notes.page = { key: id(page.key, 'notes', 'key'), title: text(page.title, 200, 'notes', 'title', true, true), text: text(page.text, 2000, 'notes', 'text', true, true), ...(page.project !== undefined ? { project: projectRef(page.project, 'notes') } : {}) };
    }
  }
  const keys = [
    ...draft.habits.map(item => item.key), ...draft.projects.map(item => item.key), ...draft.tasks.map(item => item.key),
    ...(draft.notes?.notebook.kind === 'new' ? [draft.notes.notebook.key] : []), ...(draft.notes?.page ? [draft.notes.page.key] : []),
  ];
  if (new Set(keys).size !== keys.length) fail('summary', 'keys', 'reference');
  const projects = new Set(draft.projects.map(item => item.key));
  for (const ref of [...draft.tasks.map(item => item.project), draft.notes?.page?.project]) {
    if (ref?.kind === 'draft' && !projects.has(ref.key)) fail('summary', 'project', 'reference');
  }
  if (new TextEncoder().encode(JSON.stringify(draft)).byteLength > 65_536) fail('summary', 'draft', 'limit');
  return draft;
}

/** Draft may be incomplete. Only confirmation requires complete domain choices. */
export function validateOnboardingCompletion(value: OnboardingDraft): void {
  const draft = decodeOnboardingDraft(value);
  if (draft.profile.displayName !== undefined) text(draft.profile.displayName, 120, 'profile', 'displayName');
  for (const item of draft.habits) text(item.name, 120, 'habits', 'name');
  for (const item of draft.projects) text(item.name, 120, 'projects', 'name');
  for (const item of draft.tasks) text(item.title, 200, 'tasks', 'title');
  if (draft.notes?.notebook.kind === 'new') text(draft.notes.notebook.name, 120, 'notes', 'notebook');
  if (draft.notes?.page) text(draft.notes.page.title, 200, 'notes', 'title');
}

/** Emendas já são propostas completas; não renovam nem inventam slots. */
export function decodeOnboardingReplacement(value: unknown): OnboardingReplacement {
  const discriminator = record(value, ['kind', 'patch', 'expectedProfileRevision', 'name', 'cadence', 'startedOn', 'context', 'title', 'project', 'due', 'text', 'notebook'], ['kind'], 'summary', 'replacement');
  const kind = choice(discriminator.kind, ['profile', 'habit', 'project', 'task', 'notebook', 'page', 'link'] as const, 'summary', 'kind');
  const requiredText = (value: unknown, max: number, step: OnboardingStep, field: string) => {
    text(value, max, step, field); return text(value, max, step, field, false, true);
  };
  let result: OnboardingReplacement;
  switch (kind) {
    case 'profile': {
      const row = record(value, ['kind', 'patch', 'expectedProfileRevision'], ['kind', 'patch', 'expectedProfileRevision'], 'profile', 'replacement');
      const patch = record(row.patch, ['displayName', 'focus'], [], 'profile', 'patch');
      if (patch.displayName === undefined && patch.focus === undefined) fail('profile', 'patch', 'required');
      result = { kind, expectedProfileRevision: text(row.expectedProfileRevision, 256, 'profile', 'revision'), patch: {
        ...(patch.displayName !== undefined ? { displayName: requiredText(patch.displayName, 120, 'profile', 'displayName') } : {}),
        ...(patch.focus !== undefined ? { focus: choice(patch.focus, FOCUS, 'profile', 'focus') } : {}),
      } }; break;
    }
    case 'habit': {
      const row = record(value, ['kind', 'name', 'cadence', 'startedOn'], ['kind', 'name', 'cadence', 'startedOn'], 'habits', 'replacement');
      result = { kind, name: requiredText(row.name, 120, 'habits', 'name'), cadence: choice(row.cadence, ['daily', 'three_per_week'] as const, 'habits', 'cadence'), startedOn: day(row.startedOn, 'habits', 'startedOn') }; break;
    }
    case 'project': {
      const row = record(value, ['kind', 'name', 'context'], ['kind', 'name', 'context'], 'projects', 'replacement');
      result = { kind, name: requiredText(row.name, 120, 'projects', 'name'), context: row.context === null ? null : choice(row.context, CONTEXT, 'projects', 'context') }; break;
    }
    case 'task': {
      const row = record(value, ['kind', 'title', 'project', 'due'], ['kind', 'title', 'project', 'due'], 'tasks', 'replacement');
      const due = record(row.due, ['kind', 'day'], ['kind'], 'tasks', 'due');
      let canonicalDue: OnboardingDraft['tasks'][number]['due'];
      if (due.kind === 'none') { record(row.due, ['kind'], ['kind'], 'tasks', 'due'); canonicalDue = { kind: 'none' }; }
      else if (due.kind === 'day') { record(row.due, ['kind', 'day'], ['kind', 'day'], 'tasks', 'due'); canonicalDue = { kind: 'day', day: day(due.day, 'tasks', 'due') }; }
      else return fail('tasks', 'due');
      result = { kind, title: requiredText(row.title, 200, 'tasks', 'title'), project: row.project === null ? null : projectRef(row.project, 'tasks'), due: canonicalDue }; break;
    }
    case 'notebook': {
      const row = record(value, ['kind', 'name'], ['kind', 'name'], 'notes', 'replacement');
      result = { kind, name: requiredText(row.name, 120, 'notes', 'name') }; break;
    }
    case 'page': {
      const row = record(value, ['kind', 'title', 'text', 'notebook'], ['kind', 'title', 'text', 'notebook'], 'notes', 'replacement');
      const notebook = record(row.notebook, ['kind', 'key', 'id'], ['kind'], 'notes', 'notebook');
      let target: Extract<OnboardingReplacement, {kind:'page'}>['notebook'];
      if (notebook.kind === 'prepared') { record(row.notebook, ['kind', 'key'], ['kind', 'key'], 'notes', 'notebook'); target = { kind: 'prepared', key: id(notebook.key, 'notes', 'notebook') }; }
      else if (notebook.kind === 'existing') { record(row.notebook, ['kind', 'id'], ['kind', 'id'], 'notes', 'notebook'); target = { kind: 'existing', id: id(notebook.id, 'notes', 'notebook') }; }
      else return fail('notes', 'notebook');
      result = { kind, title: requiredText(row.title, 200, 'notes', 'title'), text: text(row.text, 2000, 'notes', 'text', true, true), notebook: target }; break;
    }
    case 'link': {
      const row = record(value, ['kind', 'project'], ['kind', 'project'], 'notes', 'replacement');
      result = { kind, project: projectRef(row.project, 'notes') }; break;
    }
  }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 65_536) fail('summary', 'replacement', 'limit');
  return result;
}

function decodeRecovery(value: unknown): OnboardingRecoveryEntry {
  const fields = ['intentId', 'itemKey', 'kind', 'status', 'choice', 'canReplace', 'canOmit', 'dependentIntentIds'];
  const row = record(value, fields, fields, 'summary', 'recovery');
  const kind = choice(row.kind, ['profile', 'habit', 'project', 'task', 'notebook', 'page', 'link'] as const, 'summary', 'kind');
  const selected = row.choice === null ? null : decodeOnboardingReplacement(row.choice);
  const canReplace = bool(row.canReplace, 'canReplace');
  if ((selected && selected.kind !== kind) || (canReplace && !selected)) fail('summary', 'choice');
  const dependentIntentIds = list(row.dependentIntentIds, 63, 'summary', 'dependentIntentIds').map(value => id(value, 'summary', 'dependentIntentIds'));
  if (new Set(dependentIntentIds).size !== dependentIntentIds.length) fail('summary', 'dependentIntentIds');
  return { intentId: id(row.intentId, 'summary', 'intentId'), itemKey: id(row.itemKey, 'summary', 'itemKey'), kind, status: choice(row.status, ['ready', 'pending', 'blocked', 'failed', 'unknown'] as const, 'summary', 'status'), choice: selected, canReplace, canOmit: bool(row.canOmit, 'canOmit'), dependentIntentIds };
}

function decodeReceipt(value: unknown): OnboardingIntentReceipt {
  const row = record(value, ['intentId', 'itemKey', 'kind', 'status', 'entityId', 'reason'], ['intentId', 'itemKey', 'kind', 'status', 'entityId', 'reason'], 'summary', 'receipt');
  const status = choice(row.status, ['ready', 'pending', 'confirmed', 'blocked', 'failed', 'unknown', 'omitted'] as const, 'summary', 'status');
  const entityId = row.entityId === null ? null : id(row.entityId, 'summary', 'entityId');
  if ((status === 'confirmed') !== (entityId !== null)) fail('summary', 'entityId');
  if ((status === 'confirmed' || status === 'omitted') && row.reason !== null) fail('summary', 'reason');
  return { intentId: id(row.intentId, 'summary', 'intentId'), itemKey: id(row.itemKey, 'summary', 'itemKey'), kind: choice(row.kind, ['profile', 'habit', 'project', 'task', 'notebook', 'page', 'link'] as const, 'summary', 'kind'), status, entityId, reason: row.reason === null ? null : choice(row.reason, ['validation', 'dependency', 'forbidden', 'conflict', 'commit_unknown', 'unavailable'] as const, 'summary', 'reason') };
}

function decodeRound(value: unknown): OnboardingRound {
  const row = record(value, ['id', 'revision', 'status', 'step', 'draft', 'editedAt', 'expiresAt', 'receipts'], ['id', 'revision', 'status', 'step', 'draft', 'editedAt', 'expiresAt', 'receipts'], 'welcome', 'round');
  const status = choice(row.status, ['active', 'paused', 'executing', 'partial', 'complete', 'expired'] as const, 'welcome', 'status');
  if ((status === 'active' || status === 'paused') && row.draft === null) fail('welcome', 'draft');
  if ((status === 'complete' || status === 'expired') && row.draft !== null) fail('welcome', 'draft');
  const receipts = list(row.receipts, 64, 'summary', 'receipts').map(decodeReceipt);
  if (new Set(receipts.map(item => item.intentId)).size !== receipts.length || new Set(receipts.map(item => `${item.kind}:${item.itemKey}`)).size !== receipts.length || (status === 'complete' && receipts.some(item => item.status !== 'confirmed' && item.status !== 'omitted'))) fail('summary', 'receipts');
  return { id: id(row.id, 'welcome', 'roundId'), revision: revision(row.revision), status, step: choice(row.step, ONBOARDING_STEPS, 'welcome', 'step'), draft: row.draft === null ? null : decodeOnboardingDraft(row.draft), editedAt: timestamp(row.editedAt, 'editedAt'), expiresAt: timestamp(row.expiresAt, 'expiresAt'), receipts };
}

export function decodeOnboardingSnapshot(value: unknown, ownerId: string): OnboardingSnapshot {
  const expectedOwner = id(ownerId, 'welcome', 'owner');
  const fields = ['schemaVersion', 'ownerId', 'today', 'timeZone', 'eligibility', 'capabilities', 'profile', 'round', 'calendar', 'recovery'];
  const row = record(value, fields, fields, 'welcome', 'snapshot');
  if (row.schemaVersion !== 1) fail('welcome', 'schemaVersion', 'version');
  if (id(row.ownerId, 'welcome', 'owner') !== expectedOwner || row.timeZone !== 'America/Sao_Paulo') fail('welcome', 'owner');
  const eligibility = record(row.eligibility, ['kind', 'canStart', 'offerPending', 'reason'], ['kind', 'canStart', 'offerPending', 'reason'], 'welcome', 'eligibility');
  const kind = choice(eligibility.kind, ['existing_opt_in', 'new_explicit', 'denied'] as const, 'welcome', 'eligibility');
  const canStart = bool(eligibility.canStart, 'canStart');
  if (kind === 'denied' && canStart) fail('welcome', 'eligibility');
  const caps = record(row.capabilities, CAPABILITIES, CAPABILITIES, 'welcome', 'capabilities');
  const profile = record(row.profile, ['displayName', 'focus', 'revision'], ['displayName', 'focus', 'revision'], 'profile', 'profile');
  const calendar = record(row.calendar, ['status', 'canConnect', 'accounts', 'sources'], ['status', 'canConnect', 'accounts', 'sources'], 'calendar', 'calendar');
  const calendarStatus = choice(calendar.status, ['ready', 'not_configured', 'forbidden', 'unavailable'] as const, 'calendar', 'status');
  const accounts = list(calendar.accounts, 2, 'calendar', 'accounts').map(value => {
    const item = record(value, ['id', 'email', 'status'], ['id', 'email', 'status'], 'calendar', 'account');
    return { id: id(item.id, 'calendar', 'accountId'), email: text(item.email, 320, 'calendar', 'email'), status: choice(item.status, ['connected', 'reauthorize', 'revocation_pending'] as const, 'calendar', 'status') };
  });
  const sources = list(calendar.sources, 5000, 'calendar', 'sources').map(value => {
    const item = record(value, ['id', 'accountId', 'name', 'selected'], ['id', 'accountId', 'name', 'selected'], 'calendar', 'source');
    return { id: id(item.id, 'calendar', 'sourceId'), accountId: id(item.accountId, 'calendar', 'accountId'), name: text(item.name, 500, 'calendar', 'name'), selected: bool(item.selected, 'selected') };
  });
  if (new Set(accounts.map(item => item.id)).size !== accounts.length || new Set(sources.map(item => item.id)).size !== sources.length || sources.some(item => !accounts.some(account => account.id === item.accountId))) fail('calendar', 'sources', 'reference');
  if (calendarStatus !== 'ready' && (accounts.length !== 0 || sources.length !== 0 || calendar.canConnect !== false)) fail('calendar', 'calendar');
  const round = row.round === null ? null : decodeRound(row.round);
  const recovery = list(row.recovery, 64, 'summary', 'recovery').map(decodeRecovery);
  if ((!round || !['executing', 'partial'].includes(round.status)) && recovery.length) fail('summary', 'recovery');
  if (new Set(recovery.map(item => item.intentId)).size !== recovery.length) fail('summary', 'recovery');
  for (const entry of recovery) {
    const receipt = round?.receipts.find(item => item.intentId === entry.intentId);
    if (!receipt || receipt.kind !== entry.kind || receipt.itemKey !== entry.itemKey || receipt.status !== entry.status) fail('summary', 'recovery', 'reference');
    for (const dependentId of entry.dependentIntentIds) {
      const dependent = round?.receipts.find(item => item.intentId === dependentId);
      if (dependentId === entry.intentId || !dependent || dependent.status === 'confirmed' || dependent.status === 'omitted') fail('summary', 'recovery', 'reference');
    }
  }
  return {
    schemaVersion: 1, ownerId: expectedOwner, today: day(row.today, 'welcome', 'today'), timeZone: 'America/Sao_Paulo',
    eligibility: { kind, canStart, offerPending: bool(eligibility.offerPending, 'offerPending'), reason: eligibility.reason === null ? null : choice(eligibility.reason, ['unavailable', 'forbidden'] as const, 'welcome', 'reason') },
    capabilities: Object.fromEntries(CAPABILITIES.map(key => [key, bool(caps[key], key)])) as OnboardingSnapshot['capabilities'],
    profile: { displayName: profile.displayName === null ? null : text(profile.displayName, 120, 'profile', 'displayName'), focus: profile.focus === null ? null : choice(profile.focus, FOCUS, 'profile', 'focus'), revision: text(profile.revision, 256, 'profile', 'revision') },
    round, recovery,
    calendar: { status: calendarStatus, canConnect: bool(calendar.canConnect, 'canConnect'), accounts, sources },
  };
}

export function decodeOnboardingCommand(value: unknown): OnboardingCommand {
  const row = record(value, ['command', 'input'], ['command', 'input'], 'welcome', 'command');
  const command = choice(row.command, ['onboarding.start', 'onboarding.save', 'onboarding.pause', 'onboarding.confirm', 'onboarding.advance', 'onboarding.amend'] as const, 'welcome', 'command');
  const fields = command === 'onboarding.start' ? ['clientId'] : command === 'onboarding.advance' ? ['roundId', 'clientId'] : command === 'onboarding.save' ? ['roundId', 'expectedRevision', 'clientId', 'draft', 'step'] : command === 'onboarding.amend' ? ['roundId', 'expectedRevision', 'clientId', 'intentId', 'change'] : ['roundId', 'expectedRevision', 'clientId'];
  const input = record(row.input, fields, fields, 'welcome', 'input');
  const clientId = id(input.clientId, 'welcome', 'clientId');
  if (command === 'onboarding.start') return { command, input: { clientId } };
  const roundId = id(input.roundId, 'welcome', 'roundId');
  if (command === 'onboarding.advance') return { command, input: { roundId, clientId } };
  const expectedRevision = revision(input.expectedRevision);
  if (command === 'onboarding.amend') {
    const change = record(input.change, ['kind', 'value', 'dependents', 'dependentIntentIds'], ['kind'], 'summary', 'change');
    const intentId = id(input.intentId, 'summary', 'intentId');
    if (change.kind === 'replace') {
      record(input.change, ['kind', 'value'], ['kind', 'value'], 'summary', 'change');
      return { command, input: { roundId, expectedRevision, clientId, intentId, change: { kind: 'replace', value: decodeOnboardingReplacement(change.value) } } };
    }
    record(input.change, ['kind', 'dependents', 'dependentIntentIds'], ['kind', 'dependents', 'dependentIntentIds'], 'summary', 'change');
    if (change.kind !== 'omit') fail('summary', 'change');
    const dependents = choice(change.dependents, ['deny', 'omit_selected'] as const, 'summary', 'dependents');
    const dependentIntentIds = list(change.dependentIntentIds, 63, 'summary', 'dependentIntentIds').map(value => id(value, 'summary', 'dependentIntentIds'));
    if (new Set(dependentIntentIds).size !== dependentIntentIds.length || dependentIntentIds.includes(intentId) || (dependents === 'deny' && dependentIntentIds.length !== 0)) fail('summary', 'dependentIntentIds');
    return { command, input: { roundId, expectedRevision, clientId, intentId, change: { kind: 'omit', dependents, dependentIntentIds } } };
  }
  if (command === 'onboarding.save') return { command, input: { roundId, expectedRevision, clientId, draft: decodeOnboardingDraft(input.draft), step: choice(input.step, ONBOARDING_STEPS, 'welcome', 'step') } };
  return { command, input: { roundId, expectedRevision, clientId } };
}

export function decodeOnboardingChoicesQuery(value: unknown): OnboardingChoicesQuery {
  const row = record(value, ['kind', 'query', 'cursor'], ['kind', 'query', 'cursor'], 'welcome', 'choices');
  return { kind: choice(row.kind, ['projects', 'notebooks'] as const, 'welcome', 'kind'), query: text(row.query, 120, 'welcome', 'query', true), cursor: row.cursor === null ? null : text(row.cursor, 2048, 'welcome', 'cursor') };
}

export function decodeOnboardingChoices(value: unknown, expectedKind: OnboardingChoicesQuery['kind']): OnboardingChoices {
  const row = record(value, ['kind', 'items', 'nextCursor'], ['kind', 'items', 'nextCursor'], 'welcome', 'choices');
  if (row.kind !== expectedKind) fail('welcome', 'kind');
  const items = list(row.items, 50, 'welcome', 'items').map(value => {
    const item = record(value, ['id', 'name'], ['id', 'name'], 'welcome', 'item');
    return { id: id(item.id, 'welcome', 'id'), name: text(item.name, 500, 'welcome', 'name') };
  });
  if (new Set(items.map(item => item.id)).size !== items.length) fail('welcome', 'items', 'reference');
  return { kind: expectedKind, items, nextCursor: row.nextCursor === null ? null : text(row.nextCursor, 2048, 'welcome', 'cursor') };
}
