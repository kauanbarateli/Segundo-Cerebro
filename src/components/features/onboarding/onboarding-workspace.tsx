'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import type { OnboardingStep } from '@/core/onboarding/types';
import { ONBOARDING_STEPS } from '@/core/onboarding/validation';
import { BrandSymbol } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { OnboardingTheme } from './onboarding-theme';
import { CollectionStep, FOCUS_LABELS, NotesStep, Options, ProfileStep } from './draft-steps';
import { useOnboarding, type OnboardingController } from './use-onboarding';
import { RecoveryChoices } from './recovery-choices';
import { ONBOARDING_OAUTH_NOTICES, type OnboardingOAuthNotice } from './oauth-notice';
import './onboarding.css';

const COPY: Record<OnboardingStep, { title: string; description: string; label: string }> = {
  welcome: { title: 'Sua vida, com mais clareza.', description: 'Planos, rotina e ideias em um só lugar. Vamos preparar o seu espaço?', label: 'Boas-vindas' },
  profile: { title: 'Como podemos chamar você?', description: 'Um nome para deixar o espaço mais seu.', label: 'Seu nome' },
  calendar: { title: 'Traga sua agenda.', description: 'Veja seus compromissos sem precisar alternar entre aplicativos.', label: 'Google Calendar' },
  habits: { title: 'Comece com um hábito.', description: 'Pequenos passos, no seu ritmo.', label: 'Hábito' },
  projects: { title: 'Dê nome a um plano.', description: 'Algo que você quer tirar do papel.', label: 'Projeto' },
  tasks: { title: 'Escolha o próximo passo.', description: 'Uma ação simples para colocar o plano em movimento.', label: 'Tarefa' },
  notes: { title: 'Um lugar para suas ideias.', description: 'Prepare um caderno. A primeira nota pode vir agora ou depois.', label: 'Notas' },
  spaces: { title: 'Explore no seu tempo.', description: 'Outros espaços estarão por perto quando você precisar.', label: 'Outros espaços' },
  summary: { title: 'Vamos começar?', description: 'Veja o que foi preparado. Tudo pode ser ajustado depois.', label: 'Resumo' },
};

export function OnboardingWorkspace({ ownerId, notice = null }: { ownerId: string; notice?: OnboardingOAuthNotice | null }) {
  const state = useOnboarding(ownerId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Field errors own focus after their editor/details render.
    if (!heading.current?.closest('main')?.querySelector('[aria-invalid="true"]')) heading.current?.focus({ preventScroll: true });
  }, [state.step, state.loading]);
  const round = state.snapshot?.round;
  const editable = !!state.draft && (round?.status === 'active' || round?.status === 'paused');
  const disabled = !editable || !!state.hold || state.locking;
  const frozen = !!round && ['executing', 'partial', 'complete', 'expired'].includes(round.status);
  const welcome = !round || (!frozen && state.step === 'welcome');
  const step = welcome ? 'welcome' : round && ['executing', 'partial', 'complete', 'expired'].includes(round.status) ? 'summary' : state.step;
  const index = ONBOARDING_STEPS.indexOf(step);
  const status = round?.status;
  const title = step === 'summary' && status === 'complete' ? 'Seu espaço está pronto.' : COPY[step].title;

  return <div className="onboarding">
    <a className="ob-skip-link" href="#onboarding-main">Ir para o conteúdo</a>
    <header className="ob-header">
      <Link href="/" className="ob-brand" aria-label="Segundo Cérebro, salvar e ir ao painel" aria-disabled={state.busy || !!state.hold} onClick={event => { event.preventDefault(); if (!state.busy && !state.hold) void state.exit(); }}><BrandSymbol size={36} /><span>segundo<br /><strong>cérebro.</strong></span></Link>
      <div className="ob-header-actions"><OnboardingTheme ownerId={ownerId} onSessionChanged={state.sessionChanged} /><Button variant="ghost" disabled={state.busy || !!state.hold} onClick={() => { void state.exit(); }}>Fazer depois</Button></div>
    </header>
    <div className={`ob-layout${welcome ? ' ob-welcome' : ''}`}>
      <main id="onboarding-main" className="ob-content" aria-busy={state.loading || state.busy || undefined}>
        {state.loading ? <div role="status"><p className="ob-meta">Preparando seu percurso…</p></div> : !state.snapshot ? <section className="ob-heading">
          <h1 ref={heading} tabIndex={-1}>Vamos com calma.</h1><p>{state.hold === 'session' ? 'Entre novamente para continuar com segurança.' : 'Não foi possível consultar o onboarding. Seu espaço continua disponível no painel.'}</p>
          <div className="ob-welcome-actions">{state.hold === 'session' ? <Link className="ob-link-button" href="/entrar">Entrar novamente</Link> : <Button variant="primary" disabled={state.busy} onClick={() => { void state.reload(); }}>Tentar consultar</Button>}<Link className="ob-quiet" href="/">Ir ao painel</Link></div>
        </section> : <>
          {!welcome && <Progress step={step} state={state} disabled={disabled || state.busy} />}
          <section className={`ob-heading${welcome ? ' ob-welcome-copy' : ''}`}>
            <h1 ref={heading} tabIndex={-1}>{title}</h1><p>{COPY[step].description}</p>
          </section>
          {welcome ? <>
            <div className="ob-welcome-actions">
              {state.snapshot.eligibility.canStart && <Button variant="primary" loading={state.busy} disabled={!!state.hold} onClick={() => { void state.start(); }}>{round ? 'Retomar' : 'Começar'}<Icons.ChevronRight aria-hidden="true" /></Button>}
              <Button variant="ghost" className="ob-quiet" disabled={state.busy || !!state.hold} onClick={() => { void state.exit(); }}>Explorar por conta própria</Button>
            </div><p className="ob-meta">Você pode pular qualquer etapa.</p>
            {!state.snapshot.eligibility.canStart && <p className="ob-meta">O onboarding está indisponível para esta conta agora.</p>}
          </> : <div className="ob-stage" key={`${round?.id}:${step}`}>
            {status === 'expired' && <div className="ob-notice" role="status">O prazo deste rascunho terminou. Seus registros já confirmados foram preservados. {state.snapshot.eligibility.canStart && <Button variant="secondary" disabled={state.busy || !!state.hold} onClick={() => { void state.start(); }}>Começar um novo percurso</Button>}</div>}
            {round?.draft === null && status !== 'expired' && status !== 'complete' && <p className="ob-meta">O conteúdo desta rodada não está mais disponível. Abaixo aparece o estado de cada escolha.</p>}
            {state.draft && step === 'profile' && <Capability available={state.snapshot.capabilities.configuracoes}><ProfileStep state={state} disabled={disabled} /></Capability>}
            {step === 'calendar' && <Capability available={state.snapshot.capabilities.calendario}><CalendarStep state={state} disabled={disabled || state.busy} notice={notice} /></Capability>}
            {state.draft && (step === 'habits' || step === 'projects' || step === 'tasks') && <Capability available={state.snapshot.capabilities[step === 'habits' ? 'habitos' : step === 'projects' ? 'projetos' : 'tarefas']}>
              <CollectionStep key={step} kind={step} state={state} disabled={disabled} />
            </Capability>}
            {state.draft && step === 'notes' && <Capability available={state.snapshot.capabilities.conhecimento}><NotesStep state={state} disabled={disabled} /></Capability>}
            {step === 'spaces' && <Spaces state={state} />}
            {step === 'summary' && <Summary state={state} />}
          </div>}
          {state.message && <div className={state.hold || state.validationStep ? 'ob-notice' : 'ob-meta'} role={state.hold || state.validationStep ? 'alert' : 'status'}>
            {state.message}
            {state.validationStep && state.validationStep !== step && <Button variant="ghost" disabled={state.busy} onClick={() => state.review(state.validationStep!)}>Revisar etapa</Button>}
            {state.hold === 'session' ? <Link className="ob-quiet" href="/entrar">Entrar novamente</Link> : state.hold && <>
              <Button variant="secondary" disabled={state.busy} onClick={() => { void state.reload(); }}>{state.dirty ? 'Descartar edição local e carregar versão salva' : 'Conferir estado salvo'}</Button>
              {state.amendPending && <Button variant="secondary" disabled={state.busy} onClick={() => { void state.retryAmend(); }}>Conferir a mesma alteração</Button>}
              <p className="ob-meta">Não reenviaremos uma gravação sem conferir o resultado.</p>
            </>}
          </div>}
          {!welcome && <footer className="ob-footer">
            {status !== 'complete' && <Button variant="ghost" disabled={state.busy || !!state.hold || !editable} onClick={() => { void state.navigate(ONBOARDING_STEPS[Math.max(0, index - 1)]!); }}><Icons.ChevronLeft aria-hidden="true" />Voltar</Button>}
            <div className="ob-footer-actions">
              {step !== 'summary' && <>{!hasStepChoices(step, state) && <Button variant="ghost" disabled={state.busy || disabled} onClick={() => { void state.navigate(ONBOARDING_STEPS[index + 1]!); }}>Pular</Button>}<Button variant="primary" loading={state.busy} disabled={disabled} onClick={() => { void state.navigate(ONBOARDING_STEPS[index + 1]!); }}>Continuar<Icons.ChevronRight aria-hidden="true" /></Button></>}
              {step === 'summary' && (status === 'complete' ? <Link className="ob-link-button" href="/">Acessar meu painel<Icons.ChevronRight aria-hidden="true" /></Link> : editable ? <Button variant="primary" loading={state.busy} disabled={!!state.hold} onClick={() => { void state.finish(); }}>Preparar meu espaço<Icons.ChevronRight aria-hidden="true" /></Button> : (status === 'partial' || status === 'executing') ? <Button variant="primary" loading={state.busy} disabled={!!state.hold} onClick={() => { void state.resume(); }}>Verificar e continuar</Button> : <Link className="ob-link-button" href="/">Ir ao painel</Link>)}
            </div>
          </footer>}
          {!welcome && <p className="ob-save-state" role="status">{state.busy ? 'Conferindo e salvando…' : state.dirty ? 'Há escolhas ainda não salvas.' : editable ? 'Escolhas salvas. Os registros serão criados ao confirmar o resumo.' : status === 'complete' ? 'Percurso concluído. Revê-lo não recria seus registros.' : 'Resultados parciais preservados.'}</p>}
          {round && !['complete', 'expired'].includes(round.status) && <p className="ob-meta">As escolhas ainda não concluídas ficam disponíveis até {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(round.expiresAt))}, horário de Brasília. Somente uma alteração efetiva das escolhas renova esse prazo.</p>}
          {state.hold && state.snapshot && <Link className="ob-quiet" href="/">Sair sem reenviar</Link>}
        </>}
      </main>
    </div>
  </div>;
}

/** DTO choices remain choices when incomplete; hiding Skip never discards them. */
function hasStepChoices(step: OnboardingStep, state: OnboardingController): boolean {
  const draft = state.draft;
  switch (step) {
    case 'profile': return !!draft && (draft.profile.displayName !== undefined || draft.profile.focus !== undefined);
    case 'calendar': return state.snapshot?.calendar.status === 'ready' && state.snapshot.calendar.accounts.length > 0;
    case 'habits': return !!draft?.habits.length;
    case 'projects': return !!draft?.projects.length;
    case 'tasks': return !!draft?.tasks.length;
    case 'notes': return !!draft?.notes;
    default: return false;
  }
}

function Progress({ step, state, disabled }: { step: OnboardingStep; state: OnboardingController; disabled: boolean }) {
  const index = ONBOARDING_STEPS.indexOf(step);
  return <div className="ob-progress"><div className="ob-progress-copy"><span>{step === 'summary' ? 'Seu espaço, no seu ritmo' : `Etapa ${index} de 7`}</span>
    {step !== 'summary' && <details className="ob-step-menu" onKeyDown={event => {
      if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.open) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }}><summary>Ver etapas<Icons.ChevronDown aria-hidden="true" /></summary><nav aria-label="Etapas do onboarding"><ol className="ob-steps">
      {ONBOARDING_STEPS.slice(1).map((item, index) => <li key={item}><button type="button" className={`ob-step${item === step ? ' is-active' : ''}`} aria-current={item === step ? 'step' : undefined} disabled={disabled}
        onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void state.navigate(item); }}><span className="ob-step-number">{index + 1}</span>{COPY[item].label}</button></li>)}
    </ol></nav></details>}</div><progress aria-label="Progresso do percurso" max={8} value={index} /></div>;
}

function Capability({ available, children }: { available: boolean; children: ReactNode }) {
  return available ? children : <p className="ob-meta">Este espaço não está disponível para sua conta. Você pode pular esta etapa.</p>;
}

function CalendarStep({ state, disabled, notice }: { state: OnboardingController; disabled: boolean; notice: OnboardingOAuthNotice | null }) {
  const calendar = state.snapshot!.calendar;
  return <div>
    {notice && <p className="ob-meta" role="status">{ONBOARDING_OAUTH_NOTICES[notice]}</p>}
    {calendar.status === 'ready' ? <>
      <ul className="ob-account-list">{calendar.accounts.map(account => <li key={account.id} className="ob-account"><Icons.Google aria-hidden="true" /><div><strong>{account.email}</strong><small>{account.status === 'connected' ? 'Conectada · somente leitura' : account.status === 'reauthorize' ? 'Precisa reconectar' : 'Desconexão pendente'}</small></div>
        {account.status === 'reauthorize' ? <Button variant="secondary" disabled={disabled} onClick={() => { void state.connectGoogle(account.id); }}>Reconectar</Button> : account.status === 'connected' ? <Icons.Check aria-label="Conectada" /> : <Icons.Clock aria-label="Pendente" />}</li>)}</ul>
      {calendar.canConnect && <Button variant="secondary" className="ob-add-more" disabled={disabled} onClick={() => { void state.connectGoogle(); }}><Icons.Google aria-hidden="true" />{calendar.accounts.length ? 'Conectar outra conta' : 'Conectar Google Calendar'}</Button>}
      {calendar.accounts.length >= 2 && <p className="ob-meta">Duas contas conectadas. Você pode gerenciá-las depois no Calendário.</p>}
      {calendar.sources.length > 0 && <Options title="Escolher calendários"><div className="ob-source-list">{calendar.sources.map(source => <button key={source.id} type="button" className="ob-source" role="checkbox" aria-checked={source.selected} disabled={disabled} onClick={() => { void state.selectSource(source.id, !source.selected); }}><span className="ob-source-check" aria-hidden="true">{source.selected && <Icons.Check />}</span><span>{source.name}<small>{calendar.accounts.find(account => account.id === source.accountId)?.email}</small></span></button>)}</div></Options>}
      {calendar.accounts.length > 0 && calendar.sources.length === 0 && <p className="ob-meta">A conta está conectada. A lista de calendários ainda não está disponível; você pode ajustar depois.</p>}
    </> : <p className="ob-meta">{calendar.status === 'not_configured' ? 'A conexão Google ainda não está configurada neste ambiente.' : calendar.status === 'forbidden' ? 'A conexão não está disponível para esta conta.' : 'Não conseguimos consultar o Google agora. Você pode seguir e conectar depois.'}</p>}
    <p className="ob-account-note"><Icons.Lock aria-hidden="true" /><span>Somente leitura, até duas contas. A conexão e a seleção de calendários têm efeito agora, mesmo se você pausar ou pular o restante.</span></p>
  </div>;
}

function Spaces({ state }: { state: OnboardingController }) {
  return <div className="ob-module-list">
    {state.snapshot?.capabilities.financeiro && <details className="ob-module"><summary><Icons.Wallet aria-hidden="true" /><span>Financeiro<small>Receitas, despesas e planos</small></span><Icons.ChevronDown aria-hidden="true" /></summary><div className="ob-module-copy"><p>Organize suas contas quando fizer sentido para você. Nenhum dado financeiro é pedido neste percurso.</p></div></details>}
    <details className="ob-module"><summary><Icons.File aria-hidden="true" /><span>Arquivos<small>Junto dos seus registros</small></span><Icons.ChevronDown aria-hidden="true" /></summary><div className="ob-module-copy"><p>Imagens e anexos ficam junto dos registros que os aceitam.</p></div></details>
    {state.snapshot?.capabilities.cofre && <details className="ob-module"><summary><Icons.Vault aria-hidden="true" /><span>Cofre<small>Um espaço para seus segredos</small></span><Icons.ChevronDown aria-hidden="true" /></summary><div className="ob-module-copy"><p>Você configura o Cofre no próprio espaço. Não insira senhas, chaves ou kit de recuperação aqui.</p></div></details>}
  </div>;
}

function Summary({ state }: { state: OnboardingController }) {
  const round = state.snapshot!.round!, complete = round.status === 'complete';
  const draft = ['active', 'paused'].includes(round.status) ? state.draft : null;
  const confirmedCount = round.receipts.filter(item => item.status === 'confirmed').length;
  const omittedCount = round.receipts.filter(item => item.status === 'omitted').length;
  const prepared = !!draft && (!!draft.profile.displayName || !!draft.profile.focus || !!draft.habits.length || !!draft.projects.length || !!draft.tasks.length || !!draft.notes);
  return <>
    {!prepared && round.receipts.length === 0 && <p className="ob-meta">Você pode configurar tudo pelo painel, no seu tempo.</p>}
    <ul className="ob-summary-list">
      {draft && (draft.profile.displayName !== undefined || draft.profile.focus) && <li><Icons.User aria-hidden="true" /><span><strong>{draft.profile.displayName?.trim() || (draft.profile.displayName !== undefined ? 'Nome a definir' : 'Seu foco')}</strong><small>{draft.profile.focus ? FOCUS_LABELS[draft.profile.focus] : draft.profile.displayName?.trim() ? 'Nome preparado' : 'Rascunho incompleto'}</small></span></li>}
      {state.snapshot!.calendar.status === 'ready' && state.snapshot!.calendar.accounts.length > 0 && <li><Icons.Calendar aria-hidden="true" /><span><strong>{state.snapshot!.calendar.accounts.length} {state.snapshot!.calendar.accounts.length === 1 ? 'conta Google conectada' : 'contas Google conectadas'}</strong><small>Conexão já efetivada</small></span></li>}
      {draft && draft.habits.length > 0 && <li><Icons.Repeat aria-hidden="true" /><span><strong>{draft.habits.length} {draft.habits.length === 1 ? 'hábito' : 'hábitos'}</strong><small>{complete ? 'Resultado abaixo' : 'Preparado para confirmar'}</small></span></li>}
      {draft && draft.projects.length > 0 && <li><Icons.Folder aria-hidden="true" /><span><strong>{draft.projects.length} {draft.projects.length === 1 ? 'projeto' : 'projetos'}</strong><small>{draft.projects.map(item => item.name.trim() || 'Nome a definir').join(', ')}</small></span></li>}
      {draft && draft.tasks.length > 0 && <li><Icons.Tasks aria-hidden="true" /><span><strong>{draft.tasks.length} {draft.tasks.length === 1 ? 'tarefa' : 'tarefas'}</strong><small>Seus próximos passos</small></span></li>}
      {draft?.notes && <li><Icons.Book aria-hidden="true" /><span><strong>{draft.notes.notebook.kind === 'new' ? draft.notes.notebook.name.trim() || 'Caderno a definir' : 'Caderno existente'}</strong><small>{draft.notes.page ? draft.notes.page.title.trim() ? 'Uma primeira nota preparada' : 'Nota com título a definir' : 'Sem primeira nota'}</small></span></li>}
    </ul>
    {round.receipts.length > 0 && <section className="ob-results" aria-label="Resultados da preparação"><h2>Resultado de cada escolha</h2><p className="ob-meta">{confirmedCount} {confirmedCount === 1 ? 'escolha confirmada' : 'escolhas confirmadas'}{omittedCount ? `; ${omittedCount} deixada${omittedCount === 1 ? '' : 's'} de fora, sem criação` : ''}.</p><ul className="ob-summary-list">{round.receipts.map(receipt => <li key={receipt.intentId}><span><strong>{{ profile: 'Perfil', habit: 'Hábito', project: 'Projeto', task: 'Tarefa', notebook: 'Caderno', page: 'Nota', link: 'Vínculo' }[receipt.kind]}</strong><small>{{ ready: 'Aguardando envio', pending: 'Em andamento', confirmed: 'Confirmado', blocked: 'Dependência pendente', failed: 'Precisa de revisão', unknown: 'Resultado ainda não confirmado', omitted: 'Deixado de fora · nenhum registro criado por esta escolha' }[receipt.status]}</small></span></li>)}</ul></section>}
    {(round.status === 'partial' || round.status === 'executing') && <RecoveryChoices state={state} />}
    {!complete && ['active', 'paused'].includes(round.status) && <Options title="Revisar escolhas"><div className="ob-review">{ONBOARDING_STEPS.slice(1, -1).map(step => <Button key={step} variant="ghost" disabled={state.busy || !!state.hold} onClick={() => { void state.navigate(step); }}>{COPY[step].label}<Icons.ChevronRight aria-hidden="true" /></Button>)}</div></Options>}
    {complete && state.snapshot!.eligibility.canStart && <Options title="Configurar outra vez"><p className="ob-meta">Uma nova rodada prepara novos registros. Rever este resumo não altera os que já existem.</p><Button variant="secondary" disabled={state.busy || !!state.hold} onClick={() => { void state.start(); }}>Começar nova rodada</Button></Options>}
  </>;
}
