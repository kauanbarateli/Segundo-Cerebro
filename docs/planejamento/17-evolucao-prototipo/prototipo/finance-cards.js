/* Cartões de demonstração: somente os quatro últimos dígitos são registrados. */
(() => {
  'use strict';
  const A = window.App, E = A.esc, I = A.icon;
  const F = () => A.financeModel;
  const ui = { id: null, month: A.TODAY.slice(0, 7), tab: 'invoice', returnId: null };
  const colors = [['stone', 'Grafite'], ['sand', 'Areia'], ['sage', 'Verde']];
  const button = (action, label, cls = '', attrs = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  const money = cents => A.financeUI?.amount ? A.financeUI.amount(cents) : A.state.settings.hideAmounts ? '<span aria-label="Valor oculto">••••</span>' : E(A.money(cents));
  const number = cents => (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  const mainMonth = () => A.financeUI?.month?.() || A.TODAY.slice(0, 7);
  const shortDate = day => day ? new Date(day + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—';
  const colorKey = value => value === 'graphite' ? 'stone' : colors.some(c => c[0] === value) ? value : 'stone';
  const card = id => F().account(id);
  const chip = `<svg width="23" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><rect x="8" y="7" width="8" height="10" rx="2"/><path d="M3 8h5M3 16h5M16 8h5M16 16h5M12 3v4M12 17v4"/></svg>`;
  function tile(c, small = false) {
    return `<span class="fc-tile fc-color-${colorKey(c.color)} ${small ? 'fc-tile-small' : ''}" aria-hidden="true">${chip}<span class="fc-tile-mark"><svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M2 5a4 4 0 0 1 0 4M5 3a7 7 0 0 1 0 8M8 1a10 10 0 0 1 0 12"/></svg></span></span>`;
  }
  function refresh() { if (A.financeUI?.refresh) A.financeUI.refresh(); else A.render(); }
  function show(title, body) {
    const d = document.querySelector('#detail-dialog'), returnFocus = d.open ? A._returnFocus : document.activeElement;
    A.financeUI.openDialog(title, body); A._returnFocus = returnFocus;
  }
  function error(form, message) {
    const el = form.querySelector('[data-fc-error]'); el.hidden = false; el.textContent = message; el.focus();
  }
  const errorMarkup = '<p class="fc-error" data-fc-error role="alert" tabindex="-1" hidden></p>';
  function closeSaved(id) {
    refresh();
    A._returnFocus = [...document.querySelectorAll('[data-action="fc-open"]')].find(el => el.dataset.id === id) || document.querySelector('[data-action="fc-new"]');
    A.closeDialog();
  }
  function list(compact = false) {
    const cards = F().cards(), visible = compact ? cards.slice(0, 3) : cards;
    return `<section class="panel fc-list ${compact ? 'fc-list-compact' : ''}" aria-labelledby="fc-list-title"><div class="fc-list-heading"><h2 id="fc-list-title">Meus cartões <span class="fc-count">${cards.length}</span></h2>${button('fc-new', I('plus', 16) + ' Adicionar', '', 'aria-label="Adicionar cartão"')}</div>${cards.length ? `<div class="fc-card-list">${visible.map(c => {
      const sum = F().cardSummary(c.id), invoice = F().invoice(c.id, mainMonth());
      return `<button type="button" class="fc-card-row" data-action="fc-open" data-id="${E(c.id)}" aria-label="Abrir ${E(c.name)}">${tile(c, true)}<span class="fc-card-copy"><strong>${E(c.name)}</strong><small>•••• ${E(c.last4 || '4821')}</small></span><span class="fc-card-value"><strong>${money(sum.debt)}</strong><small>Vence ${E(shortDate(invoice.dueDate))}</small></span>${I('chevron-right', 16)}</button>`;
    }).join('')}</div><div class="fc-list-footer"><span><small>Total em aberto</small><strong>${money(cards.reduce((sum, c) => sum + F().cardSummary(c.id).debt, 0))}</strong></span>${compact ? button('fc-all', 'Ver todos os cartões', '') : '<small>O pagamento reduz a dívida e o saldo da conta.</small>'}</div>` : `<div class="fc-empty"><p>Adicione um cartão para acompanhar compras e faturas.</p>${button('fc-new', 'Adicionar cartão', 'primary')}</div>`}</section>`;
  }
  function editor(id, fromDetail = false) {
    const existing = id ? card(id) : null;
    if (id && (!existing || existing.kind !== 'card')) return A.notify('Este cartão não está disponível.');
    ui.returnId = fromDetail && existing ? existing.id : null;
    const c = existing || { name: '', last4: '', limit: '', closingDay: 18, dueDay: 25, paymentAccount: F().accounts().find(a => a.kind !== 'card')?.id || '', color: 'stone' };
    const cashAccounts = F().accounts().filter(a => a.kind !== 'card' && !a.archived);
    show(existing ? 'Editar cartão' : 'Adicionar cartão', `<form data-form="fc-card" class="fn-form fc-form"><input type="hidden" name="id" value="${E(existing?.id || '')}">${errorMarkup}<div class="fc-preview">${tile(c)}<div><strong class="fc-preview-name">${E(c.name || 'Seu cartão')}</strong><span class="fc-preview-number">•••• ${E(c.last4 || '0000')}</span></div></div><div class="form-grid fc-name-grid"><div class="field"><label for="fc-name">Nome do cartão</label><input id="fc-name" name="name" value="${E(c.name)}" maxlength="60" required placeholder="Ex.: Cartão pessoal" autofocus></div><div class="field"><label for="fc-last4">Últimos 4 dígitos</label><input id="fc-last4" name="last4" value="${E(c.last4)}" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="off" placeholder="0000"></div></div><div class="fc-limit-grid"><div class="field"><label for="fc-limit">Limite</label><input id="fc-limit" name="limit" value="${c.limit ? number(c.limit) : ''}" inputmode="decimal" required placeholder="0,00"></div><div class="field"><label for="fc-closing">Fecha dia</label><select id="fc-closing" name="closingDay">${Array.from({ length: 31 }, (_, i) => i + 1).map(n => `<option value="${n}" ${Number(c.closingDay) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="field"><label for="fc-due">Vence dia</label><select id="fc-due" name="dueDay">${Array.from({ length: 31 }, (_, i) => i + 1).map(n => `<option value="${n}" ${Number(c.dueDay) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div><div class="field"><label for="fc-account">Conta para pagamento</label><select id="fc-account" name="paymentAccount" required>${cashAccounts.map(a => `<option value="${E(a.id)}" ${c.paymentAccount === a.id ? 'selected' : ''}>${E(a.name)}</option>`).join('')}</select></div><fieldset class="fc-colors"><legend>Cor do cartão</legend><div>${colors.map(([key, label]) => `<label><input type="radio" name="color" value="${key}" ${colorKey(c.color) === key ? 'checked' : ''}><span class="fc-swatch fc-color-${key}" aria-hidden="true">${I('check', 18)}</span><span class="fc-swatch-name">${label}</span></label>`).join('')}</div></fieldset>${existing ? '<p class="fc-hint">Mudanças no fechamento valem para novas compras. As faturas anteriores são preservadas.</p>' : '<p class="fc-hint">O protótipo guarda apenas os últimos quatro dígitos.</p>'}<div class="dialog-actions">${button('fc-editor-cancel', 'Cancelar')}<button type="submit" class="button primary">${existing ? 'Salvar alterações' : 'Adicionar cartão'}</button></div></form>`);
  }
  function rows(items, purchaseOnly = false) {
    const filtered = purchaseOnly ? items.filter(t => t.type === 'expense') : items;
    if (!filtered.length) return '<div class="fc-empty"><p>Nenhuma compra nesta fatura.</p><span>As compras do cartão aparecem aqui ao serem registradas.</span></div>';
    return `<div class="fc-table-wrap" tabindex="0" role="region" aria-label="Movimentações da fatura"><table class="fc-table"><thead><tr><th scope="col">Descrição</th><th scope="col">Data</th><th scope="col">Valor</th></tr></thead><tbody>${filtered.slice().sort((a, b) => b.date.localeCompare(a.date)).map(t => `<tr><td><strong>${E(t.title)}</strong>${t.type === 'transfer' ? '<small>Pagamento da fatura</small>' : ''}</td><td>${E(shortDate(t.date))}</td><td class="${t.type === 'transfer' ? 'fc-paid' : ''}">${t.type === 'transfer' && !A.state.settings.hideAmounts ? '− ' : ''}${money(t.amount)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function open(id, month, tab = 'invoice', focus) {
    const c = card(id); if (!c || c.kind !== 'card') return A.notify('Este cartão não está disponível.');
    ui.id = id; ui.month = /^\d{4}-\d{2}$/.test(month || '') ? month : mainMonth(); ui.tab = ['invoice', 'purchases', 'settings'].includes(tab) ? tab : 'invoice';
    const invoice = F().invoice(id, ui.month), summary = F().cardSummary(id), hidden = A.state.settings.hideAmounts;
    const ratio = summary.limit ? Math.min(100, Math.max(0, summary.debt / summary.limit * 100)) : 0;
    let content = '';
    if (ui.tab === 'settings') content = `<dl class="fc-settings-list"><div><dt>Limite</dt><dd>${money(c.limit)}</dd></div><div><dt>Fechamento</dt><dd>Dia ${Number(c.closingDay)}</dd></div><div><dt>Vencimento</dt><dd>Dia ${Number(c.dueDay)}</dd></div><div><dt>Conta para pagamento</dt><dd>${E(card(c.paymentAccount)?.name || 'Conta principal')}</dd></div></dl><p class="fc-hint">Compras no dia do fechamento entram na próxima fatura.</p>${button('fc-edit', 'Editar configurações', '', `data-id="${E(id)}"`)}`;
    else content = `${ui.tab === 'invoice' ? `<div class="fc-invoice-summary"><div><span>${invoice.debt > 0 ? 'Fatura em aberto' : 'Sem valor em aberto'}</span><strong>${money(Math.max(0, invoice.debt))}</strong></div><div><span>Vencimento</span><b>${E(shortDate(invoice.dueDate))}</b></div><div><span>Fechamento</span><b>${E(shortDate(invoice.closingDate))}</b></div></div>` : `<div class="fc-purchases-total"><span>Compras desta fatura</span><strong>${money(invoice.purchases)}</strong></div>`}${rows(invoice.transactions || [], ui.tab === 'purchases')}<div class="fc-limit-summary"><span>Limite ${money(summary.limit)}</span><span>Disponível ${money(Math.max(0, summary.available))}</span></div>${hidden ? '<div class="fc-hidden-progress" aria-label="Uso do limite oculto"></div>' : `<progress class="fc-progress" max="100" value="${ratio}" aria-label="${Math.round(ratio)}% do limite atual utilizado"></progress>`}${button('fc-pay', 'Registrar pagamento', 'primary fc-pay-button', `data-id="${E(id)}" ${invoice.debt <= 0 ? 'disabled' : ''}`)}`;
    show(c.name, `<section class="fc-detail"><div class="fc-detail-context">${tile(c, true)}<span>•••• ${E(c.last4 || '4821')}</span>${button('fc-edit', 'Editar cartão', '', `data-id="${E(id)}"`)}</div><div class="fc-period"><div>${button('fc-month', I('chevron-left'), 'icon-button', 'data-delta="-1" aria-label="Fatura anterior"')}<label><span class="life-sr">Mês da fatura</span><input type="month" id="fc-month" value="${ui.month}" min="2020-01" max="2040-12" data-fc-month></label>${button('fc-month', I('chevron-right'), 'icon-button', 'data-delta="1" aria-label="Próxima fatura"')}</div></div><div class="fc-tabs" role="tablist" aria-label="Detalhes do cartão">${[['invoice', 'Fatura'], ['purchases', 'Compras'], ['settings', 'Configurações']].map(([key, label]) => `<button type="button" class="fc-tab ${ui.tab === key ? 'is-active' : ''}" role="tab" aria-selected="${ui.tab === key}" tabindex="${ui.tab === key ? '0' : '-1'}" id="fc-tab-${key}" aria-controls="fc-detail-panel" data-action="fc-tab" data-tab="${key}">${label}</button>`).join('')}</div><div id="fc-detail-panel" role="tabpanel" aria-labelledby="fc-tab-${ui.tab}" class="fc-tab-panel" tabindex="0">${content}</div></section>`);
    if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
  }
  function payment(id, month = ui.month, paymentId) {
    const existing = paymentId ? (A.state.transactions || []).find(t => t.id === paymentId && t.type === 'transfer' && !t.deleted) : null;
    const c = card(id), invoice = F().invoice(id, month, existing?.id);
    if (!c || invoice.debt <= 0) return A.notify('Esta fatura não tem valor em aberto.');
    ui.id = id; ui.month = month;
    show(existing ? 'Editar pagamento' : 'Registrar pagamento', `<form data-form="fc-payment" class="fn-form fc-form"><input type="hidden" name="id" value="${E(existing?.id || '')}"><input type="hidden" name="cardId" value="${E(id)}"><input type="hidden" name="month" value="${E(month)}">${errorMarkup}<div class="fc-payment-context">${tile(c, true)}<span><strong>${E(c.name)}</strong><small>Fatura de ${new Date(month + '-01T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</small></span></div><div class="form-grid"><div class="field"><label for="fc-pay-amount">Valor do pagamento</label><input id="fc-pay-amount" name="amount" value="${number(existing?.amount || invoice.debt)}" inputmode="decimal" required autofocus><small>Em aberto: ${money(invoice.debt)}</small></div><div class="field"><label for="fc-pay-date">Data</label><input id="fc-pay-date" name="date" type="date" value="${E(existing?.date || A.TODAY)}" max="${A.TODAY}" required></div></div><div class="field"><label for="fc-pay-account">Conta de origem</label><select id="fc-pay-account" name="account">${F().accounts().filter(a => a.kind !== 'card' && !a.archived).map(a => `<option value="${E(a.id)}" ${a.id === (existing?.account || c.paymentAccount) ? 'selected' : ''}>${E(a.name)}</option>`).join('')}</select></div><p class="fc-hint">O pagamento reduz o saldo da conta e a dívida do cartão, sem contar a despesa novamente.</p><div class="dialog-actions">${button('fc-payment-cancel', 'Voltar')}<button type="submit" class="button primary">${existing ? 'Salvar pagamento' : 'Registrar pagamento'}</button></div></form>`);
  }
  Object.assign(A.actions, {
    'fc-new': () => editor(),
    'fc-open': el => open(el.dataset.id),
    'fc-all': () => A.financeUI?.showTab('cards'),
    'fc-edit': el => editor(el.dataset.id, true),
    'fc-editor-cancel': () => ui.returnId ? open(ui.returnId, ui.month, ui.tab) : A.closeDialog(),
    'fc-tab': el => open(ui.id, ui.month, el.dataset.tab, '#fc-tab-' + el.dataset.tab),
    'fc-month': el => {
      const d = new Date(ui.month + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + Number(el.dataset.delta));
      const month = d.toISOString().slice(0, 7); if (month < '2020-01' || month > '2040-12') return;
      open(ui.id, month, ui.tab, `[data-action="fc-month"][data-delta="${el.dataset.delta}"]`);
    },
    'fc-pay': el => payment(el.dataset.id),
    'fc-payment-cancel': () => open(ui.id, ui.month, 'invoice')
  });
  A.forms['fc-card'] = (data, form) => {
    const oldId = String(data.get('id') || ''), input = { id: oldId || undefined, name: String(data.get('name') || '').trim(), last4: String(data.get('last4') || '').trim(), limit: F().parseMoney(data.get('limit')), closingDay: Number(data.get('closingDay')), dueDay: Number(data.get('dueDay')), paymentAccount: String(data.get('paymentAccount')), color: String(data.get('color')) };
    let saved;
    if (F().commit(() => { saved = F().saveCard(input); }, oldId ? 'Cartão atualizado.' : 'Cartão adicionado.', message => error(form, message))) {
      if (ui.returnId) { refresh(); open(saved.id, ui.month, ui.tab, '#fc-tab-' + ui.tab); }
      else closeSaved(saved.id);
    }
  };
  A.forms['fc-payment'] = (data, form) => {
    const input = { id: String(data.get('id') || '') || undefined, cardId: String(data.get('cardId')), month: String(data.get('month')), amount: F().parseMoney(data.get('amount')), date: String(data.get('date')), account: String(data.get('account')) };
    if (F().commit(() => F().payCard(input), 'Pagamento registrado.', message => error(form, message))) { refresh(); open(input.cardId, input.month, 'invoice', '#fc-tab-invoice'); }
  };
  document.addEventListener('input', event => {
    const el = event.target, form = el.closest?.('[data-form="fc-card"]'); if (!form) return;
    if (el.name === 'name') form.querySelector('.fc-preview-name').textContent = el.value.trim() || 'Seu cartão';
    if (el.name === 'last4') form.querySelector('.fc-preview-number').textContent = '•••• ' + (el.value || '0000');
    if (el.name === 'color') form.querySelector('.fc-tile').className = 'fc-tile fc-color-' + colorKey(el.value);
  });
  document.addEventListener('change', event => {
    const el = event.target; if (!el.matches('[data-fc-month]')) return;
    if (!el.value || !el.checkValidity()) { el.value = ui.month; A.notify('Escolha um mês entre janeiro de 2020 e dezembro de 2040.'); return; }
    open(ui.id, el.value, ui.tab, '#fc-month');
  });
  document.addEventListener('keydown', event => {
    const el = event.target; if (!el.matches('.fc-tab') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...el.parentElement.querySelectorAll('.fc-tab')], current = tabs.indexOf(el);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next].click();
  });
  A.financeCards = { list, open, editor, payment, tile };
})();
