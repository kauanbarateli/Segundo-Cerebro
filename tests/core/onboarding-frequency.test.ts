import { describe, expect, it, vi } from 'vitest';
import { decodeOnboardingDraft, decodeOnboardingHabitFrequency, decodeOnboardingReplacement, decodeOnboardingSnapshot, onboardingHabitFrequency, validateOnboardingCompletion } from '../../src/core/onboarding/validation';
import { createOnboardingService, newOnboardingDraft } from '../../src/core/onboarding/use-cases';
import { planOnboardingIntents, planOnboardingReplacement } from '../../src/core/onboarding/server-planning';
import type { OnboardingDraft, OnboardingHabitFrequency, OnboardingPort, OnboardingSnapshot } from '../../src/core/onboarding/types';

const owner = '74000000-0000-4000-8000-000000000001', round = '74000000-0000-4000-8000-000000000002';
const key = '74000000-0000-4000-8000-000000000003', day = '2026-10-25';
const habit = (frequency: unknown) => ({ key, name: 'Ler', ...(frequency as object), startedOn: day });
const draft = (value: unknown) => decodeOnboardingDraft({ ...newOnboardingDraft(), habits: [value] });
function snapshot(content: OnboardingDraft): OnboardingSnapshot {
  return {
    schemaVersion: 1, ownerId: owner, today: day, timeZone: 'America/Sao_Paulo',
    eligibility: { kind: 'existing_opt_in', canStart: true, offerPending: false, reason: null },
    capabilities: { configuracoes: true, calendario: true, habitos: true, projetos: true, tarefas: true, conhecimento: true, financeiro: true, cofre: true },
    profile: { displayName: null, focus: null, revision: 'profile-revision' },
    calendar: { status: 'not_configured', canConnect: false, accounts: [], sources: [] }, recovery: [],
    round: { id: round, revision: '9007199254740993', status: 'active', step: 'habits', draft: content, editedAt: day + 'T12:00:00Z', expiresAt: '2026-11-24T12:00:00Z', receipts: [] },
  };
}

describe('onboarding frequency: explicit item v2, unchanged outer protocol and legacy bodies', () => {
  it.each(['daily', 'three_per_week'] as const)('reads legacy %s without adding a version or rewriting its JSON', cadence => {
    const original = habit({ cadence }), before = JSON.stringify(original);
    const decoded = draft(original);
    expect(JSON.stringify(decoded.habits[0])).toBe(before);
    expect(onboardingHabitFrequency(decoded.habits[0]!)).toEqual({ cadence });
    expect(Object.hasOwn(decoded.habits[0]!, 'version')).toBe(false);
    expect(JSON.stringify(original)).toBe(before);
    expect(decodeOnboardingSnapshot(snapshot(decoded), owner).schemaVersion).toBe(1);
  });

  it.each([
    { version: 2, cadence: 'daily' },
    { version: 2, cadence: 'weekdays', weekdays: [5, 1, 3] },
    { version: 2, cadence: 'weekly_target', weeklyTarget: 1 },
    { version: 2, cadence: 'weekly_target', weeklyTarget: 7 },
  ])('round-trips the closed v2 choice %#', frequency => {
    const original = habit(frequency), decoded = draft(original);
    expect(decoded.habits[0]).toEqual(original);
    validateOnboardingCompletion(decoded);
    expect(decodeOnboardingSnapshot(snapshot(decoded), owner).round?.draft).toEqual(decoded);
  });

  it('persists empty selected weekdays for editing, but refuses Add/completion/replacement before any plan', () => {
    const original = habit({ version: 2, cadence: 'weekdays', weekdays: [] }), decoded = draft(original);
    expect(decoded.habits[0]).toEqual(original);
    expect(() => validateOnboardingCompletion(decoded)).toThrow();
    expect(() => planOnboardingIntents(round, decoded, 'profile')).toThrow();
    expect(() => decodeOnboardingHabitFrequency({ version: 2, cadence: 'weekdays', weekdays: [] }, true)).toThrow();
    expect(() => decodeOnboardingReplacement({ kind: 'habit', name: 'Ler', version: 2, cadence: 'weekdays', weekdays: [], startedOn: day })).toThrow();
    expect(decoded.habits[0]).toEqual(original);
  });

  it.each([0, 1, 3, '2', null, undefined])('refuses explicit unknown version %s without replacing the draft', version => {
    const value = habit({ version, cadence: 'daily' }), initial = { ...newOnboardingDraft(), habits: [value] };
    const before = structuredClone(initial);
    expect(() => decodeOnboardingDraft(initial)).toThrow();
    expect(initial).toEqual(before);
  });

  it.each([
    { cadence: 'weekdays', weekdays: [1] },
    { cadence: 'weekly_target', weeklyTarget: 3 },
    { cadence: 'daily', weekdays: [] },
    { version: 2, cadence: 'three_per_week' },
    { version: 2, cadence: 'daily', weeklyTarget: 3 },
    { version: 2, cadence: 'weekdays', weekdays: [1], weeklyTarget: 3 },
    { version: 2, cadence: 'weekly_target', weeklyTarget: 3, weekdays: [] },
    { version: 2, cadence: 'daily', goal: 7 },
  ])('refuses mixed/extra frequency fields %#', frequency => expect(() => draft(habit(frequency))).toThrow());

  it.each([[-1], [7], [1.5], [1, 1], ['1'], [true]])('refuses invalid or duplicated weekdays %j', weekdays => {
    expect(() => draft(habit({ version: 2, cadence: 'weekdays', weekdays }))).toThrow();
  });

  it('refuses sparse/getter/extra day entries without invoking getters', () => {
    let reads = 0;
    const accessor: unknown[] = [1]; Object.defineProperty(accessor, '0', { get() { reads++; return 1; } });
    const sparse = new Array(2);
    const extra = Object.assign([1], { hidden: true });
    for (const weekdays of [accessor, sparse, extra]) expect(() => draft(habit({ version: 2, cadence: 'weekdays', weekdays }))).toThrow();
    expect(reads).toBe(0);
  });

  it.each([0, 8, 1.5, NaN, Infinity, '3', null])('refuses invalid weekly target %s', weeklyTarget => {
    expect(() => draft(habit({ version: 2, cadence: 'weekly_target', weeklyTarget }))).toThrow();
  });

  it('refuses frequency accessors/prototypes with zero getter reads', () => {
    let reads = 0;
    const value = { key, name: 'Ler', cadence: 'daily', startedOn: day };
    Object.defineProperty(value, 'version', { enumerable: true, get() { reads++; return 2; } });
    expect(() => draft(value)).toThrow();
    expect(() => decodeOnboardingHabitFrequency(Object.create({ version: 2, cadence: 'daily' }))).toThrow();
    expect(reads).toBe(0);
  });

  it('keeps the exact legacy command and choice JSON, including clientId and field order', () => {
    const decoded = draft(habit({ cadence: 'three_per_week' }));
    const plan = planOnboardingIntents(round, decoded, 'profile');
    const input = { name: 'Ler', schedule_kind: 'weekly_target', weekdays: [], weekly_target: 3, started_on: day, color_key: 'personal', icon_key: null, position: 0, client_id: 'onb:' + round + ':habit:' + key + ':v1' };
    const choice = { kind: 'habit', name: 'Ler', cadence: 'three_per_week', startedOn: day };
    expect(JSON.stringify(plan[0]!.input)).toBe(JSON.stringify(input));
    expect(JSON.stringify(plan[0]!.choice)).toBe(JSON.stringify(choice));
    expect(planOnboardingIntents(round, decoded, 'profile')).toEqual(plan);
  });

  it('plans the actual three domain frequencies without mutating the saved selection order or date', () => {
    const options: OnboardingHabitFrequency[] = [{ version: 2, cadence: 'daily' }, { version: 2, cadence: 'weekdays', weekdays: [5, 1, 3] }, { version: 2, cadence: 'weekly_target', weeklyTarget: 7 }];
    const expected = [{ schedule_kind: 'daily', weekdays: [], weekly_target: null }, { schedule_kind: 'weekdays', weekdays: [1, 3, 5], weekly_target: null }, { schedule_kind: 'weekly_target', weekdays: [], weekly_target: 7 }];
    options.forEach((frequency, index) => {
      const original = draft(habit(frequency)), before = JSON.stringify(original), plan = planOnboardingIntents(round, original, 'profile');
      expect(plan).toHaveLength(1); expect(plan[0]!.command).toBe('habit.create');
      expect(plan[0]!.input).toMatchObject({ ...expected[index], started_on: day, client_id: 'onb:' + round + ':habit:' + key + ':v1' });
      expect(plan[0]!.choice).toMatchObject(frequency);
      expect(JSON.stringify(original)).toBe(before);
      expect(planOnboardingIntents(round, original, 'profile')).toEqual(plan);
      expect(plan[0]!.input).not.toHaveProperty('checked');
    });
  });

  it('keeps item version independent of intent replacement version and preserves legacy recovery', () => {
    const legacy = { kind: 'habit' as const, name: 'Ler', cadence: 'three_per_week' as const, startedOn: day };
    const before = JSON.stringify(legacy);
    expect(JSON.stringify(decodeOnboardingReplacement(legacy))).toBe(before);
    const next = { kind: 'habit' as const, name: 'Ler', version: 2 as const, cadence: 'weekdays' as const, weekdays: [1, 3], startedOn: day };
    const plan = planOnboardingReplacement(round, key, next, 4);
    expect(plan.choice).toEqual(next);
    expect(plan.input).toMatchObject({ schedule_kind: 'weekdays', weekdays: [1, 3], weekly_target: null, client_id: 'onb:' + round + ':habit:' + key + ':v4' });
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('refuses an unknown item version at the real service boundary before any save/confirm', async () => {
    const saved = snapshot(newOnboardingDraft());
    const port: OnboardingPort = { load: vi.fn(async () => saved), choices: vi.fn(async input => ({ kind: input.kind, items: [], nextCursor: null })), start: vi.fn(async () => saved), save: vi.fn(async () => saved), pause: vi.fn(async () => saved), confirm: vi.fn(async () => saved), advance: vi.fn(async () => saved), amend: vi.fn(async () => saved) };
    const service = createOnboardingService(port, owner), invalid = { ...newOnboardingDraft(), habits: [habit({ version: 99, cadence: 'daily' })] } as unknown as OnboardingDraft;
    await expect(service.save({ roundId: round, expectedRevision: '9007199254740993', clientId: key, draft: invalid, step: 'habits' })).rejects.toThrow();
    expect(port.save).not.toHaveBeenCalled(); expect(port.confirm).not.toHaveBeenCalled();
    expect(saved.round?.draft).toEqual(newOnboardingDraft());
  });
});
