"use client";

import Link from "next/link";
import { useMemo } from "react";
import { resolveAccess } from "@/core/access/resolve-access";
import { defaultWindow } from "@/core/calendario";
import { somarDias } from "@/core/habitos/habits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { useDemoApplication, useDemoQuery } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { CalendarAccounts } from "./calendar-accounts";
import { dateWithYear, sourceTones } from "./calendar-projections";
import { useCalendarCommands } from "./use-calendar-commands";
import "./calendar.css";

/** Integrações composes the Calendar's own account management: the same
 * `agenda` query, commands and OAuth start. No second account state exists.
 * The Calendar entitlement still governs every calendar read and command. */
export function CalendarIntegrations() {
  const app = useDemoApplication(), { policy } = useDemoAccess();
  const calendarAccess = resolveAccess("calendario", policy).allowed, connected = app.mode === "connected";
  const query = useDemoQuery("agenda", calendarAccess);
  const commands = useCalendarCommands();
  const calendars = useMemo(() => query.data?.calendars ?? [], [query.data?.calendars]);
  const tones = useMemo(() => sourceTones(calendars), [calendars]);
  const syncWindow = query.data?.window ?? defaultWindow(app.today());
  return <div className="calendar-integrations" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="calendar-integrations-toolbar">
      <p>Seu tempo em um só lugar, com as fontes que importam.</p>
      {calendarAccess && <Link className="calendar-button-link" href="/calendario">Abrir calendário<Icons.ChevronRight width={18} height={18} /></Link>}
    </div>
    <div className="calendar-integrations-notice">
      <strong>{connected ? "Somente leitura" : "Demonstração sem contas externas"}</strong>
      <p>{connected ? "O Segundo Cérebro lê os calendários escolhidos de até duas contas Google. Não cria, altera nem remove compromissos no Google."
        : "Esta demonstração não solicita acesso ao Google nem envia dados. Ao entrar com a sua conta, você pode conectar até duas contas Google em modo somente leitura."}</p>
    </div>
    {!calendarAccess ? <Card className="calendar-integrations-state" data-state="denied">
      <h2>Calendário indisponível para esta conta</h2>
      <p>As contas Google e os calendários conectados dependem do módulo Calendário. Enquanto ele não estiver liberado, nenhum dado da agenda é exibido aqui.</p>
    </Card> : query.status === "error" ? <Card className="calendar-integrations-state" data-state="error">
      <h2>Não foi possível carregar as conexões</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button>
    </Card> : !query.data ? <div className="calendar-integrations-skeleton" role="status" aria-label="Carregando conexões"><i /><i /></div>
      : connected ? <>
        {commands.feedback && <p role="status" className="calendar-feedback">{commands.feedback}</p>}
        <CalendarAccounts agenda={query.data} commands={commands} tones={tones} layout="integrations"
          sync={{ window: syncWindow, caption: "Sincronizar busca novamente o período já guardado: de " + dateWithYear(syncWindow.start_day) + " a " + dateWithYear(somarDias(syncWindow.end_day, -1)) + "." }} />
      </> : <section className="calendar-connections calendar-connections--integrations" aria-labelledby="calendar-demo-title">
        <div className="calendar-connections-heading"><div className="calendar-google-heading">
          <span className="calendar-google-mark" aria-hidden="true"><Icons.Google /></span>
          <div><h2 id="calendar-demo-title">Google Calendar</h2><p>Nenhuma conta conectada nesta demonstração</p></div>
        </div></div>
        <div className="calendar-demo-sources">
          <h3>Calendários de exemplo</h3>
          {calendars.length ? <ul>{calendars.map(source => <li key={source.id} data-tone={tones.get(source.id)}><span className="calendar-source-dot" aria-hidden="true" />{source.name}</li>)}</ul>
            : <p>Nenhum calendário de exemplo nesta demonstração.</p>}
          <p>Os compromissos fictícios aparecem no Calendário e no Início. A escolha de calendários e a sincronização ficam disponíveis com uma conta Google conectada.</p>
        </div>
      </section>}
    <p className="calendar-integrations-footnote">Desmarcar um calendário remove seus compromissos do Calendário, do Início e dos lembretes. Criar ou alterar eventos no Google não faz parte deste fluxo.</p>
  </div>;
}
