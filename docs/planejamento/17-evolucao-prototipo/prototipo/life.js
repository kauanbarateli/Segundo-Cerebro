(function () {
  'use strict';
  const A = window.App;
  const e = value => A.esc(String(value == null ? '' : value));
  const iconAliases = {pencil:'edit', 'more-horizontal':'more', 'refresh-cw':'refresh', 'key-round':'shield', wifi:'link', monitor:'grid', unlock:'lock', 'arrow-down-left':'arrow-up-right', 'arrow-right-left':'arrow-right'};
  const icon = (name, size) => A.icon(iconAliases[name] || name, size || 18);
  const ui = { vaultOpen: false, vaultItem: 'v1', revealed: false };
  const settings = () => A.state.settings || (A.state.settings = { name: 'Kauan' });
  const btn = (action, text, cls, attrs) => '<button type="button" class="button ' + (cls || '') + '" data-action="life-' + action + '" ' + (attrs || '') + '>' + text + '</button>';
  const error = (form, message) => { let output = form.querySelector('[data-form-error]'); if (!output) { output = document.createElement('p'); output.className = 'life-form-error'; output.setAttribute('role', 'alert'); output.dataset.formError = ''; form.prepend(output); } output.textContent = message; };
  A.actions['life-close'] = () => A.closeDialog();

  // Financeiro: finance-model.js, finance.js, finance-cards.js e finance-goals.js.

  // Hábitos: rotinas e desempenho em habits-model.js / habits.js.

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
    return '<div class="life-page life-settings">' + A.profile.settings() + '<section class="panel"><div class="life-settings-heading"><h2>Aparência</h2><p class="muted">O tema acompanha todas as áreas e fica salvo neste navegador.</p></div><div class="life-theme-options">' + [['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon'], ['system', 'Sistema', 'monitor']].map(([key, name, ico]) => '<button class="life-theme-option ' + (theme === key ? 'is-selected' : '') + '" type="button" data-action="life-theme" data-theme="' + key + '" aria-pressed="' + (theme === key) + '"><span class="life-theme-preview preview-' + key + '"><i></i><i></i><i></i></span><span>' + icon(ico) + name + (theme === key ? icon('check') : '') + '</span></button>').join('') + '</div></section><section class="panel focus-image-settings" id="focus-image-settings"><div class="life-settings-heading"><h2>Imagem do destaque do dia</h2><p class="muted">Escolha o fundo da sua próxima ação no Início.</p></div><form data-form="focus-image">' + (A.media?.imageEditor({key:'focusImage',value:s.focusImage,label:'Imagem de fundo',kind:'focus'}) || '') + '<div class="image-settings-footer"><button type="submit" class="button primary">Salvar imagem</button><a class="text-link" href="#/inicio">Ver no Início ' + icon('arrow-right') + '</a></div></form></section><section class="panel"><div class="life-settings-heading"><h2>Preferências</h2><p class="muted">Pequenos ajustes para o dia a dia.</p></div><form data-form="life-preferences"><label class="life-toggle-row"><span><strong>Ocultar valores financeiros</strong><small>Mascarar saldos e lançamentos ao abrir o Financeiro.</small></span><input type="checkbox" name="hideAmounts" ' + (s.hideAmounts ? 'checked' : '') + '></label><label class="life-toggle-row"><span><strong>Lembretes de reunião</strong><small>Preferência demonstrativa, sem notificações externas ou com o navegador fechado.</small></span><input type="checkbox" name="reminders" ' + (s.reminders !== false ? 'checked' : '') + '></label><div class="form-grid"><div class="field"><label for="life-calendar-view">Visualização inicial da agenda</label><select id="life-calendar-view" name="calendarView">' + [['list', 'Lista'], ['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([key, text]) => '<option value="' + key + '" ' + ((s.calendarView || 'list') === key ? 'selected' : '') + '>' + text + '</option>').join('') + '</select></div><div class="field"><label for="life-reminder-minutes">Antecedência</label><select id="life-reminder-minutes" name="reminderMinutes">' + [5, 10, 15, 30].map(n => '<option value="' + n + '" ' + ((Number(s.reminderMinutes) || 10) === n ? 'selected' : '') + '>' + n + ' minutos</option>').join('') + '</select></div></div><button type="submit" class="button primary">Salvar preferências</button></form></section><section class="panel"><div class="section-head"><div><h2>Calendários conectados</h2><p class="muted">Escolha as fontes de exemplo exibidas na agenda.</p></div>' + btn('go-integrations', 'Gerenciar integrações ' + icon('arrow-right')) + '</div></section><section class="panel"><div class="life-settings-heading"><h2>Dados da demonstração</h2><p class="muted">As alterações ficam somente neste navegador. Este arquivo exporta dados do protótipo, não os dados da sua conta real.</p></div><div class="row">' + btn('export', icon('download') + ' Exportar demonstração') + btn('reset', 'Restaurar exemplos', 'life-danger-link') + '</div></section></div>';
  };
  A.forms['focus-image'] = (data,form) => {
    const image=A.media.read(form,'focusImage');if(!image.ok)return;
    const s=settings(),before=s.focusImage,previousActivity=A.state.activity.slice();
    s.focusImage=image.value;
    A.state.activity=[{id:A.uid('a'),title:'Imagem do destaque atualizada',detail:image.value?'Imagem personalizada':'Sem imagem',time:new Date().toISOString()},...A.state.activity].slice(0,80);
    if(!A.save()){
      if(before===undefined)delete s.focusImage;else s.focusImage=before;
      A.state.activity=previousActivity;
      const message='Não foi possível salvar a imagem neste navegador. Tente uma imagem menor ou remova o fundo e salve novamente.';
      A.media.setError(form,'focusImage',message);A.notify(message);return;
    }
    A.media.setError(form,'focusImage','');
    const status=form.querySelector('.image-editor-status');if(status)status.textContent='Alteração salva. Seu destaque está atualizado no Início.';
    A.notify(image.value?'Imagem do destaque salva.':'Destaque salvo sem imagem.');
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


