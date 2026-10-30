import { describe, expect, it } from "vitest";
import type { AccountSettings } from "../../src/core/configuracoes";
import { reconcilePreferenceDraft } from "../../src/components/features/configuracoes/preference-draft";
const baseline: AccountSettings["preferences"] = { theme: "light", values_hidden: false, default_calendar_view: "week", meeting_reminders_enabled: true, meeting_reminder_minutes: 10 };

describe("rascunhos independentes de Aparência e Preferências", () => {
  it.each(["appearance-first", "preferences-first"] as const)("salva em %s sem apagar a outra seção", order => {
    let saved: AccountSettings["preferences"] = { ...baseline }, draft: AccountSettings["preferences"] = { ...baseline, theme: "dark", values_hidden: true, meeting_reminder_minutes: 15 };
    const appearance = { theme: "dark" as const }, preferences = { values_hidden: true, meeting_reminder_minutes: 15 };
    for (const patch of order === "appearance-first" ? [appearance, preferences] : [preferences, appearance]) {
      const confirmed = { ...saved, ...patch };
      draft = reconcilePreferenceDraft(saved, draft, confirmed, patch);
      saved = confirmed;
      expect(draft).toEqual({ ...baseline, theme: "dark", values_hidden: true, meeting_reminder_minutes: 15 });
    }
    expect(saved).toEqual(draft);
  });
  it("preserva edição posterior ao clique e adota campos realmente não alterados", () => {
    const draft = { ...baseline, theme: "system" as const, values_hidden: true };
    const server = { ...baseline, theme: "dark" as const, default_calendar_view: "month" as const };
    expect(reconcilePreferenceDraft(baseline, draft, server, { theme: "dark" })).toEqual({ ...server, theme: "system", values_hidden: true });
    expect(baseline.theme).toBe("light"); expect(draft.theme).toBe("system");
  });
  it("uma resposta de Perfil/Avatar/Módulos também preserva o rascunho das duas seções", () => {
    const draft = { ...baseline, theme: "dark" as const, values_hidden: true };
    expect(reconcilePreferenceDraft(baseline, draft, baseline)).toEqual(draft);
  });
});
