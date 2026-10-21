/* Captura: drafts stay in memory until an explicit, atomic local save. */
(() => {
  'use strict';
  const A = window.App, E = A.esc, I = A.icon;
  const drafts = new Map();
  const types = {idea:'Ideia', task:'Tarefa', note:'Nota', reminder:'Lembrete'};
  const typeIcon = type => ({idea:'capture', task:'tasks', note:'file-text', reminder:'clock'}[type] || 'file-text');
  const captures = () => A.state.captures.filter(c => !c.deleted && !c.archived);
  const valueKey = value => JSON.stringify([value.title, value.body, value.bodyHtml, value.type]);
  function values(record = {}) {
    const bodyHtml = A.richText.sanitize(record.bodyHtml || A.richText.fromText(record.body || ''));
    return {title:record.title || '', body:A.richText.toText(bodyHtml), bodyHtml, type:types[record.type] ? record.type : 'idea'};
  }
  function draft(key) {
    const record = captures().find(c => c.id === key);
    if (record?.converted) return {...values(record), dirty:false};
    if (!drafts.has(key)) drafts.set(key, {...values(record), dirty:false, error:''});
    return drafts.get(key);
  }
  function items() {
    const mode = A.ui.captureFilter || 'inbox', query = (A.ui.captureQuery || '').trim().toLocaleLowerCase('pt-BR');
    return captures().filter(c => mode === 'all' || (mode === 'inbox' ? !c.converted : !!c.converted))
      .filter(c => !query || [c.title,c.body].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  }
  function noteList() {
    const list = items();
    return list.length ? list.map(c => {
      const pending = drafts.get(c.id), current = pending?.dirty ? pending : c;
      return `<button class="cp-entry ${A.ui.captureSelected === c.id ? 'is-selected' : ''}" data-action="cp-select" data-id="${E(c.id)}" data-capture-row="${E(c.id)}" ${A.ui.captureSelected === c.id ? 'aria-current="true"' : ''}><span class="cp-entry-meta"><span>${E(types[c.type] || 'Ideia')}</span><time>${A.dateLabel(c.created)}</time></span><strong data-capture-row-title>${E(current.title || 'Sem título')}</strong><span class="cp-entry-preview" data-capture-row-preview>${E(current.body || 'Uma ideia pronta para ganhar contexto.')}</span><span class="cp-entry-foot">${c.converted ? I('check', 14) + 'Organizada' : I(typeIcon(c.type), 14) + 'Na entrada'}<span class="cp-draft-dot" data-capture-row-draft ${pending?.dirty ? '' : 'hidden'} aria-label="Alterações não salvas"></span></span></button>`;
    }).join('') : `<div class="cp-list-empty">${I('inbox',24)}<strong>${A.ui.captureQuery ? 'Nenhuma captura encontrada' : 'Tudo no seu tempo'}</strong><p>${A.ui.captureQuery ? 'Tente outro título ou trecho de texto.' : A.ui.captureFilter === 'organized' ? 'As capturas que virarem tarefas ou notas aparecerão aqui.' : 'Guarde a próxima ideia quando ela chegar.'}</p>${A.ui.captureQuery ? '<button class="text-link" data-action="cp-clear-search">Limpar busca</button>' : ''}</div>`;
  }
  function render() {
    const list = items();
    if (A.ui.captureSelected == null) A.ui.captureSelected = list[0]?.id || 'new';
    const key = A.ui.captureSelected;
    const record = captures().find(c => c.id === key);
    const d = draft(key), organized = !!record?.converted, editing = !!A.ui.captureMobileEditor;
    requestAnimationFrame(fitTitle);
    return `<div class="cp-workspace ${editing ? 'is-editing' : ''}"><aside class="cp-rail" aria-label="Suas capturas"><div class="cp-rail-heading"><h2>Suas capturas</h2><span class="cp-total" data-cp-count>${list.length}</span></div><button class="button cp-new" data-action="cp-new">${I('plus',17)}Nova captura</button><label class="cp-search">${I('search',17)}<span class="sr-only">Buscar capturas</span><input type="search" data-cp-search value="${E(A.ui.captureQuery || '')}" placeholder="Buscar nas capturas…" autocomplete="off"></label><div class="cp-filters" role="group" aria-label="Filtrar capturas">${[['inbox','Entrada'],['organized','Organizadas'],['all','Todas']].map(([id,label]) => `<button data-action="cp-filter" data-value="${id}" aria-pressed="${(A.ui.captureFilter || 'inbox') === id}">${label}</button>`).join('')}</div><div class="cp-list" data-cp-list>${noteList()}</div><p class="cp-rail-foot">${I('inbox',15)}Capture agora. Organize depois.</p></aside><section class="cp-document" aria-label="${organized ? 'Captura organizada' : 'Editor de captura'}"><form data-form="capture-editor" data-capture-key="${E(key)}"><div class="cp-document-top"><button class="text-link cp-back" type="button" data-action="cp-back">${I('chevron-left',16)}Capturas</button><span class="cp-save-status ${d.error ? 'is-error' : ''}" data-cp-status role="status">${organized ? 'Origem preservada' : d.error || (d.dirty ? 'Alterações não salvas' : key === 'new' ? 'Nova captura' : 'Salvo neste navegador')}</span>${!organized ? `<button type="submit" class="button primary cp-save" ${!d.dirty || !d.title.trim() ? 'disabled' : ''}>${I('check',16)}Salvar captura</button>` : `<a class="button" href="#/${record.taskId ? 'tarefas/' + E(record.taskId) : 'conhecimento/' + E(record.noteId)}">Abrir ${record.taskId ? 'tarefa' : 'nota'}${I('arrow-up-right',16)}</a>`}</div><div class="cp-document-heading"><label class="sr-only" for="cp-title">Título da captura</label><textarea id="cp-title" data-capture-title name="title" rows="1" maxlength="160" required placeholder="Dê um nome à ideia…" ${organized ? 'readonly' : ''}>${E(d.title)}</textarea><div class="cp-document-meta"><label class="cp-type"><span class="sr-only">Tipo de captura</span><select name="type" ${organized ? 'disabled' : ''}>${Object.entries(types).map(([id,label]) => `<option value="${id}" ${d.type === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>${record ? 'Capturada em ' + A.dateLabel(record.created) : 'Um espaço para pensar livremente.'}</span></div></div>${A.richText.markup({id:'cp-body', text:d.body, html:d.bodyHtml, label:'Conteúdo da captura', placeholder:'Escreva livremente. A organização vem depois.', readOnly:organized})}<div class="cp-writing-foot"><span data-cp-words>${wordCount(d.body)}</span>${!organized ? `<button type="button" class="text-link" data-action="cp-discard" ${d.dirty ? '' : 'hidden'}>Descartar alterações</button>` : '<span>O conteúdo organizado é editado no destino.</span>'}</div>${!organized ? `<div class="cp-organize"><span>Dê um próximo passo</span><div><button type="button" class="button" data-action="cp-task" ${!d.title.trim() ? 'disabled' : ''}>${I('tasks',16)}Virar tarefa</button><button type="button" class="button" data-action="cp-note" ${!d.title.trim() ? 'disabled' : ''}>${I('book',16)}Levar para Conhecimento</button></div></div>` : ''}</form></section></div>`;
  }
  function wordCount(body) {
    const words = String(body || '').trim().split(/\s+/).filter(Boolean).length;
    return `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
  }
  function fitTitle() {
    const title = document.querySelector('[data-capture-title]');
    if (title) { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; }
  }
  function update(form) {
    if (!form) return;
    const key = form.dataset.captureKey, record = captures().find(c => c.id === key);
    if (record?.converted) return;
    const d = draft(key), rich = A.richText.read(form);
    Object.assign(d, {title:form.elements.title.value, type:form.elements.type.value, ...rich, error:''});
    d.dirty = valueKey(d) !== valueKey(values(record));
    const status = form.querySelector('[data-cp-status]');
    status.textContent = d.dirty ? 'Alterações não salvas' : key === 'new' ? 'Nova captura' : 'Salvo neste navegador';
    status.classList.remove('is-error');
    form.querySelector('.cp-save').disabled = !d.dirty || !d.title.trim();
    form.querySelector('[data-action=cp-discard]').hidden = !d.dirty;
    form.querySelectorAll('.cp-organize button').forEach(button => { button.disabled = !d.title.trim(); });
    form.querySelector('[data-cp-words]').textContent = wordCount(d.body);
    const row = [...document.querySelectorAll('[data-capture-row]')].find(el => el.dataset.captureRow === key);
    if (row) {
      row.querySelector('[data-capture-row-title]').textContent = d.title || 'Sem título';
      row.querySelector('[data-capture-row-preview]').textContent = d.body || 'Uma ideia pronta para ganhar contexto.';
      row.querySelector('[data-capture-row-draft]').hidden = !d.dirty;
    }
    fitTitle();
  }
  function commit(changes, title, detail = '') {
    const before = {};
    for (const key of Object.keys(changes)) { before[key] = A.state[key]; A.state[key] = changes[key]; }
    before.activity = A.state.activity;
    A.state.activity = [{id:A.uid('a'),title,detail,time:new Date().toISOString()},...A.state.activity].slice(0,80);
    if (A.save()) return true;
    Object.assign(A.state, before);
    A.notify('Não foi possível salvar. Seu texto continua no editor; tente novamente.');
    return false;
  }
  function saveValues(id, content) {
    const record = A.state.captures.find(c => c.id === id);
    if (record?.converted) { A.notify('Esta captura já foi organizada. Abra o destino para editar.'); return null; }
    const next = {...record,id:record?.id || A.uid('c'),...content,title:content.title.trim(),created:record?.created || A.TODAY,updated:A.TODAY};
    if (!next.title) return null;
    const collection = record ? A.state.captures.map(c => c.id === id ? next : c) : [next,...A.state.captures];
    return commit({captures:collection},record ? 'Captura atualizada' : 'Captura salva',next.title) ? next : null;
  }
  function save(form, redraw = true) {
    if (!form || !form.reportValidity()) return null;
    update(form);
    const key = form.dataset.captureKey, d = draft(key);
    if (!d.dirty && key !== 'new') return A.state.captures.find(c => c.id === key);
    const record = saveValues(key,{title:d.title,type:d.type,...A.richText.read(form)});
    if (!record) {
      d.error = 'Não foi possível salvar. Tente novamente.';
      form.querySelector('[data-cp-status]').textContent = d.error;
      form.querySelector('[data-cp-status]').classList.add('is-error');
      return null;
    }
    drafts.delete(key); drafts.delete(record.id);
    A.ui.captureSelected = record.id;
    if (key === 'new') { A.ui.captureFilter = 'inbox'; A.ui.captureQuery = ''; }
    if (redraw) {
      A.render(); A.notify('Captura salva neste navegador.');
      document.querySelector('[data-capture-title]')?.focus({preventScroll:true});
    }
    return record;
  }
  function open(id) {
    A.ui.captureSelected = id;
    A.ui.captureMobileEditor = true;
    if (A.ui.route !== 'capturar') A.go('capturar');
    else {
      A.render();
      const title = document.querySelector('[data-capture-title]');
      title?.focus({preventScroll:true});
      if (matchMedia('(max-width:1000px)').matches) document.querySelector('.cp-document')?.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
  function quick(id) {
    const c = A.state.captures.find(c => c.id === id);
    if (c?.converted) return A.notify('Esta captura já foi organizada. Abra o destino para editar.');
    const d = values(c);
    A.openDialog(id ? 'Editar captura' : 'Capture antes que a ideia passe', `<form data-form="capture" class="cp-quick"><input type="hidden" name="id" value="${E(id || '')}"><label class="field">Título da captura<input name="title" value="${E(d.title)}" required maxlength="160" placeholder="Uma ideia, uma tarefa, um lembrete…" autofocus></label><label class="field">Tipo<select name="type">${Object.entries(types).map(([key,label]) => `<option value="${key}" ${d.type === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${A.richText.markup({id:'cp-quick-body',html:d.bodyHtml,text:d.body,label:'Detalhes da captura'})}<div class="dialog-actions"><button type="button" class="button" data-action="close-dialog">Cancelar</button><button type="submit" class="button primary">Salvar captura</button></div></form>`);
  }
  function saveQuick(data, form) {
    const record = saveValues(data.get('id'), {title:String(data.get('title') || ''),type:data.get('type') || 'idea',...A.richText.read(form)});
    if (!record) return;
    drafts.delete(record.id); A.closeDialog();
    if (A.ui.route === 'capturar') { A.ui.captureSelected = record.id; A.ui.captureMobileEditor = true; A.ui.captureFilter = 'inbox'; A.ui.captureQuery = ''; }
    A.render(); A.notify('Captura salva neste navegador.');
  }
  function prepare(kind) {
    const form = document.querySelector('form[data-form=capture-editor]');
    const record = save(form, false);
    if (!record || record.converted) return;
    A.render();
    if (kind === 'task') A.taskDialog(null,{title:record.title,description:record.body,origin:record.id});
    else A.noteDialog(null,{title:record.title,body:record.body || record.title,bodyHtml:record.body ? record.bodyHtml : A.richText.fromText(record.title),origin:record.id});
  }
  function renameHtml(html, before, after) {
    const template = document.createElement('template');
    template.innerHTML = A.richText.sanitize(html);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.data = node.data.split('[[' + before + ']]').join('[[' + after + ']]');
    return A.richText.sanitize(template.innerHTML);
  }
  function renderBody(record, wiki = false) {
    const template = document.createElement('template');
    template.innerHTML = A.richText.sanitize(record.bodyHtml || A.richText.fromText(record.body || ''));
    if (!wiki) return template.innerHTML;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT), nodes = [];
    let node;
    while ((node = walker.nextNode())) if (!node.parentElement?.closest('a')) nodes.push(node);
    nodes.forEach(text => {
      const pieces = text.data.split(/(\[\[[^\]]+\]\])/g);
      if (pieces.length < 2) return;
      const fragment = document.createDocumentFragment();
      pieces.forEach(piece => {
        if (!piece.startsWith('[[') || !piece.endsWith(']]')) { fragment.append(document.createTextNode(piece)); return; }
        const title = piece.slice(2,-2), match = A.state.notes.find(n => n.title === title && !n.deleted);
        const link = document.createElement(match ? 'a' : 'button');
        link.className = 'wiki-link'; link.textContent = title;
        if (match) link.href = '#/conhecimento/' + encodeURIComponent(match.id);
        else { link.type = 'button'; link.dataset.action = 'unresolved-note'; link.dataset.title = title; }
        fragment.append(link);
      });
      text.replaceWith(fragment);
    });
    return template.innerHTML;
  }
  function saveNote(data, form) {
    const id = data.get('id'), existing = A.state.notes.find(n => n.id === id);
    const title = String(data.get('title') || '').trim(), origin = data.get('origin');
    if (!title) return;
    if (A.state.notes.some(n => !n.deleted && n.id !== id && n.title.toLocaleLowerCase() === title.toLocaleLowerCase())) return A.notify('Já existe uma página com esse título. Escolha outro nome.');
    if (origin && !existing && A.state.captures.find(c => c.id === origin)?.converted) return A.notify('Esta captura já foi organizada.');
    const content = form.querySelector('.rt-field') ? A.richText.read(form) : {body:String(data.get('body') || ''),bodyHtml:undefined};
    if (!content.body.trim()) return A.notify('Escreva o conteúdo da página antes de salvar.');
    const next = {...existing,id:existing?.id || A.uid('n'),title,...content,notebook:data.get('notebook'),project:data.get('project'),updated:A.TODAY,origin:origin || undefined,relatedEvent:data.get('relatedEvent') || undefined};
    let notes = existing ? A.state.notes.map(n => n.id === id ? next : n) : [next,...A.state.notes];
    if (existing && existing.title !== title) notes = notes.map(n => ({...n,body:n.body.split('[[' + existing.title + ']]').join('[[' + title + ']]'),...(n.bodyHtml ? {bodyHtml:renameHtml(n.bodyHtml,existing.title,title)} : {})}));
    const changes = {notes};
    if (origin) changes.captures = A.state.captures.map(c => c.id === origin ? {...c,converted:true,noteId:next.id} : c);
    if (next.relatedEvent) changes.events = A.state.events.map(ev => ev.id === next.relatedEvent ? {...ev,noteId:next.id} : ev);
    if (!commit(changes,'Página salva',title)) return;
    if (origin) drafts.delete(origin);
    A.closeDialog(); A.go('conhecimento',next.id); A.notify('Página salva e conexões atualizadas.');
  }
  function createTask(data) {
    const origin = data.get('origin'), capture = A.state.captures.find(c => c.id === origin);
    if (!capture || capture.converted) return A.notify('Esta captura já tem um destino ou não está disponível.');
    const title = String(data.get('title') || '').trim();
    if (!title) return;
    const task = {id:A.uid('t'),title,description:String(data.get('description') || '').trim(),project:data.get('project'),category:data.get('category'),status:data.get('status'),priority:data.get('priority'),due:data.get('due'),estimate:Number(data.get('estimate')) || 25,noteId:data.get('noteId'),origin,relatedEvent:data.get('relatedEvent') || undefined};
    if (!commit({tasks:[task,...A.state.tasks],captures:A.state.captures.map(c => c.id === origin ? {...c,converted:true,taskId:task.id} : c)},'Tarefa criada',title)) return;
    drafts.delete(origin); A.closeDialog(); A.render(); A.notify('Tarefa criada. A captura de origem foi preservada.');
  }
  A.capture = {render,open,quick,saveQuick,saveNote,createTask,renderBody,clear(){drafts.clear();A.ui.captureSelected=null;A.ui.captureQuery='';A.ui.captureFilter='inbox';A.ui.captureMobileEditor=false;}};
  A.forms['capture-editor'] = (_,form) => save(form);
  Object.assign(A.actions, {
    'cp-new':()=>{A.ui.captureFilter='inbox';A.ui.captureQuery='';open('new');},
    'cp-select':el=>open(el.dataset.id),
    'cp-back':()=>{A.ui.captureMobileEditor=false;A.render();document.querySelector('.cp-entry.is-selected')?.focus({preventScroll:true});},
    'cp-filter':el=>{A.ui.captureFilter=el.dataset.value;A.ui.captureSelected=items()[0]?.id || 'new';A.render();},
    'cp-clear-search':()=>{A.ui.captureQuery='';A.render();document.querySelector('[data-cp-search]')?.focus();},
    'cp-discard':()=>{drafts.delete(A.ui.captureSelected);A.render();A.notify('Alterações descartadas.');document.querySelector('[data-capture-title]')?.focus({preventScroll:true});},
    'cp-task':()=>prepare('task'), 'cp-note':()=>prepare('note')
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if (el.matches('[data-cp-search]')) {
      A.ui.captureQuery=el.value;
      document.querySelector('[data-cp-list]').innerHTML=noteList();
      document.querySelector('[data-cp-count]').textContent=items().length;
    } else if (el.matches('[data-capture-title]')) update(el.closest('form[data-capture-key]'));
  });
  document.addEventListener('change',event=>{if(event.target.matches('form[data-capture-key] select[name=type]'))update(event.target.closest('form'));});
  document.addEventListener('richtextchange',event=>update(event.target.closest('form[data-capture-key]')));
  document.addEventListener('keydown',event=>{
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='s' && A.ui.route==='capturar' && !document.querySelector('dialog[open]')) {
      event.preventDefault(); save(document.querySelector('form[data-form=capture-editor]'));
    }
  });
  window.addEventListener('resize',fitTitle);
  window.addEventListener('beforeunload',event=>{if([...drafts.values()].some(d=>d.dirty)){event.preventDefault();event.returnValue='';}});
})();
