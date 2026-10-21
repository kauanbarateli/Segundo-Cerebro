/* Segundo Cérebro — protótipo local. Todos os registros abaixo são fictícios. */
(() => {
  'use strict';
  const TODAY = '2026-10-17', STORAGE = 'sc-prototype-v1';
  const seed = {
    version: 1,
    settings: {name:'Kauan',hideAmounts:false,reminders:true,reminderMinutes:10},
    calendarSources:{work:true,personal:true,study:true},
    projects:[
      {id:'p1',title:'Segundo Cérebro',description:'Um lugar para conectar ideias e transformar intenção em ação.',color:'blue',deadline:'2026-10-30',status:'active',coverImage:'assets/covers/project-workspace.png'},
      {id:'p2',title:'Aprender com intenção',description:'Construir um repertório que faça diferença no trabalho.',color:'purple',deadline:'2026-11-20',status:'active',coverImage:'assets/covers/project-learning.png'},
      {id:'p3',title:'Uma rotina mais leve',description:'Abrir espaço para saúde, movimento e descanso.',color:'green',deadline:'2026-12-01',status:'active',coverImage:'assets/covers/focus-landscape.png'}
    ],
    tasks:[
      {id:'t1',title:'Revisar a experiência de captura',description:'Rever o caminho entre uma ideia solta e uma tarefa com contexto. Anotar o que pode ficar mais simples.',project:'p1',category:'Trabalho',status:'doing',priority:'high',due:TODAY,estimate:45,relatedEvent:'e1',noteId:'n1'},
      {id:'t2',title:'Ler o próximo capítulo de Hábitos Atômicos',description:'Registrar três ideias que posso aplicar à minha rotina.',project:'p2',category:'Estudos',status:'todo',priority:'medium',due:TODAY,estimate:25,noteId:'n2'},
      {id:'t3',title:'Organizar os gastos da semana',description:'Conferir os lançamentos e planejar a próxima semana.',project:'p3',category:'Pessoal',status:'todo',priority:'medium',due:TODAY,estimate:20},
      {id:'t4',title:'Preparar roteiro de entrevistas',description:'Escrever perguntas sobre organização pessoal, captura e recuperação de informações.',project:'p1',category:'Trabalho',status:'todo',priority:'high',due:'2026-10-19',estimate:60},
      {id:'t5',title:'Separar referências para o calendário',description:'Priorizar legibilidade dos horários e dos compromissos.',project:'p1',category:'Trabalho',status:'done',priority:'low',due:TODAY,estimate:30},
      {id:'t6',title:'Agendar revisão dos objetivos',description:'Reservar um momento no fim do mês para refletir.',project:'p3',category:'Pessoal',status:'todo',priority:'low',due:'2026-10-23',estimate:15}
    ],
    captures:[
      {id:'c1',title:'Uma ideia para a revisão semanal',body:'Começar pela pergunta: o que merece minha atenção na próxima semana?',type:'idea',created:TODAY},
      {id:'c2',title:'Pesquisar livros sobre atenção',body:'Encontrar leituras sobre foco profundo e criar uma pequena lista de referências.',type:'note',created:'2026-10-16'},
      {id:'c3',title:'Testar a captura com o celular',body:'Experimentar salvar uma ideia enquanto estou fora de casa.',type:'task',created:'2026-10-16'}
    ],
    notebooks:['Produto','Aprendizado','Vida pessoal'],
    notes:[
      {id:'n1',title:'Decisões da revisão de produto',notebook:'Produto',project:'p1',relatedEvent:'e1',body:'Uma experiência mais simples começa com menos decisões.\n\nObjetivo da revisão\nEntender como capturar uma ideia rapidamente e reencontrá-la no momento certo.\n\nDecisões\n• Capturar primeiro, organizar depois.\n• Preservar a origem quando uma captura virar tarefa.\n• Conectar tarefas, notas e compromissos pelo contexto.\n\nPróximo passo\nRevisar o fluxo com base em [[Princípios do Segundo Cérebro]].',updated:TODAY},
      {id:'n2',title:'Pequenos hábitos, grandes mudanças',notebook:'Aprendizado',project:'p2',body:'A consistência vale mais do que a intensidade de um único dia.\n\nIdeias da leitura\n• Tornar o hábito fácil de começar.\n• Deixar os sinais visíveis no ambiente.\n• Revisar a rotina sem transformar um dia difícil em desistência.\n\nExperimento desta semana\nLer por vinte minutos depois do café da manhã.',updated:'2026-10-16'},
      {id:'n3',title:'Princípios do Segundo Cérebro',notebook:'Produto',project:'p1',body:'Capturar → organizar → conectar → reencontrar → agir → revisar.\n\nUma informação, vários contextos\nUma nota conserva sua identidade quando é vinculada a um projeto ou a uma reunião.\n\nClareza antes de complexidade\nA interface deve ajudar a entender o próximo movimento.\n\nVeja também [[Decisões da revisão de produto]].',updated:'2026-10-15'},
      {id:'n4',title:'Minha revisão de domingo',notebook:'Vida pessoal',project:'p3',body:'Um encontro breve comigo para encerrar a semana.\n\n1. Esvaziar a caixa de entrada.\n2. Reconhecer o que avancei.\n3. Conferir os próximos compromissos.\n4. Escolher três prioridades.\n5. Reservar tempo para descansar.',updated:'2026-10-14'}
    ],
    habits:[
      {id:'h1',title:'Ler por 20 minutos',goal:'20 minutos por dia',checked:['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16',TODAY],paused:false},
      {id:'h2',title:'Movimentar o corpo',goal:'30 minutos por dia',checked:['2026-10-12','2026-10-14','2026-10-15','2026-10-16'],paused:false},
      {id:'h3',title:'Planejar o próximo dia',goal:'5 minutos à noite',checked:['2026-10-12','2026-10-13','2026-10-15','2026-10-16'],paused:false}
    ],
    accounts:[{id:'checking',name:'Conta principal',kind:'checking',opening:185000},{id:'card',name:'Cartão pessoal',kind:'card',opening:0}],
    transactions:[
      {id:'f1',title:'Salário',amount:650000,type:'income',account:'checking',date:'2026-10-05',category:'Trabalho'},
      {id:'f2',title:'Aluguel',amount:180000,type:'expense',account:'checking',date:'2026-10-06',category:'Moradia'},
      {id:'f3',title:'Supermercado',amount:38690,type:'expense',account:'checking',date:'2026-10-15',category:'Alimentação'},
      {id:'f4',title:'Curso de design',amount:18900,type:'expense',account:'card',date:'2026-10-12',category:'Educação'},
      {id:'f5',title:'Café e uma boa conversa',amount:2850,type:'expense',account:'checking',date:'2026-10-16',category:'Lazer'},
      {id:'f6',title:'Internet',amount:9990,type:'expense',account:'checking',date:'2026-10-10',category:'Moradia'},
      {id:'f7',title:'Livraria',amount:7990,type:'expense',account:'card',date:TODAY,category:'Educação'}
    ],
    events:[
      {id:'e1',title:'Revisão do Segundo Cérebro',date:TODAY,start:'10:00',end:'11:00',source:'work',location:'Google Meet · demonstração',noteId:'n1',project:'p1'},
      {id:'e2',title:'Caminhada no parque',date:TODAY,start:'07:30',end:'08:30',source:'personal',location:'Parque da cidade',project:'p3'},
      {id:'e3',title:'Leitura e anotações',date:TODAY,start:'15:00',end:'16:00',source:'study',location:'Em casa',noteId:'n2',project:'p2'},
      {id:'e4',title:'Planejamento da semana',date:'2026-10-12',start:'09:00',end:'10:00',source:'work',location:'Escritório',project:'p1'},
      {id:'e5',title:'Estudo de experiência do usuário',date:'2026-10-12',start:'14:00',end:'15:30',source:'study',location:'Biblioteca',project:'p2'},
      {id:'e6',title:'Conversa sobre o produto',date:'2026-10-13',start:'10:00',end:'11:30',source:'work',location:'Google Meet · demonstração',project:'p1'},
      {id:'e7',title:'Treino de força',date:'2026-10-13',start:'17:00',end:'18:00',source:'personal',location:'Academia',project:'p3'},
      {id:'e8',title:'Tempo de foco',date:'2026-10-14',start:'08:30',end:'10:30',source:'work',location:'Escritório',project:'p1'},
      {id:'e9',title:'Aula de inglês',date:'2026-10-14',start:'14:00',end:'15:00',source:'study',location:'Aula online',project:'p2'},
      {id:'e10',title:'Apresentação do projeto',date:'2026-10-15',start:'10:00',end:'11:30',source:'work',location:'Sala de reuniões',project:'p1'},
      {id:'e11',title:'Almoço em família',date:'2026-10-15',start:'12:00',end:'13:00',source:'personal',location:'Em casa'},
      {id:'e12',title:'Organizar referências',date:'2026-10-16',start:'09:00',end:'10:00',source:'work',location:'Escritório',project:'p1'},
      {id:'e13',title:'Grupo de leitura',date:'2026-10-16',start:'16:00',end:'17:30',source:'study',location:'Biblioteca',project:'p2'},
      {id:'e14',title:'Revisão semanal',date:'2026-10-18',start:'17:00',end:'17:45',source:'personal',location:'Em casa',noteId:'n4'},
      {id:'e15',title:'Semana de leitura',date:'2026-10-14',endDate:'2026-10-18',allDay:true,source:'study',location:'Agenda pessoal'}
    ],
    activity:[{id:'a1',title:'Nota atualizada',detail:'Decisões da revisão de produto',time:'2026-10-17T09:15:00-03:00'},{id:'a2',title:'Tarefa concluída',detail:'Separar referências para o calendário',time:'2026-10-17T08:50:00-03:00'}]
  };
  let state, storageError=false;
  try {const data=JSON.parse(localStorage.getItem(STORAGE));state=data?.version===1&&Array.isArray(data.tasks)&&Array.isArray(data.notes)?data:structuredClone(seed);}catch(e){state=structuredClone(seed);storageError=true;}
  // Upgrade only untouched example covers; an explicit empty value means the user removed it.
  let addedDemoCovers=false;
  for(const project of Array.isArray(state.projects)?state.projects:[]){
    const example=seed.projects.find(p=>p.id===project.id&&p.title===project.title);
    if(example&&!Object.hasOwn(project,'coverImage')){
      project.coverImage=example.coverImage;
      addedDemoCovers=true;
    }
  }
  if(addedDemoCovers){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){storageError=true;}}
  const paths={
    home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    capture:'M12 3v12m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
    inbox:'M4 4h16l2 12v4H2v-4L4 4m-2 12h6l2 3h4l2-3h6',
    book:'M12 5v16m0-16C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1',
    check:'m5 12 4 4L19 6', tasks:'M9 5h12M9 12h12M9 19h12M3 4l1 1 2-2M3 11l1 1 2-2M3 18l1 1 2-2',
    calendar:'M8 2v4m8-4v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    habit:'M20 7v5a8 8 0 1 1-4-7m-4 4v4l3 2m3-12v5h5',
    wallet:'M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5m17 7h-5v5h5m-3-2.5h.01',
    lock:'M6 11h12v10H6Zm2 0V7a4 4 0 0 1 8 0v4m-4 4v3',
    settings:'m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3Zm2 7a3 3 0 1 0 .01 0',
    search:'M21 21l-5-5M10 3a7 7 0 1 0 .01 0',
    plus:'M12 5v14M5 12h14', moon:'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13',
    sun:'M12 8a4 4 0 1 0 .01 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
    'arrow-up-right':'M6 18 18 6M6 6h12v12', 'arrow-right':'M4 12h16m-6-6 6 6-6 6',
    'chevron-right':'m9 5 7 7-7 7','chevron-left':'m15 5-7 7 7 7','chevron-down':'m6 9 6 6 6-6',
    clock:'M12 3a9 9 0 1 0 .01 0M12 7v5l3 2',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 20a2 2 0 0 0 4 0',
    x:'m6 6 12 12M6 18 18 6',menu:'M4 6h16M4 12h16M4 18h16',
    'file-text':'M14 2H4v20h16V8Zm0 0v6h6M8 12h8M8 16h8',
    link:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2m2 7a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2',
    'map-pin':'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0M12 7a3 3 0 1 0 .01 0',
    refresh:'M20 7v5h-5M4 17v-5h5m-5 0a8 8 0 0 1 13-6l3 3M4 15l3 3a8 8 0 0 0 13-6',
    info:'M12 3a9 9 0 1 0 .01 0M12 11v6m0-10v1',activity:'M3 12h4l3-8 4 16 3-8h4',
    eye:'M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12m10-3a3 3 0 1 0 .01 0',
    'eye-off':'m3 3 18 18M10 5h2c6 0 10 7 10 7l-3 4M6 6c-3 2-4 6-4 6s4 7 10 7h2',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',archive:'M3 3h18v5H3Zm2 5v13h14V8m-10 5h6',
    edit:'m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    copy:'M9 9h12v12H9ZM5 15H3V3h12v2',logout:'M9 3H3v18h6m-1-9h14m-5-5 5 5-5 5',
    shield:'M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6Zm-5 10 3 3 7-7',
    kanban:'M3 4h5v16H3Zm7 0h5v10h-5Zm7 0h4v13h-4Z',
    grip:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
    image:'M3 3h18v18H3ZM3 16l5-5 5 5 3-3 5 5M8 7h.01',
    more:'M5 12h.01M12 12h.01M19 12h.01',target:'M12 3a9 9 0 1 0 .01 0M12 7a5 5 0 1 0 .01 0M12 11a1 1 0 1 0 .01 0',
    filter:'M3 4h18l-7 8v7l-4 2v-9Z',grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
    list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    credit:'M2 5h20v14H2Zm0 5h20M6 15h3',user:'M12 3a4 4 0 1 0 .01 0M4 21v-3a8 8 0 0 1 16 0v3',
    checkCircle:'M20 11v1a8 8 0 1 1-5-7m-7 7 4 4 9-11',sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.App={state,seed,TODAY,ui:{route:'inicio',id:null,taskFilter:'all',noteFilter:'Todos',mobileNav:false},routes:{},actions:{},forms:{},storageError,
    esc,uid:(p='id')=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),
    icon:(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${name?(paths[name]||paths['file-text']):''}"/></svg>`,
    money:n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((n||0)/100),
    dateLabel:d=>d?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(d+'T12:00:00')):'Sem prazo',
    save(){try{localStorage.setItem(STORAGE,JSON.stringify(this.state));this.storageError=false;return true;}catch(e){this.storageError=true;this.notify('O navegador não permitiu salvar. Suas alterações ficam nesta sessão.');return false;}},
    persist(message){this.save();if(message){this.log(message);this.notify(message);}this.render();},
    log(title,detail=''){this.state.activity.unshift({id:this.uid('a'),title,detail,time:new Date().toISOString()});this.state.activity=this.state.activity.slice(0,80);this.save();},
    notify(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(this._toast);this._toast=setTimeout(()=>el.classList.remove('visible'),4000);},
    go(route,id){this.closeDialog();this.ui.mobileNav=false;const hash='#/'+route+(id?'/'+encodeURIComponent(id):'');if(location.hash===hash){this.ui.route=route;this.ui.id=id||null;this.render();}else location.hash=hash;},
    openDialog(title,body){const d=document.querySelector('#detail-dialog');this._returnFocus=document.activeElement;d.innerHTML=`<header class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close-dialog" aria-label="Fechar">${this.icon('x')}</button></header><div class="dialog-body">${body}</div>`;if(!d.open)d.showModal();},
    closeDialog(){document.querySelector('#detail-dialog')?.close();},
    setTheme(theme){this.ui.theme=theme;try{localStorage.setItem('sc-prototype-theme',theme);}catch(e){}document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;this.syncTheme?.();},
    exportData(){const blob=new Blob([JSON.stringify(this.state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='segundo-cerebro-demonstracao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notify('Dados de demonstração exportados.');},
    resetDemo(){this.openDialog('Recomeçar a demonstração',`<p>Isso apaga suas alterações neste protótipo e restaura os exemplos iniciais.</p><div class="dialog-actions"><button class="button" data-action="close-dialog">Manter alterações</button><button class="button danger" data-action="confirm-reset">Restaurar exemplos</button></div>`);}
  };
  try{App.ui.theme=localStorage.getItem('sc-prototype-theme')||'light';}catch(e){App.ui.theme='light';}
})();

