(function () {
  'use strict';
  const A = window.App;
  const TODAY = '2026-10-17';
  const SOURCES = { work: { name: 'Trabalho', color: 'work', account: 'Conta de trabalho' }, personal: { name: 'Pessoal', color: 'personal', account: 'Conta pessoal' }, study: { name: 'Estudos', color: 'study', account: 'Conta pessoal' } };
  const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const HOUR_HEIGHT = 80;
  const esc = value => A.esc(String(value == null ? '' : value));
  const icon = (name, size) => A.icon(name, size || 18);
  const date = value => new Date(value + 'T12:00:00Z');
  const key = value => value.toISOString().slice(0, 10);
  const add = (value, n) => { const d = date(value); d.setUTCDate(d.getUTCDate() + n); return key(d); };
  const fmt = (value, options) => new Intl.DateTimeFormat('pt-BR', Object.assign({ timeZone: 'UTC' }, options)).format(date(value));
  const monthStart = value => value.slice(0, 7) + '-01';
  const shiftMonth = (value, amount) => { const d = date(monthStart(value)); d.setUTCMonth(d.getUTCMonth() + amount); return key(d); };
  const monday = value => add(value, -((date(value).getUTCDay() + 6) % 7));
  const minutes = value => { const p = String(value || '00:00').split(':').map(Number); return p[0] * 60 + p[1]; };
  const source = event => SOURCES[event.source] || SOURCES.personal;
  const eventDateEnd = event => event.endDate || (event.allDay ? add(event.date, 1) : event.date);
  const accounts = () => A.state.googleAccounts || [{ id: 'google-demo-1', name: 'Conta pessoal', sources: ['personal', 'study'] }, { id: 'google-demo-2', name: 'Conta de trabalho', sources: ['work'] }];
  const availableSources = () => Object.entries(SOURCES).filter(([id]) => accounts().some(account => account.sources.includes(id)));
  function settings() {
    if (!A.ui.calendarDate) A.ui.calendarDate = TODAY;
    if (!A.ui.calendarView) A.ui.calendarView = A.state.settings && A.state.settings.calendarView || 'list';
    if (!A.ui.calendarMiniDate) A.ui.calendarMiniDate = monthStart(A.ui.calendarDate);
    if (!A.state.calendarSources) A.state.calendarSources = { work: true, personal: true, study: true };
    return { day: A.ui.calendarDate, view: A.ui.calendarView };
  }
  function visibleEvents() { const available = availableSources().map(([id]) => id); return (A.state.events || []).filter(event => available.includes(event.source) && A.state.calendarSources[event.source] !== false); }
  function onDay(event, day) {
    const end = eventDateEnd(event);
    if (event.allDay) return event.date <= day && end > day;
    return event.date <= day && (end > day || (end === day && minutes(event.end) > 0));
  }
  function dayEvents(day) { return visibleEvents().filter(event => onDay(event, day)).sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || String(a.start || '').localeCompare(String(b.start || ''))); }
  function daysFor(day, view) {
    const first = view === 'day' ? day : view === 'week' ? monday(day) : monday(monthStart(day));
    return Array.from({ length: view === 'day' ? 1 : view === 'week' ? 7 : 42 }, (_, index) => add(first, index));
  }
  function periodTitle(day, view) {
    if (view === 'day') return fmt(day, { day: 'numeric', month: 'long' });
    if (view === 'week') {
      const first = monday(day), last = add(first, 6);
      return first.slice(0, 7) === last.slice(0, 7) ? Number(first.slice(-2)) + '–' + fmt(last, { day: 'numeric', month: 'long' }) : fmt(first, { day: 'numeric', month: 'short' }) + ' – ' + fmt(last, { day: 'numeric', month: 'short' });
    }
    return fmt(day, { month: 'long' });
  }
  function weekNumber(value) { const d = date(value); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7); }
  function eventTime(event, day) {
    if (event.allDay) return 'Dia inteiro';
    if (day && day > event.date) return day < eventDateEnd(event) ? 'Continua neste dia' : 'Continua · até ' + event.end;
    if (day && day < eventDateEnd(event)) return event.start + ' · continua no dia seguinte';
    return (event.start || '') + ' – ' + (event.end || '');
  }
  const eventNote = event => (A.state.notes || []).find(note => note.id === event.noteId && !note.deleted);
  function eventContext(event) {
    const note = eventNote(event);
    return String(event.description || (note && note.body) || '').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
  }
  function durationLabel(event) {
    if (event.allDay) {
      const count = Math.max(1, Math.round((date(eventDateEnd(event)) - date(event.date)) / 86400000));
      return count === 1 ? 'Dia inteiro' : count + ' dias';
    }
    const count = Math.max(0, Math.round((date(eventDateEnd(event)) - date(event.date)) / 86400000) * 1440 + minutes(event.end) - minutes(event.start));
    const hours = Math.floor(count / 60), remainder = count % 60;
    return [hours ? hours + 'h' : '', remainder ? remainder + ' min' : ''].filter(Boolean).join(' ');
  }
  function selectedAppointment(day, events) {
    if (A.ui.calendarAgendaDate !== day || (A.ui.calendarAgendaId && !events.some(event => event.id === A.ui.calendarAgendaId))) {
      A.ui.calendarAgendaDate = day;
      const initial = events.find(event => eventContext(event)) || events[0];
      A.ui.calendarAgendaId = initial ? initial.id : null;
    }
    return A.ui.calendarAgendaId;
  }
  function weekStrip(day) {
    return `<div class="cal-week-strip" data-cal-strip role="group" aria-label="Selecionar dia da semana">${daysFor(day, 'week').map(value => {
      const count = dayEvents(value).length;
      return `<button class="cal-strip-day ${value === day ? 'is-selected' : ''} ${value === TODAY ? 'is-today' : ''}" data-action="cal-select-date" data-context="week-strip" data-date="${value}" aria-pressed="${value === day}" ${value === TODAY ? 'aria-current="date"' : ''} aria-label="${esc(fmt(value, { dateStyle: 'full' }) + ', ' + count + (count === 1 ? ' compromisso' : ' compromissos'))}"><span>${esc(fmt(value, { weekday: 'short' }).replace('.', ''))}</span><strong>${Number(value.slice(-2))}</strong><i class="${count ? 'has-events' : ''}" aria-hidden="true"></i></button>`;
    }).join('')}</div>`;
  }
  function monthPicker(day) {
    return `<div class="cal-month-picker" data-cal-strip role="region" aria-label="Selecionar dia do mês"><div class="cal-month-picker-grid">${WEEKDAYS.map(value => `<span class="cal-picker-weekday">${value}</span>`).join('')}${daysFor(day, 'month').map(value => {
      const count = dayEvents(value).length;
      return `<button class="cal-month-picker-date ${value.slice(0, 7) !== day.slice(0, 7) ? 'outside' : ''} ${value === day ? 'is-selected' : ''} ${value === TODAY ? 'is-today' : ''}" data-action="cal-select-date" data-context="month-picker" data-date="${value}" aria-pressed="${value === day}" ${value === TODAY ? 'aria-current="date"' : ''} aria-label="${esc(fmt(value, { dateStyle: 'full' }) + ', ' + count + (count === 1 ? ' compromisso' : ' compromissos'))}"><span>${Number(value.slice(-2))}</span><i class="${count ? 'has-events' : ''}" aria-hidden="true"></i></button>`;
    }).join('')}</div></div>`;
  }
  function dayAgenda(day, context) {
    const events = dayEvents(day), selected = selectedAppointment(day, events);
    const dateLabel = (day === TODAY ? 'Hoje, ' : '') + fmt(day, { weekday: 'long', day: 'numeric', month: 'long' });
    return `<section class="cal-linear-agenda" aria-label="Agenda de ${esc(fmt(day, { dateStyle: 'full' }))}"><header class="cal-linear-heading"><h3>${esc(dateLabel)}</h3><span>${events.length} ${events.length === 1 ? 'compromisso' : 'compromissos'}</span></header>${events.length ? `<div class="cal-linear-events">${events.map((event, index) => {
      const expanded = selected === event.id, note = eventNote(event), detail = eventContext(event);
      const panelId = 'cal-context-' + context + '-' + index;
      const starts = day > event.date ? '00:00' : event.start;
      const ends = day < eventDateEnd(event) ? '24:00' : event.end;
      return `<article class="cal-linear-row ${expanded ? 'is-selected' : ''}"><div class="cal-linear-time">${event.allDay ? '<span>Dia<br>inteiro</span>' : `<time datetime="${esc(day + 'T' + starts)}">${esc(starts)}</time><span>${esc(ends)}</span>`}${!event.allDay && day > event.date ? '<small>continua</small>' : ''}</div><div class="cal-appointment ${expanded ? 'is-expanded' : ''}"><button class="cal-appointment-toggle" data-action="cal-select-event" data-id="${esc(event.id)}" data-date="${day}" data-context="${context}" aria-expanded="${expanded}" aria-controls="${panelId}"><span class="cal-appointment-title">${esc(event.title)}</span><span class="cal-appointment-meta"><span class="cal-appointment-source cal-${source(event).color}"><i aria-hidden="true"></i>${source(event).name}</span>${durationLabel(event) ? '<span aria-hidden="true">·</span><span>' + esc(durationLabel(event)) + '</span>' : ''}${note ? icon('file-text', 14) + '<span class="sr-only">Nota vinculada</span>' : ''}</span>${A.calendarPeople?.stack(event) || ''}<span class="cal-appointment-chevron" aria-hidden="true">${icon('chevron-down', 16)}</span></button><div id="${panelId}" class="cal-appointment-context" ${expanded ? '' : 'hidden'}>${detail ? `<p class="cal-context-preview">${esc(detail)}</p>` : ''}${event.location ? `<p class="cal-appointment-location">${icon('map-pin', 14)}<span>${esc(event.location)}</span></p>` : ''}${event.allDay && eventDateEnd(event) > add(event.date, 1) ? `<p class="cal-appointment-range">${esc(fmt(event.date, { day: 'numeric', month: 'short' }) + ' – ' + fmt(add(eventDateEnd(event), -1), { day: 'numeric', month: 'short' }))}</p>` : ''}<div class="cal-context-actions"><button data-action="cal-event" data-id="${esc(event.id)}" data-context="${context}">Ver detalhes${icon('arrow-up-right', 15)}</button><button data-action="cal-note" data-id="${esc(event.id)}" data-context="${context}">${icon('file-text', 15)}${note ? 'Abrir nota' : 'Criar nota'}</button></div></div></div></article>`;
    }).join('')}</div>` : '<div class="cal-day-empty"><h4>Nada agendado para este dia</h4><p>Escolha outro dia ou confira os calendários visíveis.</p><button class="button" data-action="cal-sources">Revisar calendários</button></div>'}</section>`;
  }
  function revealSelectedDate() {
    // Move only the native horizontal scroller, without stealing route focus or page position.
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.calendar-workspace [data-cal-strip]').forEach(strip => {
      const selected = strip.querySelector('[aria-pressed="true"]');
      if (!selected || !strip.clientWidth) return;
      const outer = strip.getBoundingClientRect(), inner = selected.getBoundingClientRect();
      if (inner.left < outer.left || inner.right > outer.right) strip.scrollLeft += inner.left - outer.left - (strip.clientWidth - inner.width) / 2;
    });
  }
  function miniCalendar() {
    const current = A.ui.calendarMiniDate;
    const weekStart = monday(A.ui.calendarDate), weekEnd = add(weekStart, 6);
    return `<section class="cal-mini" aria-label="Selecionar data"><div class="cal-mini-heading"><strong>${esc(fmt(current, { month: 'long', year: 'numeric' }))}</strong><div><button class="icon-button" data-action="cal-mini-shift" data-direction="-1" aria-label="Mês anterior no seletor">${icon('chevron-left', 16)}</button><button class="icon-button" data-action="cal-mini-shift" data-direction="1" aria-label="Próximo mês no seletor">${icon('chevron-right', 16)}</button></div></div><div class="cal-mini-grid">${WEEKDAYS.map(day => `<span class="cal-mini-weekday">${day.slice(0, 1)}</span>`).join('')}${daysFor(current, 'month').map(day => `<button class="cal-mini-date ${day.slice(0, 7) !== current.slice(0, 7) ? 'outside' : ''} ${A.ui.calendarView === 'week' && day >= weekStart && day <= weekEnd ? 'in-week' : ''} ${day === TODAY ? 'is-today' : ''} ${day === A.ui.calendarDate ? 'is-selected' : ''}" data-action="cal-select-date" data-date="${day}" aria-label="${esc(fmt(day, { dateStyle: 'full' }))}" ${day === A.ui.calendarDate ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${Number(day.slice(-2))}${visibleEvents().some(event => onDay(event, day)) ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div></section>`;
  }
  function sourceButtons(context) {
    return availableSources().map(([id, item]) => `<button class="cal-source" data-action="cal-source" data-id="${id}" data-context="${context || 'aside'}" aria-pressed="${A.state.calendarSources[id] !== false}"><span class="cal-source-check cal-${item.color} ${A.state.calendarSources[id] !== false ? 'checked' : ''}">${A.state.calendarSources[id] !== false ? icon('check', 13) : ''}</span><span>${item.name}</span><span class="cal-source-count">${visibleEvents().filter(event => event.source === id).length}</span></button>`).join('') || '<p class="cal-caption">Nenhuma conta de exemplo adicionada.</p><button class="button" data-action="cal-connections">Gerenciar contas</button>';
  }
  function sidebar() {
    return `<aside class="cal-aside">${miniCalendar()}${A.ui.calendarView === 'list' ? previousEvents(A.ui.calendarDate) : ''}<section class="cal-sources" aria-labelledby="cal-sources-title"><div class="cal-aside-title"><h2 id="cal-sources-title">Meus calendários</h2><span class="cal-small-count">${availableSources().length}</span></div>${sourceButtons()}<p class="cal-caption">A seleção também atualiza sua agenda no Início.</p></section><button class="cal-connection" data-action="cal-connections" aria-label="Gerenciar contas do calendário"><span class="cal-google-mark" aria-hidden="true">${icon('calendar', 20)}</span><span class="cal-connection-copy"><strong>Google Calendar</strong><span>${accounts().length} ${accounts().length === 1 ? 'conta' : 'contas'} de exemplo</span></span>${icon('chevron-right', 16)}</button><div class="cal-readonly">${icon('link', 15)}<span>Compromissos em leitura. Notas e próximos passos ao alcance.</span></div></aside>`;
  }
  function toolbar(day, view) {
    return `<div class="cal-toolbar"><div class="cal-period"><div class="cal-period-title"><h2>${esc(periodTitle(day, view))}</h2><p>${day.slice(0, 4)}${view === 'week' ? ' · Semana ' + weekNumber(day) : ''}</p></div><div class="cal-period-arrows"><button class="icon-button" data-action="cal-shift" data-direction="-1" aria-label="Período anterior">${icon('chevron-left')}</button><button class="icon-button" data-action="cal-shift" data-direction="1" aria-label="Próximo período">${icon('chevron-right')}</button></div><button class="button cal-today" data-action="cal-today">Hoje</button></div><div class="cal-toolbar-actions"><button class="icon-button cal-sources-trigger" data-action="cal-sources" aria-label="Filtrar calendários">${icon('filter')}</button><div class="cal-view-tabs" role="group" aria-label="Visualização do calendário">${[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['list', 'Lista']].map(([id, label]) => `<button data-action="cal-view" data-view="${id}" class="${id === view ? 'active' : ''}" aria-pressed="${id === view}">${label}</button>`).join('')}</div></div></div>`;
  }
  function layoutEvents(events, day) {
    const segments = events.filter(event => !event.allDay).map(event => ({ event, start: day > event.date ? 0 : minutes(event.start), end: day < eventDateEnd(event) ? 1440 : minutes(event.end), lane: 0, lanes: 1 })).sort((a, b) => a.start - b.start);
    let active = [], group = [], count = 1;
    const close = () => { group.forEach(segment => { segment.lanes = count; }); group = []; count = 1; };
    segments.forEach(segment => {
      active = active.filter(other => Math.max(other.end, other.start + 48) > segment.start);
      if (!active.length) close();
      const used = new Set(active.map(other => other.lane));
      while (used.has(segment.lane)) segment.lane++;
      count = Math.max(count, segment.lane + 1); group.push(segment); active.push(segment);
    });
    close(); return segments;
  }
  function timeline(day, view) {
    const days = daysFor(day, view);
    const events = days.map(value => dayEvents(value));
    const segments = days.map((value, index) => layoutEvents(events[index], value));
    const timed = segments.flat();
    const startHour = Math.min(7, ...timed.map(segment => Math.floor(segment.start / 60)));
    const endHour = Math.max(21, ...timed.map(segment => Math.ceil(segment.end / 60)));
    const hours = endHour - startHour;
    const height = hours * HOUR_HEIGHT;
    const allDayEvents = visibleEvents().filter(event => event.allDay && days.some(value => onDay(event, value))).map(event => ({ event, first: days.findIndex(value => onDay(event, value)), last: days.length - 1 - [...days].reverse().findIndex(value => onDay(event, value)), lane: 0 })).sort((a, b) => a.first - b.first || b.last - a.last);
    const occupied = [];
    allDayEvents.forEach(segment => { while (occupied[segment.lane] >= segment.first) segment.lane++; occupied[segment.lane] = segment.last; });
    const allDayCount = Math.max(1, occupied.length);
    return `<div class="cal-time-scroll" role="region" aria-label="${view === 'day' ? 'Agenda do dia' : 'Agenda da semana'} por horário" tabindex="0"><div class="cal-time-grid ${view === 'day' ? 'cal-single-day' : ''}" style="--cal-days:${days.length};--cal-height:${height}px;--cal-all-day-height:${allDayCount * 48 + 14}px"><div class="cal-time-corner"><span>GMT−3</span></div>${days.map((value, index) => `<button class="cal-day-header ${value === TODAY ? 'is-today' : ''} ${value === A.ui.calendarDate ? 'is-selected' : ''}" style="grid-column:${index + 2}" data-action="cal-open-day" data-date="${value}" aria-label="Abrir ${esc(fmt(value, { dateStyle: 'full' }))}"><span>${esc(fmt(value, { weekday: 'short' }).replace('.', ''))}</span><strong>${Number(value.slice(-2))}</strong>${value === TODAY ? '<small>hoje</small>' : ''}</button>`).join('')}<div class="cal-all-day-label">Dia<br>inteiro</div>${days.map((value, index) => `<div class="cal-all-day-cell ${value === TODAY ? 'is-today' : ''}" style="grid-column:${index + 2}" aria-hidden="true"></div>`).join('')}${allDayEvents.map(segment => `<button class="cal-all-day-event cal-${source(segment.event).color}" style="grid-column:${segment.first + 2}/span ${segment.last - segment.first + 1};margin-top:${segment.lane * 48 + 8}px" data-action="cal-event" data-id="${esc(segment.event.id)}" title="${esc(segment.event.title)}" aria-label="${esc(segment.event.title + ', dia inteiro, ' + source(segment.event).name)}">${icon('calendar', 14)}<span>${esc(segment.event.title)}</span>${segment.last > segment.first ? '<span class="cal-all-day-range">' + esc(fmt(days[segment.first], { day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(days[segment.last], { day: 'numeric', month: 'short' })) + '</span>' : ''}</button>`).join('')}<div class="cal-hours">${Array.from({ length: hours + 1 }, (_, index) => `<span style="top:${index * HOUR_HEIGHT}px">${String(startHour + index).padStart(2, '0')}:00</span>`).join('')}</div>${days.map((value, index) => `<section class="cal-day-track ${value === TODAY ? 'is-today' : ''}" style="grid-column:${index + 2}" aria-label="${esc(fmt(value, { dateStyle: 'full' }))}">${Array.from({ length: hours }, (_, i) => `<div class="cal-hour-rule" style="top:${i * HOUR_HEIGHT}px" aria-hidden="true"></div>`).join('')}${layoutEvents(events[index], value).map(segment => {
      const event = segment.event, top = Math.max(0, (segment.start - startHour * 60) / 60 * HOUR_HEIGHT), bottom = Math.min(height, (segment.end - startHour * 60) / 60 * HOUR_HEIGHT);
      if (bottom <= 0 || top >= height) return '';
      return `<button class="cal-time-event cal-${source(event).color} ${bottom - top < 105 ? 'is-short' : ''} ${bottom - top < 70 ? 'is-tiny' : ''}" style="top:${top + 3}px;height:${Math.max(44, bottom - top - 6)}px;left:calc(${segment.lane / segment.lanes * 100}% + 3px);width:calc(${100 / segment.lanes}% - 6px)" data-action="cal-event" data-id="${esc(event.id)}" title="${esc(event.title + ' · ' + eventTime(event, value))}" aria-label="${esc(event.title + ', ' + eventTime(event, value) + ', ' + source(event).name)}"><span class="cal-event-time">${esc(eventTime(event, value))}</span><strong>${esc(event.title)}</strong><span class="cal-event-source"><span>${source(event).name}</span>${event.noteId ? icon('file-text', 14) + '<span class="sr-only">Nota vinculada</span>' : ''}</span></button>`;
    }).join('')}</section>`).join('')}</div></div>`;
  }
  function month(day) {
    return `<div class="cal-month" role="region" aria-label="Calendário do mês"><div class="cal-month-weekdays">${WEEKDAYS.map(value => `<span>${value}</span>`).join('')}</div><div class="cal-month-grid">${daysFor(day, 'month').map(value => {
      const events = dayEvents(value);
      return `<section class="cal-month-day ${value.slice(0, 7) !== day.slice(0, 7) ? 'outside' : ''} ${value === TODAY ? 'is-today' : ''}"><button class="cal-month-date" data-action="cal-open-day" data-date="${value}" aria-label="Abrir ${esc(fmt(value, { dateStyle: 'full' }))}">${Number(value.slice(-2))}</button><div class="cal-month-items">${events.slice(0, 2).map(event => `<button class="cal-month-event cal-${source(event).color}" data-action="cal-event" data-id="${esc(event.id)}"><span class="cal-event-dot" aria-hidden="true"></span><span>${event.allDay ? '' : esc(event.start) + ' '}${esc(event.title)}</span></button>`).join('')}${events.length > 2 ? `<button class="cal-more" data-action="cal-open-day" data-date="${value}">+${events.length - 2} compromissos</button>` : ''}</div></section>`;
    }).join('')}</div></div>`;
  }
  // Each event appears once, even when it continues across several days.
  function listEntries(day) {
    const end = shiftMonth(day, 1);
    return visibleEvents().filter(event => event.date < end && (event.date >= day || onDay(event, day)))
      .map(event => ({ event, day: event.date < day ? day : event.date }))
      .sort((a, b) => a.day.localeCompare(b.day) || Number(!!b.event.allDay) - Number(!!a.event.allDay) || String(a.event.start || '').localeCompare(String(b.event.start || '')));
  }
  function previousEvents(day) {
    const events = visibleEvents().filter(event => event.allDay ? eventDateEnd(event) <= day : eventDateEnd(event) < day || (eventDateEnd(event) === day && minutes(event.end) === 0))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.start || '').localeCompare(String(a.start || ''))).slice(0, 2);
    if (!events.length) return '';
    return `<section class="cal-recent" aria-labelledby="cal-recent-title"><div class="cal-aside-title"><h2 id="cal-recent-title">Eventos anteriores</h2></div>${events.map(event => `<button class="cal-recent-event" data-action="cal-event" data-id="${esc(event.id)}"><span>${esc(fmt(event.date, { day: 'numeric', month: 'short' }))} · ${esc(event.allDay ? 'Dia inteiro' : event.start)}</span><strong>${esc(event.title)}</strong>${A.calendarPeople?.stack(event) || ''}${icon('chevron-right', 16)}</button>`).join('')}</section>`;
  }
  function eventList(day) {
    const entries = listEntries(day);
    const signature = day + ':' + entries.map(item => item.event.id).join(',');
    if (A.ui.calendarListSignature !== signature) { A.ui.calendarListSignature = signature; A.ui.calendarListPage = 0; }
    const pages = Math.max(1, Math.ceil(entries.length / 5));
    const page = Math.max(0, Math.min(pages - 1, Number(A.ui.calendarListPage) || 0));
    A.ui.calendarListPage = page;
    const shown = entries.slice(page * 5, page * 5 + 5);
    const range = fmt(day, { day: 'numeric', month: 'short' }) + ' – ' + fmt(add(shiftMonth(day, 1), -1), { day: 'numeric', month: 'short' });
    return `<section class="cal-event-list" aria-labelledby="cal-list-title"><header class="cal-list-heading"><div><h3 id="cal-list-title">${day === TODAY ? 'Próximos eventos' : 'Eventos do período'}</h3><p>${esc(range)}<span aria-hidden="true"> · </span>${entries.length} ${entries.length === 1 ? 'compromisso' : 'compromissos'}</p></div>${day !== monthStart(day) ? '<button class="cal-list-month" data-action="cal-list-month">Ver mês completo</button>' : ''}</header><div class="cal-list-date-control"><button class="button" data-action="cal-toggle-picker" aria-expanded="${!!A.ui.calendarListPicker}" aria-controls="cal-list-date-picker">${icon('calendar', 17)}${esc(fmt(day, { day: 'numeric', month: 'long' }))}${icon(A.ui.calendarListPicker ? 'chevron-up' : 'chevron-down', 16)}</button><div id="cal-list-date-picker" class="cal-list-date-picker" ${A.ui.calendarListPicker ? '' : 'hidden'}>${miniCalendar()}</div></div>${shown.length ? `<div class="cal-list-rows">${shown.map(({ event, day: value }) => {
      const context = eventContext(event);
      const rangeEnd = event.allDay ? add(eventDateEnd(event), -1) : eventDateEnd(event);
      const multipleDays = rangeEnd > event.date;
      return `<button class="cal-list-event ${value === TODAY ? 'is-today' : ''}" data-action="cal-event" data-id="${esc(event.id)}"><span class="cal-list-date"><span class="cal-list-date-day">${Number(value.slice(-2))}</span><span class="cal-list-date-month">${esc(fmt(value, { month: 'short' }))}</span><span class="cal-list-date-weekday">${value === TODAY ? 'Hoje' : esc(fmt(value, { weekday: 'short' }).replace('.', ''))}</span><span class="cal-list-time">${esc(event.allDay ? 'Dia inteiro' : value > event.date ? '00:00' : event.start)}${event.allDay ? '' : '<small>– ' + esc(value < eventDateEnd(event) ? '24:00' : event.end) + '</small>'}</span></span><span class="cal-list-content"><span class="cal-list-event-title">${esc(event.title)}</span><span class="cal-list-location">${icon('map-pin', 14)}${esc(event.location || source(event).account)}</span>${multipleDays || value > event.date ? `<span class="cal-list-range">${value > event.date ? 'Em andamento · ' : ''}${esc(fmt(event.date, { day: 'numeric', month: 'short' }))} até ${esc(fmt(rangeEnd, { day: 'numeric', month: 'short' }))}</span>` : ''}${context ? `<span class="cal-list-description">${esc(context)}</span>` : ''}<span class="cal-list-event-footer"><span class="cal-list-labels"><span class="cal-list-source cal-${source(event).color}"><i aria-hidden="true"></i>${source(event).name}</span>${eventNote(event) ? '<span class="cal-list-note">' + icon('file-text', 14) + 'Nota vinculada</span>' : ''}</span>${A.calendarPeople?.stack(event) || ''}</span></span><span class="cal-list-arrow" aria-hidden="true">${icon('arrow-up-right', 18)}</span></button>`;
    }).join('')}</div><footer class="cal-list-pagination"><span aria-live="polite">${page * 5 + 1}–${Math.min(entries.length, (page + 1) * 5)} de ${entries.length} compromissos</span><div><button class="icon-button" data-action="cal-list-page" data-direction="-1" aria-label="Eventos anteriores na lista" ${page === 0 ? 'disabled' : ''}>${icon('chevron-left', 18)}</button><span>Página ${page + 1} de ${pages}</span><button class="icon-button" data-action="cal-list-page" data-direction="1" aria-label="Próximos eventos na lista" ${page + 1 >= pages ? 'disabled' : ''}>${icon('chevron-right', 18)}</button></div></footer>` : `<div class="cal-list-empty">${icon('calendar', 32)}<h3>Um espaço livre na agenda</h3><p>Nenhum compromisso entre ${esc(range)} nos calendários visíveis.</p><button class="button" data-action="cal-sources">Revisar calendários</button></div>`}</section>`;
  }
  function eventDetails(event) {
    const item = source(event);
    const note = eventNote(event);
    const end = event.allDay && event.endDate ? add(event.endDate, -1) : event.endDate;
    const dateText = fmt(event.date, { weekday: 'long', day: 'numeric', month: 'long' }) + (end && end > event.date ? ' até ' + fmt(end, { day: 'numeric', month: 'long' }) : '');
    return `<div class="cal-event-body"><span class="cal-source-label cal-${item.color}">${item.name}</span><h2>${esc(event.title)}</h2><div class="cal-detail-row">${icon('calendar', 20)}<div><strong>${esc(dateText)}</strong><span>${event.allDay ? 'Dia inteiro' : esc(eventTime(event)) + ' · Horário de Fortaleza'}</span></div></div>${event.location ? `<div class="cal-detail-row">${icon('map-pin', 20)}<div><strong>${esc(event.location)}</strong><span>Local do compromisso</span></div></div>` : ''}<div class="cal-detail-row">${icon('link', 20)}<div><strong>Google Calendar · ${item.account}</strong><span>Compromisso de demonstração · somente leitura</span></div></div>${event.description ? `<div class="cal-detail-description"><h3>Descrição</h3><p>${esc(event.description)}</p></div>` : ''}${A.calendarPeople?.details(event) || ''}<div class="cal-detail-context"><h3>Leve o contexto com você</h3><p>${note ? 'A nota deste compromisso está pronta para suas decisões e próximos passos.' : 'Reúna pautas, decisões e próximos passos em uma nota vinculada.'}</p><button class="button primary" data-action="cal-note" data-id="${esc(event.id)}">${icon('file-text')}${note ? 'Abrir nota do compromisso' : 'Criar nota do compromisso'}</button><button class="button" data-action="cal-task" data-id="${esc(event.id)}">${icon('plus')}Criar tarefa relacionada</button></div><p class="cal-detail-footnote">Alterações no compromisso são feitas no Google Calendar. Este protótipo não acessa suas contas.</p></div>`;
  }
  function showSources() { A.openDialog('Seus calendários', `<div class="cal-sources-dialog"><p class="muted">Escolha as fontes que aparecem no Calendário e na agenda do Início.</p>${sourceButtons('dialog')}<p class="cal-caption">${availableSources().length} calendários de exemplo em ${accounts().length} ${accounts().length === 1 ? 'conta Google' : 'contas Google'}.</p></div>`); }
  function renderCalendar(direction, resetScroll) {
    const root = typeof document === 'undefined' ? null : document;
    const previousScroll = root && root.querySelector('.cal-time-scroll');
    const scrollTop = resetScroll ? 0 : previousScroll ? previousScroll.scrollTop : A.ui.calendarScroll || 0;
    A.ui.calendarScroll = scrollTop;
    A.render();
    const nextScroll = root && root.querySelector('.cal-time-scroll');
    if (nextScroll) nextScroll.scrollTop = scrollTop;
    const stage = root && root.querySelector('.cal-stage');
    if (direction && stage && stage.animate && root.documentElement?.dataset?.input !== 'keyboard' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) stage.animate([{ transform: 'translateX(' + direction * 10 + 'px)', opacity: .72 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.23,1,.32,1)' });
  }
  A.routes.calendario = function () {
    const { day, view } = settings();
    const renderDesktop = view === 'month' ? month(day) : view === 'list' ? '' : view === 'day' ? dayAgenda(day, 'desktop') : timeline(day, view);
    const renderMobile = view === 'list' ? '' : `${view === 'month' ? monthPicker(day) : weekStrip(day)}${dayAgenda(day, 'mobile')}`;
    const allHidden = availableSources().every(([id]) => A.state.calendarSources[id] === false);
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(revealSelectedDate);
    return `<div class="calendar-workspace cal-view-${esc(view)}">${toolbar(day, view)}<div class="cal-layout">${sidebar()}<div class="cal-stage">${allHidden ? '<div class="cal-filter-message">Todos os calendários estão ocultos. Selecione uma fonte para ver seus compromissos.</div>' : ''}${view === 'list' ? eventList(day) : '<div class="cal-large">' + renderDesktop + '</div><div class="cal-mobile">' + renderMobile + '</div>'}<footer class="cal-status"><span><i aria-hidden="true"></i>${A.ui.calendarSynced ? 'Exemplo atualizado nesta sessão' : 'Dados de demonstração'}<span class="cal-status-zone"> · Horário de Fortaleza</span></span><button data-action="cal-sync">${icon('refresh', 15)}Atualizar exemplo</button></footer></div></div></div>`;
  };
  A.actions['cal-view'] = element => { A.ui.calendarView = element.dataset.view; renderCalendar(); };
  A.actions['cal-shift'] = element => { const { day, view } = settings(); const n = Number(element.dataset.direction); A.ui.calendarDate = view === 'month' || view === 'list' ? shiftMonth(day, n) : add(day, n * (view === 'week' ? 7 : 1)); A.ui.calendarMiniDate = monthStart(A.ui.calendarDate); renderCalendar(n); };
  A.actions['cal-mini-shift'] = element => { settings(); A.ui.calendarMiniDate = shiftMonth(A.ui.calendarMiniDate, Number(element.dataset.direction)); renderCalendar(); };
  A.actions['cal-select-date'] = element => {
    const compactPicker = element.closest && element.closest('.cal-list-date-picker');
    A.ui.calendarDate = element.dataset.date; A.ui.calendarMiniDate = monthStart(element.dataset.date); A.ui.calendarListPicker = false;
    renderCalendar();
    if (compactPicker && typeof document !== 'undefined') document.querySelector('[data-action="cal-toggle-picker"]')?.focus({ preventScroll: true });
  };
  A.actions['cal-toggle-picker'] = () => { A.ui.calendarListPicker = !A.ui.calendarListPicker; renderCalendar(); };
  A.actions['cal-list-month'] = () => { A.ui.calendarDate = monthStart(A.ui.calendarDate); A.ui.calendarListPicker = false; renderCalendar(); };
  A.actions['cal-list-page'] = element => {
    A.ui.calendarListPage = (Number(A.ui.calendarListPage) || 0) + Number(element.dataset.direction);
    renderCalendar(Number(element.dataset.direction));
    if (typeof document !== 'undefined') {
      const heading = document.querySelector('#cal-list-title');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
    }
  };
  A.actions['cal-select-event'] = element => { const day = element.dataset.date; const event = dayEvents(day).find(item => item.id === element.dataset.id); if (!event) return; A.ui.calendarAgendaDate = day; A.ui.calendarAgendaId = A.ui.calendarAgendaId === event.id ? null : event.id; renderCalendar(); };
  A.actions['cal-open-day'] = element => { A.ui.calendarDate = element.dataset.date; A.ui.calendarMiniDate = monthStart(element.dataset.date); A.ui.calendarView = 'day'; renderCalendar(); };
  A.actions['cal-today'] = () => { A.ui.calendarDate = TODAY; A.ui.calendarMiniDate = monthStart(TODAY); renderCalendar(0, true); };
  A.actions['cal-source'] = element => { settings(); const id = element.dataset.id; if (!availableSources().some(([sourceId]) => id === sourceId)) return A.notify('Adicione a conta de exemplo em Integrações para exibir este calendário.'); A.state.calendarSources[id] = A.state.calendarSources[id] === false; A.save(); renderCalendar(); if (element.dataset.context === 'dialog') showSources(); };
  A.actions['cal-sources'] = showSources;
  A.actions['cal-event'] = element => { const event = (A.state.events || []).find(item => item.id === element.dataset.id); if (event) A.openDialog('Detalhes do compromisso', eventDetails(event)); };
  A.actions['cal-note'] = element => { const event = (A.state.events || []).find(item => item.id === element.dataset.id); if (!event) return; A.closeDialog(); if (event.noteId) A.openNote(event.noteId); else A.createEventNote(event.id); };
  A.actions['cal-task'] = element => { const event = (A.state.events || []).find(item => item.id === element.dataset.id); if (!event) return; A.closeDialog(); A.taskDialog(null, { title: 'Próximo passo: ' + event.title, relatedEvent: event.id, project: event.project || '' }); };
  A.actions['cal-sync'] = () => { A.ui.calendarSynced = true; renderCalendar(); A.notify('Exemplo atualizado. Nenhuma conta Google foi acessada.'); };
  A.actions['cal-connections'] = () => { if (A.routes.integracoes) return A.go('integracoes'); A.openDialog('Contas do calendário', `<div class="cal-connections-dialog"><p class="muted">Este protótipo usa eventos fictícios para demonstrar a integração de leitura com até duas contas Google.</p>${accounts().map(account => `<div class="cal-account"><span class="cal-account-avatar">${esc(account.name.slice(0, 1))}</span><div><strong>${esc(account.name)}</strong><span>${esc(account.sources.map(id => SOURCES[id].name).join(' · '))}</span></div><span class="pill">Exemplo</span></div>`).join('')}<p class="cal-caption">No produto, a conexão e reconexão usam consentimento Google. Nenhuma credencial é solicitada ou armazenada neste protótipo.</p></div>`); };
})();
