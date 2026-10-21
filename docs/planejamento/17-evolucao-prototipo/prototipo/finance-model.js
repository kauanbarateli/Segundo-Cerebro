/* Local prototype ledger. Amounts are integer cents; payments never duplicate expenses. */
(() => {
  'use strict';
  const A = window.App, MAX_CENTS = 100000000000;
  const categories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Trabalho', 'Salário', 'Outros'];
  const today = () => A.TODAY || '2026-10-17';
  const pad = n => String(n).padStart(2, '0');
  const uid = prefix => A.uid ? A.uid(prefix) : prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  const validMonth = value => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && validDate(value + '-01');
  function addDays(day, count) {
    if (!validDate(day) || !Number.isInteger(count)) throw new Error('Informe uma data e um intervalo válidos.');
    const parsed = new Date(day + 'T12:00:00Z'); parsed.setUTCDate(parsed.getUTCDate() + count); return parsed.toISOString().slice(0, 10);
  }
  function monthDays(month) {
    if (!validMonth(month)) throw new Error('Escolha um mês válido.');
    const year = Number(month.slice(0, 4)), m = Number(month.slice(5));
    return new Date(Date.UTC(year, m, 0, 12)).getUTCDate();
  }
  function addMonths(value, count) {
    const isMonth = validMonth(value), day = isMonth ? value + '-01' : value;
    if (!validDate(day) || !Number.isInteger(count)) throw new Error('Informe uma data e um intervalo válidos.');
    const d = new Date(day.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + count);
    const month = d.toISOString().slice(0, 7);
    return isMonth ? month : month + '-' + pad(Math.min(Number(day.slice(8)), monthDays(month)));
  }
  function parseMoney(value) {
    let input = String(value ?? '').trim().replace(/R\$|\s/g, '');
    if (input.includes(',')) {
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input)) return NaN;
      input = input.replace(/\./g, '').replace(',', '.');
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return NaN;
    const [whole, decimals = ''] = input.split('.');
    const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_CENTS ? cents : NaN;
  }
  function cents(value, label = 'O valor', allowZero = false) {
    if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_CENTS) throw new Error(label + ' deve ser ' + (allowZero ? 'zero ou ' : '') + 'maior que zero, com até duas casas decimais.');
    return value;
  }
  function sum(values) {
    const total = values.reduce((n, value) => n + BigInt(value), 0n);
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('O total excede o limite desta demonstração.');
    return Number(total);
  }
  function init() {
    const s = A.state;
    if (!Array.isArray(s.accounts)) s.accounts = [];
    if (!Array.isArray(s.transactions)) s.transactions = [];
    if (s.financeGoals === undefined) s.financeGoals = [{ id: 'fg-trip', title: 'Viagem dos sonhos', target: 600000, opening: 240000, image: 'assets/covers/focus-landscape.png', deadline: '2027-07-01', archived: false }];
    if (!Array.isArray(s.financeGoals)) s.financeGoals = [];
    if (!Array.isArray(s.financeContributions)) s.financeContributions = [];
    if (!Array.isArray(s.financeRecurrences)) s.financeRecurrences = [];
    if (!s.financeBudgets || typeof s.financeBudgets !== 'object') s.financeBudgets = {};
    if (!s.financeBudgetCategories || typeof s.financeBudgetCategories !== 'object') s.financeBudgetCategories = {};
    for (const acc of s.accounts.filter(a => a.kind === 'card')) {
      const defaults = { last4: acc.id === 'card' ? '4821' : '0000', limit: 300000, closingDay: 18, dueDay: 25, paymentAccount: s.accounts.find(a => a.kind !== 'card' && !a.archived)?.id || '', color: 'stone' };
      for (const [key, value] of Object.entries(defaults)) if (acc[key] === undefined || acc[key] === null) acc[key] = value;
    }
    // Before this extension the prototype grouped cards by purchase month. Freeze that history.
    for (const t of s.transactions) if (t.type === 'expense' && s.accounts.some(a => a.id === t.account && a.kind === 'card') && !t.statementMonth && validDate(t.date)) t.statementMonth = t.date.slice(0, 7);
    s.financeVersion = 2;
  }
  const accounts = () => { init(); return A.state.accounts; };
  const transactions = () => { init(); return A.state.transactions; };
  const cards = () => accounts().filter(a => a.kind === 'card' && !a.archived);
  const account = id => accounts().find(a => a.id === id);
  const goals = () => { init(); return A.state.financeGoals; };
  const real = t => !t.deleted && (!t.status || ['confirmed', 'reconciled'].includes(t.status)) && validDate(t.date) && t.date <= today() && Number.isSafeInteger(t.amount) && t.amount > 0;
  const visible = t => !t.deleted && t.status !== 'cancelled';
  function requireAccount(id, nonCard = false) {
    const acc = account(id);
    if (!acc || acc.archived || (nonCard && acc.kind === 'card')) throw new Error(nonCard ? 'Escolha uma conta de origem válida, sem cartão.' : 'Escolha uma conta válida.');
    return acc;
  }
  function accountBalance(id) {
    const acc = account(id); if (!acc) return 0;
    let result = Number.isSafeInteger(acc.opening) ? acc.opening : 0;
    const values = [result];
    for (const t of transactions().filter(real)) {
      if (t.account === id) {
        if (t.type === 'income') values.push(acc.kind === 'card' ? -t.amount : t.amount);
        if (t.type === 'expense') values.push(acc.kind === 'card' ? t.amount : -t.amount);
        if (t.type === 'transfer') values.push(-t.amount);
      }
      if (t.type === 'transfer' && t.toAccount === id) values.push(acc.kind === 'card' ? -t.amount : t.amount);
    }
    if (acc.kind !== 'card') for (const c of A.state.financeContributions) if (!c.deleted && c.account === id && validDate(c.date) && c.date <= today() && Number.isSafeInteger(c.amount) && c.amount > 0) values.push(-c.amount);
    return sum(values);
  }
  function summary(month = today().slice(0, 7)) {
    if (!validMonth(month)) throw new Error('Escolha um mês válido.');
    const list = transactions().filter(t => real(t) && t.date.slice(0, 7) === month);
    const cash = sum(accounts().filter(a => a.kind !== 'card').map(a => accountBalance(a.id)));
    const cardDebt = sum(accounts().filter(a => a.kind === 'card').map(a => Math.max(0, accountBalance(a.id))));
    const income = sum(list.filter(t => t.type === 'income').map(t => t.amount));
    const expense = sum(list.filter(t => t.type === 'expense').map(t => t.amount));
    return { cash, cardDebt, available: cash - cardDebt, income, expense, result: income - expense, cardPurchases: sum(list.filter(t => t.type === 'expense' && account(t.account)?.kind === 'card').map(t => t.amount)), payments: sum(list.filter(t => t.type === 'transfer' && account(t.toAccount)?.kind === 'card').map(t => t.amount)) };
  }
  function cashflow(month) {
    if (!validMonth(month)) throw new Error('Escolha um mês válido.');
    const list = transactions().filter(t => real(t) && t.date.slice(0, 7) === month);
    let income = 0, expense = 0;
    return Array.from({ length: monthDays(month) }, (_, n) => {
      const date = month + '-' + pad(n + 1), current = list.filter(t => t.date === date);
      income += sum(current.filter(t => t.type === 'income').map(t => t.amount));
      expense += sum(current.filter(t => t.type === 'expense').map(t => t.amount));
      return { date, income, expense, total: income - expense, future: date > today() };
    });
  }
  function statementFor(day, closingDay) {
    if (!validDate(day) || !Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) throw new Error('Revise a data e o dia de fechamento.');
    const month = day.slice(0, 7);
    return Number(day.slice(8)) >= Math.min(closingDay, monthDays(month)) ? addMonths(month, 1) : month;
  }
  function assignStatement(t, previous) {
    const acc = account(t.account);
    if (t.type !== 'expense' || acc?.kind !== 'card') { delete t.statementMonth; return t; }
    t.statementMonth = previous && previous.account === t.account && previous.date === t.date && validMonth(previous.statementMonth) ? previous.statementMonth : statementFor(t.date, Number(acc.closingDay));
    return t;
  }
  function cardSummary(id) {
    const card = account(id); if (!card || card.kind !== 'card') throw new Error('Cartão não encontrado.');
    const debt = Math.max(0, accountBalance(id)), limit = Number(card.limit) || 0;
    return { card, debt, outstanding: debt, available: Math.max(0, limit - debt), limit };
  }
  function invoice(id, month = today().slice(0, 7), excludeId = '') {
    const card = account(id); if (!card || card.kind !== 'card') throw new Error('Cartão não encontrado.');
    if (!validMonth(month)) throw new Error('Escolha um mês válido para a fatura.');
    const list = transactions().filter(t => t.id !== excludeId && real(t) && ((t.account === id && t.type === 'expense' && t.statementMonth === month) || (t.type === 'transfer' && t.toAccount === id && (t.statementMonth || t.date.slice(0, 7)) === month)));
    const purchases = sum(list.filter(t => t.type === 'expense').map(t => t.amount));
    const payments = sum(list.filter(t => t.type === 'transfer').map(t => t.amount));
    const debt = Math.max(0, purchases - payments + (month === (card.openingMonth || today().slice(0, 7)) ? Number(card.opening || 0) : 0));
    const dueMonth = Number(card.dueDay) <= Number(card.closingDay) ? addMonths(month, 1) : month;
    return { ...cardSummary(id), debt, outstanding: debt, purchases, payments, dueDate: dueMonth + '-' + pad(Math.min(Number(card.dueDay), monthDays(dueMonth))), closingDate: month + '-' + pad(Math.min(Number(card.closingDay), monthDays(month))), transactions: list.sort((a, b) => b.date.localeCompare(a.date)) };
  }
  function saveTransaction(input) {
    init();
    const old = input.id ? A.state.transactions.find(t => t.id === input.id) : null;
    const t = { ...old, ...input, id: old?.id || input.id || uid('ft') };
    t.title = String(t.title || '').trim();
    if (!t.title || t.title.length > 100) throw new Error('Informe uma descrição com até 100 caracteres.');
    cents(t.amount);
    if (!['income', 'expense'].includes(t.type)) throw new Error('Escolha Entrada ou Saída.');
    if (!['confirmed', 'pending', 'cancelled', 'reconciled'].includes(t.status || 'confirmed')) throw new Error('Escolha um status válido.');
    t.status = t.status || 'confirmed';
    if (!validDate(t.date) || (['confirmed', 'reconciled'].includes(t.status) && t.date > today())) throw new Error('Lançamentos confirmados precisam de uma data até 17/10/2026. Para datas futuras, escolha Pendente.');
    const acc = requireAccount(t.account);
    if (t.type === 'income' && acc.kind === 'card') throw new Error('Registre entradas em uma conta. Para quitar o cartão, use Registrar pagamento.');
    if (!categories.includes(t.category)) throw new Error('Escolha uma categoria válida.');
    t.deleted = false; assignStatement(t, old);
    if (old) Object.assign(old, t); else A.state.transactions.push(t);
    return old || t;
  }
  function deleteTransaction(id) {
    const t = transactions().find(t => t.id === id); if (!t) throw new Error('Lançamento não encontrado.');
    t.deleted = true; return t;
  }
  function saveCard(input) {
    init();
    const old = input.id ? A.state.accounts.find(a => a.id === input.id) : null;
    if (old && old.kind !== 'card') throw new Error('Esta conta não é um cartão.');
    const card = { ...old, ...input, id: old?.id || input.id || uid('fc'), kind: 'card' };
    card.name = String(card.name || '').trim(); card.last4 = String(card.last4 || '').trim();
    if (!card.name || card.name.length > 60) throw new Error('Informe um nome de até 60 caracteres para o cartão.');
    if (!/^\d{4}$/.test(card.last4)) throw new Error('Informe somente os quatro últimos dígitos do cartão.');
    cents(card.limit, 'O limite');
    if (![card.closingDay, card.dueDay].every(d => Number.isInteger(d) && d >= 1 && d <= 31)) throw new Error('Fechamento e vencimento devem ser dias entre 1 e 31.');
    requireAccount(card.paymentAccount, true);
    if (!['stone', 'sand', 'sage', 'graphite', 'warm', 'green', 'gray'].includes(card.color)) throw new Error('Escolha uma das cores disponíveis para o cartão.');
    card.opening = old?.opening || 0;
    if (old) Object.assign(old, card); else A.state.accounts.push(card);
    return old || card;
  }
  function payCard(input) {
    init();
    const card = requireAccount(input.cardId); if (card.kind !== 'card') throw new Error('Escolha um cartão.');
    requireAccount(input.account || card.paymentAccount, true);
    cents(input.amount);
    if (!validDate(input.date) || input.date > today()) throw new Error('Use uma data de pagamento até 17/10/2026.');
    const month = input.month || today().slice(0, 7);
    const old = input.id ? A.state.transactions.find(t => t.id === input.id) : null;
    if (old && old.type !== 'transfer') throw new Error('Este lançamento não é um pagamento.');
    const bill = invoice(card.id, month, old?.id);
    if (input.amount > bill.outstanding) throw new Error('O pagamento não pode ultrapassar o valor em aberto desta fatura.');
    const checking = input.account || card.paymentAccount;
    const balance = accountBalance(checking) + (old && old.account === checking && real(old) ? old.amount : 0);
    if (input.amount > balance) throw new Error('O saldo da conta de origem é insuficiente para este pagamento.');
    const t = { id: old?.id || uid('fp'), title: 'Pagamento da fatura', amount: input.amount, date: input.date, type: 'transfer', account: checking, toAccount: card.id, statementMonth: month, category: 'Pagamento de fatura', status: 'confirmed', deleted: false };
    if (old) Object.assign(old, t); else A.state.transactions.push(t);
    return old || t;
  }
  function goalSummary(id) {
    const goal = typeof id === 'object' ? id : goals().find(g => g.id === id);
    if (!goal) throw new Error('Meta não encontrada.');
    init();
    const contributions = A.state.financeContributions.filter(c => c.goalId === goal.id && !c.deleted && validDate(c.date) && c.date <= today() && Number.isSafeInteger(c.amount) && c.amount > 0);
    const saved = sum([Number(goal.opening) || 0, ...contributions.map(c => c.amount)]), target = Number(goal.target) || 0;
    return { goal, saved, target, remaining: Math.max(0, target - saved), percent: target ? Math.round(saved / target * 100) : 0, contributions };
  }
  function saveGoal(input) {
    init(); const old = input.id ? A.state.financeGoals.find(g => g.id === input.id) : null;
    const g = { opening: 0, image: '', deadline: '', archived: false, ...old, ...input, id: old?.id || input.id || uid('fg') };
    g.title = String(g.title || '').trim(); if (!g.title || g.title.length > 80) throw new Error('Dê um nome à meta com até 80 caracteres.');
    cents(g.target, 'O valor da meta'); cents(g.opening, 'O valor já reservado', true);
    if (g.deadline && !validDate(g.deadline)) throw new Error('Escolha uma data válida para a meta.');
    if (A.media?.sanitizeSource) g.image = A.media.sanitizeSource(g.image);
    if (old) Object.assign(old, g); else A.state.financeGoals.push(g);
    return old || g;
  }
  function contribute(input) {
    init(); const goal = A.state.financeGoals.find(g => g.id === input.goalId && !g.archived);
    if (!goal) throw new Error('Escolha uma meta ativa.');
    requireAccount(input.account, true); cents(input.amount);
    if (!validDate(input.date) || input.date > today()) throw new Error('Use uma data de aporte até 17/10/2026.');
    if (input.amount > accountBalance(input.account)) throw new Error('O saldo da conta de origem é insuficiente para este aporte.');
    const c = { id: uid('fgc'), goalId: goal.id, amount: input.amount, date: input.date, account: input.account };
    A.state.financeContributions.push(c); return c;
  }
  function validateRecurrence(r) {
    r.title = String(r.title || '').trim(); if (!r.title || r.title.length > 100) throw new Error('Informe uma descrição com até 100 caracteres.');
    cents(r.amount); requireAccount(r.account);
    if (!['income', 'expense'].includes(r.type || 'expense')) throw new Error('Escolha Entrada ou Saída.');
    if ((r.type || 'expense') === 'income' && account(r.account)?.kind === 'card') throw new Error('Entradas recorrentes precisam de uma conta, sem cartão.');
    if (!categories.includes(r.category || 'Outros')) throw new Error('Escolha uma categoria válida.');
    if (!['monthly', 'weekly', 'yearly'].includes(r.frequency)) throw new Error('Escolha uma frequência válida.');
    if (!validDate(r.nextDate)) throw new Error('Escolha uma próxima data válida.');
    if (r.installments && (!Number.isInteger(r.current) || !Number.isInteger(r.total) || r.current < 1 || r.total < r.current || r.total > 600)) throw new Error('Informe a parcela atual e o total, entre 1 e 600.');
    return r;
  }
  function syncRecurrence(r) {
    init(); validateRecurrence(r);
    if (!r.id) r.id = uid('fr');
    const start = r.nextDate, end = addDays(addMonths(start, 12), -1), desired = new Map();
    if (r.active !== false && r.generate !== false) {
      for (let n = 0; n < 366; n++) {
        const day = r.frequency === 'weekly' ? addDays(start, n * 7) : addMonths(start, n * (r.frequency === 'yearly' ? 12 : 1));
        const installmentNo = r.installments ? r.current + n : null;
        if (day > end || (r.installments && installmentNo > r.total)) break;
        desired.set(r.id + ':' + day, { date: day, installmentNo });
      }
    }
    // Dated actuals and user-deleted occurrences are immutable to automatic generation.
    for (const t of A.state.transactions.filter(t => t.recurrenceId === r.id && t.status === 'pending' && t.date > today())) {
      if (!desired.has(t.occurrenceKey || r.id + ':' + t.date)) { t.status = 'cancelled'; t.recurrencePaused = true; }
    }
    let created = 0, updated = 0;
    for (const [key, occurrence] of desired) {
      const previous = A.state.transactions.find(t => t.occurrenceKey === key || t.recurrenceId === r.id && t.date === occurrence.date);
      if (previous && (previous.deleted || !['pending', 'cancelled'].includes(previous.status || 'confirmed') || (previous.status === 'cancelled' && !previous.recurrencePaused))) continue;
      if (previous && previous.date <= today()) continue;
      const t = { id: previous?.id || uid('frt'), title: r.title, amount: r.amount, date: occurrence.date, type: r.type || 'expense', account: r.account, category: r.category || 'Outros', status: 'pending', recurrenceId: r.id, occurrenceKey: key, installmentNo: occurrence.installmentNo, installmentTotal: r.installments ? r.total : null, recurrencePaused: false, deleted: false };
      assignStatement(t, previous);
      if (previous) { Object.assign(previous, t); updated++; } else { A.state.transactions.push(t); created++; }
    }
    return { created, updated, scheduled: desired.size };
  }
  function saveRecurrence(input) {
    init(); const old = input.id ? A.state.financeRecurrences.find(r => r.id === input.id) : null;
    const r = validateRecurrence({ active: true, generate: true, type: 'expense', category: 'Outros', installments: false, current: 1, total: 12, ...old, ...input, id: old?.id || input.id || uid('fr') });
    if (old) Object.assign(old, r); else A.state.financeRecurrences.push(r);
    syncRecurrence(old || r); return old || r;
  }
  function budget(month) {
    init(); if (!validMonth(month)) throw new Error('Escolha um mês válido.');
    const limit = A.state.financeBudgets[month] ?? 450000, used = summary(month).expense;
    const allocations = A.state.financeBudgetCategories[month] || {}, allocated = sum(Object.values(allocations));
    return { month, limit, used, available: limit - used, percent: limit ? Math.round(used / limit * 100) : 0, categories: allocations, allocated, overallocated: allocated > limit };
  }
  function saveBudget(month, limit, allocations = {}, repeat = false) {
    init(); if (!validMonth(month)) throw new Error('Escolha um mês válido.'); cents(limit, 'O limite');
    const next = {};
    for (const [category, amount] of Object.entries(allocations)) { if (!categories.includes(category)) throw new Error('Escolha categorias válidas.'); cents(amount, 'O limite da categoria', true); if (amount) next[category] = amount; }
    for (let n = 0; n < (repeat ? 12 : 1); n++) { const key = addMonths(month, n); A.state.financeBudgets[key] = limit; A.state.financeBudgetCategories[key] = { ...next }; }
    return budget(month);
  }
  function commit(mutate, message, errorCallback) {
    const before = structuredClone(A.state);
    try {
      const result = mutate();
      if (result === false) throw new Error('Não foi possível concluir esta alteração.');
      if (message) { A.state.activity = A.state.activity || []; A.state.activity.unshift({ id: uid('a'), title: message, detail: '', time: new Date().toISOString() }); A.state.activity = A.state.activity.slice(0, 80); }
      if (!A.save()) throw new Error('Não foi possível salvar. Libere espaço no navegador e tente novamente.');
      if (message) A.notify?.(message); return true;
    } catch (error) {
      A.state = before;
      const message = error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.';
      if (typeof errorCallback === 'function') errorCallback(message);
      else A.notify?.(message);
      return false;
    }
  }
  A.financeModel = { init, categories, validDate, validMonth, addDays, addMonths, monthDays, parseMoney, cents, accounts, account, transactions, cards, goals, real, visible, accountBalance, summary, cashflow, statementFor, assignStatement, cardSummary, invoice, saveTransaction, deleteTransaction, saveCard, payCard, goalSummary, goalTotal: h => goalSummary(h).saved, saveGoal, contribute, addContribution: (goalId, input) => contribute({ ...input, goalId }), validateRecurrence, syncRecurrence, saveRecurrence, budget, saveBudget, commit };
})();
