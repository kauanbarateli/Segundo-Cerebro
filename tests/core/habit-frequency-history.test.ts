import { describe, expect, it } from "vitest";
import { normalizarHistoricoDeFrequencia, resolverFrequenciaNoDia, type HabitoParaHistorico, type VigenciaDeFrequenciaV1 } from "../../src/core/habitos";

const habit = (patch: Partial<HabitoParaHistorico> = {}): HabitoParaHistorico => ({ id: "habit", user_id: "owner", started_on: "2026-10-01", schedule_kind: "daily", weekdays: [], weekly_target: null, ...patch });
const period = (patch: Partial<VigenciaDeFrequenciaV1> = {}): VigenciaDeFrequenciaV1 => ({ version: 1, habit_id: "habit", user_id: "owner", effective_from: "2026-10-01", schedule_kind: "daily", weekdays: [], weekly_target: null, ...patch });
const normalize = (historico: readonly VigenciaDeFrequenciaV1[]) => normalizarHistoricoDeFrequencia({ habito: habit(), historico });
const unsafeHistory = (value: unknown) => value as readonly VigenciaDeFrequenciaV1[];

describe("SPEC-08: contrato puro de vigência, sem desempenho ou persistência", () => {
  it("identifica o baseline ausente como frequência conhecida do legado", () => {
    const habito = habit({ schedule_kind: "weekdays", weekdays: [5, 1, 3] });
    const result = normalizarHistoricoDeFrequencia({ habito });
    expect(result).toEqual({ version: 1, habit_id: "habit", user_id: "owner", started_on: "2026-10-01", baseline_provenance: "legacy_known_frequency",
      periods: [{ version: 1, habit_id: "habit", user_id: "owner", effective_from: "2026-10-01", effective_until: null, schedule_kind: "weekdays", weekdays: [1, 3, 5], weekly_target: null }] });
    expect(normalizarHistoricoDeFrequencia({ habito, historico: undefined })).toEqual(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(habito.weekdays).toEqual([5, 1, 3]);
  });

  it("o histórico fornecido é autoridade, sem voltar à cadência atual", () => {
    const historico = [period({ effective_from: "2026-10-15", schedule_kind: "weekly_target", weekly_target: 3 }), period({ schedule_kind: "weekdays", weekdays: [5, 1, 3] })];
    const result = normalizarHistoricoDeFrequencia({ habito: habit(), historico });
    expect(result.baseline_provenance).toBe("supplied_history");
    expect(result.periods.map(row => [row.effective_from, row.effective_until, row.schedule_kind])).toEqual([
      ["2026-10-01", "2026-10-15", "weekdays"], ["2026-10-15", null, "weekly_target"],
    ]);
    expect(result.periods[0]!.weekdays).toEqual([1, 3, 5]);
    expect(historico[0]!.effective_from).toBe("2026-10-15");
  });

  it.each([
    ["2026-09-30", "not_started", null],
    ["2026-10-01", "resolved", "2026-10-01"],
    ["2026-10-14", "resolved", "2026-10-01"],
    ["2026-10-15", "resolved", "2026-10-15"],
    ["2026-10-20", "resolved", "2026-10-20"],
    ["2026-12-31", "resolved", "2026-10-20"],
  ] as const)("resolve %s nos limites exclusivos de cada vigência", (day, status, start) => {
    const historico = [period(), period({ effective_from: "2026-10-15", schedule_kind: "weekly_target", weekly_target: 3 }), period({ effective_from: "2026-10-20", schedule_kind: "weekdays", weekdays: [2, 4] })];
    const result = resolverFrequenciaNoDia({ habito: habit(), historico, day });
    expect(result.status).toBe(status);
    expect(result.period?.effective_from ?? null).toBe(start);
    expect(result).toMatchObject({ version: 1, habit_id: "habit", user_id: "owner", day, started_on: "2026-10-01", baseline_provenance: "supplied_history" });
  });

  it("expõe hábito ainda não iniciado, sem criar atividade, pausa ou marca", () => {
    const result = resolverFrequenciaNoDia({ habito: habit({ started_on: "2027-01-01" }), day: "2026-10-21" });
    expect(result).toMatchObject({ status: "not_started", period: null, baseline_provenance: "legacy_known_frequency" });
    expect(Object.keys(result).sort()).toEqual(["baseline_provenance", "day", "habit_id", "period", "started_on", "status", "user_id", "version"]);
    expect(resolverFrequenciaNoDia({ habito: habit({ started_on: "2027-01-01" }), day: "2027-01-01" }).status).toBe("resolved");
  });

  it.each([1, 7])("aceita a meta semanal limite %i sem criar marcação", target => {
    const result = normalize([period({ schedule_kind: "weekly_target", weekly_target: target })]);
    expect(result.periods[0]).toMatchObject({ schedule_kind: "weekly_target", weekly_target: target, weekdays: [] });
  });

  it("aceita domingo e sábado como limites dos dias específicos", () => {
    expect(normalize([period({ schedule_kind: "weekdays", weekdays: [6, 0] })]).periods[0]!.weekdays).toEqual([0, 6]);
  });

  it.each([
    { label: "null", historico: null }, { label: "vazio", historico: [] },
    { label: "baseline posterior", historico: [period({ effective_from: "2026-10-02" })] },
    { label: "baseline anterior", historico: [period({ effective_from: "2026-09-30" })] },
  ])("recusa histórico presente sem baseline válido: $label", ({ historico }) => {
    expect(() => normalize(unsafeHistory(historico))).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it.each([
    { label: "usuário divergente", rows: [period({ user_id: "other" })] },
    { label: "hábito divergente", rows: [period({ habit_id: "other" })] },
    { label: "baseline duplicado", rows: [period(), period()] },
    { label: "duas mudanças no mesmo dia", rows: [period(), period({ effective_from: "2026-10-15" }), period({ effective_from: "2026-10-15", schedule_kind: "weekly_target", weekly_target: 2 })] },
    { label: "versão desconhecida", rows: [{ ...period(), version: 2 }] },
    { label: "versão como texto", rows: [{ ...period(), version: "1" }] },
    { label: "campo extra de fim", rows: [{ ...period(), effective_until: "2026-10-30" }] },
    { label: "campo obrigatório ausente", rows: [{ version: 1, habit_id: "habit", effective_from: "2026-10-01", schedule_kind: "daily", weekdays: [], weekly_target: null }] },
  ])("recusa $label, inclusive ao consultar antes do início", ({ rows }) => {
    const historico = unsafeHistory(rows);
    expect(() => normalize(historico)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => resolverFrequenciaNoDia({ habito: habit(), historico, day: "2026-09-01" })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it.each(["2026-02-29", "1900-02-29", "2100-02-29", "2026-04-31", "2026-13-01", "2026-10-00", "2026-1-01", " 2026-10-01", "2026-10-01T00:00:00Z", null, 20261001, {}])("recusa dia civil inválido %j", invalid => {
    expect(() => normalizarHistoricoDeFrequencia({ habito: habit({ started_on: invalid as string }) })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => resolverFrequenciaNoDia({ habito: habit(), day: invalid as string })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => normalize([period(), period({ effective_from: invalid as string })])).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it.each(["2000-02-29", "2024-02-29", "0001-01-01", "0099-01-01"])("preserva a data real %s sem normalizar o ano", day => {
    const result = resolverFrequenciaNoDia({ habito: habit({ started_on: day }), day });
    expect(result).toMatchObject({ status: "resolved", period: { effective_from: day, effective_until: null } });
  });

  it.each([
    { schedule_kind: "monthly" }, { weekdays: [1] }, { weekly_target: 1 },
    { schedule_kind: "weekdays", weekdays: [] }, { schedule_kind: "weekdays", weekdays: [1, 1] },
    { schedule_kind: "weekdays", weekdays: [-1] }, { schedule_kind: "weekdays", weekdays: [7] },
    { schedule_kind: "weekdays", weekdays: [1.5] }, { schedule_kind: "weekdays", weekdays: ["1"] },
    { schedule_kind: "weekdays", weekdays: [1], weekly_target: 2 },
    { schedule_kind: "weekly_target", weekly_target: null }, { schedule_kind: "weekly_target", weekly_target: 0 },
    { schedule_kind: "weekly_target", weekly_target: 8 }, { schedule_kind: "weekly_target", weekly_target: 2.5 },
    { schedule_kind: "weekly_target", weekdays: [1], weekly_target: 3 },
  ])("recusa campos incompatíveis de frequência: %j", patch => {
    const invalid = { ...period(), ...patch };
    expect(() => normalize(unsafeHistory([invalid]))).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => normalizarHistoricoDeFrequencia({ habito: { ...habit(), ...patch } as HabitoParaHistorico })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("não modifica nem compartilha arrays com snapshots congelados", () => {
    const days = Object.freeze([5, 1]);
    const first = Object.freeze(period({ schedule_kind: "weekdays", weekdays: days }));
    const supplied = Object.freeze([first]);
    const habito = Object.freeze(habit({ schedule_kind: "weekdays", weekdays: days }));
    const before = JSON.stringify({ habito, supplied });
    const result = normalizarHistoricoDeFrequencia({ habito, historico: supplied });
    expect(result.periods).not.toBe(supplied);
    expect(result.periods[0]).not.toBe(first);
    expect(result.periods[0]!.weekdays).not.toBe(days);
    expect(result.periods[0]!.weekdays).toEqual([1, 5]);
    const resolved = resolverFrequenciaNoDia({ habito, historico: supplied, day: "2026-10-01" });
    expect(resolved.period).not.toBe(first);
    expect(JSON.stringify({ habito, supplied })).toBe(before);
  });

  it("recusa accessors, listas esparsas e campos desconhecidos sem executar getters", () => {
    let reads = 0;
    const accessor = { ...period(), get effective_from() { reads++; return "2026-10-01"; } };
    const days = Object.defineProperty([], "0", { get() { reads++; return 1; }, enumerable: true });
    for (const rows of [[accessor], [period({ schedule_kind: "weekdays", weekdays: days })], new Array(1)]) expect(() => normalize(unsafeHistory(rows))).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(reads).toBe(0);
    expect(() => normalizarHistoricoDeFrequencia({ habito: habit(), unknown: true } as Parameters<typeof normalizarHistoricoDeFrequencia>[0])).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it.each(["", " owner", "owner ", null, 42])("recusa identidade de hábito ou dono inválida: %j", invalid => {
    expect(() => normalizarHistoricoDeFrequencia({ habito: habit({ id: invalid as string }) })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => normalizarHistoricoDeFrequencia({ habito: habit({ user_id: invalid as string }) })).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it.each(["valid", "undefined", "throw"])("recusa getter herdado do envelope sem executar: %s", mode => {
    let reads = 0;
    const prototype = { get historico() { reads++; if (mode === "throw") throw Error("PRIVATE_GETTER"); return mode === "valid" ? [period()] : undefined; } };
    const envelope = Object.assign(Object.create(prototype), { habito: habit() });
    expect(() => normalizarHistoricoDeFrequencia(envelope)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => resolverFrequenciaNoDia(Object.assign(Object.create(prototype), { habito: habit(), day: "2026-09-01" }))).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(reads).toBe(0);
  });

  it("recusa o accessor próprio do envelope sem executar", () => {
    let reads = 0;
    const envelope = { habito: habit(), get historico() { reads++; throw Error("PRIVATE_GETTER"); } };
    expect(() => normalizarHistoricoDeFrequencia(envelope)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(reads).toBe(0);
  });

  it("preserva o contrato em envelopes com protótipo nulo", () => {
    const make = (fields: object) => Object.assign(Object.create(null), fields);
    for (const fields of [{ habito: habit() }, { habito: habit(), historico: undefined }]) {
      expect(normalizarHistoricoDeFrequencia(make(fields)).baseline_provenance).toBe("legacy_known_frequency");
      expect(resolverFrequenciaNoDia(make({ ...fields, day: "2026-09-01" })).status).toBe("not_started");
    }
    expect(normalizarHistoricoDeFrequencia(make({ habito: habit(), historico: [period()] })).baseline_provenance).toBe("supplied_history");
    expect(resolverFrequenciaNoDia(make({ habito: habit(), historico: [period()], day: "2026-10-01" })).status).toBe("resolved");
  });

  it("consome os descritores de dados sem get traps de envelope, hábito, linha ou lista", () => {
    let reads = 0;
    const observe = <T extends object>(value: T): T => new Proxy(value, { get() { reads++; throw Error("PRIVATE_GET"); } });
    const historico = observe([observe(period({ schedule_kind: "weekdays", weekdays: observe([1, 5]) }))]);
    const fields = { habito: observe(habit()), historico };
    expect(normalizarHistoricoDeFrequencia(observe(fields)).periods[0]!.weekdays).toEqual([1, 5]);
    expect(resolverFrequenciaNoDia(observe({ ...fields, day: "2026-10-01" })).status).toBe("resolved");
    expect(reads).toBe(0);
  });
});
