/* Rotina, imagens e desempenho compartilham os mesmos registros locais. */
(() => {
  'use strict';
  const A = window.App, M = A.habitModel, E = A.esc, I = A.icon;
  const TODAY = A.TODAY, ui = { mode: 'month', anchor: TODAY, week: M.weekStart(TODAY), filter: 'all', archived: false };
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const fullNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const examples = { h1: 'assets/covers/project-learning.png', h2: 'assets/covers/habit-movement.png', h3: 'assets/covers/project-workspace.png' };
  const all = () => A.state.habits || [];
  const date = day => new Date(day + 'T12:00:00Z');
  const label = day => date(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const longDate = day => date(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const button = (action, text, cls = '', attrs = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const picture = h => A.media.sanitizeSource(h.image === undefined ? examples[h.id] : h.image);
  const set = () => all().filter(h => ui.archived ? h.archived : !h.archived);
  const selected = () => set().filter(h => ui.filter === 'all' || h.id === ui.filter);
  const progress = (done, goal, text) => `<progress class="hb-progress" value="${Math.min(done, goal)}" max="${Math.max(1, goal)}" aria-label="${E(text)}"></progress>`;
  function bounds() {
    const start = ui.mode === 'month' ? ui.anchor.slice(0, 7) + '-01' : M.weekStart(ui.anchor);
    const d = date(start); d.setUTCMonth(d.getUTCMonth() + 1, 0);
    return { start, end: ui.mode === 'month' ? d.toISOString().slice(0, 10) : M.addDays(start, 6) };
  }
  function moveMonth(day, delta) {
    const d = date(day.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 10);
  }
  function rerender(focus) {
    const y = scrollY; A.render(); window.scrollTo(0, y);
    if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
  }
  function commit(mutate, message, form) {
    const before = structuredClone(A.state);
    mutate();
    A.state.activity.unshift({ id: A.uid('a'), title: message, detail: '', time: new Date().toISOString() });
    A.state.activity = A.state.activity.slice(0, 80);
    if (!A.save()) {
      A.state = before;
      const text = 'Não foi possível salvar. Libere espaço no navegador e tente novamente.';
      if (form) showError(form, text); A.notify(text); return false;
    }
    A.notify(message); return true;
  }
  function showError(form, message) {
    const output = form.querySelector('[data-habit-error]'); output.hidden = false; output.textContent = message; output.focus();
  }
  function graph(items, start, end) {
    const rows = M.dailyTotals(items, start, end), total = rows.reduce((sum, row) => sum + row.done, 0), max = Math.max(1, ...rows.map(r => r.done));
    return `<div class="hb-chart"><div class="hb-chart-heading"><div><h3>Registros ${ui.mode === 'month' ? 'no mês' : 'na semana'}</h3><p>${total} ${total === 1 ? 'registro' : 'registros'}</p></div><span>Até ${E(label(end < TODAY ? end : TODAY))}</span></div>
      <div class="hb-chart-visual" role="img" aria-label="${total} registros entre ${E(longDate(start))} e ${E(longDate(end))}. Valores diários disponíveis abaixo.">
        <div class="hb-chart-axis" aria-hidden="true">${(max <= 5 ? Array.from({ length: max + 1 }, (_, n) => n) : [0, Math.floor(max / 2), max]).map(n => `<span style="bottom:${n / max * 100}%">${n}</span>`).join('')}</div>
        <div class="hb-bars" style="--hb-columns:${rows.length}" aria-hidden="true">${rows.map((r, n) => `<div class="hb-bar-slot ${r.date > TODAY ? 'is-future' : ''} ${r.date === TODAY ? 'is-today' : ''}" title="${E(label(r.date))}: ${r.date > TODAY ? 'data futura' : r.done + ' registros'}"><div class="hb-bar-track"><span style="height:${r.done / max * 100}%"></span></div><span class="hb-bar-date">${ui.mode === 'week' ? names[date(r.date).getUTCDay()] : n === 0 || ((n + 1) % 5 === 0 && n < rows.length - 3) || n === rows.length - 1 ? r.date.slice(8) : ''}</span></div>`).join('')}</div>
      </div><details class="hb-chart-data"><summary>Ver registros por dia</summary><div class="hb-data-scroll" tabindex="0" role="region" aria-label="Dados do gráfico"><table><caption>Registros do período</caption><thead><tr><th>Data</th><th>Registros</th></tr></thead><tbody>${rows.map(r => `<tr><td>${E(label(r.date))}</td><td>${r.date > TODAY ? 'Data futura' : r.done}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  }
  function performance(items) {
    const { start, end } = bounds(), stats = items.map(h => ({ h, ...M.period(h, start, end) }));
    const done = stats.reduce((s, h) => s + h.done, 0), expected = stats.reduce((s, h) => s + h.expected, 0);
    const next = ui.mode === 'month' ? moveMonth(ui.anchor, 1) > TODAY : M.addDays(M.weekStart(ui.anchor), 7) > TODAY;
    return `<section class="panel hb-performance" aria-labelledby="hb-performance-title"><header class="hb-panel-head"><h2 id="hb-performance-title">Desempenho</h2><div class="hb-period-tools"><div class="hb-segment" role="group" aria-label="Visão do desempenho">${['week', 'month'].map(v => button('hb-mode', v === 'week' ? 'Semana' : 'Mês', ui.mode === v ? 'is-active' : '', `data-mode="${v}" aria-pressed="${ui.mode === v}"`)).join('')}</div><label class="hb-period-input"><span class="life-sr">${ui.mode === 'month' ? 'Mês do desempenho' : 'Data da semana'}</span><input type="${ui.mode === 'month' ? 'month' : 'date'}" id="hb-period" min="2020-01${ui.mode === 'month' ? '' : '-01'}" max="${ui.mode === 'month' ? TODAY.slice(0, 7) : TODAY}" value="${ui.mode === 'month' ? ui.anchor.slice(0, 7) : ui.anchor}" data-hb-period></label><div class="hb-arrows">${button('hb-period', I('chevron-left'), 'icon-button', 'data-delta="-1" aria-label="Período anterior"')}${button('hb-period', I('chevron-right'), 'icon-button', `data-delta="1" aria-label="Próximo período" ${next ? 'disabled' : ''}`)}</div></div></header>
      <div class="hb-performance-body">${graph(items, start, end)}<div class="hb-consistency"><h3>Consistência ${ui.mode === 'month' ? 'no mês' : 'na semana'}</h3><p class="hb-score"><strong>${expected ? Math.round(done / expected * 100) + '%' : '—'}</strong><span>${expected ? done + ' de ' + expected + ' práticas previstas' : 'Sem práticas previstas neste período'}</span></p><div class="hb-breakdown">${stats.map(s => `<div class="hb-breakdown-row"><span title="${E(s.h.title)}">${E(s.h.title)}</span>${progress(s.done, s.expected, `${s.h.title}: ${s.done} de ${s.expected} práticas previstas`)}<span>${s.done} / ${s.expected}</span></div>`).join('')}</div><details class="hb-method"><summary>Como é calculado?</summary><p>Conta os dias programados até ${E(label(end < TODAY ? end : TODAY))}. Dias em pausa e anteriores à criação ficam de fora. A meta semanal conta até o limite escolhido em cada semana, de segunda a domingo; em períodos parciais, até os dias disponíveis.</p></details></div></div></section>`;
  }
  function checkCell(h, day) {
    const done = M.recorded(h, day), eligible = M.eligible(h, day) && M.activeOn(h, day), future = day > TODAY;
    const disabled = future || h.paused || h.archived || (!done && !eligible);
    const reason = future ? 'Data futura' : h.archived ? 'Hábito arquivado' : h.paused ? 'Hábito em pausa' : !eligible && !done ? 'Dia não programado' : done ? 'Desmarcar' : 'Registrar';
    return `<td class="hb-day ${day === TODAY ? 'is-today' : ''}" role="cell"><span class="hb-mobile-date" aria-hidden="true">${names[date(day).getUTCDay()]}<b>${Number(day.slice(8))}</b></span><button type="button" class="hb-check ${done ? 'is-done' : ''}" data-action="life-habit-toggle" data-id="${E(h.id)}" data-date="${day}" aria-pressed="${done}" aria-label="${E(reason + ': ' + h.title + ', ' + longDate(day))}" title="${E(reason)}" ${disabled ? 'disabled' : ''}>${done ? I('check', 18) : disabled ? '<span aria-hidden="true">–</span>' : '<span class="hb-check-dot" aria-hidden="true"></span>'}</button></td>`;
  }
  function routine(items) {
    const days = M.days(ui.week, M.addDays(ui.week, 6));
    return `<section class="panel hb-routine" aria-label="Rotina semanal"><header class="hb-panel-head"><div class="hb-week-nav">${button('life-habit-week', I('chevron-left'), 'icon-button', 'data-delta="-1" aria-label="Semana anterior"')}<h2>${E(label(days[0]))} — ${E(label(days[6]))}</h2>${button('life-habit-week', I('chevron-right'), 'icon-button', `data-delta="1" aria-label="Próxima semana" ${ui.week >= M.weekStart(TODAY) ? 'disabled' : ''}`)}</div><div class="hb-routine-tools">${ui.week !== M.weekStart(TODAY) ? button('life-habit-current', 'Esta semana', 'subtle') : ''}${button('life-habit-archive-view', ui.archived ? 'Ver ativos' : 'Arquivados', ui.archived ? 'primary' : '', `aria-pressed="${ui.archived}"`)}</div></header>
      ${items.length ? `<table class="hb-grid" role="table"><caption class="life-sr">Hábitos de ${E(label(days[0]))} a ${E(label(days[6]))}</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Sua prática</th>${days.map(day => `<th scope="col" class="${day === TODAY ? 'is-today' : ''}" role="columnheader"><span>${names[date(day).getUTCDay()]}</span><strong>${Number(day.slice(8))}</strong></th>`).join('')}<th scope="col" role="columnheader">Semana</th><th scope="col" role="columnheader"><span class="life-sr">Ações</span></th></tr></thead><tbody role="rowgroup">${items.map(h => {
        const result = M.period(h, days[0], days[6]), target = M.planned(h, days[0], days[6]), source = picture(h);
        return `<tr role="row"><th scope="row" class="hb-practice" role="rowheader"><div>${source ? `<img src="${E(source)}" alt="" width="76" height="68" decoding="async">` : `<span class="hb-photo-placeholder" aria-hidden="true">${I('habit', 24)}</span>`}<span><strong>${E(h.title)}</strong><small>${E(M.schedule(h))}${h.paused ? ' · Em pausa' : ''}${h.archived ? ' · Arquivado' : ''}</small></span></div></th>${days.map(day => checkCell(h, day)).join('')}<td class="hb-week-total" role="cell"><div><span class="hb-mobile-label">Semana</span><strong>${result.done}<span> / ${target}</span></strong></div>${progress(result.done, target, `${h.title}: ${result.done} de ${target} na semana`)}</td><td class="hb-row-actions" role="cell">${button('life-habit-edit', I('more'), 'icon-button', `data-id="${E(h.id)}" aria-label="Editar ${E(h.title)}"`)}</td></tr>`;
      }).join('')}</tbody></table>` : `<div class="empty"><h3>${ui.archived ? 'Nenhum hábito arquivado' : 'Encontre seu primeiro hábito'}</h3><p>${ui.archived ? 'Seu histórico continua disponível ao arquivar uma prática.' : 'Escolha uma prática pequena e os dias em que ela cabe.'}</p>${ui.archived ? button('life-habit-archive-view', 'Voltar aos hábitos') : button('life-habit-new', 'Criar hábito', 'primary')}</div>`}</section>`;
  }
  A.routes.habitos = () => {
    if (ui.filter !== 'all' && !set().some(h => h.id === ui.filter)) ui.filter = 'all';
    const items = selected();
    return `<div class="hb-page"><div class="hb-toolbar"><label class="hb-filter"><span>Mostrar</span><select id="hb-filter" data-hb-filter aria-label="Filtrar hábitos"><option value="all">Todos os hábitos${ui.archived ? ' arquivados' : ''}</option>${set().map(h => `<option value="${E(h.id)}" ${ui.filter === h.id ? 'selected' : ''}>${E(h.title)}</option>`).join('')}</select></label>${button('life-habit-new', I('plus') + ' Novo hábito', 'primary')}</div>${items.length ? performance(items) : ''}${routine(items)}<p class="hb-note">${I('info', 18)}<span>Um dia sem registro não representa uma falha. Datas futuras não podem ser marcadas.</span></p></div>`;
  };
  A.lifeHabitGoal = M.goal;
  A.lifeHabitSchedule = M.schedule;
  A.lifeHabitEligible = h => !h.archived && !h.paused && (M.recorded(h, TODAY) || (M.eligible(h, TODAY) && M.activeOn(h, TODAY)));
  A.lifeToggleHabit = (id, day = TODAY) => {
    const h = all().find(x => x.id === id); if (!h) return;
    const done = M.recorded(h, day);
    if (day > TODAY || h.paused || h.archived || (!done && (!M.eligible(h, day) || !M.activeOn(h, day)))) return A.notify('Escolha um dia programado até hoje, em um hábito ativo.');
    if (commit(() => { h.checked = done ? (h.checked || []).filter(d => d !== day) : [...new Set([...(h.checked || []), day])]; }, done ? 'Registro desfeito.' : 'Hábito registrado.')) {
      rerender();
      [...document.querySelectorAll('[data-action="life-habit-toggle"], [data-action="home-habit"]')].find(el => el.dataset.id === id && (!el.dataset.date || el.dataset.date === day))?.focus({ preventScroll: true });
    }
  };
  function dialog(h) {
    h = h || { title: '', cadence: 'daily', weekdays: [1, 2, 3, 4, 5], weeklyTarget: 3 };
    A.openDialog(h.id ? 'Editar hábito' : 'Novo hábito', `<form data-form="life-habit" class="hb-form"><input type="hidden" name="id" value="${E(h.id || '')}"><p data-habit-error class="hb-error" role="alert" tabindex="-1" hidden></p><div class="field"><label for="hb-title">Seu hábito</label><input id="hb-title" name="title" required maxlength="80" value="${E(h.title)}" placeholder="Ex.: Ler por 20 minutos" autofocus></div><div class="field"><label for="hb-cadence">Frequência</label><select id="hb-cadence" name="cadence" data-hb-cadence>${[['daily', 'Todos os dias'], ['weekdays', 'Dias específicos'], ['weekly_target', 'Meta semanal']].map(([v, text]) => `<option value="${v}" ${(h.cadence || 'daily') === v ? 'selected' : ''}>${text}</option>`).join('')}</select></div><fieldset class="hb-weekdays" data-hb-days ${h.cadence === 'weekdays' ? '' : 'hidden'}><legend>Em quais dias?</legend><div>${[1, 2, 3, 4, 5, 6, 0].map(n => `<label><input type="checkbox" name="weekdays" value="${n}" ${(h.weekdays || [1, 2, 3, 4, 5]).includes(n) ? 'checked' : ''}><span aria-hidden="true">${names[n]}</span><span class="life-sr">${fullNames[n]}</span></label>`).join('')}</div></fieldset><div class="field" data-hb-target ${h.cadence === 'weekly_target' ? '' : 'hidden'}><label for="hb-goal">Quantas vezes por semana?</label><input id="hb-goal" name="goal" type="number" min="1" max="7" step="1" ${h.cadence === 'weekly_target' ? '' : 'disabled'} value="${Number(h.weeklyTarget) || 3}"><small>Em qualquer dia, de segunda a domingo.</small></div>
      <div class="hb-image-field">${A.media.imageEditor({ key: 'habitImage', value: picture(h), label: 'Imagem do hábito (opcional)' })}</div>${h.id ? `<p class="hb-edit-note">A nova frequência vale a partir de hoje. Os registros anteriores são preservados.</p><div class="hb-management">${button('life-habit-pause', h.paused ? 'Retomar hábito' : 'Pausar hábito', 'subtle', `data-id="${E(h.id)}" ${h.archived ? 'disabled' : ''}`)}${button('life-habit-archive', h.archived ? 'Restaurar hábito' : 'Arquivar hábito', 'subtle', `data-id="${E(h.id)}"`)}</div>` : ''}<div class="dialog-actions"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button class="button primary" type="submit">${h.id ? 'Salvar alterações' : 'Criar hábito'}</button></div></form>`);
  }
  Object.assign(A.actions, {
    'life-habit-toggle': el => A.lifeToggleHabit(el.dataset.id, el.dataset.date),
    'life-habit-new': () => dialog(),
    'life-habit-edit': el => { const h = all().find(x => x.id === el.dataset.id); if (h) dialog(h); },
    'life-habit-week': el => { ui.week = M.addDays(ui.week, 7 * Number(el.dataset.delta)); rerender(`[data-action="life-habit-week"][data-delta="${el.dataset.delta}"]`); },
    'life-habit-current': () => { ui.week = M.weekStart(TODAY); rerender('[data-action="life-habit-week"]'); },
    'life-habit-archive-view': () => { ui.archived = !ui.archived; ui.filter = 'all'; rerender('[data-action="life-habit-archive-view"]'); },
    'hb-mode': el => { ui.mode = el.dataset.mode; rerender(`[data-action="hb-mode"][data-mode="${ui.mode}"]`); },
    'hb-period': el => { ui.anchor = ui.mode === 'month' ? moveMonth(ui.anchor, Number(el.dataset.delta)) : M.addDays(ui.anchor, Number(el.dataset.delta) * 7); rerender(`[data-action="hb-period"][data-delta="${el.dataset.delta}"]`); },
    'life-habit-pause': el => manage(el.dataset.id, 'paused'),
    'life-habit-archive': el => manage(el.dataset.id, 'archived')
  });
  function manage(id, flag) {
    const h = all().find(x => x.id === id); if (!h) return;
    const message = flag === 'paused' ? (h.paused ? 'Hábito retomado.' : 'Hábito pausado.') : (h.archived ? 'Hábito restaurado.' : 'Hábito arquivado.');
    if (commit(() => M.setActivity(h, { [flag]: !h[flag] }), message, document.querySelector('.hb-form'))) { A.closeDialog(); rerender('[data-action="life-habit-new"]'); }
  }
  A.forms['life-habit'] = (data, form) => {
    const title = String(data.get('title') || '').trim(), cadence = String(data.get('cadence')), weeklyTarget = Number(data.get('goal'));
    const weekdays = [...new Set(data.getAll('weekdays').map(Number))].filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
    if (!title) return showError(form, 'Dê um nome ao hábito para continuar.');
    if (title.length > 80 || !['daily', 'weekdays', 'weekly_target'].includes(cadence)) return showError(form, 'Revise o nome e escolha uma frequência válida.');
    if (cadence === 'weekdays' && !weekdays.length) return showError(form, 'Escolha pelo menos um dia da semana.');
    if (cadence === 'weekly_target' && (!Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 7)) return showError(form, 'Escolha uma meta entre 1 e 7 vezes por semana.');
    const image = A.media.read(form, 'habitImage'); if (!image.ok) return showError(form, image.error);
    const old = all().find(h => h.id === data.get('id')), schedule = { cadence, weekdays, weeklyTarget: Number.isInteger(weeklyTarget) && weeklyTarget >= 1 && weeklyTarget <= 7 ? weeklyTarget : 3 };
    if (commit(() => {
      if (old) { M.setSchedule(old, schedule); old.title = title; old.image = image.value; }
      else A.state.habits.push({ id: A.uid('hb'), title, ...schedule, goal: cadence === 'weekly_target' ? schedule.weeklyTarget : cadence === 'weekdays' ? weekdays.length : 7, image: image.value, checked: [], paused: false, archived: false, startDate: TODAY });
    }, old ? 'Hábito atualizado.' : 'Hábito criado.', form)) { A.closeDialog(); ui.filter = 'all'; if (!old) ui.archived = false; rerender('[data-action="life-habit-new"]'); }
  };
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.matches('[data-hb-filter]')) { ui.filter = el.value; rerender('#hb-filter'); }
    if (el.matches('[data-hb-period]')) {
      if (!el.value || !el.checkValidity()) { el.value = ui.mode === 'month' ? ui.anchor.slice(0, 7) : ui.anchor; el.focus(); A.notify('Escolha um período até a data atual da demonstração. O período anterior foi mantido.'); return; }
      ui.anchor = ui.mode === 'month' ? el.value + '-01' : el.value; rerender('#hb-period');
    }
    if (el.matches('[data-hb-cadence]')) {
      const form = el.closest('form'); form.querySelector('[data-hb-days]').hidden = el.value !== 'weekdays'; form.querySelector('[data-hb-target]').hidden = el.value !== 'weekly_target'; form.querySelector('[name=goal]').disabled = el.value !== 'weekly_target';
    }
  });
  A.habits = { picture };
})();
