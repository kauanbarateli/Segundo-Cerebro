/* Local checkout demonstration. Payment fields exist only in the form DOM. */
(() => {
  'use strict';
  const A=window.App, I=A.icon;
  const fieldNames=['name','email','card','expiry','security','terms','privacy'];
  let busy=false, attempt=0;

  const errorSlot=name=>`<p id="ck-error-${name}" class="ck-field-error" hidden></p>`;
  function field(name,label,attributes,hint=''){
    return `<div class="ck-field"><label for="ck-${name}">${label}</label><input id="ck-${name}" name="${name}" data-ck-field="${name}" aria-required="true" autocomplete="off" ${attributes}${hint?` aria-describedby="ck-hint-${name}"`:''}>${hint?`<small id="ck-hint-${name}">${hint}</small>`:''}${errorSlot(name)}</div>`;
  }
  function consent(name,label,readLabel){
    return `<div class="ck-consent"><div class="ck-consent-line"><input id="ck-${name}" name="${name}" data-ck-field="${name}" type="checkbox" aria-required="true"><label for="ck-${name}">${label}</label><button type="button" class="ck-link" data-action="public-legal-modal" data-kind="${name}" aria-label="${readLabel}">Ler</button></div>${errorSlot(name)}</div>`;
  }
  function render(){
    const dark=document.documentElement.dataset.theme==='dark';
    return `<div class="checkout"><header class="ck-header"><a class="ck-brand" href="#/conheca" aria-label="Segundo Cérebro, apresentação">${A.brand()}<span>segundo<br><strong>cérebro.</strong></span></a><button class="icon-button" type="button" data-action="toggle-theme" aria-label="Alternar para modo ${dark?'claro':'escuro'}">${I(dark?'sun':'moon')}</button></header><main id="main" class="ck-main" tabindex="-1"><a class="ck-back" href="#/conheca">${I('chevron-left',16)}Voltar à apresentação</a><div class="ck-heading"><h1>Assinar o Segundo Cérebro</h1><p>Um só plano para organizar sua vida, suas ideias e seus próximos passos.</p></div><div class="ck-demo-note">${I('info')}<p><strong>Checkout simulado.</strong> Nenhuma cobrança será feita. Use dados fictícios.</p></div><div class="ck-layout"><aside class="ck-summary" aria-labelledby="ck-summary-title"><h2 id="ck-summary-title">Acesso completo</h2><p class="ck-price"><strong>R$ 29,90</strong><span>/ mês</span></p><p class="ck-plan-copy">Todos os espaços do Segundo Cérebro em uma assinatura mensal.</p><ul class="ck-includes">${['Capturas e conhecimento','Tarefas e projetos','Agenda e hábitos','Financeiro e cofre'].map(text=>`<li>${I('check',16)}${text}</li>`).join('')}</ul><dl class="ck-totals"><div><dt>Assinatura mensal</dt><dd>R$ 29,90</dd></div><div><dt>Cobrança nesta simulação</dt><dd>R$ 0,00</dd></div></dl><p class="ck-summary-note">Esta demonstração não contrata uma assinatura real.</p></aside><form class="ck-form" data-form="checkout" novalidate autocomplete="off" aria-describedby="ck-form-help"><div class="ck-section-head"><div><h2>Seus dados</h2><p id="ck-form-help">Todos os campos são obrigatórios.</p></div><button type="button" class="ck-example" data-action="ck-example">Preencher exemplo</button></div>${field('name','Nome','type="text" maxlength="50" placeholder="Como você quer ser chamado?"')}${field('email','E-mail','type="text" inputmode="email" maxlength="254" spellcheck="false" autocapitalize="none" placeholder="pessoa@example.com"')}<div class="ck-payment-heading"><h2>Cartão de teste</h2>${I('credit')}</div>${field('card','Número do cartão de teste','type="text" inputmode="numeric" maxlength="23" placeholder="4242 4242 4242 4242"','Use apenas 4242 4242 4242 4242.')}<div class="ck-field-pair">${field('expiry','Validade','type="text" inputmode="numeric" maxlength="7" placeholder="MM/AA"','Uma data futura, no formato MM/AA.')}${field('security','Código de segurança','type="text" inputmode="numeric" maxlength="3" placeholder="123"','Use o código fictício 123.')}</div><div class="ck-consents">${consent('terms','Li e aceito os Termos de serviço.','Ler Termos de serviço')}${consent('privacy','Li e aceito a Política de privacidade.','Ler Política de privacidade')}</div><p id="ck-feedback" class="ck-feedback" role="alert" hidden></p><p id="ck-status" class="ck-status" role="status" aria-live="polite" hidden></p><button class="button primary ck-submit" type="submit"><span>Confirmar assinatura simulada</span>${I('arrow-right')}</button><p class="ck-after-submit">Depois, você poderá preparar seu espaço. Os dados do cartão não são salvos nem enviados.</p></form></div></main></div>`;
  }

  function control(form,name){return form.elements.namedItem(name);}
  function clearFieldError(form,name){
    const input=control(form,name),message=form.querySelector(`#ck-error-${name}`);
    input?.removeAttribute('aria-invalid');
    const hint=form.querySelector(`#ck-hint-${name}`);
    if(hint)input?.setAttribute('aria-describedby',hint.id);else input?.removeAttribute('aria-describedby');
    if(message){message.textContent='';message.hidden=true;}
  }
  function clearErrors(form){
    fieldNames.forEach(name=>clearFieldError(form,name));
    const feedback=form.querySelector('#ck-feedback');
    if(feedback){feedback.textContent='';feedback.hidden=true;}
  }
  function feedback(form,text){
    const message=form.querySelector('#ck-feedback');
    if(message){message.textContent=text;message.hidden=false;}
  }
  function showErrors(form,errors){
    for(const [name,text] of Object.entries(errors)){
      const input=control(form,name),message=form.querySelector(`#ck-error-${name}`);
      input?.setAttribute('aria-invalid','true');
      input?.setAttribute('aria-describedby',`${form.querySelector(`#ck-hint-${name}`)?`ck-hint-${name} `:''}ck-error-${name}`);
      if(message){message.textContent=text;message.hidden=false;}
    }
    feedback(form,'Revise os campos indicados para continuar.');
    control(form,Object.keys(errors)[0])?.focus();
  }
  function validate(data){
    const errors={},name=String(data.get('name')||'').trim(),email=String(data.get('email')||'').trim();
    if(name.length<2||name.length>50)errors.name='Informe um nome fictício com 2 a 50 caracteres.';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)errors.email='Informe um e-mail válido de exemplo, como pessoa@example.com.';
    if(String(data.get('card')||'').replace(/[\s-]/g,'')!=='4242424242424242')errors.card='Use o cartão de teste 4242 4242 4242 4242.';
    const expiry=String(data.get('expiry')||'').trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/),now=new Date();
    if(!expiry)errors.expiry='Informe a validade no formato MM/AA, com um mês de 01 a 12.';
    else if(2000+Number(expiry[2])<now.getFullYear()||(2000+Number(expiry[2])===now.getFullYear()&&Number(expiry[1])<now.getMonth()+1))errors.expiry='Use uma validade que ainda não venceu.';
    if(String(data.get('security')||'').trim()!=='123')errors.security='Use o código de segurança fictício 123.';
    if(!data.has('terms'))errors.terms='Leia e aceite os Termos de serviço para continuar.';
    if(!data.has('privacy'))errors.privacy='Leia e aceite a Política de privacidade para continuar.';
    return errors;
  }
  function setBusy(form,value){
    form.setAttribute('aria-busy',String(value));
    form.querySelectorAll('input,button').forEach(element=>{element.disabled=value;});
    const label=form.querySelector('.ck-submit span');
    if(label)label.textContent=value?'Preparando seu espaço…':'Confirmar assinatura simulada';
    const status=form.querySelector('#ck-status');
    if(status){status.hidden=!value;status.textContent=value?'Preparando a demonstração neste navegador…':'';}
  }
  function resetDraft(){
    attempt++;busy=false;
    const form=document.querySelector('form[data-form="checkout"]');
    if(form){form.reset();setBusy(form,false);clearErrors(form);}
  }
  function fillExample(element){
    if(busy)return;
    const form=element.closest('form[data-form="checkout"]');
    if(!form)return;
    const example={name:'Alex',email:'alex@example.com',card:'4242 4242 4242 4242',expiry:`12/${String(new Date().getFullYear()+2).slice(-2)}`,security:'123'};
    for(const [name,value] of Object.entries(example))control(form,name).value=value;
    // Reading and accepting each legal document is always a separate choice.
    control(form,'terms').checked=false;control(form,'privacy').checked=false;
    clearErrors(form);
    const status=form.querySelector('#ck-status');
    if(status){status.hidden=false;status.textContent='Exemplo preenchido. Leia os documentos e marque os aceites para continuar.';}
    control(form,'name').focus();
  }
  async function submit(data,form){
    if(busy||!form?.isConnected)return;
    clearErrors(form);
    const errors=validate(data);
    if(Object.keys(errors).length){showErrors(form,errors);return;}
    // Only the non-payment values cross into the saved application state.
    const name=String(data.get('name')).trim(),email=String(data.get('email')).trim();
    data=null;
    busy=true;
    const currentAttempt=++attempt;
    setBusy(form,true);
    // Yield once so the pending state is visible while the local state is prepared.
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    if(currentAttempt!==attempt||!form.isConnected){if(currentAttempt===attempt)busy=false;return;}
    const previous=A.state;
    let saved=false;
    try{
      const terms=A.legalContent?.terms.version,privacy=A.legalContent?.privacy.version;
      if(!terms||!privacy||typeof A.onboarding?.createDraft!=='function')throw new Error('Checkout dependencies unavailable');
      const acceptedAt=new Date().toISOString();
      A.state={...previous,subscription:{status:'simulated',amount:2990,currency:'BRL',interval:'month',plan:'full',email,acceptedAt,acceptedVersions:{terms,privacy}},onboarding:A.onboarding.createDraft(name)};
      saved=A.save()===true;
    }catch(error){saved=false;}
    if(!saved){
      A.state=previous;
      busy=false;setBusy(form,false);
      feedback(form,'Não foi possível salvar a demonstração neste navegador. Seus dados continuam no formulário. Tente confirmar novamente.');
      form.querySelector('.ck-submit')?.focus();
      return;
    }
    form.reset();
    busy=false;
    A.go('onboarding');
  }

  A.checkout={render,resetDraft};
  A.actions['ck-example']=fillExample;
  A.forms.checkout=submit;
  document.addEventListener('input',event=>{
    const input=event.target,form=input.closest?.('form[data-form="checkout"]');
    if(!form||!fieldNames.includes(input.dataset.ckField))return;
    clearFieldError(form,input.dataset.ckField);
    if(!form.querySelector('[aria-invalid="true"]')){
      const message=form.querySelector('#ck-feedback');
      if(message){message.hidden=true;message.textContent='';}
    }
  });
})();
