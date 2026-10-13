# Calendário, Configurações e PWA — conferência de 13/10/2026

Base consultada: `2c159fc17265ac71c713a48974eb9781c589eba3`, em checkout isolado. As issues [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32), [#34](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) e [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) foram lidas no GitHub, sem escrita. Os textos abaixo preservam os cinco aceites originais de cada issue e os ticks encontrados; as provas posteriores são descritas separadamente. Nenhuma issue foi encerrada.

O primeiro pacote alterou somente o teste montado do Calendário, sua fixture e este relatório. Foi congelado e revisado separadamente. Uma reprodução posterior justificou a correção restrita de `Retomar desconexão`, descrita ao final, autorizada pela raiz antes de editar produto. Auth, provider, RPCs, SQL, PWA, dependências e configuração de serviços continuam fora deste diff. A raiz continua responsável por conexões, revogação real, consolidação e QA. Drive permanece retirado do MVP; apresentação `/conheca`, imagens e tokens foram preservados.

## Aceites originais e situação atual

### #32 — T-025 — Calendário Google real

- [ ] Fluxo OAuth completo com PKCE; token cifrado com AAD; desconectar revoga e apaga
- [x] Evento de 3 dias aparece nos 3 dias em dia/semana/mês (fixture prova)
- [ ] Navegar para além da janela busca mais (sem recarregar a página)
- [x] Calendário desmarcado some do Início e dos lembretes (o vazamento do legado tem teste)
- [x] Cron de sync autenticado, com registro de execução visível no admin

| Literal | Prova vigente e limite |
| --- | --- |
| OAuth/PKCE/AAD/revogação | Duas contas reais conectadas; PKCE/AAD, expiração e proteção de sessão possuem controles locais. A desconexão real que revoga/apaga continua pendente. Ocultar conteúdo ou receber sucesso da rota, isoladamente, não comprova o conjunto. |
| Três dias | O literal permite fixture. Core, projeções, UI estática e [UI montada](../../tests/e2e/calendar-workspace-browser.spec.ts) cobrem as três visões, fuso e término exclusivo. Não acrescentar um gate de evento Google real. |
| Expansão sem reload | A navegação real até maio de 2027 e a sincronização de ambas as fontes foram observadas. Falta uma prova conjunta do intervalo anterior/posterior, pedido efetivo fora da janela e permanência do documento. O teste montado comprova esse contrato com HTTP sintético; não comprova busca/persistência Google. |
| Filtro | A [jornada real](google-producao-20261012.md) retirou eventos do Calendário/Início e um aviso já emitido ao desmarcar sua fonte, restaurando as seleções. |
| Cron/Admin | Disparo supervisionado manual com HTTP 200, duas concluídas/zero falhas e dois registros `Agendada · Concluída` no Admin comprovados. Esta frente offline não observou o primeiro disparo diário; a raiz registrou posteriormente [o run automático de 13/10](evidence/google-cron-first-schedule-20261013.json), sem captura direta do HTTP ou das contagens desse run. Isso não reabre o literal cumprido. |

### #34 — T-027 — Configurações da conta

- [ ] Tema escolhido no desktop aparece no celular ao entrar (preferência de conta)
- [ ] Reordenar módulos muda trilho/barra na hora; essencial não desligável (servidor recusa)
- [ ] Avatar: upload assinado, re-encode, remoção
- [ ] Troca de senha exige a atual; sessões antigas derrubadas
- [ ] Painéis com navegação interna e recolhíveis no mobile (padrão herdado)

| Literal | Prova vigente e limite |
| --- | --- |
| Tema entre aparelhos | Persistência na própria conta após reload foi observada em produção, com a preferência anterior restaurada. [Contextos novos e SQL/SDK](../../tests/e2e/issue34-settings-sql.spec.ts) cobrem o tema salvo, inclusive contexto a 390px sem armazenamento local prévio. Auth/HTTP e apresentação inicial do documento são seams explícitos. Desktop/celular físicos e revisão humana permanecem adiados. |
| Módulos/essenciais | O teste SQL/SDK montado cobre alteração imediata de trilho/barra após salvar, persistência e recusa de desativar cada essencial, sem mudar entitlement. Isso não promove os cinco ticks da issue por inferência. |
| Avatar | Há prova nativa própria de upload, re-encode e remoção. Esta frente não repete upload, não usa Storage e não herda PASS de outra execução. |
| Senha/sessões | A prova própria de Auth813 registrou 15 estágios/19 checks de troca normal de senha. Novos runs conservam seus resultados individuais; esta frente não muda senha nem certifica revogação ou aparelhos. |
| Painéis mobile | A jornada montada cobre âncoras, recolhimento, teclado e ausência de escrita ao navegar. O runner SQL de Configurações exige Linux; seu guard foi preservado. Revisão humana continua pendente. |

Os cinco ticks de #34 foram encontrados desmarcados no bloco original da issue. Isso não invalida as provas próprias posteriores de Avatar/senha, nem autoriza marcar como concluída a jornada entre aparelhos. Referências: [pendências canônicas](entrega-mvp-pendencias.md), [conferência de produção](frente-b-validacoes-20261012.md) e [checkpoint de Auth813](evidence/native-ci-8134463-20261011.json).

### #12 — T-005 — PWA instalável e portões visuais

- [ ] Lighthouse reconhece a PWA instalável; instalação testada em Android e iOS reais (registro com capturas)
- [x] SW faz precache do shell; derrubar a rede e navegar → `/offline` explica o estado (sem tela branca)
- [x] share_target declarado no manifest (rota-alvo responde com placeholder digno até M2)
- [x] Os três e2e visuais no CI, verdes; um transbordo plantado é apontado com o seletor culpado
- [x] `npx impeccable detect` zero achados reais; relatório do `audit` anexado à issue no fechamento

Quatro dos cinco aceites estão marcados na issue, com [provas históricas próprias](t005-pwa.md). OP-006 registra a verificação vigente de instalabilidade pelo Chromium após a remoção da categoria PWA do Lighthouse. O literal original foi preservado acima. Instalação física Android/iOS com capturas continua pendente e adiada; viewport emulada, eventos sintéticos de instalação e CI não substituem essa prova. Nenhum teste desta frente reexecuta ou atribui a este diff os portões históricos de CI.

## Cobertura acrescentada e fontes revisadas

O novo cenário em [calendar-workspace-browser.spec.ts](../../tests/e2e/calendar-workspace-browser.spec.ts) monta `CalendarWorkspace`, providers, cliente conectado, journal e o `ConnectedCommandFeedback` original usado pelo shell. Apenas roteamento Next e respostas HTTP são substituídos; a fixture não inicia servidor Next, OAuth, Google, Auth ou Supabase.

O primeiro `calendar.disconnect` recebe uma resposta HTTP 503 após o seam colocar a conta em `revocation_pending` e retirar fontes/eventos/janela. A UI deve mostrar o estado pendente, remover os eventos, bloquear sincronização e reconexão, e não repetir o envio automaticamente ao navegar fora da janela. O botão original `Confirmar envio` deve reenviar exatamente o mesmo `client_id`; o segundo HTTP sintético 200 devolve snapshot sem conta. O teste verifica confirmação, descarte do aviso, documento único e ausência de pedidos não declarados. Ele não comprova ACK Google nem exclusão de credencial em SQL real.

As fontes de produto já possuem:

- `CalendarWorkspace`: `router.replace`, expansão apenas fora da janela, atualização do snapshot e guard de conta conectada/fonte selecionada.
- `executeCalendarCommand`/provider: fence antes de revogar; apenas HTTP Google 200 autoriza `finishDisconnect`. Os [controles originais](../../tests/adapters/calendar-security-provider.test.ts) mantêm a pendência após 400 e finalizam após retry 200 com transportes injetados.
- Tema: leitura de preferência de conta no documento e fallback local; Configurações aplica o resultado salvo e as preferências de navegação. [Quatro jornadas SQL/SDK](../../tests/e2e/issue34-settings-sql.spec.ts) já existem; não foi criada persistência paralela.
- PWA: manifest, integridade/proveniência dos assets, offline e instalação com confirmação factual já têm cobertura. Não foi encontrado defeito que justifique mudar esses arquivos.

No primeiro pacote, foi encaminhada a observação estática de que `Retomar desconexão` gerava novo UUID enquanto uma resposta 503 mantinha o envio original no journal. Naquele recorte, a recuperação comprovada era `Confirmar envio`, existente no shell. A reprodução e a correção posteriores desse botão possuem prova própria ao final; não alteram a natureza sintética do primeiro cenário.

## Roteiro para as provas conectadas da raiz

Este roteiro prepara a execução; nenhum passo conectado foi executado por esta frente. Identificadores de usuário/conta e detalhes dos calendários ficam privados. Evidência pública recebe somente horário, SHA servido quando comprovado, intervalos civis, contagens, estados/códigos fechados e booleans. Não capturar HAR, cookies, cabeçalhos de autorização, corpos brutos, títulos, e-mails, URLs assinadas ou tokens.

### Expansão de janela sem reload

1. Na sessão ordinária já conectada, confirmar duas contas/fonte selecionada e obter uma projeção fechada do snapshot anterior: intervalo agregado e contagens. O limite teórico `hoje +180` não substitui o cursor carregado; cache já ampliado até maio pode exigir outro período ainda não coberto.
2. Registrar em memória o documento/frame principal antes da ação e contar somente novas navegações desse documento. Não navegar ou recarregar para instalar o observador. A projeção de HTTP recebe somente método/rota, `start_day`/`end_day`, conclusão/status e número de requests; descarta o restante em memória.
3. Pelo controle normal da UI, abrir período cujo intervalo esteja comprovadamente além da janela anterior. Verificar uma sincronização concluída e nova leitura, com a janela posterior abrangendo o período e estados das duas contas. Eventos reais não são requisito adicional do literal de três dias.
4. Exigir, na mesma execução, pedido além do cursor anterior, retorno válido/estado atualizado e identidade do documento preservada sem navegação/reload. Se alguma parte não estiver observável, registrar `não medido` e manter esse literal parcial.
5. Voltar a Hoje/Semana e às seleções anteriores. Não trocar preferências, conectar outra conta ou limpar cache para fabricar a prova.

### Desconexão, revogação e resultado incerto

1. A raiz escolhe somente uma conexão cuja desconexão esteja autorizada. Registrar baseline fechado para esse alvo exato e para a outra conta; os identificadores usados na conferência permanecem privados. Não usar conta master como fixture.
2. Acionar Desconectar uma vez. Observar resultado terminal da rota e snapshot: a fence deve retirar fontes/eventos da conta escolhida. Um resultado incerto conserva `revocation_pending`; ocultação não significa revogação completa.
3. Se houver 503 ou transporte incerto, não declarar sucesso, liberar claim ou criar novo envio para contornar o journal. Primeiro comprovar término dos requests envolvidos; para confirmar o envio original, usar `Confirmar envio`. Não induzir falha real do Google para reproduzir a fixture.
4. Para concluir o literal, a raiz precisa comprovar a confirmação de revogação e a exclusão exata da conta/credencial. Conferência autorizada somente de metadados/contagens em `public.calendar_accounts`, `app_private.google_credentials` e relações afetadas deve indicar ausência no alvo; a outra conta deve conservar estado/conteúdo. Nunca chamar `calendar_private_account` para obter envelope/tokens como evidência.
5. Diferenciar HTTP da rota do ACK do provedor. O código só chama `finishDisconnect` depois do ACK Google 200, e a gravação final possui metadados de revogação; a prova deve identificar qual desses canais foi observado. Sem conferência final, registrar parcial. Nenhuma migration/reset/grant/limpeza global é necessária.

### Configurações e PWA em aparelhos

Quando o responsável retomar os aparelhos, escolher tema no desktop, salvar, entrar no celular real com a mesma conta e registrar tema/versão/aparelho; depois restaurar a preferência anterior. Para PWA, instalar por HTTPS em Android e iOS reais, abrir standalone e conferir ícone/splash/safe areas/offline com capturas. Não iniciar esses passos enquanto permanecerem adiados, nem marcar emulação como PASS físico.

## Verificação do primeiro pacote

Validação própria em Windows, Node 25.9.0 e dependências do junction fornecido pela raiz:

| Comando/recorte | Resultado |
| --- | --- |
| Vitest: `tests/core/calendar.test.ts`, `tests/core/settings.test.ts`, `tests/features/calendar-{projections,connected,boundary}.test.*`, `tests/features/connected-application.test.ts`, `tests/adapters/calendar-{security-provider,runtime}.test.ts` e `tests/pwa.test.ts` | **143/143**, nove suites, saída 0. A primeira tentativa no sandbox falhou em rename do cache Temp antes de importar os testes; a repetição do mesmo recorte hermético fora do sandbox passou. |
| `npm run typecheck` | Saída 0, TypeScript integral sem emissão. |
| ESLint nos dois arquivos de teste/fixture alterados, `--max-warnings=0` | Saída 0. |
| `calendar-workspace-browser.spec.ts` em Chromium headless local | **5/5**, saída 0. Config temporária ignorada, um worker, zero retries, sem `webServer`, servidor Next ou serviço real; respostas HTTP fechadas por `page.route`. |
| `git diff --check` | Sem erros no recorte. |
| Checklist comparado com o bloco original de cada issue, em leitura GitHub | Cinco aceites por issue; **15/15 literais preservados**, zero ausentes. |
| `node scripts/check-secrets.mjs` | Saída 0; **1.374 arquivos versionáveis**, sem assinaturas encontradas e sem valores impressos. |

O runtime fornecido reportou **Vitest 4.1.11**. A raiz conferiu `package.json` com intervalo **^4.1.0** e `package-lock.json` com **4.1.11**, coincidente com o runtime e aceito pelo intervalo declarado. Não houve instalação ou alteração de dependências/lockfile nesta frente. A prova local não substitui uma instalação limpa no CI. Artefatos sintéticos do navegador e a configuração temporária ficam em `work/`, ignorados pelo Git.

O runner `issue34-settings-sql.spec.ts` permanece não executado nesta rodada Windows: requer Linux e seu guard não foi removido. PWA browser/SW completo, Google/Supabase/Auth reais, revogação hospedada e aparelhos não foram executados. Nenhum resultado local autoriza afirmar CI verde ou concluir aceites hospedados/físicos.

O launcher Impeccable local foi tentado uma vez e não carregou o engine 0.1.6: cache fora das raízes permitidas. Conforme o fallback do `SKILL.md`, foram lidos `PRODUCT.md`, `DESIGN.md` e a referência `harden.md` diretamente. Nenhum `detect`/`audit` novo foi certificado por essa tentativa.

## Segundo pacote — Retomar desconexão

A raiz autorizou um teste adicional do botão original após o HTTP 503. A reprodução passou isoladamente: o clique gerou exatamente um novo UUID nativo, diferente do `client_id` original; o journal recusou essa nova intenção antes de emitir HTTP. A UI mostrou `Confirme o envio pendente antes de salvar outra alteração.` e manteve o envio original. O botão global `Confirmar envio` então reenviou o mesmo `client_id` e concluiu a resposta sintética 200. A observação de `crypto.randomUUID` encaminhou o gerador nativo e foi restaurada; não forneceu valores ao produto. Essa reprodução antecede a correção e não era sucesso funcional de `Retomar`.

Após aprovação expressa, o método existente `retryPendingCommand` recebeu um filtro opcional de comando e input sem `client_id`. A retomada filtrada lê e adota o journal sob seu lock; uma intenção de outro comando, outra conta ou outro corpo é recusada sem HTTP. Quando corresponde, usa o `PendingRequest` original, incluindo identidade, fingerprint e corpo. `sendCommand` ainda revalida a retenção sob seu próprio lock; uma intenção concorrente entre as duas leituras não pode ser substituída. O journal, os guards de sessão e a implementação de envio não foram modificados.

`Retomar desconexão` passa exatamente `calendar.disconnect` e a conta exibida. Se não há intenção pendente factual após a adoção, o método retorna `undefined` e a UI conserva a possibilidade já existente de iniciar uma desconexão para uma conta que veio pendente de outro contexto. Uma intenção diferente não recebe esse retorno e não dispara esse fallback. `Confirmar envio` sem filtro mantém o comportamento original. Nenhum corpo do journal é exposto à UI.

Paths do segundo pacote: `src/lib/demo/connected-application.ts`, `src/components/features/calendario/calendar-workspace.tsx`, `tests/features/connected-application.test.ts`, `tests/e2e/calendar-workspace-browser.spec.ts` e este relatório. A fixture do primeiro pacote permanece no hash aprovado `A61286FB5CD76CFB3F2471CA280375183931768B671BC57CA83B5CB8E35D56AF`. Os arquivos são congelados separadamente para a raiz revisar/incorporar; não houve commit ou push desta frente.

| Verificação própria do segundo pacote | Resultado |
| --- | --- |
| Vitest: aplicação conectada, UI estática do Calendário e journal original | **80/80**, três suites, saída 0. Inclui conta/comando/corpo divergentes, proibição de `client_id` no filtro, restauração do journal, ausência factual, sessão/dispose e corrida entre os locks. |
| E2E hermético montado | **8/8**, saída 0. Conserva os cinco cenários anteriores; acrescenta Retomar com mesmo ID/zero novo UUID, recusa de outro comando restaurado sem HTTP, e retomada da conta exibida sem journal local pendente. |
| TypeScript integral, lint dos quatro arquivos de código e camadas | Saída 0; **370 módulos/1.395 dependências**, sem violações. |

Checklist React/Impeccable: o callback conserva dependências explícitas, `busy`, feedback, atualização do snapshot e os controles nativos existentes. A ação continua no evento de clique; não há efeito de replay automático, biblioteca nova, alteração de layout/tokens ou leitura do corpo pelo componente. A prova montada de Retomar usa teclado e mede alvo de pelo menos **44 × 44 px**. `SKILL.md` local, `harden.md`, `craft-floor.md` e `vercel:react-best-practices` foram lidos. Não foi produzido um novo audit visual de release.

O segundo pacote corrige o comportamento local demonstrado. Não revoga conexão real, não comprova exclusão de credencial hospedada e não encerra #32, #34 ou #12. Os aceites físicos/hospedados permanecem como descritos acima.
