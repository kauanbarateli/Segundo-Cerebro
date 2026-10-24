// Optional first-run setup. All records and connections are local examples.
(() => {
  'use strict';
  const A=window.App, E=A.esc, I=A.icon, TOTAL=7, SUMMARY=8;
  const steps=['Seu nome','Sua agenda','Um hábito','Um projeto','Uma tarefa','Suas notas','Outros espaços','Resumo'];
  const accounts=[
    {id:'google-demo-1',name:'Conta pessoal',email:'pessoa@example.com',sources:['personal','study']},
    {id:'google-demo-2',name:'Conta de trabalho',email:'trabalho@example.com',sources:['work']}
  ];
  const fieldKeys=new Set(['name','focus','habitTitle','habitCadence','projectTitle','projectKind','taskTitle','taskProject','taskWhen','notebook','noteTitle','noteBody','noteProject']);
  const titleKeys={habits:'habitTitle',projects:'projectTitle',tasks:'taskTitle'};
  const blank=()=>({version:2,status:'active',step:0,visited:[],accountIds:[],habits:[],projects:[],tasks:[],knowledgeEnabled:false,
    fields:{name:A.state.settings.name!==A.seed.settings.name?A.state.settings.name:'',focus:'',habitTitle:'',habitCadence:'daily',projectTitle:'',projectKind:'Pessoal',taskTitle:'',taskProject:'',taskWhen:'today',notebook:'',noteTitle:'',noteBody:'',noteProject:''},
    notebookId:A.uid('ob-notebook'),noteId:A.uid('ob-note')});
  function state(){
    const o=A.state.onboarding||(A.state.onboarding=blank());
    if(o.version!==2){
      if(o.step===7)o.step=SUMMARY;
      if(!o.knowledgeEnabled&&o.fields.notebook==='Meu caderno'&&!o.fields.noteTitle&&!o.fields.noteBody)o.fields.notebook='';
      o.version=2;
    }
    return o;
  }
  function persist(){
    const saved=A.save(),label=document.querySelector('#ob-save-status');
    if(label){
      const text=saved?'Progresso salvo.':'Não foi possível salvar. Continue nesta aba.';
      if(label.textContent!==text)label.textContent=text;
      label.classList.toggle('is-silent',saved);
    }
    return saved;
  }
  function collect(){
    document.querySelectorAll('[data-ob-field]').forEach(el=>{if(fieldKeys.has(el.dataset.obField))state().fields[el.dataset.obField]=el.value;});
  }
  function error(message,id){
    const el=document.querySelector('#ob-error');if(el){el.hidden=false;el.textContent=message;}
    if(id){
      const field=document.getElementById(id);
      if(field){let parent=field.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}
      field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby','ob-error');field?.focus();
    }
    return false;
  }
  function clearError(){
    const el=document.querySelector('#ob-error');if(el){el.hidden=true;el.textContent='';}
    document.querySelectorAll('[data-ob-field][aria-invalid]').forEach(field=>{field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');});
  }
  function redraw(focus){A.render();if(focus)document.getElementById(focus)?.focus({preventScroll:true});}
  function changeStep(step){
    collect();const o=state();o.step=Math.max(0,Math.min(SUMMARY,step));
    if(o.status!=='complete')o.status='active';
    A.ui.obAdding=null;persist();redraw('ob-title');window.scrollTo({top:0,behavior:'instant'});
  }
  const button=(action,text,cls='',attrs='')=>`<button type="button" class="button ${cls}" data-action="ob-${action}" ${attrs}>${text}</button>`;
  const field=(key,label,max=80,placeholder='')=>`<div class="field"><label for="ob-${key}">${label}</label><input id="ob-${key}" name="${key}" data-ob-field="${key}" type="text" maxlength="${max}" value="${E(state().fields[key])}" placeholder="${E(placeholder)}" autocomplete="${key==='name'?'given-name':'off'}"></div>`;
  const select=(key,label,items)=>`<div class="field"><label for="ob-${key}">${label}</label><select id="ob-${key}" name="${key}" data-ob-field="${key}">${items.map(([value,text])=>`<option value="${E(value)}" ${state().fields[key]===value?'selected':''}>${E(text)}</option>`).join('')}</select></div>`;
  const options=(label,content,open=false)=>`<details class="ob-options" ${open?'open':''}><summary>${label}${I('chevron-down',16)}</summary><div class="ob-options-body">${content}</div></details>`;
  function projectOptions(){
    const pending=state().projects;
    return [['','Sem projeto'],...pending.map(p=>[p.id,p.title]),...A.state.projects.filter(p=>!p.deleted&&!p.archived&&!pending.some(x=>x.id===p.id)).map(p=>[p.id,p.title])];
  }
  function added(type,icon){
    const items=state()[type];if(!items.length)return '';
    return `<ul class="ob-added-list" aria-label="${type==='habits'?'Hábitos':type==='projects'?'Projetos':'Tarefas'} preparados">${items.map(item=>`<li>${I(icon)}<span><strong>${E(item.title)}</strong><small>${E(type==='habits'?(item.cadence==='daily'?'Todos os dias':'3 vezes por semana'):type==='projects'?item.kind:(item.due?'Hoje':'Sem prazo')+(item.project?' · '+(projectOptions().find(x=>x[0]===item.project)?.[1]||'Projeto'):''))}</small></span>${button('remove',I('x'),'icon-button',`data-kind="${type}" data-id="${E(item.id)}" aria-label="Remover ${E(item.title)} da configuração"`)}</li>`).join('')}</ul>`;
  }
  function isAdding(type){return !state()[type].length||A.ui.obAdding===type||state().fields[titleKeys[type]].trim();}
  function entryForm(type,label,placeholder,extra){
    const key=titleKeys[type],singular={habits:'hábito',projects:'projeto',tasks:'tarefa'}[type];
    return `<form data-form="ob-${{habits:'habit',projects:'project',tasks:'task'}[type]}" class="ob-form"><div class="ob-input-row">${field(key,label,type==='tasks'?120:80,placeholder)}<button class="button icon-button" type="submit" aria-label="Adicionar ${singular}" title="Adicionar ${singular}">${I('plus')}</button></div>${options('Ajustar detalhes',extra)}</form>`;
  }
  function more(type){
    return state()[type].length<5?button('add-more',I('plus')+' Adicionar outro','ob-quiet ob-add-more',`data-kind="${type}" id="ob-more-${type}"`):'<p class="ob-account-note">Outros itens podem ser adicionados no painel.</p>';
  }
  function welcome(){
    return `<div class="ob-welcome"><div class="ob-welcome-copy"><h1 id="ob-title" tabindex="-1">Sua vida, com<br>mais clareza.</h1><p>Planos, rotina e ideias em um só lugar.<br>Vamos preparar o seu espaço?</p></div><div class="ob-welcome-actions">${button('start','Começar '+I('arrow-right'),'primary')}${button('later','Explorar por conta própria','ob-quiet')}</div><p class="ob-account-note">Você pode pular qualquer etapa.</p></div>`;
  }
  function profile(){
    return `<div class="ob-form">${field('name','Seu nome',50,'Como você quer ser chamado?')}${options('Definir meu foco',`<fieldset><legend>O que você quer organizar?</legend><div class="ob-choice-grid">${[['Trabalho','folder'],['Estudos','book'],['Vida pessoal','home'],['Um pouco de tudo','grid']].map(([label,icon])=>button('focus',I(icon)+E(label),'ob-choice',`data-value="${label}" aria-pressed="${state().fields.focus===label}"`)).join('')}</div></fieldset>`)}</div>`;
  }
  function calendar(){
    const current=A.state.googleAccounts||[];
    return `<div class="ob-account-list">${accounts.map(account=>{
      const existing=current.some(g=>g.id===account.id),selected=existing||state().accountIds.includes(account.id);
      return button('account',`<span class="ob-account-icon" aria-hidden="true">G</span><span><strong>${E(account.name)}</strong><small>${E(account.email)}</small></span><span class="ob-account-status">${I(selected?'check':'plus')}<span class="sr-only">${existing?'Já disponível':selected?'Selecionada':'Selecionar'}</span></span>`,'ob-account',`data-id="${account.id}" aria-pressed="${selected}" ${existing?'disabled':''}`);
    }).join('')}</div><p class="ob-account-note">Contas fictícias. Sem login ou sincronização com o Google.</p>`;
  }
  function habits(){
    return `${added('habits','habit')}${isAdding('habits')?entryForm('habits','Seu hábito','Ex.: Ler por 10 minutos',select('habitCadence','Frequência',[['daily','Todos os dias'],['weekly_target','3 vezes por semana']])):more('habits')}`;
  }
  function projects(){
    return `${added('projects','folder')}${isAdding('projects')?entryForm('projects','Nome do projeto','Ex.: Planejar minha viagem',select('projectKind','Contexto',[['Pessoal','Pessoal'],['Trabalho','Trabalho'],['Estudos','Estudos']])):more('projects')}`;
  }
  function tasks(){
    return `${added('tasks','tasks')}${isAdding('tasks')?entryForm('tasks','Sua próxima ação','Ex.: Pesquisar destinos',select('taskProject','Projeto',projectOptions())+select('taskWhen','Quando',[['today','Hoje, na demonstração'],['later','Sem prazo']])):more('tasks')}`;
  }
  function knowledge(){
    const f=state().fields;
    return `<div class="ob-form">${field('notebook','Nome do caderno',60,'Ex.: Ideias e aprendizados')}${options('Adicionar uma primeira nota',field('noteTitle','Título da nota',120,'Ex.: O que quero aprender')+`<div class="field"><label for="ob-noteBody">Sua ideia</label><textarea id="ob-noteBody" data-ob-field="noteBody" maxlength="2000" rows="3" placeholder="Escreva quando quiser…">${E(f.noteBody)}</textarea></div>`+options('Vincular a um projeto',select('noteProject','Projeto da nota',projectOptions())),Boolean(f.noteTitle||f.noteBody))}</div>`;
  }
  function otherSpaces(){
    return `<div class="ob-module-list">${[
      ['wallet','Financeiro','Gastos e contas','Acompanhe entradas, despesas e cartão. O resumo financeiro também aparece no seu painel.'],
      ['file-text','Arquivos','Materiais com contexto','A proposta reúne materiais às suas ideias. Nesta demonstração, não há upload de arquivos.'],
      ['lock','Cofre','Informações reservadas','Explore os itens fictícios do Cofre. Este protótipo não recebe senhas ou segredos reais.']
    ].map(([icon,title,short,description])=>`<details class="ob-module"><summary>${I(icon)}<span><strong>${title}</strong><small>${short}</small></span>${I('chevron-down',16)}</summary><div class="ob-module-copy">${description}</div></details>`).join('')}</div>`;
  }
  const countLabel=(n,singular,plural)=>n+' '+(n===1?singular:plural);
  function hasChoices(){
    const o=state(),f=o.fields;
    return Boolean([false,f.name.trim()||f.focus,o.accountIds.length,o.habits.length||f.habitTitle.trim(),o.projects.length||f.projectTitle.trim(),o.tasks.length||f.taskTitle.trim(),f.notebook.trim()||f.noteTitle.trim()||f.noteBody.trim(),false][o.step]);
  }
  function syncSkip(){const el=document.querySelector('[data-action="ob-skip"]');if(el)el.hidden=hasChoices();}
  function summary(){
    const o=state(),f=o.fields,complete=o.status==='complete',rows=[];
    if(f.name.trim())rows.push(['user',f.name.trim(),f.focus||'Seu perfil']);
    else if(f.focus)rows.push(['grid',f.focus,'Seu foco']);
    const googleCount=new Set([...(A.state.googleAccounts||[]).map(g=>g.id),...o.accountIds]).size;
    if(googleCount)rows.push(['calendar',countLabel(googleCount,'conta de exemplo','contas de exemplo'),'Google Calendar']);
    if(o.habits.length)rows.push(['habit',countLabel(o.habits.length,'hábito','hábitos'),'Para acompanhar']);
    if(o.projects.length)rows.push(['folder',countLabel(o.projects.length,'projeto','projetos'),o.projects.length===1?o.projects[0].title:'Seus planos']);
    if(o.tasks.length)rows.push(['tasks',countLabel(o.tasks.length,'tarefa','tarefas'),'Seus próximos passos']);
    if(o.knowledgeEnabled)rows.push(['book',f.notebook.trim(),f.noteTitle.trim()?'1 nota preparada':'Seu caderno']);
    return `${rows.length?`<ul class="ob-summary-list">${rows.map(([icon,label,detail])=>`<li>${I(icon)}<span><strong>${E(label)}</strong><small>${E(detail)}</small></span></li>`).join('')}</ul>`:'<p class="ob-empty">Você pode configurar tudo pelo painel.</p>'}${complete?button('new','Configurar mais recursos','ob-quiet ob-add-more'):options('Revisar escolhas',`<div class="ob-review">${steps.slice(0,TOTAL).map((label,index)=>button('step',label+I('chevron-right',16),'ob-quiet',`data-step="${index+1}"`)).join('')}</div>`)}`;
  }
  const headings=[null,
    ['Como podemos chamar você?','Um nome para deixar o espaço mais seu.'],
    ['Traga sua agenda.','Veja compromissos pessoais e de trabalho juntos.'],
    ['Comece com um hábito.','Escolha algo pequeno para fazer com frequência.'],
    ['Dê nome a um plano.','Um projeto reúne suas tarefas e ideias.'],
    ['Escolha o próximo passo.','O que você pode fazer para começar?'],
    ['Um lugar para suas ideias.','Cadernos guardam notas e aprendizados.'],
    ['Explore no seu tempo.','Estes espaços também fazem parte do seu painel.']
  ];
  function progress(step){
    return `<div class="ob-progress"><div class="ob-progress-copy"><label for="ob-progress">${step===SUMMARY?'Seu espaço está pronto':`Etapa ${step} de ${TOTAL}`}</label>${step<SUMMARY&&state().status!=='complete'?`<details class="ob-step-menu"><summary>Ver etapas ${I('chevron-down',14)}</summary><nav aria-label="Etapas da configuração"><ol class="ob-steps">${steps.map((label,index)=>`<li>${button('step',`<span class="ob-step-number">${state().visited.includes(index+1)?I('check',14):index+1}</span>${label}`,`ob-step ${step===index+1?'is-active':''}`,`data-step="${index+1}" ${step===index+1?'aria-current="step"':''}`)}</li>`).join('')}</ol></nav></details>`:''}</div><progress id="ob-progress" max="${TOTAL}" value="${Math.min(step-1,TOTAL)}">${Math.min(step-1,TOTAL)} de ${TOTAL}</progress></div>`;
  }
  function render(){
    const o=state(),step=o.status==='complete'?SUMMARY:o.step;
    document.title='Segundo Cérebro · Primeiros passos';
    document.body.classList.remove('mobile-nav-open');document.querySelector('#nav-tooltip').hidden=true;
    const title=step===SUMMARY?(o.fields.name.trim()?`${o.fields.name.trim().split(/\s+/)[0]}, vamos começar?`:'Vamos começar?'):headings[step]?.[0];
    const subtitle=step===SUMMARY?'Tudo pode ser ajustado depois.':headings[step]?.[1];
    document.querySelector('#app').innerHTML=`<div class="onboarding"><header class="ob-header"><a class="ob-brand" href="#/onboarding" data-action="ob-welcome" aria-label="Segundo Cérebro, apresentação">${A.brand()}<span>segundo<br><strong>cérebro.</strong></span></a><div class="ob-header-actions"><button class="icon-button" type="button" data-action="toggle-theme" aria-label="Alternar tema">${I('moon')}</button>${step?button('later',o.status==='complete'?'Ir para o painel':'Fazer depois','ob-quiet'):''}</div></header><div class="ob-layout"><main id="main" class="ob-content" tabindex="-1">${step?`${progress(step)}<div class="ob-heading"><h1 id="ob-title" tabindex="-1">${E(title)}</h1><p>${E(subtitle)}</p></div><div class="ob-stage">${[null,profile,calendar,habits,projects,tasks,knowledge,otherSpaces,summary][step]()}</div><p id="ob-error" class="ob-error" role="alert" hidden></p><footer class="ob-footer">${o.status==='complete'?'<span></span>':button('back',I('chevron-left')+' Voltar','ob-quiet')}<div class="ob-footer-actions">${step<SUMMARY?button('skip','Pular','ob-quiet'):''}${button(step===SUMMARY?'finish':'next',(step===SUMMARY?'Acessar meu painel':step===TOTAL?'Concluir':'Continuar')+' '+I('arrow-right'),'primary')}</div></footer>`:welcome()}<p class="ob-status ${A.storageError?'':'is-silent'}" id="ob-save-status" role="status" aria-live="polite">${A.storageError?'Não foi possível salvar. Continue nesta aba.':'Progresso salvo neste navegador.'}</p></main></div></div>`;
    A.syncTheme?.();syncSkip();
  }
  function add(type,redrawAfter=true){
    collect();const o=state(),f=o.fields,key=titleKeys[type],title=f[key].trim();
    if(!title)return error('Dê um nome para adicionar ou pule esta etapa.',`ob-${key}`);
    if(o[type].length>=5)return error('Adicione os próximos itens pelo painel.');
    if(o[type].some(x=>x.title.toLocaleLowerCase('pt-BR')===title.toLocaleLowerCase('pt-BR')))return error('Este item já foi adicionado. Escolha outro nome.',`ob-${key}`);
    const item={id:A.uid('ob-'+type),title};
    if(type==='habits')Object.assign(item,{cadence:f.habitCadence==='weekly_target'?'weekly_target':'daily',goal:f.habitCadence==='weekly_target'?3:7,weeklyTarget:3,weekdays:[],checked:[],paused:false,archived:false,startDate:A.TODAY});
    if(type==='projects')Object.assign(item,{kind:f.projectKind,description:'',color:{Pessoal:'purple',Trabalho:'blue',Estudos:'green'}[f.projectKind]||'blue',deadline:'',status:'active'});
    if(type==='tasks')Object.assign(item,{project:projectOptions().some(x=>x[0]===f.taskProject)?f.taskProject:'',category:[...o.projects,...A.state.projects].find(p=>p.id===f.taskProject)?.kind||'Pessoal',status:'todo',priority:'medium',due:f.taskWhen==='today'?A.TODAY:'',description:'',estimate:0});
    o[type].push(item);f[key]='';A.ui.obAdding=null;
    const input=document.querySelector(`[data-ob-field="${key}"]`);if(input)input.value='';
    if(type==='projects'){if(!f.taskProject)f.taskProject=item.id;if(!f.noteProject)f.noteProject=item.id;}
    persist();if(redrawAfter){redraw(o[type].length<5?'ob-more-'+type:'ob-title');A.notify('Adicionado.');}return true;
  }
  function validKnowledge(){
    const o=state(),f=o.fields;
    if(!f.notebook.trim()&&(f.noteTitle.trim()||f.noteBody.trim()||o.knowledgeEnabled))return error('Dê um nome ao caderno para guardar sua nota.','ob-notebook');
    if(f.noteBody.trim()&&!f.noteTitle.trim())return error('Dê um título à sua nota.','ob-noteTitle');
    if(duplicateNote())return error('Já existe uma página com esse título. Escolha outro nome.','ob-noteTitle');
    o.knowledgeEnabled=Boolean(f.notebook.trim());return true;
  }
  function prepareStep(){
    collect();const o=state(),f=o.fields,kind={3:'habits',4:'projects',5:'tasks'}[o.step];
    if(kind&&f[titleKeys[kind]].trim()&&!add(kind,false))return false;
    if(o.step===6&&!validKnowledge())return false;
    return true;
  }
  function next(skip=false){
    const o=state();if(o.status==='complete')return;
    if(!skip&&!prepareStep())return;
    if(skip){collect();if(o.step===6)o.knowledgeEnabled=false;}
    if(o.step===TOTAL&&!prepareSummary())return;
    if(!o.visited.includes(o.step))o.visited.push(o.step);
    changeStep(o.step+1);
  }
  function duplicateNote(){
    const o=state(),title=o.fields.noteTitle.trim().toLocaleLowerCase();
    return title&&A.state.notes.some(n=>!n.deleted&&n.id!==o.noteId&&n.title.toLocaleLowerCase()===title);
  }
  function prepareSummary(){
    collect();const o=state(),f=o.fields;
    for(const [type,step] of [['habits',3],['projects',4],['tasks',5]]){
      const title=f[titleKeys[type]].trim();
      if(title&&(o[type].length>=5||o[type].some(item=>item.title.toLocaleLowerCase('pt-BR')===title.toLocaleLowerCase('pt-BR')))){
        changeStep(step);return add(type,false);
      }
    }
    if((!f.notebook.trim()&&(f.noteTitle.trim()||f.noteBody.trim()||o.knowledgeEnabled))||(f.noteBody.trim()&&!f.noteTitle.trim())||duplicateNote()){
      changeStep(6);return validKnowledge();
    }
    for(const type of ['habits','projects','tasks'])if(f[titleKeys[type]].trim())add(type,false);
    o.knowledgeEnabled=Boolean(f.notebook.trim());
    return true;
  }
  function finish(){
    const o=state();if(o.status==='complete'){A.go('inicio');return;}
    if(!prepareSummary())return;
    if(o.knowledgeEnabled&&(!o.fields.notebook.trim()||(o.fields.noteBody.trim()&&!o.fields.noteTitle.trim()))){changeStep(6);error('Confira o nome do caderno e o título da nota.','ob-notebook');return;}
    if(o.knowledgeEnabled&&duplicateNote()){changeStep(6);error('Já existe uma página com esse título. Escolha outro nome.','ob-noteTitle');return;}
    const f=o.fields,name=f.name.trim();if(name)A.state.settings.name=name;if(f.focus)A.state.settings.focus=f.focus;
    for(const key of ['habits','projects','tasks']){
      const existing=new Set(A.state[key].map(x=>x.id));
      A.state[key].unshift(...o[key].filter(x=>!existing.has(x.id)).map(x=>structuredClone(x)));
    }
    if(o.accountIds.length){
      const current=A.state.googleAccounts||[];
      o.accountIds.forEach(id=>{const account=accounts.find(g=>g.id===id);if(account&&!current.some(g=>g.id===id)&&current.length<2){current.push(structuredClone(account));account.sources.forEach(source=>A.state.calendarSources[source]=true);}});
      A.state.googleAccounts=current;
      const connected=new Set(current.flatMap(g=>g.sources));Object.keys(A.state.calendarSources).forEach(source=>{if(!connected.has(source))A.state.calendarSources[source]=false;});
    }
    if(o.knowledgeEnabled){
      const notebook=f.notebook.trim();if(!A.state.notebooks.includes(notebook))A.state.notebooks.push(notebook);
      if(f.noteTitle.trim()&&!A.state.notes.some(n=>n.id===o.noteId))A.state.notes.unshift({id:o.noteId,title:f.noteTitle.trim(),body:f.noteBody.trim(),notebook,project:f.noteProject,updated:A.TODAY});
    }
    o.status='complete';o.step=SUMMARY;o.completedAt=new Date().toISOString();A.log('Configuração inicial concluída','Seu espaço recebeu as escolhas do onboarding.');A.go('inicio');A.notify('Seu espaço está pronto.');
  }
  function resume(){const o=state();if(o.status!=='complete')o.status='active';persist();A.go('onboarding');}
  A.onboarding={render,init(){const o=state();if((!location.hash||location.hash==='#/inicio')&&o.status==='active')history.replaceState(null,'','#/onboarding');},
    banner(){return state().status!=='complete'?`<div class="ob-resume"><div><strong>Continue de onde parou.</strong><p>Suas escolhas estão guardadas.</p></div>${button('resume','Continuar configuração '+I('arrow-right'))}</div>`:'';},
    settings(){const complete=state().status==='complete';return `<section class="panel"><div class="section-head"><div><h2>Primeiros passos</h2><p class="muted">${complete?'Reveja suas escolhas ou prepare mais recursos.':'Continue a configuração quando quiser.'}</p></div>${button('resume',complete?'Rever configuração':'Continuar configuração')}</div></section>`;}
  };
  Object.assign(A.actions,{
    'ob-start':()=>changeStep(state().step||1),'ob-welcome':()=>changeStep(0),'ob-resume':resume,
    'ob-next':()=>next(),'ob-skip':()=>next(true),'ob-back':()=>changeStep(state().step-1),
    'ob-step':el=>{const o=state(),target=Number(el.dataset.step);if(o.status==='complete')return;if(target===SUMMARY){if(!prepareSummary())return;}else if(target>o.step&&!prepareStep())return;changeStep(target);},
    'ob-later':()=>{collect();if(state().status!=='complete')state().status='paused';persist();A.go('inicio');},
    'ob-focus':el=>{collect();state().fields.focus=state().fields.focus===el.dataset.value?'':el.dataset.value;persist();document.querySelectorAll('[data-action="ob-focus"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.value===state().fields.focus)));syncSkip();},
    'ob-account':el=>{const o=state(),id=el.dataset.id;if(!accounts.some(g=>g.id===id)||(A.state.googleAccounts||[]).some(g=>g.id===id))return;const index=o.accountIds.indexOf(id);if(index>=0)o.accountIds.splice(index,1);else if(o.accountIds.length+(A.state.googleAccounts||[]).length<2)o.accountIds.push(id);else return;persist();redraw();document.querySelector(`[data-action="ob-account"][data-id="${id}"]`)?.focus();},
    'ob-add-more':el=>{const type=el.dataset.kind;if(!titleKeys[type])return;collect();A.ui.obAdding=type;redraw('ob-'+titleKeys[type]);},
    'ob-remove':el=>{const o=state(),type=el.dataset.kind,id=el.dataset.id;if(!titleKeys[type])return;collect();o[type]=o[type].filter(x=>x.id!==id);if(type==='projects'){o.tasks.forEach(t=>{if(t.project===id)t.project='';});if(o.fields.taskProject===id)o.fields.taskProject='';if(o.fields.noteProject===id)o.fields.noteProject='';}persist();redraw(isAdding(type)?'ob-'+titleKeys[type]:'ob-more-'+type);},
    'ob-finish':finish,'ob-new':()=>{A.state.onboarding=blank();state().fields.name=A.state.settings.name;persist();changeStep(1);}
  });
  A.forms['ob-habit']=()=>add('habits');A.forms['ob-project']=()=>add('projects');A.forms['ob-task']=()=>add('tasks');
  document.addEventListener('input',event=>{
    const key=event.target.dataset.obField;if(!fieldKeys.has(key))return;state().fields[key]=event.target.value;
    if(key==='notebook')state().knowledgeEnabled=Boolean(event.target.value.trim());
    clearError();syncSkip();persist();
  });
  document.addEventListener('change',event=>{const key=event.target.dataset.obField;if(fieldKeys.has(key)){state().fields[key]=event.target.value;persist();}});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    document.querySelectorAll('.ob-step-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary')?.focus();});
  });
})();
