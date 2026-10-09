"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess, type FeatureKey } from "@/core/access/resolve-access";
import { settingsPreferences, validAccountSettings, type AccountSettings } from "@/core/configuracoes";
import { WORKSPACE_ROUTES } from "@/lib/navigation/routes";
import { useTheme } from "@/components/theme/theme-provider";
import { InstallHelp } from "@/components/pwa/install-help";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/data-display";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { fileReadUrl, uploadFile } from "@/components/layout/file-upload";
import "./settings.css";

export function SettingsConnectedWorkspace() {
  const router = useRouter();
  const app = useDemoApplication(), { policy, applyAccountPreferences } = useDemoAccess(), theme = useTheme();
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
      const uploaded = file ? await uploadFile({ file, kind: "avatar", userId: app.userId, sender: app.executeDomainCommand }) : null;
      await app.executeDomainCommand(uploaded ? "avatar.set" : "avatar.remove", { ...(uploaded ? { file_id: uploaded.id } : {}), client_id: crypto.randomUUID() });
      const value = await load(); if (value) adopt(value);
      router.refresh(); setMessage(uploaded ? "Foto da conta atualizada." : "Foto da conta removida.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível atualizar a foto. Confirme o envio pendente."); }
    finally { setSaving(false); }
  }
  function move(feature: FeatureKey, offset: number) { const next = [...modules], index = next.findIndex(row => row.module_key === feature), to = index + offset; if (to < 0 || to >= next.length) return; [next[index], next[to]] = [next[to]!, next[index]!]; setModules(next.map((row, order) => ({ ...row, sort_order: order * 10 }))); }
  if (loading && !data) return <p role="status">Carregando suas configurações…</p>;
  if (!data || !preferences) return <div><p role="alert">{error}</p><Button onClick={() => void load().then(value => { if (value) adopt(value); })}>Tentar novamente</Button></div>;
  return <div className="settings-workspace" data-access="allowed">
    <nav className="settings-links" aria-label="Nesta página"><a href="#perfil">Perfil</a><a href="#aparencia">Aparência</a><a href="#modulos">Módulos</a><a href="#lembretes">Lembretes</a><a href="#dados">Meus dados</a></nav>
    {error && <p role="alert">{error}</p>}<p role="status">{message}</p>
    <section id="perfil" className="settings-section"><Card className="settings-card"><Collapsible defaultOpen title="Perfil"><p>{data.profile.email}</p>
      {data.profile.avatar_file_id && <div className="settings-account-avatar">
        {/* Private same-origin authorization precedes the short-lived Storage redirect. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileReadUrl(data.profile.avatar_file_id, app.userId)} alt="Foto da sua conta" width={80} height={80} />
        <Button variant="ghost" disabled={saving} onClick={() => void avatar(null)}>Remover foto</Button>
      </div>}
      <label className="settings-avatar-upload">Escolher foto · PNG ou JPEG
        {/* Native file input needs the browser capability; a visible label names it. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input type="file" accept="image/png,image/jpeg" disabled={saving} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void avatar(file); }} />
      </label>
      <form onSubmit={event => { event.preventDefault(); void save("settings.profile.update", { display_name: name }); }}><Field label="Nome" value={name} maxLength={120} required onChange={event => setName(event.target.value)} /><Button type="submit" loading={saving}>Salvar nome</Button></form>
      <Link className="settings-link" href="/trocar-senha">Trocar senha</Link><p>A troca exige a senha atual e encerra as outras sessões.</p>
    </Collapsible></Card></section>
    <section id="aparencia" className="settings-section"><Card className="settings-card"><Collapsible defaultOpen title="Aparência">
      <Field as="select" label="Tema da conta" value={preferences.theme} onChange={event => setPreferences({ ...preferences, theme: event.target.value as AccountSettings["preferences"]["theme"] })}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></Field>
      <Switch label="Ocultar valores financeiros ao entrar" checked={preferences.values_hidden} onCheckedChange={values_hidden => setPreferences({ ...preferences, values_hidden })} />
      <Button loading={saving} onClick={() => void save("settings.preferences.update", { patch: { theme: preferences.theme, values_hidden: preferences.values_hidden } })}>Salvar aparência</Button>
    </Collapsible></Card></section>
    <section id="modulos" className="settings-section"><Card className="settings-card"><Collapsible defaultOpen title="Módulos"><p>Escolha o que aparece e a ordem da navegação.</p>
      <ol className="settings-module-list">{modules.map((row, index) => <li key={row.module_key}><Switch label={WORKSPACE_ROUTES.find(route => route.feature === row.module_key)?.label ?? row.module_key} checked={row.visible} disabled={["inicio", "capturar", "configuracoes"].includes(row.module_key)} onCheckedChange={visible => setModules(modules.map(item => item.module_key === row.module_key ? { ...item, visible } : item))} /><div><Button variant="ghost" disabled={index === 0} aria-label={`Subir ${row.module_key}`} onClick={() => move(row.module_key, -1)}>Subir</Button><Button variant="ghost" disabled={index === modules.length - 1} aria-label={`Descer ${row.module_key}`} onClick={() => move(row.module_key, 1)}>Descer</Button></div></li>)}</ol>
      <Button loading={saving} onClick={() => void save("settings.modules.update", { modules })}>Salvar módulos</Button>
    </Collapsible></Card></section>
    <section id="lembretes" className="settings-section"><Card className="settings-card"><Collapsible defaultOpen title="Calendário e lembretes">
      <Field as="select" label="Visão inicial" value={preferences.default_calendar_view} onChange={event => setPreferences({ ...preferences, default_calendar_view: event.target.value as "day" | "week" | "month" })}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></Field>
      <Switch label="Lembrar de reuniões no aplicativo" checked={preferences.meeting_reminders_enabled} onCheckedChange={meeting_reminders_enabled => setPreferences({ ...preferences, meeting_reminders_enabled })} />
      <Field as="select" label="Antecedência" value={preferences.meeting_reminder_minutes} onChange={event => setPreferences({ ...preferences, meeting_reminder_minutes: Number(event.target.value) })}>{[5, 10, 15, 30].map(minutes => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</Field>
      <Button loading={saving} onClick={() => void save("settings.preferences.update", { patch: { default_calendar_view: preferences.default_calendar_view, meeting_reminders_enabled: preferences.meeting_reminders_enabled, meeting_reminder_minutes: preferences.meeting_reminder_minutes } })}>Salvar lembretes</Button>
    </Collapsible></Card></section>
    <section id="dados" className="settings-section"><Card className="settings-card"><Collapsible defaultOpen title="Meus dados"><p>Seus registros pertencem à sua conta. A administração acompanha contas e ações administrativas; conteúdos pessoais permanecem isolados.</p><p>Exportação de dados está prevista para a fase 2. Notificações push também ficam para essa fase.</p></Collapsible></Card></section>
    <InstallHelp />
  </div>;
}
