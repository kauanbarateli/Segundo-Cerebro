"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { settingsPreferences, validAccountSettings, type AccountSettings } from "@/core/configuracoes";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";
import { useTheme } from "@/components/theme/theme-provider";
import { InstallHelp } from "@/components/pwa/install-help";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/data-display";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { fileReadUrl, uploadFile } from "@/components/layout/file-upload";
import { HomeImageSettings } from "./home-image-settings";
import { OwnSessionsSection } from "./own-sessions-section";
import { createOwnSessionsReader } from "./own-sessions-reader";
import { SettingsLegalSection } from "./settings-legal-section";
import { SettingsFocusSection } from "./settings-focus-section";
import "./settings.css";

export function SettingsConnectedWorkspace() {
  const router = useRouter();
  const app = useDemoApplication(), { policy, applyAccountPreferences } = useDemoAccess(), theme = useTheme();
  const readSessions = useMemo(() => createOwnSessionsReader(app.userId), [app.userId]);
  const [data, setData] = useState<AccountSettings | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [name, setName] = useState(""), [preferences, setPreferences] = useState<AccountSettings["preferences"] | null>(null), [modules, setModules] = useState<AccountSettings["modules"]>([]);
  const adopt = useCallback((value: AccountSettings) => {
    if (value.user_id !== app.userId) throw new Error("A conta mudou. Recarregue a página.");
    setData(value); setName(value.profile.display_name ?? ""); setPreferences(value.preferences);
    setModules(WORKSPACE_ROUTES.filter(route => resolveAccess(route.feature, policy).allowed).map((route, index) => value.modules.find(row => row.module_key === route.feature) ?? { module_key: route.feature, visible: true, sort_order: index * 10 }).sort((a, b) => a.sort_order - b.sort_order || a.module_key.localeCompare(b.module_key)));
    applyAccountPreferences(settingsPreferences(value)); theme.setPreference(value.preferences.theme);
  }, [app.userId, policy, applyAccountPreferences, theme]);
  // Avoid a read loop when presentation preferences are adopted.
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { const reply = await fetch("/api/settings", { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": app.userId }, signal }); const value: unknown = await reply.json();
      if (!reply.ok || !validAccountSettings(value, app.userId)) throw new Error("Não foi possível carregar suas configurações. Tente novamente.");
      return value;
    } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível carregar."); return null; } finally { if (!signal?.aborted) setLoading(false); }
  }, [app.userId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).then(value => { if (value && !controller.signal.aborted) { setData(value); setName(value.profile.display_name ?? ""); setPreferences(value.preferences); } }); return () => controller.abort(); }, [load]);
  useEffect(() => { if (data && !modules.length) setModules(WORKSPACE_ROUTES.filter(route => resolveAccess(route.feature, policy).allowed).map((route, index) => data.modules.find(row => row.module_key === route.feature) ?? { module_key: route.feature, visible: true, sort_order: index * 10 }).sort((a, b) => a.sort_order - b.sort_order)); }, [data, modules.length, policy]);
  async function save(command: string, input: Record<string, unknown>) {
    setSaving(true); setMessage(""); setError("");
    try { const value = await app.executeDomainCommand(command, { ...input, client_id: crypto.randomUUID() }); adopt(value as AccountSettings); setMessage("Configurações salvas na sua conta."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Confirme o envio pendente."); } finally { setSaving(false); }
  }
  async function avatar(file: File | null) {
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const uploaded = file ? await uploadFile({ file, kind: "avatar", userId: app.userId, storageOrigin: app.storageOrigin, sender: app.executeDomainCommand }) : null;
      await app.executeDomainCommand(uploaded ? "avatar.set" : "avatar.remove", { ...(uploaded ? { file_id: uploaded.id } : {}), client_id: crypto.randomUUID() });
      const value = await load(); if (value) adopt(value);
      router.refresh(); setMessage(uploaded ? "Foto da conta atualizada." : "Foto da conta removida.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível atualizar a foto. Confirme o envio pendente."); }
    finally { setSaving(false); }
  }
  function move(feature: FeatureKey, offset: number) { const next = [...modules], index = next.findIndex(row => row.module_key === feature), to = index + offset; if (to < 0 || to >= next.length) return; [next[index], next[to]] = [next[to]!, next[index]!]; setModules(next.map((row, order) => ({ ...row, sort_order: order * 10 }))); }
  if (loading && !data) return <div className="settings-workspace"><p role="status" className="settings-loading">Carregando suas configurações…</p><SettingsLegalSection /></div>;
  if (!data || !preferences) return <div className="settings-workspace"><div className="settings-panel settings-error"><p role="alert">{error}</p><Button onClick={() => void load().then(value => { if (value) adopt(value); })}>Tentar novamente</Button></div><SettingsLegalSection /></div>;
  const initial = (data.profile.display_name ?? data.profile.email ?? "?").trim().slice(0, 1).toUpperCase() || "?";
  return <div className="settings-workspace" data-access="allowed">
    <p className="settings-intro">Ajuste o Segundo Cérebro ao seu jeito de organizar a vida. Cada seção salva na sua conta.</p>
    <nav className="settings-links" aria-label="Nesta página"><a href="#perfil">Perfil</a><a href="#sessoes">Sessões</a><a href="#aparencia">Aparência</a><a href="#modulos">Módulos</a><a href="#lembretes">Lembretes</a><a href="#dados">Meus dados</a><a href="#privacidade-e-termos">Privacidade e termos</a></nav>
    {error && <p role="alert" className="settings-alert">{error}</p>}<p role="status" className="settings-feedback">{message}</p>
    <section id="perfil" className="settings-panel settings-panel--collapsible"><Collapsible defaultOpen title="Perfil">
      <div className="settings-profile">{data.profile.avatar_file_id
        // Private same-origin authorization precedes the short-lived Storage redirect.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="settings-avatar-photo" src={fileReadUrl(data.profile.avatar_file_id, app.userId)} alt="Foto da sua conta" width={58} height={58} />
        : <span className="settings-avatar" aria-hidden="true">{initial}</span>}
        <div><strong>{data.profile.display_name || "Nome não definido"}</strong><p>{data.profile.email}</p></div></div>
      <div className="settings-avatar-actions">
        <label className="settings-avatar-upload">Escolher foto · PNG ou JPEG
          {/* Native file input needs the browser capability; a visible label names it. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input type="file" accept="image/png,image/jpeg" disabled={saving} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void avatar(file); }} />
        </label>
        {data.profile.avatar_file_id && <Button variant="ghost" disabled={saving} onClick={() => void avatar(null)}>Remover foto</Button>}
      </div>
      <form className="settings-inline-form" onSubmit={event => { event.preventDefault(); void save("settings.profile.update", { display_name: name }); }}><Field label="Nome" value={name} maxLength={120} required onChange={event => setName(event.target.value)} /><Button type="submit" variant="primary" loading={saving}>Salvar nome</Button></form>
      <SettingsFocusSection key={app.userId} userId={app.userId} />
    </Collapsible></section>
    <OwnSessionsSection scopeKey={app.userId} read={readSessions} />
    <section id="aparencia" className="settings-panel settings-panel--collapsible"><Collapsible defaultOpen title="Aparência">
      <p className="settings-text">O tema da conta vale para todos os aparelhos ao entrar. O controle do topo muda apenas este navegador até você salvar.</p>
      <div className="settings-form-grid"><Field as="select" label="Tema da conta" value={preferences.theme} onChange={event => setPreferences({ ...preferences, theme: event.target.value as AccountSettings["preferences"]["theme"] })}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></Field></div>
      <div className="settings-toggle-row"><Switch label="Ocultar valores financeiros ao entrar" checked={preferences.values_hidden} onCheckedChange={values_hidden => setPreferences({ ...preferences, values_hidden })} /></div>
      <Button variant="primary" loading={saving} onClick={() => void save("settings.preferences.update", { patch: { theme: preferences.theme, values_hidden: preferences.values_hidden } })}>Salvar aparência</Button>
      <HomeImageSettings />
    </Collapsible></section>
    <section id="modulos" className="settings-panel settings-panel--collapsible"><Collapsible defaultOpen title="Módulos"><p className="settings-text">Escolha o que aparece e a ordem da navegação. Início, Capturar e Configurações ficam sempre disponíveis.</p>
      <ol className="settings-module-list">{modules.map((row, index) => { const label = WORKSPACE_ROUTES.find(route => route.feature === row.module_key)?.label ?? row.module_key; return <li key={row.module_key}><Switch label={label} checked={row.visible} disabled={["inicio", "capturar", "configuracoes"].includes(row.module_key)} onCheckedChange={visible => setModules(modules.map(item => item.module_key === row.module_key ? { ...item, visible } : item))} /><div><Button variant="ghost" disabled={index === 0} aria-label={`Subir ${label}`} onClick={() => move(row.module_key, -1)}>Subir</Button><Button variant="ghost" disabled={index === modules.length - 1} aria-label={`Descer ${label}`} onClick={() => move(row.module_key, 1)}>Descer</Button></div></li>; })}</ol>
      <Button variant="primary" loading={saving} onClick={() => void save("settings.modules.update", { modules })}>Salvar módulos</Button>
    </Collapsible></section>
    <section id="lembretes" className="settings-panel settings-panel--collapsible"><Collapsible defaultOpen title="Calendário e lembretes">
      <div className="settings-toggle-row"><Switch label="Lembrar de reuniões no aplicativo" checked={preferences.meeting_reminders_enabled} onCheckedChange={meeting_reminders_enabled => setPreferences({ ...preferences, meeting_reminders_enabled })} /></div>
      <div className="settings-form-grid"><Field as="select" label="Visão inicial" value={preferences.default_calendar_view} onChange={event => setPreferences({ ...preferences, default_calendar_view: event.target.value as "day" | "week" | "month" | "list" })}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="list">Lista</option></Field>
        <Field as="select" label="Antecedência" value={preferences.meeting_reminder_minutes} onChange={event => setPreferences({ ...preferences, meeting_reminder_minutes: Number(event.target.value) })}>{[5, 10, 15, 30].map(minutes => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</Field></div>
      <Button variant="primary" loading={saving} onClick={() => void save("settings.preferences.update", { patch: { default_calendar_view: preferences.default_calendar_view, meeting_reminders_enabled: preferences.meeting_reminders_enabled, meeting_reminder_minutes: preferences.meeting_reminder_minutes } })}>Salvar lembretes</Button>
    </Collapsible></section>
    <section id="dados" className="settings-panel settings-panel--collapsible"><Collapsible defaultOpen title="Meus dados"><p className="settings-text">Seus registros pertencem à sua conta. A administração acompanha contas e ações administrativas; conteúdos pessoais permanecem isolados.</p><p className="settings-text">Exportação de dados e notificações push ficam para a fase 2.</p></Collapsible></section>
    <SettingsLegalSection />
    <section className="settings-panel" aria-label="Instalação do aplicativo"><InstallHelp /></section>
  </div>;
}
