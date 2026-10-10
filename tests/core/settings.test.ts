import { describe, expect, it, vi } from "vitest";
import { applySettings, decodeSettingsCommand, settingsPreferences, validAccountSettings, type AccountSettings } from "../../src/core/configuracoes";
const id = "test-request";
const owner = "10000000-0000-4000-8000-000000000001";
const initialSettings: AccountSettings = { user_id: owner, profile: { display_name: null, email: null, avatar_file_id: null }, preferences: { theme: "system", default_calendar_view: "week", values_hidden: false, meeting_reminders_enabled: true, meeting_reminder_minutes: 10 }, modules: [] };
describe("preferências da conta e seus limites de autoridade", () => {
  it("aceita o snapshot recém-provisionado sem overrides de módulos", () => {
    expect(validAccountSettings(initialSettings, owner)).toBe(true);
    expect(settingsPreferences(initialSettings)).toEqual({});
  });
  it("não transforma a lista vazia de leitura em um comando de escrita válido", () => {
    const command = { command: "settings.modules.update", input: { client_id: id, modules: [] } };
    const port = { load: vi.fn(), commit: vi.fn() };
    expect(() => decodeSettingsCommand(command)).toThrow();
    expect(() => applySettings(port, command)).toThrow();
    expect(port.commit).not.toHaveBeenCalled();
  });
  it("mantém DTOs vazios ou preenchidos fechados ao dono, campos e módulos válidos", () => {
    const row = { module_key: "tarefas", visible: true, sort_order: 0 };
    for (const value of [
      { ...initialSettings, user_id: "other" }, { ...initialSettings, secret: "PRIVATE_CANARY" },
      { ...initialSettings, profile: { ...initialSettings.profile, role: "master" } },
      { ...initialSettings, preferences: { ...initialSettings.preferences, meeting_reminder_minutes: null } },
      { ...initialSettings, modules: null }, { ...initialSettings, modules: [null] },
      { ...initialSettings, modules: [{ ...row, module_key: "unknown" }] }, { ...initialSettings, modules: [row, row] },
      { ...initialSettings, modules: [{ ...row, entitlement: true }] },
      { ...initialSettings, modules: [{ module_key: "inicio", visible: false, sort_order: 0 }] },
    ]) expect(validAccountSettings(value, owner)).toBe(false);
  });
  it.each(["", " ", "a".repeat(121)])("recusa nome vazio ou grande: %s", display_name => expect(() => decodeSettingsCommand({ command: "settings.profile.update", input: { client_id: id, display_name } })).toThrow());
  it.each(["inicio", "capturar", "configuracoes"])("recusa esconder %s", module_key => expect(() => decodeSettingsCommand({ command: "settings.modules.update", input: { client_id: id, modules: [{ module_key, visible: false, sort_order: 1 }] } })).toThrow());
  it.each([
    { role: "master" }, { entitlement: true }, { theme: "pink" }, { values_hidden: "false" }, { meeting_reminder_minutes: 0 }, { meeting_reminder_minutes: 10.5 }, { meeting_reminders_enabled: null }, {},
  ])("recusa preferências fora do contrato: %j", patch => expect(() => decodeSettingsCommand({ command: "settings.preferences.update", input: { client_id: id, patch } })).toThrow());
  it("não entrega comandos inválidos à persistência e não aceita dono vindo do formulário", async () => {
    const port = { load: vi.fn(), commit: vi.fn() };
    expect(() => applySettings(port, { command: "settings.profile.update", input: { client_id: id, display_name: "Nome", user_id: "other" } })).toThrow();
    expect(port.commit).not.toHaveBeenCalled();
  });
  it("preserva o DTO exato para idempotência e não converte ordem em entitlement", () => {
    const request = { command: "settings.modules.update", input: { client_id: id, modules: [{ module_key: "tarefas", visible: false, sort_order: 10 }] } };
    expect(decodeSettingsCommand(request)).toEqual(request);
    expect(settingsPreferences({ modules: request.input.modules } as AccountSettings)).toEqual({ tarefas: { visible: false, order: 10 } });
  });
  it("recusa módulos repetidos e limites de ordenação", () => {
    for (const modules of [[{ module_key: "tarefas", visible: true, sort_order: -1 }], [{ module_key: "tarefas", visible: true, sort_order: 1001 }], Array(2).fill({ module_key: "tarefas", visible: true, sort_order: 0 })]) expect(() => decodeSettingsCommand({ command: "settings.modules.update", input: { client_id: id, modules } })).toThrow();
  });
});
