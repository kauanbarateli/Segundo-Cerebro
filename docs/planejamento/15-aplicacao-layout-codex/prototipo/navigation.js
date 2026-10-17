/* Navigation preferences and motion preserve the active page and unsaved fields. */
(() => {
  'use strict';
  const A=window.App;
  const mobile=matchMedia('(max-width:600px)');
  const compact=matchMedia('(max-width:1050px)');
  let saved;
  try { saved=localStorage.getItem('sc-prototype-sidebar'); } catch (_) {}
  A.ui.sidebarCollapsed=saved?saved==='collapsed':compact.matches;
  const originalIcon=A.icon;
  A.icon=(name,size=20)=>name==='panel-left'?`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M14 9l3 3-3 3"/></svg>`:originalIcon(name,size);
  const tip=()=>document.querySelector('#nav-tooltip');
  let tipTimer;
  function hideTip(){clearTimeout(tipTimer);const t=tip();if(t)t.hidden=true;document.querySelectorAll('[aria-describedby="nav-tooltip"]').forEach(el=>el.removeAttribute('aria-describedby'));}
  A.syncTheme=()=>{
    const dark=document.documentElement.dataset.theme==='dark';
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(el=>{el.innerHTML=A.icon(dark?'sun':'moon');el.setAttribute('aria-label',`Alternar para modo ${dark?'claro':'escuro'}`);});
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    document.querySelectorAll('[data-action="life-theme"]').forEach(el=>{
      const selected=el.dataset.theme===A.ui.theme;
      el.classList.toggle('is-selected',selected);el.setAttribute('aria-pressed',String(selected));
      const labels={light:['Claro','sun'],dark:['Escuro','moon'],system:['Sistema','grid']};
      const [label,icon]=labels[el.dataset.theme];
      el.lastElementChild.innerHTML=A.icon(icon)+label+(selected?A.icon('check'):'');
    });
  };
  A.syncShell=()=>{
    const shell=document.querySelector('.app-shell'),side=document.querySelector('.sidebar');
    if(!shell||!side)return;
    shell.classList.toggle('is-collapsed',A.ui.sidebarCollapsed);
    shell.classList.toggle('nav-open',A.ui.mobileNav);
    side.inert=mobile.matches&&!A.ui.mobileNav;
    document.querySelector('.workspace').inert=mobile.matches&&A.ui.mobileNav;
    document.querySelector('.mobile-bottom').inert=mobile.matches&&A.ui.mobileNav;
    document.body.classList.toggle('mobile-nav-open',mobile.matches&&A.ui.mobileNav);
    if(mobile.matches&&A.ui.mobileNav){side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');}
    else {side.removeAttribute('role');side.removeAttribute('aria-modal');}
    document.querySelectorAll('[data-action="toggle-sidebar"]').forEach(el=>{
      const label=`${A.ui.sidebarCollapsed?'Expandir':'Recolher'} menu lateral`;
      el.setAttribute('aria-expanded',String(!A.ui.sidebarCollapsed));el.setAttribute('aria-label',label);el.title=label;
    });
    document.querySelectorAll('[data-action="toggle-menu"]').forEach(el=>el.setAttribute('aria-expanded',String(A.ui.mobileNav)));
    hideTip();
    A.syncTheme();
  };
  A.toggleSidebar=()=>{
    A.ui.sidebarCollapsed=!A.ui.sidebarCollapsed;
    saved=A.ui.sidebarCollapsed?'collapsed':'expanded';
    try {localStorage.setItem('sc-prototype-sidebar',saved);}catch(_){}
    A.syncShell();
  };
  A.setMobileNav=open=>{
    if(open)A._navReturnFocus=document.activeElement;
    A.ui.mobileNav=open;A.syncShell();
    if(open)document.querySelector('.sidebar-close')?.focus({preventScroll:true});
    else if(A._navReturnFocus?.isConnected)A._navReturnFocus.focus({preventScroll:true});
  };
  function resize(){if(!saved)A.ui.sidebarCollapsed=compact.matches;if(!mobile.matches)A.ui.mobileNav=false;A.syncShell();}
  mobile.addEventListener('change',resize);compact.addEventListener('change',resize);
  function showTip(event){
    clearTimeout(tipTimer);
    const el=event.target.closest?.('[data-tooltip]');
    if(!el||!A.ui.sidebarCollapsed||mobile.matches)return;
    const t=tip(),rect=el.getBoundingClientRect();
    t.textContent=el.dataset.tooltip;t.hidden=false;t.style.left=`${rect.right+10}px`;t.style.top=`${Math.max(8,Math.min(innerHeight-44,rect.top+(rect.height-36)/2))}px`;
    el.setAttribute('aria-describedby','nav-tooltip');
  }
  document.addEventListener('pointerover',e=>{if(e.pointerType==='mouse')showTip(e);});
  document.addEventListener('pointerout',e=>{if(e.target.closest?.('[data-tooltip],#nav-tooltip')&&!e.target.closest('[data-tooltip],#nav-tooltip').contains(e.relatedTarget))tipTimer=setTimeout(hideTip,160);});
  document.addEventListener('focusin',showTip);document.addEventListener('focusout',hideTip);
  document.addEventListener('click',hideTip);
  document.addEventListener('scroll',hideTip,true);
  document.addEventListener('keydown',e=>{
    document.documentElement.dataset.input='keyboard';
    if(e.key==='Escape')hideTip();
    if(e.key==='Tab'&&A.ui.mobileNav&&mobile.matches){
      const items=[...document.querySelectorAll('.sidebar a,.sidebar button')].filter(el=>el.getClientRects().length&&!el.disabled);
      if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
    }
  },true);
  document.addEventListener('pointerdown',()=>{document.documentElement.dataset.input='pointer';},true);
})();
