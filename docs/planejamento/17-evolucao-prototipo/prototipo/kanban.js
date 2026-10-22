/* Tarefas: as visualizações Lista e Kanban compartilham os mesmos registros. */
(() => {
  'use strict';
  const A=window.App, E=A.esc, I=A.icon, VIEW_KEY='sc-prototype-task-view';
  const columns=[['todo','A fazer'],['doing','Em andamento'],['done','Concluídas']];
  const statuses={todo:'A fazer',doing:'Em andamento',done:'Concluída',archived:'Arquivada'};
  const priorities={low:'Baixa',medium:'Média',high:'Alta',urgent:'Urgente'};
  let view='list',draggedId=null;
  try{view=localStorage.getItem(VIEW_KEY)==='kanban'?'kanban':'list';}catch(e){/* A preferência continua disponível nesta sessão. */}

  function getView(){return view;}
  function viewControl(){
    return `<div class="task-view-switch" role="group" aria-label="Visualização de tarefas">${[['list','Lista'],['kanban','Kanban']].map(([value,label])=>`<button type="button" class="button ${view===value?'active':''}" data-action="task-view" data-value="${value}" aria-pressed="${view===value}">${I(value,17)}${label}</button>`).join('')}</div>`;
  }
  function dueLabel(task){
    if(!task.due)return '<span class="kanban-due">Sem prazo</span>';
    let label;
    try{label=task.due===A.TODAY?'Hoje':A.dateLabel(task.due);}catch(e){label='Prazo a revisar';}
    const overdue=task.due<A.TODAY&&!['done','archived'].includes(task.status)&&!task.deleted;
    return `<time class="kanban-due ${overdue?'overdue':''}" datetime="${E(task.due)}">${overdue?'Atrasada · ':''}${E(label)}</time>`;
  }
  function card(task){
    const project=A.state.projects.find(p=>p.id===task.project)?.title||'Sem projeto';
    const draggable=!task.deleted&&task.status!=='archived';
    const priority=priorities[task.priority]||'Sem prioridade';
    const note=task.noteId&&A.state.notes.some(n=>n.id===task.noteId&&!n.deleted);
    return `<article class="kanban-card ${task.status==='done'?'is-complete':''}" data-task-id="${E(task.id)}">
      <div class="kanban-card-context"><span class="kanban-project">${I('folder',14)}${E(project)}</span>${draggable?`<span class="kanban-drag-handle" draggable="true" aria-hidden="true" title="Arraste para mover">${I('grip',18)}</span>`:''}</div>
      <button type="button" class="kanban-card-title" data-action="open-task" data-id="${E(task.id)}">${E(task.title)}</button>
      <p class="kanban-card-category">${E(task.category||'Pessoal')}${task.origin?' · Captura de origem':''}</p>
      <div class="kanban-card-meta"><span class="pill ${['high','urgent'].includes(task.priority)?'warm':''}" aria-label="Prioridade ${E(priority.toLocaleLowerCase('pt-BR'))}">${E(priority)}</span>${dueLabel(task)}${note?`<span class="kanban-note" title="Nota relacionada">${I('file-text',15)}<span class="sr-only">Com nota relacionada</span></span>`:''}</div>
      <div class="kanban-card-footer">${task.deleted?`<button type="button" class="button kanban-restore" data-action="restore-task" data-id="${E(task.id)}" aria-label="Restaurar ${E(task.title)}">${I('refresh',15)}Restaurar tarefa</button>`:`<select class="kanban-status-select" data-change="kanban-status" data-task-id="${E(task.id)}" aria-label="Estado de ${E(task.title)}">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${task.status===value?'selected':''}>${label}</option>`).join('')}</select>`}</div>
    </article>`;
  }
  function render(tasks,filter='all'){
    const special=filter==='trash'||filter==='archived';
    const groups=special?[[filter,filter==='trash'?'Lixeira':'Arquivadas']]:columns;
    return `${special?'':`<p class="kanban-hint"><span class="kanban-hint-desktop">Arraste pelo ícone ou altere o estado no cartão.</span><span class="kanban-hint-touch">Deslize para ver as colunas. Altere o estado no cartão.</span></p>`}
      <div class="kanban-board ${special?'is-single-column':''}" role="region" aria-label="Quadro de tarefas" tabindex="0">
      ${groups.map(([status,label])=>{
        const items=special?tasks:tasks.filter(t=>t.status===status);
        const emptyText=filter==='trash'?'A lixeira está vazia.':filter==='archived'?'Nenhuma tarefa arquivada.':'Nenhuma tarefa nesta etapa com os filtros atuais.';
        return `<section class="kanban-column" data-status="${status}" aria-labelledby="kanban-heading-${status}">
          <div class="kanban-column-head"><h2 id="kanban-heading-${status}" tabindex="-1">${label}</h2><span class="kanban-count" aria-label="${items.length} ${items.length===1?'tarefa':'tarefas'}">${items.length}</span></div>
          <div class="kanban-cards">${items.map(card).join('')||`<p class="kanban-empty">${emptyText}</p>`}</div>
          ${special?'':`<button type="button" class="kanban-add" data-action="kanban-new" data-status="${status}" aria-label="Nova tarefa em ${label}">${I('plus',16)}Nova tarefa</button>`}
        </section>`;
      }).join('')}</div>`;
  }
  function rememberScroll(){
    const board=document.querySelector('.kanban-board');
    return {left:board?.scrollLeft||0,top:board?.scrollTop||0,x:window.scrollX||0,y:window.scrollY||0};
  }
  function renderAfterMove(id,status,scroll){
    A.render();
    const board=document.querySelector('.kanban-board');
    if(!board)return;
    board.scrollLeft=scroll.left;board.scrollTop=scroll.top;
    const select=[...board.querySelectorAll('.kanban-status-select')].find(el=>el.dataset.taskId===id);
    const destination=board.querySelector(`[data-status="${status}"] .kanban-column-head h2`);
    const target=select||destination||board.querySelector('.kanban-column-head h2')||board;
    target.focus({preventScroll:true});
    // Reveal focus horizontally; keep the page position when the control remains visible.
    const viewport=board.getBoundingClientRect?.(),bounds=target.getBoundingClientRect?.();
    if(viewport&&bounds){
      if(bounds.left<viewport.left+12)board.scrollLeft-=viewport.left+12-bounds.left;
      else if(bounds.right>viewport.right-12)board.scrollLeft+=bounds.right-viewport.right+12;
    }
    window.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});
    const focused=target.getBoundingClientRect?.(),height=window.innerHeight;
    if(focused&&height>0){
      const topbar=document.querySelector('.topbar')?.getBoundingClientRect?.();
      const bottomNav=document.querySelector('.mobile-bottom')?.getBoundingClientRect?.();
      const top=topbar?.height>0&&topbar.bottom>0&&topbar.top<height?Math.max(16,topbar.bottom+16):16;
      const bottom=bottomNav?.height>0&&bottomNav.top<height&&bottomNav.bottom>0?Math.min(height-16,bottomNav.top-16):height-16;
      const delta=focused.top<top||focused.bottom>bottom?(focused.top+focused.bottom-top-bottom)/2:0;
      if(delta)window.scrollTo({left:scroll.x,top:Math.max(0,window.scrollY+delta),behavior:'instant'});
    }
  }
  function moveTask(id,status){
    const task=A.state.tasks.find(t=>t.id===id);
    if(!task||task.deleted||!Object.hasOwn(statuses,status))return false;
    if(task.status===status)return true;
    const scroll=rememberScroll(),previousStatus=task.status,previousActivity=A.state.activity.slice();
    task.status=status;
    A.state.activity.unshift({id:A.uid('a'),title:status==='done'?'Tarefa concluída':status==='archived'?'Tarefa arquivada':'Estado da tarefa atualizado',detail:`${task.title} · ${statuses[status]}`,time:new Date().toISOString()});
    A.state.activity=A.state.activity.slice(0,80);
    if(!A.save()){
      task.status=previousStatus;A.state.activity=previousActivity;
      renderAfterMove(id,previousStatus,scroll);
      A.notify('Não foi possível salvar a mudança. O estado anterior foi mantido. Tente novamente.');
      return false;
    }
    renderAfterMove(id,status,scroll);
    A.notify(`Tarefa movida para ${statuses[status].toLocaleLowerCase('pt-BR')}.`);
    return true;
  }
  function clearDrag(){
    draggedId=null;
    document.querySelectorAll('.kanban-column.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));
    document.querySelectorAll('.kanban-card.is-dragging').forEach(el=>el.classList.remove('is-dragging'));
  }
  function dropColumn(target){
    const column=target.closest?.('.kanban-column');
    return column&&columns.some(([status])=>status===column.dataset.status)?column:null;
  }
  function canDrop(){
    const task=A.state.tasks.find(t=>t.id===draggedId);
    return task&&!task.deleted&&task.status!=='archived';
  }
  A.actions['task-view']=el=>{
    const next=el.dataset.value;
    if(!['list','kanban'].includes(next)||next===view)return;
    clearDrag();view=next;
    let stored=true;
    try{localStorage.setItem(VIEW_KEY,view);}catch(e){stored=false;}
    A.render();
    document.querySelector(`.task-view-switch [data-value="${view}"]`)?.focus({preventScroll:true});
    if(!stored)A.notify('A visualização foi alterada. O navegador não permitiu lembrar esta preferência.');
  };
  A.actions['kanban-new']=el=>{
    const status=el.dataset.status;
    if(columns.some(([value])=>value===status))A.taskDialog(null,{status,project:A.ui.taskProject||''});
  };
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset?.change!=='kanban-status')return;
    moveTask(el.dataset.taskId,el.value);
  });
  document.addEventListener('dragstart',event=>{
    const handle=event.target.closest?.('.kanban-drag-handle');
    if(!handle)return;
    const taskCard=handle.closest('.kanban-card');
    draggedId=taskCard?.dataset.taskId;
    if(!draggedId||!canDrop()||!event.dataTransfer){event.preventDefault();clearDrag();return;}
    taskCard.classList.add('is-dragging');
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',draggedId);
    event.dataTransfer.setDragImage?.(taskCard,24,24);
  });
  document.addEventListener('dragover',event=>{
    if(!draggedId||!canDrop())return;
    const column=dropColumn(event.target);
    if(!column)return;
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='move';
    document.querySelectorAll('.kanban-column.is-drop-target').forEach(el=>{if(el!==column)el.classList.remove('is-drop-target');});
    column.classList.add('is-drop-target');
  });
  document.addEventListener('dragleave',event=>{
    const column=dropColumn(event.target);
    if(column&&!column.contains(event.relatedTarget))column.classList.remove('is-drop-target');
  });
  document.addEventListener('drop',event=>{
    const column=dropColumn(event.target),id=draggedId;
    if(!id||!column||!canDrop()){clearDrag();return;}
    event.preventDefault();clearDrag();moveTask(id,column.dataset.status);
  });
  document.addEventListener('dragend',clearDrag);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&draggedId)clearDrag();});
  window.addEventListener('hashchange',clearDrag);
  A.kanban={getView,viewControl,render,moveTask};
})();
