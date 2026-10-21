/* Financial goals share the ledger's model; image edits stay in the form until saved. */
(() => {
  'use strict';
  const A = window.App, E = A.esc;
  const F = () => A.financeModel;
  let selectedGoal = '';
  const hidden = () => Boolean(A.state.settings?.hideAmounts);
  const money = cents => hidden() ? '<span aria-label="Valor oculto">••••</span>' : E(A.money(cents));
  const inputMoney = cents => (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  const button = (action, text, cls = '', attrs = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const dateLabel = day => new Date(day + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const image = goal => A.media.sanitizeSource(goal?.image || '');
  const goals = () => F().goals().filter(goal => !goal.archived);
  const summary = id => F().goalSummary(id);
  const progress = info => `<div class="fg-progress-row"><progress max="100" value="${hidden() ? 0 : Math.min(100, Math.max(0, info.percent))}" aria-label="${hidden() ? 'Progresso da meta oculto' : E(info.goal.title + ': ' + info.percent + '% alcançado')}"></progress><span>${hidden() ? '••' : info.percent + '%'}</span></div>`;
  function fail(form, message) {
    const target = form.querySelector('[data-fg-error]');
    if (target) { target.textContent = String(message); target.hidden = false; target.focus(); }
  }
  function refresh(id) {
    if (id) selectedGoal = id;
    if (A.financeUI?.refresh) A.financeUI.refresh(); else A.render();
    [...document.querySelectorAll('[data-action="fg-open"]')].find(el => el.dataset.id === selectedGoal)?.focus({ preventScroll: true });
  }
  function cover(goal, detail = false) {
    const source = image(goal);
    if (!source) return '';
    return detail
      ? `<img class="fg-detail-image" src="${E(source)}" alt="" width="220" height="260" decoding="async">`
      : `<button type="button" class="fg-cover" data-action="fg-open" data-id="${E(goal.id)}" aria-label="Abrir meta ${E(goal.title)}"><img src="${E(source)}" alt="" width="420" height="250" decoding="async"></button>`;
  }
  function card(goal, compact) {
    const info = summary(goal.id);
    return `<article class="fg-card ${compact ? 'is-compact' : ''} ${image(goal) ? 'has-cover' : ''}">${cover(goal)}<div class="fg-card-body"><h3><button type="button" data-action="fg-open" data-id="${E(goal.id)}">${E(goal.title)}</button></h3><p class="fg-value"><strong>${money(info.saved)}</strong><span>de ${money(info.target)}</span></p>${progress(info)}${goal.deadline ? `<p class="fg-deadline">Até ${E(dateLabel(goal.deadline))}</p>` : ''}<div class="fg-card-actions">${button('fg-open', 'Adicionar valor', '', `data-id="${E(goal.id)}"`)}${button('fg-edit', A.icon('edit', 16), 'icon-button', `data-id="${E(goal.id)}" aria-label="Editar meta ${E(goal.title)}"`)}</div></div></article>`;
  }
  function render(compact = false) {
    const items = goals();
    if (!items.some(goal => goal.id === selectedGoal)) selectedGoal = items[0]?.id || '';
    const featured = items.find(goal => goal.id === selectedGoal);
    return `<section class="${compact ? 'panel fg-featured' : 'fg-planning'}" aria-label="Metas financeiras"><header class="fg-section-head"><h2>Metas financeiras</h2>${button('fg-new', compact ? A.icon('plus', 16) : A.icon('plus', 16) + ' Nova meta', compact ? 'icon-button' : '', 'aria-label="Nova meta financeira"')}</header>${compact && items.length > 1 ? `<label class="fg-picker"><span class="life-sr">Meta em destaque</span><select data-fg-select aria-label="Meta em destaque">${items.map(goal => `<option value="${E(goal.id)}" ${goal.id === selectedGoal ? 'selected' : ''}>${E(goal.title)}</option>`).join('')}</select></label>` : ''}${items.length ? compact ? card(featured, true) : `<div class="fg-cards">${items.map(goal => card(goal, false)).join('')}</div>` : `<div class="fg-empty"><p>Defina uma conquista e acompanhe quanto já guardou.</p>${button('fg-new', 'Criar primeira meta', 'primary')}</div>`}</section>`;
  }
  function open(id) {
    const info = summary(id);
    if (!info?.goal) return;
    const goal = info.goal, accounts = F().accounts().filter(account => account.kind !== 'card' && !account.archived);
    A.financeUI.openDialog('Meta financeira', `<div class="fg-detail ${image(goal) ? 'has-image' : ''}">${cover(goal, true)}<div class="fg-detail-content"><header class="fg-detail-heading"><h3>${E(goal.title)}</h3>${button('fg-edit', 'Editar meta', '', `data-id="${E(goal.id)}"`)}</header><p class="fg-value"><strong>${money(info.saved)}</strong><span>de ${money(info.target)}</span></p>${progress(info)}${goal.deadline ? `<p class="fg-deadline">Até ${E(dateLabel(goal.deadline))}</p>` : ''}<form data-form="fg-contribution" class="fg-contribution"><input type="hidden" name="goalId" value="${E(goal.id)}"><p class="fg-form-error" data-fg-error role="alert" tabindex="-1" hidden></p><h4>Adicionar valor</h4><div class="form-grid"><div class="field"><label for="fg-amount">Valor</label><input id="fg-amount" name="amount" inputmode="decimal" placeholder="0,00" required data-fg-preview autocomplete="off" autofocus></div><div class="field"><label for="fg-date">Data</label><input id="fg-date" name="date" type="date" max="${A.TODAY}" value="${A.TODAY}" required></div></div><div class="field"><label for="fg-account">Conta de origem</label><select id="fg-account" name="account" required>${accounts.map(account => `<option value="${E(account.id)}">${E(account.name)}</option>`).join('')}</select></div><p class="fg-deposit-preview" data-fg-preview-output aria-live="polite">${hidden() ? 'Valores ocultos.' : 'Após o aporte: ' + E(A.money(info.saved)) + ' · ' + info.percent + '%'}</p><p class="fg-transfer-note">O valor será reservado da conta escolhida, sem contar como despesa.</p><div class="dialog-actions">${button('close-dialog', 'Cancelar')}<button class="button primary" type="submit" ${accounts.length ? '' : 'disabled'}>Registrar aporte</button></div></form></div></div>`);
  }
  function editor(id) {
    const existing = id ? summary(id)?.goal : null;
    if (id && !existing) return;
    const goal = existing || { id: A.uid('fg'), title: '', target: 0, image: '', deadline: '' };
    A.financeUI.openDialog(existing ? 'Editar meta financeira' : 'Nova meta financeira', `<form data-form="fg-goal" class="fg-editor"><input type="hidden" name="id" value="${E(goal.id)}"><input type="hidden" name="existing" value="${existing ? 'yes' : 'no'}"><p class="fg-form-error" data-fg-error role="alert" tabindex="-1" hidden></p><div class="field"><label for="fg-title">Nome da meta</label><input id="fg-title" name="title" value="${E(goal.title)}" required maxlength="80" placeholder="Ex.: Viagem dos sonhos" autofocus></div><div class="form-grid"><div class="field"><label for="fg-target">Quanto quer guardar?</label><input id="fg-target" name="target" inputmode="decimal" value="${goal.target ? inputMoney(goal.target) : ''}" placeholder="0,00" required></div><div class="field"><label for="fg-deadline">Prazo <span class="fg-optional">(opcional)</span></label><input id="fg-deadline" name="deadline" type="date" value="${E(goal.deadline || '')}"></div></div>${A.media.imageEditor({ key: 'goalImage', value: image(goal), label: 'Imagem da meta (opcional)' })}${existing ? '<p class="fg-edit-hint">Seus aportes são mantidos ao editar a meta.</p>' : ''}<div class="dialog-actions">${button('close-dialog', 'Cancelar')}<button class="button primary" type="submit">${existing ? 'Salvar meta' : 'Criar meta'}</button></div></form>`);
  }
  A.forms['fg-goal'] = (data, form) => {
    if (form.dataset.submitting === 'true') return;
    const title = String(data.get('title') || '').trim(), target = F().parseMoney(data.get('target')), deadline = String(data.get('deadline') || '');
    if (!title || title.length > 80) return fail(form, 'Dê um nome à meta com até 80 caracteres.');
    if (!Number.isSafeInteger(target) || target <= 0) return fail(form, 'Informe um valor maior que zero, com até duas casas decimais.');
    if (deadline && !F().validDate(deadline)) return fail(form, 'Escolha uma data válida para o prazo ou deixe o campo vazio.');
    const media = A.media.read(form, 'goalImage');
    if (!media.ok) return fail(form, media.error);
    form.dataset.submitting = 'true';
    const id = String(data.get('id')), input = { id, title, target, deadline, image: media.value };
    if (data.get('existing') !== 'yes') input.opening = 0;
    const success = F().commit(() => F().saveGoal(input), data.get('existing') === 'yes' ? 'Meta atualizada.' : 'Meta criada.', message => fail(form, message));
    if (success) { A.closeDialog(); refresh(id); }
    else form.dataset.submitting = 'false';
  };
  A.forms['fg-contribution'] = (data, form) => {
    if (form.dataset.submitting === 'true') return;
    const goalId = String(data.get('goalId')), amount = F().parseMoney(data.get('amount')), date = String(data.get('date')), account = String(data.get('account'));
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail(form, 'Informe um valor maior que zero, com até duas casas decimais.');
    if (!F().validDate(date) || date > A.TODAY) return fail(form, 'Escolha uma data até 17/10/2026, o dia desta demonstração.');
    form.dataset.submitting = 'true';
    const success = F().commit(() => F().contribute({ goalId, amount, date, account }), 'Aporte registrado.', message => fail(form, message));
    if (success) { A.closeDialog(); refresh(goalId); }
    else form.dataset.submitting = 'false';
  };
  Object.assign(A.actions, {
    'fg-new': () => editor(),
    'fg-edit': el => editor(el.dataset.id),
    'fg-open': el => open(el.dataset.id)
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-fg-select]')) { selectedGoal = target.value; refresh(); document.querySelector('[data-fg-select]')?.focus({ preventScroll: true }); }
  });
  document.addEventListener('input', event => {
    if (!event.target.matches('[data-fg-preview]')) return;
    const form = event.target.closest('form'), info = summary(form.elements.goalId.value), output = form.querySelector('[data-fg-preview-output]');
    const value = F().parseMoney(event.target.value), amount = Number.isSafeInteger(value) && value > 0 ? value : 0;
    const total = info.saved + amount, percent = Math.round(total / info.target * 100);
    output.textContent = hidden() ? 'Valores ocultos.' : 'Após o aporte: ' + A.money(total) + ' · ' + percent + '%';
  });
  A.financeGoals = { render, open, editor };
})();
