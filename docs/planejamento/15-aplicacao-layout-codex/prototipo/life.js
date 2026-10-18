(function () {
  'use strict';
  const A = window.App;
  const TODAY = '2026-10-17';
  const e = value => A.esc(String(value == null ? '' : value));
  const iconAliases = {pencil:'edit', 'more-horizontal':'more', 'refresh-cw':'refresh', 'key-round':'shield', wifi:'link', monitor:'grid', unlock:'lock', 'arrow-down-left':'arrow-up-right', 'arrow-right-left':'arrow-right'};
  const icon = (name, size) => A.icon(iconAliases[name] || name, size || 18);
  const uid = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const ui = { financeTab: 'resumo', month: '2026-10', financeFilter: 'all', financeQuery: '', week: 0, showArchived: false, vaultOpen: false, vaultItem: 'v1', revealed: false };
  const dates = value => new Date(value + 'T12:00:00Z');
  const addDays = (day, number) => { const d = dates(day); d.setUTCDate(d.getUTCDate() + number); return d.toISOString().slice(0, 10); };
  const dateLabel = day => dates(day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const monthLabel = month => dates(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const settings = () => A.state.settings || (A.state.settings = { name: 'Kauan' });
  const txs = () => A.state.transactions || (A.state.transactions = []);
  const habits = () => A.state.habits || (A.state.habits = []);
  const accounts = () => A.state.accounts || [];
  const amount = value => settings().hideAmounts ? '<span aria-label="Valor oculto">••••</span>' : e(A.money(value));
  const numericAmount = value => (Number(value || 0) / 100).toFixed(2).replace('.', ',');
  const validDate = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(dates(day)) && dates(day).toISOString().slice(0, 10) === day;
  const btn = (action, text, cls, attrs) => '<button type="button" class="button ' + (cls || '') + '" data-action="life-' + action + '" ' + (attrs || '') + '>' + text + '</button>';
  const accountName = kind => { const acc = accounts().find(x => x.kind === kind); return acc ? acc.name : kind === 'card' ? 'Cartão pessoal' : 'Conta principal'; };
  const error = (form, message) => { let output = form.querySelector('[data-form-error]'); if (!output) { output = document.createElement('p'); output.className = 'life-form-error'; output.setAttribute('role', 'alert'); output.dataset.formError = ''; form.prepend(output); } output.textContent = message; };
  const parseMoney = input => {
    let value = String(input || '').trim().replace(/\s|R\$/g, '');
    if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return NaN;
    const cents = Math.round(Number(value) * 100);
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : NaN;
  };
  const dialogEnd = label => '<div class="life-dialog-actions">' + btn('close', 'Cancelar') + '<button class="button primary" type="submit">' + label + '</button></div>';
  A.actions['life-close'] = () => A.closeDialog();

  function financeSummary(month) {
    let cash = accounts().filter(x => x.kind !== 'card').reduce((n, x) => n + Number(x.opening || 0), 0);
    let cardDebt = accounts().filter(x => x.kind === 'card').reduce((n, x) => n + Number(x.opening || 0), 0);
    let income = 0, expense = 0, cardPurchases = 0, payments = 0;
    txs().filter(t => !t.deleted && t.status !== 'cancelled').forEach(t => {
      const value = Number(t.amount || 0);
      const included = !month || String(t.date).slice(0, 7) === month;
      if (t.type === 'income') { if (t.account === 'card') cardDebt -= value; else cash += value; if (included) income += value; }
      if (t.type === 'expense') { if (t.account === 'card') cardDebt += value; else cash -= value; if (included) { expense += value; if (t.account === 'card') cardPurchases += value; } }
      if (t.type === 'transfer') { cash -= value; cardDebt -= value; if (included) payments += value; }
    });
    return { cash, cardDebt, income, expense, cardPurchases, payments, available: cash - Math.max(0, cardDebt) };
  }
  A.lifeFinanceSummary = () => financeSummary('2026-10');

  function transactionRows(items) {
    if (!items.length) return '<div class="empty"><h3>Nenhum lançamento neste período</h3><p>Registre uma receita ou despesa para acompanhar o mês.</p>' + btn('transaction-new', icon('plus') + ' Novo lançamento', 'primary') + '</div>';
    return '<div class="life-table-wrap"><table class="life-transactions"><thead><tr><th scope="col">Lançamento</th><th scope="col">Data</th><th scope="col">Conta</th><th scope="col" class="life-number">Valor</th><th scope="col"><span class="life-sr">Ações</span></th></tr></thead><tbody>' + items.map(t => '<tr><td><div class="life-transaction-title"><span class="life-transaction-symbol ' + (t.type === 'income' ? 'is-income' : t.type === 'transfer' ? 'is-transfer' : '') + '">' + icon(t.type === 'income' ? 'arrow-down-left' : t.type === 'transfer' ? 'arrow-right-left' : 'arrow-up-right') + '</span><span><strong>' + e(t.title) + '</strong><small>' + e(t.type === 'transfer' ? 'Pagamento de fatura' : t.category || 'Outros') + '</small></span></div></td><td class="muted">' + e(dateLabel(t.date)) + '</td><td>' + e(accountName(t.account)) + '</td><td class="life-number ' + (t.type === 'income' ? 'life-income' : '') + '">' + (settings().hideAmounts ? '' : t.type === 'income' ? '+ ' : '− ') + amount(t.amount) + '</td><td>' + btn('transaction-edit', icon('pencil'), 'icon-button', 'data-id="' + e(t.id) + '" aria-label="Editar ' + e(t.title) + '"') + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function budgetView(summary, compact) {
    const budget = (A.state.financeBudgets || {})[ui.month] || 450000;
    const ratio = Math.round(summary.expense / budget * 100);
    const categories = {};
    txs().filter(t => !t.deleted && t.type === 'expense' && t.date.slice(0, 7) === ui.month).forEach(t => { const key = t.category || 'Outros'; categories[key] = (categories[key] || 0) + t.amount; });
    return '<section class="panel life-budget"><div class="section-head"><h2>Plano do mês</h2>' + btn('budget-edit', 'Ajustar limite', '') + '</div><p class="muted">Um limite para todas as despesas, incluindo compras no cartão.</p><div class="life-budget-value"><strong>' + amount(summary.expense) + '</strong><span class="muted">de ' + amount(budget) + '</span></div><progress class="life-progress ' + (ratio >= 100 ? 'is-danger' : '') + '" max="100" value="' + Math.min(ratio, 100) + '" aria-label="' + (settings().hideAmounts ? 'Consumo do orçamento oculto' : ratio + '% do limite usado') + '"></progress><div class="life-budget-caption"><span>' + (settings().hideAmounts ? 'Uso oculto' : ratio + '% utilizado') + '</span><span>' + (ratio > 100 ? 'Limite excedido em ' : 'Ainda disponível: ') + amount(Math.abs(budget - summary.expense)) + '</span></div>' + (compact ? '' : '<div class="life-category-list">' + Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([name, value]) => '<div class="life-category-row"><span>' + e(name) + '</span><span class="life-category-line"><span style="width:' + Math.min(100, value / budget * 100) + '%"></span></span><strong>' + amount(value) + '</strong></div>').join('') + '</div><p class="life-footnote">O limite total é independente dos limites por categoria. Neste protótipo, você ajusta o plano total.</p>') + '</section>';
  }

  A.routes.financeiro = function () {
    const sum = financeSummary(ui.month);
    const list = txs().filter(t => !t.deleted && t.date.slice(0, 7) === ui.month).sort((a, b) => b.date.localeCompare(a.date));
    let content = '';
    if (ui.financeTab === 'resumo') {
      content = '<div class="life-finance-overview"><section class="panel life-cash"><div class="section-head"><h2>Seu dinheiro, com clareza</h2>' + btn('mask-values', icon(settings().hideAmounts ? 'eye' : 'eye-off'), 'icon-button', 'aria-label="' + (settings().hideAmounts ? 'Mostrar valores' : 'Ocultar valores') + '"') + '</div><dl class="life-balances"><div><dt>Saldo em conta</dt><dd>' + amount(sum.cash) + '</dd></div><div><dt>Comprometido no cartão</dt><dd>' + amount(Math.max(0, sum.cardDebt)) + '</dd></div><div class="life-available"><dt>Após reservar a fatura</dt><dd>' + amount(sum.available) + '</dd></div></dl><p class="life-footnote">Saldo atual dos lançamentos de exemplo. Compras no cartão só saem da conta ao pagar a fatura.</p></section>' + budgetView(sum, true) + '</div><div class="life-month-flow"><div><span class="muted">Entradas de ' + e(monthLabel(ui.month).split(' de ')[0]) + '</span><strong class="life-income">' + amount(sum.income) + '</strong></div><div><span class="muted">Despesas do mês</span><strong>' + amount(sum.expense) + '</strong></div><div><span class="muted">Resultado do mês</span><strong>' + amount(sum.income - sum.expense) + '</strong></div></div><section class="panel life-ledger"><div class="section-head"><h2>Lançamentos recentes</h2>' + btn('finance-tab', 'Ver todos', '', 'data-tab="lancamentos"') + '</div>' + transactionRows(list.slice(0, 5)) + '</section>';
    } else if (ui.financeTab === 'lancamentos') {
      const filtered = list.filter(t => (ui.financeFilter === 'all' || t.type === ui.financeFilter) && (t.title + ' ' + t.category).toLocaleLowerCase('pt-BR').includes(ui.financeQuery.toLocaleLowerCase('pt-BR')));
      content = '<section class="panel life-ledger"><div class="life-ledger-tools"><form data-form="life-finance-search" class="life-search-form"><label class="life-sr" for="life-finance-query">Buscar lançamentos</label><input id="life-finance-query" name="query" type="search" value="' + e(ui.financeQuery) + '" placeholder="Buscar lançamento ou categoria"><button type="submit" class="button">' + icon('search') + '<span>Buscar</span></button></form><div class="life-filter-group" aria-label="Tipo de lançamento">' + [['all', 'Todos'], ['income', 'Receitas'], ['expense', 'Despesas'], ['transfer', 'Pagamentos']].map(([key, label]) => btn('finance-filter', label, ui.financeFilter === key ? 'is-selected' : '', 'data-filter="' + key + '" aria-pressed="' + (ui.financeFilter === key) + '"')).join('') + '</div></div>' + transactionRows(filtered) + '<p class="life-footnote">' + filtered.length + ' lançamento' + (filtered.length === 1 ? '' : 's') + ' encontrado' + (filtered.length === 1 ? '' : 's') + '. Os totais do resumo consideram o mês completo.</p></section>';
    } else if (ui.financeTab === 'fatura') {
      content = '<div class="life-finance-overview"><section class="panel life-cash"><div class="section-head"><h2>' + e(accountName('card')) + '</h2><span class="pill">Exemplo</span></div><p class="muted">Valor em aberto</p><p class="life-statement-total">' + amount(Math.max(0, sum.cardDebt)) + '</p><p class="muted">Compras do período: ' + amount(sum.cardPurchases) + '<br>Pagamentos no período: ' + amount(sum.payments) + '</p>' + btn('pay-card', icon('check') + ' Registrar pagamento', 'primary', sum.cardDebt <= 0 ? 'disabled' : '') + '</section><section class="panel life-statement-explanation"><h2>Uma compra, uma despesa</h2><p>As compras compõem a fatura e entram nas despesas. O pagamento reduz o saldo da conta e a dívida do cartão, sem contar a despesa novamente.</p><p class="muted">Nesta demonstração, as compras são agrupadas pelo mês do lançamento. Ciclos de fechamento, juros e parcelamentos não são simulados.</p></section></div><section class="panel life-ledger"><div class="section-head"><h2>Compras e pagamentos de ' + e(monthLabel(ui.month)) + '</h2></div>' + transactionRows(list.filter(t => t.account === 'card' || t.type === 'transfer')) + '</section>';
    } else content = budgetView(sum, false);
    return '<div class="life-page"><div class="life-page-toolbar"><p class="muted">Contas, compromissos e escolhas para o seu mês.</p>' + btn('transaction-new', icon('plus') + ' Novo lançamento', 'primary') + '</div><div class="life-tabs-toolbar"><div class="tabs" role="tablist" aria-label="Financeiro">' + [['resumo', 'Visão geral'], ['lancamentos', 'Lançamentos'], ['fatura', 'Cartão'], ['plano', 'Planejamento']].map(([key, label]) => '<button class="tab ' + (ui.financeTab === key ? 'active' : '') + '" type="button" role="tab" aria-selected="' + (ui.financeTab === key) + '" data-action="life-finance-tab" data-tab="' + key + '">' + label + '</button>').join('') + '</div><div class="life-period">' + btn('finance-month', icon('chevron-left'), 'icon-button', 'data-delta="-1" aria-label="Mês anterior"') + '<span>' + e(monthLabel(ui.month)) + '</span>' + btn('finance-month', icon('chevron-right'), 'icon-button', 'data-delta="1" aria-label="Próximo mês"') + '</div></div>' + content + '</div>';
  };

  A.actions['life-finance-tab'] = el => { ui.financeTab = el.dataset.tab; A.render(); };
  A.actions['life-finance-month'] = el => { const d = dates(ui.month + '-01'); d.setUTCMonth(d.getUTCMonth() + Number(el.dataset.delta)); ui.month = d.toISOString().slice(0, 7); A.render(); };
  A.actions['life-finance-filter'] = el => { ui.financeFilter = el.dataset.filter; A.render(); };
  A.forms['life-finance-search'] = data => { ui.financeQuery = String(data.get('query') || '').trim(); A.render(); };
  A.actions['life-mask-values'] = () => { settings().hideAmounts = !settings().hideAmounts; A.persist(settings().hideAmounts ? 'Valores ocultos.' : 'Valores visíveis.'); };

  function transactionDialog(existing) {
    const t = existing || { title: '', amount: '', type: 'expense', account: 'checking', date: TODAY, category: 'Alimentação' };
    if (t.type === 'transfer') { paymentDialog(t); return; }
    A.openDialog(existing ? 'Editar lançamento' : 'Novo lançamento', '<form data-form="life-transaction"><input type="hidden" name="id" value="' + e(t.id || '') + '"><div class="field"><label for="life-title">Descrição</label><input id="life-title" name="title" value="' + e(t.title) + '" required maxlength="100" placeholder="Ex.: Mercado da semana" autofocus></div><div class="form-grid"><div class="field"><label for="life-value">Valor em reais</label><input id="life-value" name="amount" value="' + (t.amount ? numericAmount(t.amount) : '') + '" inputmode="decimal" placeholder="0,00" required></div><div class="field"><label for="life-type">Tipo</label><select id="life-type" name="type"><option value="expense" ' + (t.type === 'expense' ? 'selected' : '') + '>Despesa</option><option value="income" ' + (t.type === 'income' ? 'selected' : '') + '>Receita</option></select></div><div class="field"><label for="life-account">Conta</label><select id="life-account" name="account"><option value="checking" ' + (t.account === 'checking' ? 'selected' : '') + '>' + e(accountName('checking')) + '</option><option value="card" ' + (t.account === 'card' ? 'selected' : '') + '>' + e(accountName('card')) + '</option></select></div><div class="field"><label for="life-date">Data</label><input id="life-date" name="date" type="date" value="' + e(t.date) + '" max="' + TODAY + '" required></div></div><div class="field"><label for="life-category">Categoria</label><select id="life-category" name="category">' + ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Trabalho', 'Salário', 'Outros'].map(x => '<option ' + (t.category === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div><p class="life-footnote">Lançamento confirmado de exemplo. Use Planejamento para ajustar o limite mensal. Receitas devem entrar na conta principal.</p>' + (existing ? btn('transaction-remove', 'Excluir lançamento', 'life-danger-link', 'data-id="' + e(t.id) + '"') : '') + dialogEnd(existing ? 'Salvar alterações' : 'Criar lançamento') + '</form>');
  }
  A.actions['life-transaction-new'] = () => transactionDialog();
  A.actions['life-transaction-edit'] = el => { const t = txs().find(x => x.id === el.dataset.id); if (t) transactionDialog(t); };
  A.forms['life-transaction'] = (data, form) => {
    const title = String(data.get('title') || '').trim(), value = parseMoney(data.get('amount')), date = String(data.get('date')), type = String(data.get('type')), account = String(data.get('account'));
    if (!title || title.length > 100) return error(form, 'Informe uma descrição com até 100 caracteres.');
    if (!Number.isFinite(value)) return error(form, 'Informe um valor maior que zero, com até duas casas decimais.');
    if (!validDate(date) || date > TODAY) return error(form, 'Use uma data válida até 17/10/2026, o dia desta demonstração.');
    if (!['income', 'expense'].includes(type) || !['checking', 'card'].includes(account)) return error(form, 'Selecione um tipo e uma conta válidos.');
    if (type === 'income' && account === 'card') return error(form, 'Registre receitas na conta principal. Use “Registrar pagamento” para pagar o cartão.');
    const id = String(data.get('id') || '');
    const current = txs().find(t => t.id === id);
    const next = { id: current ? current.id : uid('tr'), title, amount: value, date, type, account, category: String(data.get('category')), status: 'confirmed' };
    if (current) Object.assign(current, next); else txs().push(next);
    A.closeDialog(); A.persist(current ? 'Lançamento atualizado.' : 'Lançamento criado.');
  };
  A.actions['life-transaction-remove'] = el => { const t = txs().find(x => x.id === el.dataset.id); if (!t) return; A.openDialog('Excluir lançamento?', '<p>“' + e(t.title) + '” será retirado dos totais. A exclusão afeta apenas os dados locais desta demonstração.</p><div class="life-dialog-actions">' + btn('close', 'Cancelar') + btn('transaction-delete-confirm', 'Excluir lançamento', 'life-danger-button', 'data-id="' + e(t.id) + '"') + '</div>'); };
  A.actions['life-transaction-delete-confirm'] = el => { const t = txs().find(x => x.id === el.dataset.id); if (t) t.deleted = true; A.closeDialog(); A.persist('Lançamento excluído dos totais.'); };
  A.actions['life-budget-edit'] = () => A.openDialog('Ajustar plano do mês', '<form data-form="life-budget"><p class="muted">Defina o limite total de despesas para ' + e(monthLabel(ui.month)) + '.</p><div class="field"><label for="life-budget-input">Limite em reais</label><input id="life-budget-input" name="amount" inputmode="decimal" value="' + numericAmount((A.state.financeBudgets || {})[ui.month] || 450000) + '" required autofocus></div>' + dialogEnd('Salvar limite') + '</form>');
  A.forms['life-budget'] = (data, form) => { const value = parseMoney(data.get('amount')); if (!Number.isFinite(value)) return error(form, 'Informe um limite maior que zero, com até duas casas decimais.'); (A.state.financeBudgets || (A.state.financeBudgets = {}))[ui.month] = value; A.closeDialog(); A.persist('Plano mensal atualizado.'); };

  function paymentDialog(t) {
    const debt = financeSummary().cardDebt + (t ? t.amount : 0);
    if (debt <= 0) return A.notify('O cartão não tem valor em aberto.');
    A.openDialog(t ? 'Editar pagamento' : 'Registrar pagamento da fatura', '<form data-form="life-card-payment"><input type="hidden" name="id" value="' + e(t ? t.id : '') + '"><p class="muted">Saída da ' + e(accountName('checking')) + ' e redução da dívida do cartão na mesma operação.</p><div class="field"><label for="life-pay-value">Valor do pagamento em reais</label><input id="life-pay-value" name="amount" inputmode="decimal" value="' + numericAmount(t ? t.amount : debt) + '" required autofocus></div><p class="life-footnote">Você pode registrar um pagamento parcial. Dívida antes deste pagamento: ' + amount(debt) + '.</p><div class="field"><label for="life-pay-date">Data</label><input id="life-pay-date" name="date" type="date" value="' + e(t ? t.date : TODAY) + '" max="' + TODAY + '" required></div>' + (t ? btn('transaction-remove', 'Excluir pagamento', 'life-danger-link', 'data-id="' + e(t.id) + '"') : '') + dialogEnd(t ? 'Salvar pagamento' : 'Confirmar pagamento') + '</form>');
  }
  A.actions['life-pay-card'] = () => paymentDialog();
  A.forms['life-card-payment'] = (data, form) => {
    const value = parseMoney(data.get('amount')), day = String(data.get('date')), old = txs().find(t => t.id === data.get('id'));
    const debt = financeSummary().cardDebt + (old ? old.amount : 0);
    if (!Number.isFinite(value) || value > debt) return error(form, 'Informe um valor maior que zero e até o valor em aberto da fatura.');
    if (!validDate(day) || day > TODAY) return error(form, 'Informe uma data válida até 17/10/2026.');
    const item = { id: old ? old.id : uid('tr'), title: 'Pagamento da fatura', amount: value, type: 'transfer', account: 'checking', toAccount: 'card', date: day, category: 'Pagamento de fatura' };
    if (old) Object.assign(old, item); else txs().push(item);
    A.closeDialog(); A.persist('Pagamento registrado. Saldo e dívida atualizados juntos.');
  };

  function habitCadence(h) { return h.cadence || 'daily'; }
  function habitGoal(h) { return habitCadence(h) === 'weekly_target' ? Number(h.weeklyTarget || h.goal) || 3 : habitCadence(h) === 'weekdays' ? (h.weekdays || [1, 2, 3, 4, 5]).length : 7; }
  function habitEligible(h, day) { return day >= (h.startDate || '2026-01-01') && (habitCadence(h) !== 'weekdays' || (h.weekdays || [1, 2, 3, 4, 5]).includes(dates(day).getUTCDay())); }
  const habitDays = () => Array.from({ length: 7 }, (_, n) => addDays('2026-10-12', ui.week * 7 + n));
  function habitSchedule(h) { return habitCadence(h) === 'weekly_target' ? habitGoal(h) + ' vezes por semana' : habitCadence(h) === 'weekdays' ? (h.weekdays || []).map(n => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][n]).join(', ') : typeof h.goal === 'string' && h.goal ? h.goal : 'Todos os dias'; }
  A.lifeHabitGoal = habitGoal;
  A.lifeHabitSchedule = habitSchedule;
  A.lifeHabitEligible = h => !h.archived && !h.paused && habitEligible(h, TODAY);
  A.lifeToggleHabit = function (id, day) {
    const h = habits().find(x => x.id === id); day = day || TODAY;
    if (!h || h.archived || h.paused) return A.notify('Retome este hábito antes de registrar.');
    if (day > TODAY || !habitEligible(h, day)) return A.notify('Escolha um dia elegível, até o dia atual da demonstração.');
    if (!Array.isArray(h.checked)) h.checked = [];
    const existing = h.checked.indexOf(day);
    if (existing >= 0) h.checked.splice(existing, 1); else h.checked.push(day);
    A.persist(existing >= 0 ? 'Registro desfeito.' : 'Hábito registrado. Um passo de cada vez.');
  };
  A.routes.habitos = function () {
    const days = habitDays(), active = habits().filter(h => ui.showArchived ? h.archived : !h.archived);
    const completed = habits().filter(h => !h.archived && (h.checked || []).includes(TODAY)).length;
    const expected = habits().filter(h => !h.archived && !h.paused && habitEligible(h, TODAY)).length;
    return '<div class="life-page"><div class="life-page-toolbar"><p class="muted">Consistência com espaço para a vida acontecer.</p>' + btn('habit-new', icon('plus') + ' Novo hábito', 'primary') + '</div><section class="life-habit-intro"><div><h2>Pequenos passos. Mais presença.</h2><p><strong>' + completed + '</strong> hábito' + (completed === 1 ? '' : 's') + ' registrado' + (completed === 1 ? '' : 's') + ' hoje' + (expected ? ', de ' + expected + ' disponíve' + (expected === 1 ? 'l' : 'is') : '') + '.</p></div><span class="pill">Sábado, 17 de outubro</span></section><section class="panel life-habit-panel"><div class="section-head"><div class="life-period">' + btn('habit-week', icon('chevron-left'), 'icon-button', 'data-delta="-1" aria-label="Semana anterior"') + '<h2>' + e(dateLabel(days[0])) + ' — ' + e(dateLabel(days[6])) + '</h2>' + btn('habit-week', icon('chevron-right'), 'icon-button', 'data-delta="1" aria-label="Próxima semana" ' + (ui.week >= 0 ? 'disabled' : '')) + '</div><div class="row">' + (ui.week !== 0 ? btn('habit-current', 'Esta semana') : '') + btn('habit-archive-view', ui.showArchived ? 'Ver ativos' : 'Arquivados', ui.showArchived ? 'is-selected' : '') + '</div></div>' + (active.length ? '<p class="life-scroll-hint">Deslize a semana para ver todos os dias.</p><div class="life-habit-grid-wrap" role="region" aria-label="Marcações dos hábitos na semana" tabindex="0"><table class="life-habit-grid"><thead><tr><th scope="col">Sua prática</th>' + days.map((day, n) => '<th scope="col" class="' + (day === TODAY ? 'life-today' : '') + '"><span>' + ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][n] + '</span><strong>' + day.slice(8) + '</strong></th>').join('') + '<th scope="col">Semana</th><th scope="col"><span class="life-sr">Ações</span></th></tr></thead><tbody>' + active.map(h => {
      const checked = (h.checked || []).filter(d => days.includes(d) && habitEligible(h, d)).length;
      const goal = habitGoal(h);
      return '<tr class="' + (h.paused ? 'life-habit-paused' : '') + '"><td><strong>' + e(h.title) + '</strong><span class="life-habit-description">' + (h.paused ? 'Em pausa · histórico preservado' : e(habitSchedule(h))) + '</span></td>' + days.map(day => {
        const done = (h.checked || []).includes(day), unavailable = day > TODAY || h.paused || h.archived || !habitEligible(h, day);
        return '<td><button type="button" class="life-habit-check ' + (done ? 'is-done' : '') + ' ' + (day === TODAY ? 'is-today' : '') + '" data-action="life-habit-toggle" data-id="' + e(h.id) + '" data-date="' + day + '" aria-pressed="' + done + '" aria-label="' + e((done ? 'Desmarcar ' : 'Registrar ') + h.title + ' em ' + dateLabel(day)) + '" ' + (unavailable ? 'disabled' : '') + '>' + (done ? icon('check', 17) : day > TODAY ? '<span class="life-future-dot"></span>' : '<span class="life-check-dot"></span>') + '</button></td>';
      }).join('') + '<td><strong class="life-habit-count">' + checked + '<span> / ' + goal + '</span></strong><small class="life-habit-description">' + (checked >= goal ? 'Meta alcançada' : h.paused ? 'Em pausa' : 'em andamento') + '</small></td><td>' + btn('habit-edit', icon('more-horizontal'), 'icon-button', 'data-id="' + e(h.id) + '" aria-label="Editar ' + e(h.title) + '"') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><h3>' + (ui.showArchived ? 'Nenhum hábito arquivado' : 'Comece com uma prática simples') + '</h3><p>' + (ui.showArchived ? 'Os hábitos arquivados ficam aqui com seu histórico.' : 'Escolha algo que cabe no seu dia e construa seu ritmo.') + '</p>' + (ui.showArchived ? '' : btn('habit-new', 'Criar meu primeiro hábito', 'primary')) + '</div>') + '</section><div class="life-habit-note">' + icon('info') + '<p>A semana começa na segunda. Metas semanais podem ser cumpridas em qualquer dia; um dia sem registro não representa uma falha. Datas futuras não podem ser marcadas.</p></div></div>';
  };
  A.actions['life-habit-toggle'] = el => A.lifeToggleHabit(el.dataset.id, el.dataset.date);
  A.actions['life-habit-week'] = el => { ui.week = Math.min(0, ui.week + Number(el.dataset.delta)); A.render(); };
  A.actions['life-habit-current'] = () => { ui.week = 0; A.render(); };
  A.actions['life-habit-archive-view'] = () => { ui.showArchived = !ui.showArchived; A.render(); };
  function habitDialog(h) {
    h = h || { title: '', cadence: 'daily', goal: 3, weekdays: [1, 2, 3, 4, 5] };
    A.openDialog(h.id ? 'Editar hábito' : 'Novo hábito', '<form data-form="life-habit"><input type="hidden" name="id" value="' + e(h.id || '') + '"><div class="field"><label for="life-habit-title">Qual prática você quer cultivar?</label><input id="life-habit-title" name="title" required maxlength="80" value="' + e(h.title) + '" placeholder="Ex.: Ler por 20 minutos" autofocus></div><div class="form-grid"><div class="field"><label for="life-habit-cadence">Frequência</label><select id="life-habit-cadence" name="cadence">' + [['daily', 'Todos os dias'], ['weekdays', 'Dias específicos'], ['weekly_target', 'Meta semanal']].map(([v, text]) => '<option value="' + v + '" ' + (habitCadence(h) === v ? 'selected' : '') + '>' + text + '</option>').join('') + '</select></div><div class="field"><label for="life-habit-goal">Meta semanal</label><input id="life-habit-goal" type="number" name="goal" min="1" max="7" value="' + (Number(h.weeklyTarget || h.goal) || 3) + '"><small class="muted">Usada ao escolher “Meta semanal”.</small></div></div><fieldset class="life-days-fieldset"><legend>Dias específicos</legend><div>' + [1, 2, 3, 4, 5, 6, 0].map(n => '<label><input type="checkbox" name="weekdays" value="' + n + '" ' + ((h.weekdays || []).includes(n) ? 'checked' : '') + '><span>' + ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][n] + '</span></label>').join('') + '</div><p class="muted">Usados apenas na frequência “Dias específicos”.</p></fieldset>' + (h.id ? '<div class="life-habit-management">' + btn('habit-pause', h.paused ? 'Retomar hábito' : 'Pausar hábito', '', 'data-id="' + e(h.id) + '"') + btn('habit-archive', h.archived ? 'Restaurar hábito' : 'Arquivar hábito', '', 'data-id="' + e(h.id) + '"') + '</div><p class="life-footnote">Pausar ou arquivar preserva todos os registros.</p>' : '') + dialogEnd(h.id ? 'Salvar alterações' : 'Criar hábito') + '</form>');
  }
  A.actions['life-habit-new'] = () => habitDialog();
  A.actions['life-habit-edit'] = el => { const h = habits().find(x => x.id === el.dataset.id); if (h) habitDialog(h); };
  A.forms['life-habit'] = (data, form) => {
    const title = String(data.get('title') || '').trim(), cadence = String(data.get('cadence')), goal = Number(data.get('goal')), weekdays = data.getAll('weekdays').map(Number);
    if (!title || title.length > 80) return error(form, 'Dê um nome ao hábito com até 80 caracteres.');
    if (!['daily', 'weekdays', 'weekly_target'].includes(cadence)) return error(form, 'Selecione uma frequência válida.');
    if (cadence === 'weekly_target' && (!Number.isInteger(goal) || goal < 1 || goal > 7)) return error(form, 'Defina uma meta entre 1 e 7 vezes por semana.');
    if (cadence === 'weekdays' && !weekdays.length) return error(form, 'Selecione pelo menos um dia da semana.');
    const old = habits().find(h => h.id === data.get('id'));
    if (old) Object.assign(old, { title, cadence, goal: cadence === 'weekly_target' ? goal : cadence === 'weekdays' ? weekdays.length : 7, weeklyTarget: goal, weekdays });
    else habits().push({ id: uid('hb'), title, cadence, goal: cadence === 'weekly_target' ? goal : cadence === 'weekdays' ? weekdays.length : 7, weeklyTarget: goal, weekdays, checked: [], paused: false, archived: false, startDate: TODAY });
    A.closeDialog(); A.persist(old ? 'Hábito atualizado.' : 'Hábito criado. Seu primeiro registro já pode começar.');
  };
  A.actions['life-habit-pause'] = el => { const h = habits().find(x => x.id === el.dataset.id); if (!h) return; h.paused = !h.paused; A.closeDialog(); A.persist(h.paused ? 'Hábito pausado. Seu histórico está preservado.' : 'Hábito retomado.'); };
  A.actions['life-habit-archive'] = el => { const h = habits().find(x => x.id === el.dataset.id); if (!h) return; h.archived = !h.archived; A.closeDialog(); A.persist(h.archived ? 'Hábito arquivado.' : 'Hábito restaurado.'); };

  const vaultExamples = [
    { id: 'v1', title: 'Conta de demonstração', user: 'pessoa@example.com', url: 'https://example.com', password: 'EXEMPLO-ApenasDemo-2026', note: 'Credencial fictícia para demonstrar a navegação do Cofre.' },
    { id: 'v2', title: 'Wi-Fi de exemplo', user: 'Rede de demonstração', url: 'Não se aplica', password: 'EXEMPLO-Rede-Ficticia-42', note: 'Esta rede não existe. Nenhum dado pessoal é armazenado neste módulo.' }
  ];
  A.routes.cofre = function () {
    if (!ui.vaultOpen) return '<div class="life-vault-locked"><div class="life-vault-mark">' + icon('lock', 34) + '</div><h2>Um lugar para o que é privado.</h2><p>Explore o fluxo do Cofre com credenciais fictícias, sem informar senha mestra ou qualquer segredo real.</p>' + btn('vault-open', icon('unlock') + ' Abrir cofre de demonstração', 'primary') + '<div class="notice life-vault-notice"><strong>Demonstração sem criptografia</strong><p>O produto prevê um Cofre cifrado. Este protótipo apenas demonstra abrir, revelar, copiar e bloquear itens de exemplo.</p></div></div>';
    const item = vaultExamples.find(v => v.id === ui.vaultItem) || vaultExamples[0];
    return '<div class="life-page"><div class="life-page-toolbar"><p class="muted">Somente credenciais fictícias. Nenhuma senha real é solicitada.</p>' + btn('vault-lock', icon('lock') + ' Bloquear cofre') + '</div><div class="notice life-vault-inline">Demonstração sem criptografia. O cofre bloqueia ao sair desta área, trocar de aba ou perder o foco da janela.</div><div class="life-vault-layout"><section class="panel life-vault-list"><h2>Itens de exemplo</h2>' + vaultExamples.map(v => '<button type="button" class="life-vault-item ' + (v.id === item.id ? 'is-selected' : '') + '" data-action="life-vault-select" data-id="' + v.id + '" aria-pressed="' + (v.id === item.id) + '">' + icon(v.id === 'v1' ? 'key-round' : 'wifi') + '<span><strong>' + e(v.title) + '</strong><small>' + e(v.user) + '</small></span></button>').join('') + '</section><section class="panel life-vault-detail"><div class="section-head"><h2>' + e(item.title) + '</h2><span class="pill">Fictício</span></div><dl class="life-secret-fields"><div><dt>Usuário</dt><dd>' + e(item.user) + '</dd></div><div><dt>Senha de exemplo</dt><dd><span class="life-demo-password">' + (ui.revealed ? e(item.password) : '••••••••••••••••') + '</span><div class="row">' + btn('vault-reveal', icon(ui.revealed ? 'eye-off' : 'eye'), 'icon-button', 'aria-label="' + (ui.revealed ? 'Ocultar' : 'Revelar') + ' senha de exemplo"') + btn('vault-copy', icon('copy'), 'icon-button', 'aria-label="Copiar senha de exemplo"') + '</div></dd></div><div><dt>Endereço</dt><dd>' + e(item.url) + '</dd></div><div><dt>Nota</dt><dd class="muted">' + e(item.note) + '</dd></div></dl><p class="life-footnote">Os itens são fixos e não são salvos no armazenamento local. O kit de recuperação e a senha mestra fazem parte do produto completo.</p></section></div></div>';
  };
  function lockVault(render) { const wasOpen = ui.vaultOpen; ui.vaultOpen = false; ui.revealed = false; if (wasOpen && render) A.render(); }
  A.lifeLockVault = () => lockVault(false);
  A.actions['life-vault-open'] = () => { ui.vaultOpen = true; ui.revealed = false; A.render(); };
  A.actions['life-vault-lock'] = () => { lockVault(true); A.notify('Cofre de demonstração bloqueado.'); };
  A.actions['life-vault-select'] = el => { ui.vaultItem = el.dataset.id; ui.revealed = false; A.render(); };
  A.actions['life-vault-reveal'] = () => { if (ui.vaultOpen) { ui.revealed = !ui.revealed; A.render(); } };
  A.actions['life-vault-copy'] = async () => {
    if (!ui.vaultOpen) return;
    const item = vaultExamples.find(v => v.id === ui.vaultItem);
    try { if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error(); await navigator.clipboard.writeText(item.password); A.notify('Senha fictícia copiada.'); }
    catch (_) { A.notify('O navegador bloqueou a cópia. Use Revelar para selecionar o exemplo.'); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) lockVault(true); });
  window.addEventListener('blur', () => lockVault(true));
  window.addEventListener('hashchange', () => { if (!location.hash.includes('cofre')) lockVault(false); });

  A.routes.configuracoes = function () {
    const s = settings(), theme = A.ui.theme || s.theme || 'light';
    return '<div class="life-page life-settings"><p class="muted">Ajuste o Segundo Cérebro ao seu jeito de organizar a vida.</p><section class="panel"><div class="life-settings-heading"><h2>Seu perfil</h2><p class="muted">Como você aparece nesta demonstração.</p></div><form data-form="life-profile"><div class="life-profile-row"><span class="life-avatar">' + e((s.name || 'Kauan').trim().slice(0, 1).toUpperCase()) + '</span><div class="field"><label for="life-profile-name">Nome de apresentação</label><input id="life-profile-name" name="name" maxlength="50" required value="' + e(s.name || 'Kauan') + '"></div><button class="button primary" type="submit">Salvar nome</button></div></form></section><section class="panel"><div class="life-settings-heading"><h2>Aparência</h2><p class="muted">O tema acompanha todas as áreas e fica salvo neste navegador.</p></div><div class="life-theme-options">' + [['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon'], ['system', 'Sistema', 'monitor']].map(([key, name, ico]) => '<button class="life-theme-option ' + (theme === key ? 'is-selected' : '') + '" type="button" data-action="life-theme" data-theme="' + key + '" aria-pressed="' + (theme === key) + '"><span class="life-theme-preview preview-' + key + '"><i></i><i></i><i></i></span><span>' + icon(ico) + name + (theme === key ? icon('check') : '') + '</span></button>').join('') + '</div></section><section class="panel"><div class="life-settings-heading"><h2>Preferências</h2><p class="muted">Pequenos ajustes para o dia a dia.</p></div><form data-form="life-preferences"><label class="life-toggle-row"><span><strong>Ocultar valores financeiros</strong><small>Mascarar saldos e lançamentos ao abrir o Financeiro.</small></span><input type="checkbox" name="hideAmounts" ' + (s.hideAmounts ? 'checked' : '') + '></label><label class="life-toggle-row"><span><strong>Lembretes de reunião</strong><small>Preferência demonstrativa, sem notificações externas ou com o navegador fechado.</small></span><input type="checkbox" name="reminders" ' + (s.reminders !== false ? 'checked' : '') + '></label><div class="form-grid"><div class="field"><label for="life-calendar-view">Visualização inicial da agenda</label><select id="life-calendar-view" name="calendarView">' + [['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([key, text]) => '<option value="' + key + '" ' + ((s.calendarView || 'week') === key ? 'selected' : '') + '>' + text + '</option>').join('') + '</select></div><div class="field"><label for="life-reminder-minutes">Antecedência</label><select id="life-reminder-minutes" name="reminderMinutes">' + [5, 10, 15, 30].map(n => '<option value="' + n + '" ' + ((Number(s.reminderMinutes) || 10) === n ? 'selected' : '') + '>' + n + ' minutos</option>').join('') + '</select></div></div><button type="submit" class="button primary">Salvar preferências</button></form></section><section class="panel"><div class="section-head"><div><h2>Calendários conectados</h2><p class="muted">Escolha as fontes de exemplo exibidas na agenda.</p></div>' + btn('go-integrations', 'Gerenciar integrações ' + icon('arrow-right')) + '</div></section><section class="panel"><div class="life-settings-heading"><h2>Dados da demonstração</h2><p class="muted">As alterações ficam somente neste navegador. Este arquivo exporta dados do protótipo, não os dados da sua conta real.</p></div><div class="row">' + btn('export', icon('download') + ' Exportar demonstração') + btn('reset', 'Restaurar exemplos', 'life-danger-link') + '</div></section></div>';
  };
  A.forms['life-profile'] = (data, form) => { const name = String(data.get('name') || '').trim(); if (!name || name.length > 50) return error(form, 'Informe um nome com até 50 caracteres.'); settings().name = name; A.persist('Nome atualizado.'); };
  A.actions['life-theme'] = el => { settings().theme = el.dataset.theme; A.setTheme(el.dataset.theme); A.save(); A.notify('Tema atualizado.'); };
  A.forms['life-preferences'] = data => { Object.assign(settings(), { hideAmounts: data.has('hideAmounts'), reminders: data.has('reminders'), calendarView: String(data.get('calendarView')), reminderMinutes: Number(data.get('reminderMinutes')) }); A.ui.calendarView = settings().calendarView; A.persist('Preferências salvas neste navegador.'); };
  A.actions['life-go-integrations'] = () => A.go('integracoes');
  A.actions['life-export'] = () => A.exportData();
  A.actions['life-reset'] = () => { lockVault(false); A.resetDemo(); };

  function googleAccounts() { return A.state.googleAccounts || (A.state.googleAccounts = [{ id: 'google-demo-1', name: 'Conta pessoal', email: 'pessoa@example.com', sources: ['personal', 'study'] }, { id: 'google-demo-2', name: 'Conta de trabalho', email: 'trabalho@example.com', sources: ['work'] }]); }
  const sources = { work: 'Trabalho', personal: 'Pessoal', study: 'Estudos' };
  A.routes.integracoes = function () {
    const google = googleAccounts(), selected = A.state.calendarSources || (A.state.calendarSources = { work: true, personal: true, study: true });
    return '<div class="life-page life-integrations"><div class="life-page-toolbar"><p class="muted">Seu tempo em um só lugar, com as fontes que importam.</p>' + btn('go-calendar', 'Abrir calendário ' + icon('arrow-right')) + '</div><div class="notice life-integration-notice"><strong>Conexões simuladas</strong><p>Esta tela demonstra até duas contas Google. Não solicita acesso à sua conta e não envia dados ao Google. A integração prevista no produto é somente leitura.</p></div><section class="panel"><div class="section-head"><div class="life-google-heading"><span class="life-google-letter" aria-hidden="true">G</span><div><h2>Google Calendar</h2><p class="muted">' + google.length + ' de 2 contas de exemplo</p></div></div>' + btn('google-add', icon('plus') + ' Adicionar conta de exemplo', '', google.length >= 2 ? 'disabled' : '') + '</div><div class="life-google-accounts">' + (google.length ? google.map(g => '<section class="life-google-account"><div class="section-head"><div><h3>' + e(g.name) + '</h3><p class="muted">' + e(g.email) + '</p></div><span class="pill">Simulação</span></div><div class="life-source-list">' + g.sources.map(key => '<label class="life-toggle-row"><span class="life-source-name"><i class="life-source-dot source-' + key + '"></i><strong>' + sources[key] + '</strong></span><input type="checkbox" data-action="life-google-source" data-source="' + key + '" ' + (selected[key] ? 'checked' : '') + ' aria-label="Mostrar calendário ' + sources[key] + '"></label>').join('') + '</div><div class="life-account-actions">' + btn('google-sync', icon('refresh-cw') + ' Simular sincronização', '', 'data-id="' + e(g.id) + '"') + btn('google-remove', 'Remover exemplo', 'life-danger-link', 'data-id="' + e(g.id) + '"') + '</div></section>').join('') : '<div class="empty"><h3>Escolha sua primeira conta de exemplo</h3><p>Veja como as fontes aparecem na agenda e no Início.</p></div>') + '</div></section><p class="life-footnote">Desmarcar uma fonte remove seus eventos do Calendário e do Início. Alterar ou criar eventos no Google não faz parte deste fluxo.</p></div>';
  };
  A.actions['life-go-calendar'] = () => A.go('calendario');
  A.actions['life-google-source'] = el => { const selected = A.state.calendarSources || (A.state.calendarSources = {}); selected[el.dataset.source] = el.checked; A.persist(el.checked ? 'Fonte exibida na agenda e no Início.' : 'Fonte ocultada da agenda e do Início.'); };
  A.actions['life-google-sync'] = el => { const account = googleAccounts().find(g => g.id === el.dataset.id); if (account) { account.lastSync = '17/10/2026'; A.persist('Sincronização simulada concluída. Nenhuma consulta ao Google foi feita.'); } };
  A.actions['life-google-add'] = () => {
    if (googleAccounts().length >= 2) return A.notify('O limite é de duas contas de exemplo.');
    const used = new Set(googleAccounts().flatMap(g => g.sources));
    const options = [{ id: 'google-demo-1', name: 'Conta pessoal', email: 'pessoa@example.com', sources: ['personal', 'study'] }, { id: 'google-demo-2', name: 'Conta de trabalho', email: 'trabalho@example.com', sources: ['work'] }].filter(g => !g.sources.some(s => used.has(s)));
    A.openDialog('Adicionar conta de exemplo', '<p class="muted">Escolha uma conta fictícia para explorar as fontes. Nenhum login é necessário.</p><div class="life-demo-account-options">' + options.map(g => btn('google-add-confirm', '<strong>' + e(g.name) + '</strong><span>' + e(g.email) + '</span>', '', 'data-id="' + g.id + '"')).join('') + '</div>');
  };
  A.actions['life-google-add-confirm'] = el => {
    if (googleAccounts().length >= 2 || googleAccounts().some(g => g.id === el.dataset.id)) return;
    const personal = el.dataset.id === 'google-demo-1';
    const account = { id: el.dataset.id, name: personal ? 'Conta pessoal' : 'Conta de trabalho', email: personal ? 'pessoa@example.com' : 'trabalho@example.com', sources: personal ? ['personal', 'study'] : ['work'] };
    googleAccounts().push(account); const selected = A.state.calendarSources || (A.state.calendarSources = {}); account.sources.forEach(s => { selected[s] = true; });
    A.closeDialog(); A.persist('Conta de exemplo adicionada.');
  };
  A.actions['life-google-remove'] = el => { const account = googleAccounts().find(g => g.id === el.dataset.id); if (!account) return; A.openDialog('Remover conta de exemplo?', '<p>Os calendários de “' + e(account.name) + '” serão ocultados do Início e da agenda. Você pode adicionar este exemplo novamente.</p><div class="life-dialog-actions">' + btn('close', 'Cancelar') + btn('google-remove-confirm', 'Remover exemplo', 'life-danger-button', 'data-id="' + e(account.id) + '"') + '</div>'); };
  A.actions['life-google-remove-confirm'] = el => { const account = googleAccounts().find(g => g.id === el.dataset.id); if (!account) return; const selected = A.state.calendarSources || (A.state.calendarSources = {}); account.sources.forEach(s => { selected[s] = false; }); A.state.googleAccounts = googleAccounts().filter(g => g.id !== account.id); A.closeDialog(); A.persist('Conta de exemplo removida.'); };
})();
