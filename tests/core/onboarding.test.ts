import { describe, expect, it, vi } from 'vitest';
import { createOnboardingService, newOnboardingDraft } from '../../src/core/onboarding/use-cases';
import { OnboardingPortError, type OnboardingDraft, type OnboardingPort, type OnboardingSnapshot } from '../../src/core/onboarding/types';
import { decodeOnboardingChoices, decodeOnboardingCommand, decodeOnboardingDraft, decodeOnboardingReplacement, decodeOnboardingSnapshot, OnboardingValidationError, validateOnboardingCompletion } from '../../src/core/onboarding/validation';

const owner = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';
const roundId = '20000000-0000-4000-8000-000000000001';
const key = '30000000-0000-4000-8000-000000000001';
const taskKey = '30000000-0000-4000-8000-000000000002';
const clientId = '40000000-0000-4000-8000-000000000001';
function snapshot(): OnboardingSnapshot {
  return {
    schemaVersion: 1, ownerId: owner, today: '2026-10-23', timeZone: 'America/Sao_Paulo',
    eligibility: { kind: 'existing_opt_in', canStart: true, offerPending: false, reason: null },
    capabilities: { configuracoes: true, calendario: true, habitos: true, projetos: true, tarefas: true, conhecimento: true, financeiro: true, cofre: true },
    profile: { displayName: null, focus: null, revision: 'opaque-profile-revision' }, calendar: { status: 'not_configured', canConnect: false, accounts: [], sources: [] }, recovery: [],
    round: { id: roundId, revision: '9007199254740993', status: 'active', step: 'profile', draft: newOnboardingDraft(), editedAt: '2026-10-23T12:00:00Z', expiresAt: '2026-11-22T12:00:00Z', receipts: [] },
  };
}
function port(value = snapshot()): OnboardingPort {
  return { load: vi.fn(async () => value), choices: vi.fn(async input => ({ kind: input.kind, items: [], nextCursor: null })), start: vi.fn(async () => value), save: vi.fn(async () => value), pause: vi.fn(async () => value), confirm: vi.fn(async () => value), advance: vi.fn(async () => value), amend: vi.fn(async () => value) };
}

describe('onboarding: escolhas versionadas e identidade', () => {
  it('distingue ausência de rodada de um rascunho vazio válido', () => {
    const value = snapshot(); value.round = null;
    expect(decodeOnboardingSnapshot(value, owner).round).toBeNull();
    expect(decodeOnboardingDraft(newOnboardingDraft())).toEqual(newOnboardingDraft());
  });
  it('preserva omissões de foco/contexto e não importa rascunhos demo', () => {
    const draft = newOnboardingDraft();
    draft.profile = { displayName: undefined, focus: undefined };
    draft.projects = [{ key, name: 'Plano', context: undefined }];
    expect(decodeOnboardingDraft(draft)).toEqual({ ...newOnboardingDraft(), projects: [{ key, name: 'Plano' }] });
    expect(() => decodeOnboardingDraft({ version: 2, ...draft })).toThrow(OnboardingValidationError);
  });
  it('não usa títulos iguais como identidade de entidades ou vínculos', () => {
    const draft: OnboardingDraft = { ...newOnboardingDraft(), projects: [{ key, name: 'Mesmo nome' }], tasks: [{ key: taskKey, title: 'Mesmo nome', project: { kind: 'existing', id: foreign }, due: { kind: 'none' } }] };
    expect(decodeOnboardingDraft(draft).tasks[0]?.project).toEqual({ kind: 'existing', id: foreign });
    draft.tasks[0]!.project = { kind: 'draft', key: foreign };
    expect(() => decodeOnboardingDraft(draft)).toThrow(OnboardingValidationError);
  });
  it('recusa chaves duplicadas entre espécies e mais de cinco itens', () => {
    const draft: OnboardingDraft = { ...newOnboardingDraft(), projects: [{ key, name: 'Plano' }], tasks: [{ key, title: 'Ação', due: { kind: 'none' } }] };
    expect(() => decodeOnboardingDraft(draft)).toThrow(OnboardingValidationError);
    expect(() => decodeOnboardingDraft({ ...newOnboardingDraft(), projects: Array.from({ length: 6 }, () => ({ key, name: 'Plano' })) })).toThrow(OnboardingValidationError);
  });
  it('mantém Hoje como dia civil explícito ao retomar em outra data', () => {
    const draft: OnboardingDraft = { ...newOnboardingDraft(), tasks: [{ key, title: 'Ação', due: { kind: 'day', day: '2026-10-23' } }] };
    const value = snapshot(); value.today = '2026-10-24'; value.round!.draft = draft;
    expect(decodeOnboardingSnapshot(value, owner).round?.draft?.tasks[0]?.due).toEqual({ kind: 'day', day: '2026-10-23' });
    draft.tasks[0]!.due = { kind: 'day', day: '2026-02-30' };
    expect(() => decodeOnboardingDraft(draft)).toThrow(OnboardingValidationError);
  });
  it('não cria primeira nota sem caderno, nem aceita texto sem título', () => {
    expect(() => decodeOnboardingDraft({ ...newOnboardingDraft(), notes: { page: { key, title: 'Ideia', text: '' } } })).toThrow();
    const incomplete = decodeOnboardingDraft({ ...newOnboardingDraft(), notes: { notebook: { kind: 'existing', id: foreign }, page: { key, title: '', text: 'Ideia' } } });
    expect(() => validateOnboardingCompletion(incomplete)).toThrow();
    expect(decodeOnboardingDraft({ ...newOnboardingDraft(), notes: { notebook: { kind: 'existing', id: foreign } } }).notes).toEqual({ notebook: { kind: 'existing', id: foreign } });
  });
  it('rejeita getters, protótipos, arrays esparsos e metadados privilegiados', () => {
    const getter = vi.fn(() => ({}));
    const values = [
      { ...newOnboardingDraft(), profile: { role: 'master' } },
      { ...newOnboardingDraft(), profile: Object.defineProperty({}, 'displayName', { enumerable: true, get: getter }) },
      Object.assign(Object.create({ admin: true }), newOnboardingDraft()),
      { ...newOnboardingDraft(), habits: new Array(1) },
    ];
    for (const value of values) expect(() => decodeOnboardingDraft(value)).toThrow(OnboardingValidationError);
    expect(getter).not.toHaveBeenCalled();
  });
  it('valida dono, versão, capacidades e calendário sem inventar conexões', () => {
    const value = snapshot();
    for (const invalid of [{ ...value, ownerId: foreign }, { ...value, schemaVersion: 2 }, { ...value, serverSecret: 'PRIVATE_CANARY' }, { ...value, calendar: { ...value.calendar, canConnect: true } }, { ...value, eligibility: { ...value.eligibility, kind: 'denied', canStart: true } }]) expect(() => decodeOnboardingSnapshot(invalid, owner)).toThrow(OnboardingValidationError);
    expect(decodeOnboardingSnapshot(value, owner).round?.revision).toBe('9007199254740993');
  });
  it('não converte conteúdo expirado em rascunho vazio nem unknown em completo', () => {
    const value = snapshot(); value.round!.draft = null;
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
    value.round!.status = 'expired';
    expect(decodeOnboardingSnapshot(value, owner).round?.draft).toBeNull();
    value.round!.status = 'partial';
    value.round!.receipts = [{ intentId: key, itemKey: taskKey, kind: 'task', status: 'unknown', entityId: null, reason: 'commit_unknown' }];
    expect(decodeOnboardingSnapshot(value, owner).round?.status).toBe('partial');
    value.round!.status = 'complete';
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
  });
  it('retorna erros fechados sem copiar o valor pessoal rejeitado', () => {
    try { decodeOnboardingDraft({ ...newOnboardingDraft(), profile: { displayName: 'PRIVATE_CANARY'.repeat(20) } }); }
    catch (error) { expect(error).toBeInstanceOf(OnboardingValidationError); expect(JSON.stringify(error)).not.toContain('PRIVATE_CANARY'); }
  });
  it('recusa conteúdo retido em complete/expired e recibos confirmados inconsistentes', () => {
    const value = snapshot(); value.round!.status = 'complete';
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
    value.round!.draft = null;
    value.round!.receipts = [{ intentId: key, itemKey: taskKey, kind: 'task', status: 'confirmed', entityId: foreign, reason: 'unavailable' }];
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
    value.round!.receipts[0]!.reason = null;
    expect(decodeOnboardingSnapshot(value, owner).round?.status).toBe('complete');
    value.round!.receipts.push({ ...value.round!.receipts[0]!, intentId: clientId });
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
  });
});

describe('onboarding: port sem autoridade do navegador', () => {
  it('recusa dono/URL/campos adicionais antes de chamar a persistência', async () => {
    const gateway = port(); const service = createOnboardingService(gateway, owner);
    expect(() => decodeOnboardingCommand({ command: 'onboarding.start', input: { clientId, ownerId: foreign } })).toThrow();
    await expect(service.save({ roundId, expectedRevision: '0', clientId, draft: { ...newOnboardingDraft(), projects: [{ key, name: 'x'.repeat(121) }] }, step: 'projects' })).rejects.toBeInstanceOf(OnboardingValidationError);
    expect(gateway.save).not.toHaveBeenCalled();
  });
  it('preserva a identidade do comando e revisão bigint em um único envio', async () => {
    const gateway = port(); const service = createOnboardingService(gateway, owner);
    const input = { roundId, expectedRevision: '9007199254740993', clientId, draft: newOnboardingDraft(), step: 'summary' as const };
    await service.save(input);
    expect(gateway.save).toHaveBeenCalledExactlyOnceWith(input);
    expect(gateway.confirm).not.toHaveBeenCalled(); expect(gateway.advance).not.toHaveBeenCalled();
  });
  it('falha de leitura nunca vira conta nova; resposta de escrita incerta não é repetida', async () => {
    const gateway = port(); const service = createOnboardingService(gateway, owner);
    vi.mocked(gateway.load).mockResolvedValue({ ...snapshot(), ownerId: foreign });
    await expect(service.load()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    vi.mocked(gateway.confirm).mockRejectedValue(new Error('PRIVATE_CANARY'));
    await expect(service.confirm({ roundId, expectedRevision: '1', clientId })).rejects.toMatchObject({ code: 'COMMIT_UNKNOWN' });
    expect(gateway.confirm).toHaveBeenCalledTimes(1); expect(gateway.advance).not.toHaveBeenCalled();
  });
  it('conflito e veto ficam explícitos, sem sobrescrever ou mudar clientId', async () => {
    const gateway = port(); const service = createOnboardingService(gateway, owner);
    vi.mocked(gateway.pause).mockRejectedValue(new OnboardingPortError('CONFLICT'));
    await expect(service.pause({ roundId, expectedRevision: '1', clientId })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(gateway.pause).toHaveBeenCalledTimes(1);
  });
  it('não atesta salvamento quando o servidor retorna outro conteúdo ou outra rodada', async () => {
    const gateway = port(); const service = createOnboardingService(gateway, owner);
    const draft = { ...newOnboardingDraft(), profile: { displayName: 'Nome preparado' } };
    await expect(service.save({ roundId, expectedRevision: '1', clientId, draft, step: 'summary' })).rejects.toMatchObject({ code: 'COMMIT_UNKNOWN' });
    const other = snapshot(); other.round!.id = foreign; vi.mocked(gateway.pause).mockResolvedValue(other);
    await expect(service.pause({ roundId, expectedRevision: '1', clientId })).rejects.toMatchObject({ code: 'COMMIT_UNKNOWN' });
    expect(gateway.save).toHaveBeenCalledTimes(1); expect(gateway.pause).toHaveBeenCalledTimes(1);
  });
  it('salva, pausa e recarrega escolhas incompletas; confirmar exige completar sem comandos de domínio', async () => {
    const saved = snapshot(); const gateway = port(saved); const service = createOnboardingService(gateway, owner);
    saved.round!.revision = '1';
    vi.mocked(gateway.save).mockImplementation(async input => { expect(input.expectedRevision).toBe(saved.round!.revision); saved.round!.draft = input.draft; saved.round!.step = input.step; saved.round!.revision = String(BigInt(saved.round!.revision) + 1n); return saved; });
    vi.mocked(gateway.pause).mockImplementation(async () => { saved.round!.status = 'paused'; return saved; });
    const incomplete: OnboardingDraft = {
      ...newOnboardingDraft(), habits: [{ key, name: '', cadence: 'three_per_week', startedOn: '2026-10-23' }],
      notes: { notebook: { kind: 'new', key: taskKey, name: '' }, page: { key: foreign, title: '', text: 'Ideia antes do caderno  ' } },
    };
    await service.save({ roundId, expectedRevision: '1', clientId, draft: { ...newOnboardingDraft(), habits: [{ ...incomplete.habits[0]!, name: 'Ler' }] }, step: 'habits' });
    await service.save({ roundId, expectedRevision: '2', clientId: taskKey, draft: incomplete, step: 'notes' });
    await service.pause({ roundId, expectedRevision: '3', clientId });
    const restored = await service.load();
    expect(restored.round?.draft).toEqual(incomplete);
    expect(restored.round?.draft?.notes?.page?.text).toBe('Ideia antes do caderno  ');
    expect(() => validateOnboardingCompletion(restored.round!.draft!)).toThrow(OnboardingValidationError);
    expect(gateway.confirm).not.toHaveBeenCalled(); expect(gateway.advance).not.toHaveBeenCalled();
    const complete = decodeOnboardingDraft({ ...incomplete, habits: [{ ...incomplete.habits[0]!, name: 'Ler' }], notes: { ...incomplete.notes!, notebook: { kind: 'new', key: taskKey, name: 'Ideias' }, page: { ...incomplete.notes!.page!, title: 'Primeira ideia' } } });
    expect(() => validateOnboardingCompletion(complete)).not.toThrow();
  });
  it('opções existentes têm ID, tipo e limites próprios', () => {
    expect(decodeOnboardingChoices({ kind: 'projects', items: [{ id: foreign, name: 'Plano' }], nextCursor: 'opaque' }, 'projects').items[0]?.id).toBe(foreign);
    expect(() => decodeOnboardingChoices({ kind: 'notebooks', items: [], nextCursor: null }, 'projects')).toThrow();
    expect(() => decodeOnboardingChoices({ kind: 'projects', items: [{ id: foreign, name: 'A' }, { id: foreign, name: 'B' }], nextCursor: null }, 'projects')).toThrow();
  });
  it('omissão conclui sem entidade criada e nunca disfarça unknown', () => {
    const value = snapshot(); value.round!.status = 'complete'; value.round!.draft = null;
    value.round!.receipts = [{ intentId: key, itemKey: taskKey, kind: 'task', status: 'omitted', entityId: null, reason: null }];
    expect(decodeOnboardingSnapshot(value, owner).round?.receipts.filter(item => item.status === 'confirmed')).toHaveLength(0);
    value.round!.receipts[0]!.entityId = foreign;
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
    value.round!.receipts[0]!.entityId = null; value.round!.receipts[0]!.reason = 'commit_unknown';
    expect(() => decodeOnboardingSnapshot(value, owner)).toThrow();
  });
  it('fecha recovery ao recibo ativo e rejeita dependência inventada ou terminal', () => {
    const value = snapshot(); value.round!.status = 'partial';
    value.round!.receipts = [{ intentId: key, itemKey: taskKey, kind: 'task', status: 'failed', entityId: null, reason: 'validation' }];
    value.recovery = [{ intentId: key, itemKey: taskKey, kind: 'task', status: 'failed', choice: { kind: 'task', title: 'Ação', project: null, due: {kind:'none'} }, canReplace: true, canOmit: true, dependentIntentIds: [] }];
    expect(decodeOnboardingSnapshot(value, owner).recovery).toHaveLength(1);
    for (const invalid of [{ ...value, recovery: [{ ...value.recovery[0]!, itemKey: foreign }] }, { ...value, recovery: [{ ...value.recovery[0]!, dependentIntentIds: [foreign] }] }, { ...value, recovery: [{ ...value.recovery[0]!, choice: null }] }, { ...value, recovery: [...value.recovery, ...value.recovery] }]) expect(() => decodeOnboardingSnapshot(invalid, owner)).toThrow();
  });
  it('emendas fecham kind e versão sem inserir slots, dados de administrador ou destino implícito', () => {
    const value = { kind: 'page', title: 'Ideia', text: 'Texto  ', notebook: { kind: 'prepared', key } };
    expect(decodeOnboardingReplacement(value)).toEqual(value);
    for (const invalid of [{ ...value, project: { kind: 'existing', id: foreign } }, { ...value, intentVersion: 2 }, { kind: 'profile', patch: {focus: null}, expectedProfileRevision: 'opaque' }, { kind: 'profile', patch: {}, expectedProfileRevision: 'opaque' }, { kind: 'task', title: '', project: null, due: {kind:'none'} }]) expect(() => decodeOnboardingReplacement(invalid)).toThrow();
    expect(decodeOnboardingReplacement({kind:'project',name:'Plano',context:null})).toEqual({kind:'project',name:'Plano',context:null});
  });
  it('envia emenda uma vez com CAS e não avança automaticamente após a resposta', async () => {
    const value = snapshot(); value.round!.status = 'partial'; const gateway = port(value), service = createOnboardingService(gateway, owner);
    const input = { roundId, expectedRevision: '9007199254740993', clientId, intentId: key, change: { kind: 'omit' as const, dependents: 'deny' as const, dependentIntentIds: [] } };
    await service.amend(input);
    expect(gateway.amend).toHaveBeenCalledExactlyOnceWith(input); expect(gateway.advance).not.toHaveBeenCalled();
    expect(() => decodeOnboardingCommand({command:'onboarding.amend',input:{...input,change:{kind:'omit',dependents:'deny',dependentIntentIds:[foreign]}}})).toThrow();
  });
});
