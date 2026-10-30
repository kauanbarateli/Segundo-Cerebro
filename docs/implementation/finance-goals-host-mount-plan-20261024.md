# Plano concreto · host real de Metas e fotos

24/10/2026. Somente análise de fonte e proposta de autoria; nenhuma montagem, flag, schema ou código foi alterado. Candidato informado por Root: 0d933d98ca8fcd6def222d184d9b9462370d98eb / árvore b6c018609cac8267f9c58def3385911f6dcd8eb2. O Git recusou cwd do checkout Root; não houve mudança de configuração nem nova tentativa. Os hashes das 23 fontes lidas constam do JSON sources ao lado. Não são certificação Git/CI.

As notas anteriores ficam preservadas em finance-goals-host-mount-plan-notes-20261024.md. Hotfix EFix1-R2 foi entregue em pacote separado; seu resultado CI é responsabilidade do SHA próprio. Este plano não herda PASS de deb/dad/N e não autoriza qualquer operação.

## 1. Ponto real de composição e recorte mínimo

OBSERVADO: FinanceWorkspace não monta GoalsPanel. FinanceDashboard recebe hoje apenas cartões no aside (finance-panels.tsx:60). Doc17/prototipo/finance.js:78 coloca a Meta compacta antes dos cartões; linha81 coloca orçamento + Metas completas + séries no Planejamento. GoalsPanel já implementa compacto/lista/detalhe/histórico/editor, mas é isolado e cria seu controller em useGoalsChannel.

RECOMENDADO: duas fatias, sem reescrever o Financeiro.

**H0 · Metas no host, sem capacidade de foto:** usar as rotas/client/journal reais existentes, respeitando availability. Quatro paths de produto:

| Path | Delta restrito |
| --- | --- |
| NOVO src/components/features/financeiro/goals/finance-goals-host.tsx | Instância connected, factory assíncrona do client concreto, liveness por owner/providerEpoch/clientEpoch; seleção da apresentação compacta/completa; recursos locais privados. |
| src/components/features/financeiro/goals/goals-panel.tsx | Modo silencioso apenas quando flag=false, sem pending/reconfirm/failure; callback de confirmação para invalidar dados atuais; propagar prepare recusado como erro local fixo ao editor. Preservar o uso isolado atual. |
| src/components/features/financeiro/finance-panels.tsx | Slot ReactNode opcional no aside antes dos cartões; rótulo “Metas e cartões” somente quando houver conteúdo. Sem mudar fórmulas/valores. |
| src/components/features/financeiro/finance-workspace.tsx | Montar um único host visível por vez: compacto no Painel; completo junto a FinanceBudgets na aba atual orcamentos. O rótulo pode ser “Planejamento”, conservando a chave/links tab=orcamentos e as demais abas. |

A mudança de posição pode remontar o host: cleanup encerra controller/client/handles e RAM; nunca revoga a identidade nem apaga journals. A nova montagem lê o mesmo epoch durável, conserva pending/reconfirm e não envia nada automaticamente. Não montar dois GoalsPanel concorrentes (compacto + completo) com controllers independentes.

**H1 · ligação opcional de E/R2 + recuperação:** seis paths adicionais de produto, além do binder opcional em GoalsPanel/H0:

| Path | Delta restrito |
| --- | --- |
| NOVO src/components/features/financeiro/goals/goal-image-host-binding.ts | Factory privada de capacidades E e de recuperação da fonte. Um client concreto, um J2 por host vivo, a barreira desse client e o controller real; nenhuma nova porta financeira. |
| NOVO src/components/features/financeiro/goals/goal-image-source-recovery.tsx | UI pequena para A antiga/pré-finalização, com o picker existente e ações explícitas; não recebe prepare, createId financeiro ou dispatcher Goal. |
| src/components/features/financeiro/goals/use-goals-channel.ts | Getter somente leitura do controller real e atual, fechado por active/bound/owner/client; nenhum segundo controller, clone substituto ou nova regra financeira. |
| src/lib/files/goal-image-upload-journal.ts | Somente ciclo browser: registrar revoker antes de await open, lidar com evento explícito de logout/owner confirmado mesmo após sair do Financeiro. Preservar integralmente class/protocolo J2/R2, chaves, limites e CAS. |
| src/adapters/db/finance-goals-availability.ts | Decisão server-only para NOVAS imagens, default false; proposta de nome exato FINANCE_GOALS_IMAGES_V1_ENABLED === “true”, combinada com Goals habilitado. Root controla a futura configuração, sem alteração agora. |
| src/app/(workspace)/financeiro/page.tsx | Depois de authorizeWorkspaceFeature, passar somente o boolean público imagesEnabled. Não expor URL de banco, segredo, configuração privilegiada ou suposta prova de schema. |

Sem alteração necessária em GoalEditor/Picker/E3, Core, FinanceGoalsClientPort, Options da factory financeira, SQL ou tipos gerados para autorar H0 e o binder H1 inertes. A lacuna de opcionalidade G0 abaixo exige contrato adicional antes de ativar H1; não deve ser escondida no binder.

Testes propostos: NOVOS tests/features/finance-goals-host-lifecycle.test.ts, tests/features/goal-image-host-binding.test.ts, tests/lib/goal-image-upload-browser-lifecycle.test.ts, tests/e2e/finance-goals-host.spec.ts e helpers/finance-goals-host-fixture.tsx. Um documento de implementação próprio. Reutilizar os E2Es E3 e os testes R/J2; não trocar o coletor, regras ou fixtures existentes por doubles permissivos. Root deve derivar a nova closure/Admin antes da publicação.

## 2. Contrato local a congelar para autoria

Não é port Core nem wire novo. O host possui privadamente:

~~~ts
type Controller = ReturnType<typeof createGoalsController>;
// A instância concreta retornada por browserFinanceGoalsClient:
type HostResources = {
  ownerId: string;
  providerEpoch: number;       // DemoProvider; NÃO é o epoch UUID do journal.
  client: FinanceGoalsBrowserClient;
  current(): boolean;
};
// Getter do hook, nunca um objeto fabricado de state():
currentImageController(): Controller | null;

// Projeção local de preparação do editor; não admite upload:
type ImageEditorBasis = {
  goalId: string | null;
  goalRevision: string | null;
  baselineFileId: string | null;
};
~~~

Sequência obrigatória:

1. Host somente em app.mode=connected, userId esperado e !app.closing. A página e cada endpoint continuam autenticando e verificando Entitlement financeiro. Criar o client via browserFinanceGoalsClient(ownerId,isCurrent), aguardar epoch/readback e reconferir o host ANTES de publicar o client; sua criação não envia HTTP.
2. Não depender da identidade do objeto app: o DemoProvider faz spread em cada render. Capturar userId, providerEpoch, modo/closing e referências estáveis de executeDomainCommand, initializeJournal e getCommandSnapshot. Privacidade ou rerender não pode recriar serviços em loop; troca real encerra o handle antigo.
3. GoalsPanel mantém seu único useGoalsChannel/controller. Seu getter deve devolver exatamente active.current quando válido; a factory recebe esse objeto e um getter para conferir a mesma identidade após awaits. Nunca chamar createGoalsController novamente para satisfazer a barreira.
4. Abrir J2 apenas em gesto humano de abrir/consultar a edição ou recuperar foto. O binder memoiza a instância J2 positiva durante a vida desse host e a usa em TODAS as factories A/B. Não há fallback de memória. Falha de abertura só permite nova consulta humana, que relê estado durável; não representa vazio nem autorização de UUID.
5. Scope de E é fechado e imutável: ownerId, client.epoch, editorKey, goalId, goalRevision, baselineFileId. A revisão financeira vem da mesma GoalPage/GoalDetail capturada ao abrir, não do snapshot v1 nem de relógio/re-render.
6. Capability E contém o Picker REAL tipado, isCurrent, linked() do MESMO client.imageUploadLinks.current(), e open(scope). O factory cria GoalImageUploadCoordinator com exatamente J2, client, client.imageUploadBarrier, controller atual, application() real, origin=window.location.origin e storageOrigin validada recebida do Provider. Não copiar CommandJournal, construir Application sintética, importar componente na lib ou usar sender novo.
7. Depois de qualquer await: owner/providerEpoch/clientEpoch, current(), fechamento, referências do sender, controller atual, scope/baseline/revisões e intenção/seleção continuam iguais. Timeout/erro/old response não pode pintar B nem navegar outra sessão.
8. E já valida formulário/revisão antes do await e exige imageId UUID antes de criar intenção. O callback prepare do host deve lançar erro fixo se channel.run/prepare recusar; retornar void silencioso em falha não é confirmação de revisão. Continuar usando o controller para Review/Confirm financeiro, terminal status/settle e reconfirmação.

O binder não devolve journal, capability Storage, File, proof serializado ou GoalCommand a outro serviço. O File fica em RAM do picker/sessão. Cancel/fechar/mascarar encerra a RAM/URL e handles, mantendo A e qualquer intenção financeira durável. Sem auto-ack, retry, dispatch, cleanup remoto ou remoção de journal.

## 3. editorKey e recuperação original A

**A no mesmo alvo.** Ao gesto de abrir/consultar editor, ler J2 sob suas verificações locais. Se active(A) e owner/epoch/goalId/goalRevision/baselineFileId coincidem com a leitura atual do alvo, reutilizar o editorKey EXATO de A; não gerar outra identidade de upload por remontagem. A UI informa que há envio original e o botão Consultar/Revisar continua sendo o gesto que recupera metadata/resume. Nenhum File, nome/alvo financeiro ou proof é reconstruído do journal de imagem. Se J2 validado estiver empty, o host pode criar só uma chave local estável para a vida daquele editor; isso não cria clientId/uploadId/Goal nem prova ausência de comando remoto. Estado ausente/corrupto/indisponível não é empty.

**A de outro scope e fases anteriores a finalizing.** Hoje R.retirementState exige uploadId e fase finalizing/ready-unbound; chamar discardFinalized antes disso dá PENDING. Não rebater goalRevision, baseline ou editorKey de A para B.

Protocolo implementável com os métodos EXISTENTES, sem novo RPC:

1. Mostrar recuperação separada da fonte: “Esta foto pendente pertence a outra edição. Conclua o envio original antes de trocar.” Abrir um coordenador próprio com scope=A exata, mesmo J2/client/barreira/controller/application. Enquanto essa UI está ativa, currentScope retorna A porque a superfície atual é a recuperação A, não um editor financeiro. O alvo atual B fica separado e não é substituído.
2. Essa superfície NÃO recebe select(), prepare(), createId financeiro, GoalCommand ou forma de confirmar Meta. Pode apenas consultar view; pedir reselect(File) do ORIGINAL por nome/tamanho/MIME/hash; e invocar resume() por gesto humano. Um arquivo diferente é recusado. Não há novo UUID: reserve/retry usam o uploadClientId original, e o uploadId conhecido não muda.
3. prepared sem File pede original; reserving/reserved seguem a tentativa original; put-uncertain/put-confirmed passam por observação conforme C2a; indeterminate fica held; finalizing/ready-unbound recapturam a finalização original. Timeout/5xx/ausência nunca autorizam B. A substituída por outra aba dá STALE; consultar o estado atual por nova ação, sem operar com o handle antigo.
4. Só um novo positivo do receiver original conclui essa fase. O proof ready A NÃO vai para E/B nem é serializado. Não há “Meta salva”: somente envio original concluído. Fechar esse handle preserva A agora pronta e não publica arquivo no alvo novo.
5. Voltar ao editor do alvo atual com scope B correto. Sua nova factory captura A já finalizável. A ação explícita recover/discardFinalized obtém NOVO positivo original e barreira livre, produz retirement-review(A); então substituir por B usa replaceRetired com File/geração/scope atuais. B durável encerra A; abrir NOVO handle B pelos mesmos recursos.
6. SET B com efeito/readback perdido permanece B protegido. A falha STALE e não pode afetar B; consulta/reabertura lê metadata B completa, e novo finalize próprio é exigido para pronta/vínculo/retirada. Nunca refazer B, copiar autorização ou gerar outro UUID por silêncio.

Fonte A não precisa continuar sendo uma Meta atual/ativa para finalizar seu arquivo próprio; isso não autoriza escrita na Meta antiga. Caso Entitlement/Auth/storage/protocolo não permitam essa continuação, permanecer em hold com erro fixo. Não inventar clear nem bypass para “destravar”.

**G0 — impedimento real à ativação de fotos.** Depois de salvar foto A, J2 continua active/ready-unbound(A). retireLinked/discardFinalized retornam retirement-review(A), nunca empty. E.review atualmente exige empty para unchanged/remove; portanto uma nova Meta SEM foto, preservar baseline ou remover imagem após esse ciclo fica bloqueada até escolher B. A imagem é opcional no contrato T-054. Não se deve montar e chamar esse comportamento de concluído.

Root precisa aprovar uma fatia local explícita “continuar sem nova foto / manter / remover”, validada pelo receiver/barreira R e pelo alvo atual, antes de H1 ativo. Ela não pode usar snapshot review(A), boolean livre, ausência de recibo ou clear como prova. Este plano NÃO inventa sua API/proof nem altera R/E; H0 e autoria inerte do binder/recuperação podem avançar sem declarar G0 resolvida. A mesma guarda impede desativar a foto e usar o formulário legado como atalho para descartar A selecionada.

## 4. Reconferência, lifecycle e dados

**Financeiro:** preparar é read-only. Confirmar usa o client/journal/controller atuais, UUID/corpo imutáveis. Falha e resultado incerto mostram a tentativa original. Status é read-only; settle exige o gesto explícito e prova terminal; nenhum deles se transforma em outro execute. Flag de novas operações false NÃO apaga journal nem esconde a recuperação financeira Auth/Entitlement permitida.

Após confirmação/encerramento: atualizar GoalPage/GoalDetail e app.refreshActive; se falhar, manter needsRefresh. Somente depois da leitura atual, o botão humano “Conferi os dados atuais” chama acknowledgeReview. Nem disponibilidade, imagem pronta, linked proof, recovery ou nova montagem podem chamar ack.

**Duas abas/logout:** class J2/CAS e Web Locks continuam autoridade local. Apenas UMA tentativa global de upload por dono/epoch; B de outra aba invalida o handle A antes de efeitos. Browser factory precisa registrar revoker ANTES de await journal.open; assim falha parcial de abertura também pode ser revogada pelo logout real. O registro guarda handles de revogação (sem File/body), sobrevive a sair do Financeiro e usa o evento literal existente para evitar dependência lib→componente. Substituir registro do mesmo owner/epoch não muda chaves/CAS.

Unmount/route change = dispose, sem apagar estado. Logout ou identidade CONFIRMADA = ocultar valores, invalidar epoch/handles e revokeIdentity/remoção com readback, inclusive em outra aba. Storage indisponível falha fechado; não adotar dono B nem mostrar prévia A. 403/503/flag=false por si só não são logout e não apagam A/intenção. Listener/storage-fence bloqueia respostas antigas e revoga object URLs. A política de Auth/logout existente não deve ser reescrita por essa fatia.

**DTOs:** usar page/detail/history/preview/execute/terminal já fechados e decodificados. Mesmo owner e finance_revision em cada total; não somar páginas, misturar revisões ou buscar SDK no navegador. DemoQueries.finance hoje não tem reservas globais: contas fornecem escolhas id/nome/tipo/moeda/arquivada; saldo/reservado/disponível para aporte vêm de GoalReview server completo da mesma revisão. Patrimônio/saldo real não diminuem com reserva. Não renomear o total atual “Após descontar dívidas” como disponível após reservas. PR90/goal-reserves/readmodel global e export/backup/restore continuam uma integração separada, sem copiar branch antiga ou fingir total por páginas.

**URLs/privacidade:** manter financeHref/transaction e filtros existentes; não criar query monetária, File, digest, capability ou clientId em URL/log. Esta fatia não promete deep-link Goal novo: cartões/detalhes usam ID próprio e current/sequence; links legados permanecem. File privado usa rota atual e foco do dono, sem optimizer público. Ocultar valores remove inputs/barra/ARIA monetários e, por escolha conservadora, desmonta picker/preview com nome de arquivo; não limpa journals.

## 5. Interface e estados mínimos

OBSERVADO: grade FinanceDashboard usa minmax(0,1fr) + minmax(18rem,.44fr) e vira coluna única em1279px (finance.css237/286). Reusar esse slot e os estilos Goals existentes, sem breakpoints/paleta/CSS novos por conveniência. DS2.1/Geist, campos16px, alvos44px, foco/keyboard/reduced motion, temas reais.

Estados visíveis: preparando sessão local; indisponível sem A; erro com dados preservados; vazio real; metas carregadas; revisão; tentativa incerta; reconferência; envio A precisa File; A retida/indeterminate; A antiga em recuperação; retirement-review sem autorização reconstruída; B admitida aguardando novo handle; sessão encerrada. Nenhuma metadata ready equivale a Meta salva.

Compacto vem ANTES de cartões; completo junto ao plano mensal. Sem sidebar/modal aninhado novo. Dialog existente preserva foco no trigger e Escape/backdrop só quando seguro; preview local se desfaz, envio/intenção não. Textos de recuperação não exibem IDs, credenciais ou dados financeiros de outra conta.

## 6. Autoria inerte e gates de ativação

Pode autorar H0/H1 offline com flags defaultfalse, capacidade opcional, fixtures de transporte explícitas e testes negativos, sem tocar schema/env/produção. O host não pode usar GoalsRPC se availability=false; endpoint availability autentica sem RPC Goal. Recuperação financeira existente permanece acessível quando houver pending/reconfirm. Nenhuma foto nova é admitida antes do gate servidor e Storage confiável; recovery A só por gestos explícitos e autorização vigente. Nenhum reset, seed, migrations em CI ou serviço novo.

Antes de ativar no destino isolado twry:
1. Root revisa/fecha G0 e a fatia de source recovery, liveness e revogação antes-open; peers e closure/layers/Admin atualizados.
2. Novo SHA próprio: typecheck/lint/unidades/E2E e PNGs reais. Não herdar PASS de0d/dad/deb; nenhum teste novo foi rodado pelo autor deste plano.
3. Root converte/revisa a composição canônica aditiva de Goals(5SQL) + E1-A + M1, preservando guardas B2/Budget e026. Hoje esses arquivos DRAFT_ONLY/ROLLBACK são propostas; executar helper descartável não instala nem qualifica hospedado. Número da migration/tipos/catálogo ficam com Root; não alterar001–026 ou aplicar por build/deploy.
4. Homologação supervisionada: tipos oficiais, RLS/grants, triggers por OID/ordem, fence old-generation, retenção/cleanup de arquivos e financeiro, catálogo/rollback/resíduos e concorrência nativa. Backups/export/restore de metas/reservas/dispositions permanecem gates próprios.
5. Só então configurar ativação exata por servidor no destino aprovado e executar aceite com duas contas comuns próprias, sem Master, sem dados privados de terceiros. Merge/produção seguem bloqueados até o aceite.

Roteiro conectado mínimo:
- Criar/editar/preservar/remover/restaurar Meta; conta1000 reserva200 mantém1000, disponível800, liberar50 dá850, despesa0. Cartão/outro dono/data futura/insuficiência recusados; corrida não sobre-reserva.
- Foto escolher/cancel/undo zeroIO; inválido zeroadmissão; revisar original→finalize próprio→Review→Confirm separado. Resposta perdida, reload semFile e hash diferente mantêm A; duasabas e SET B/readback falho até terceiro ciclo preservam identidades.
- A antiga em CADA fase anterior à finalização, inclusive goalRevision diferente: recuperação fonte sem prepare financeiro/novo UUID, depois nova retirada nominal e B. G0 exige continuar realmente sem foto após A.
- Unknown financeiro A, flagfalse,403/503 e ausência de recibo: journal original conserva UUID/corpo, nenhuma nova intenção B; settle/status e reconferência humana funcionam conforme contrato.
- Sair do Financeiro sem logout preserva A; logout fora do Financeiro e troca de conta/aba removem corpo/prévia antigos e negam late success/error, inclusive falha antes-open.
- Painel/Planejamento/links transação/filtros não duplicam controllers, comandos ou totais. Páginas com revisão distinta exigem releitura. Imagem privada recusada cai em sem capa sem apagar seu ID.
- Claro/escuro320/390/768/intermediária/desktop, teclado/Tab/Escape/retorno de foco/zoom/movimento reduzido; PNGs/fontes/imagem naturalWidth positivo. Contraste medido nos fundos reais, sem chamar fixture de PASS.

Conclusão técnica: H0 é independente de imagens e pode ser preparado inerte agora. H1 tem um caminho finito para A antiga usando as APIs existentes, mas a opcionalidade G0 e os gates de schema/aceite conectado impedem ativá-lo. Nenhuma pergunta externa é necessária para Root decidir a próxima autoria.