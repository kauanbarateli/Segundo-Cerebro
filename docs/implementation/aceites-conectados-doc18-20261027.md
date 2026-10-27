# Doc18 — aceites conectados de 27/10/2026

Continuação da PR #120, com merge e produção bloqueados. Este registro atualiza o saldo de execução; os checkpoints de 25–26/10 permanecem históricos. O protótipo doc17 é a autoridade visual, conforme D-080/D-084. Restore, checkout Asaas e novo Drive seguem fora deste recorte.

## Base e ambiente observados

- Source de partida: `b17a41fd80fc61f3a8df0fda3264948f6ce08553`, árvore `b9c1ea520fc29b368c8dda05734f5868991ee6ce`.
- Preview READY `dpl_91uS6TxzTux1myVt5HDfVsMeNHn5`, branch `codex/homologacao-twry-20261022`, projeto pessoal isolado `twrydxsdemaykgvdlpyd`. Ator comum QA descartável já existente, sem Master.
- A base passou 24 execuções de CI, com 606/606 E2Es em cada CI geral, 409 no diagnóstico Doc18 e 11 em Auth UI. São provas de b17, sem herança automática para a correção seguinte.
- A conexão Supabase recusou `get_project` e uma consulta somente leitura de metadados. Nenhuma configuração, grant ou credencial foi alterada para contornar a recusa. As observações abaixo são de UI/reload; novos contadores independentes de banco não foram observados.
- Notebook de 8 GB: leitura por `node:os` indicou aproximadamente 796 MiB livres antes do ensaio. A tentativa anterior via CIM foi indisponível, não uma leitura de zero memória. Testes locais são seriais, heap de 256 MB; browser de testes, build, PostgreSQL e Docker ficam no GitHub. A aba humana existente foi preservada.

## Metas: foco, imagem e reentrada — aprovado no recorte observado

Usada a Meta sintética existente do ensaio 3403, sem criar outro arquivo, Meta ou aporte. O detalhe abriu com o título e valores anteriores. O editor terminou sua preparação protegida e manteve a indicação de conservar a foto atual.

O valor local `1,005` foi recusado antes de uma confirmação financeira. O alerta de validação recebeu foco (`role=alert`) após o commit React. Cancelar devolveu foco ao botão que abriu a Meta. Depois da recarga, a mesma âncora e o valor anterior permaneceram, a imagem estava decodificada em 512 × 512, não havia alerta e o detalhe/editor estavam fechados.

Não houve seleção de arquivo, início de upload, confirmação financeira ou alteração de destaque. A leitura da imagem é uma prova de apresentação atual, sem afirmar bytes físicos independentes, unicidade de recibos ou ausência de órfãos.

[Observação sanitizada de foco/reload](evidence/doc18-connected-b17-20261027/goals-focus-reload.json).

**Continuidade conferida por Git:** dos 70 paths que abrangem Goals, transporte/host/canal de imagens, adapters, Core, rotas, componentes compartilhados, schema027 e lockfiles, 69 são idênticos entre 3403 e b17. O único delta é o foco em `goal-editor.tsx`. Os positivos hospedados de A/B de imagem, vínculo/recibo e reservas continuam nas suas fontes próprias: [upload3403](goals-image-hosted-3403-20261025.md), [efeitos financeiros](finance-goals-ui-oneactor-current27-20261025.md) e [destaque0310](doc18-conteudo-metas-conectados-20261026.md). Essa equivalência limita o reteste; não transforma os resultados históricos em um novo upload b17.

## Conhecimento: aviso residual reproduzido

Foi criada uma única página sintética para este ensaio no caderno QA existente. Duas abas próprias carregaram a mesma página; a aba humana anterior não foi usada. A primeira salvou o marcador A uma vez. A segunda conservou B no editor e seu único save recusado exibiu a resolução, incluindo A como texto salvo.

Após um clique em **Usar a versão salva**, o editor adotou A, removeu B e a região de conflito desapareceu. O alerta externo do workspace continuou visível. O feedback global de comando não estava presente nesta primeira recusa; não atribuir todo conflito ao journal. A aba auxiliar foi fechada somente após a adoção, sem rascunho pendente. Não houve overwrite nem exclusão de registro.

Essas observações demonstram o defeito de apresentação e a preservação do vencedor. Não certificam contagens atuais de versões, eventos ou recibos no banco. As provas anteriores de CAS/Reader permanecem no [histórico específico](doc18-conflito-conectado-20261026.md).

[Observação sanitizada antes/depois da escolha, ainda sem a correção](evidence/doc18-connected-b17-20261027/knowledge-conflict-before-fix.json). O raster nativo de diagnóstico recorta o viewport e não enquadrou o alerta; não foi incorporado como prova visual dele.

## Correção delimitada e validação

O erro do workspace é associado ao UUID original da tentativa. Somente a adoção explícita, ou um overwrite explicitamente solicitado e concluído, notifica a resolução. A dispensa do feedback global consulta o getter atual e só limpa `rejected` do mesmo UUID, na mesma pilha síncrona. Erros de outra operação/load, pending, resultado incerto, sessão alterada, erro de journal e confirmações permanecem.

Não muda CommandSession, payload, API, schema, regra CAS, UUIDs de replay, número de writes ou journal. O helper ocupa o arquivo de runtime existente. As duas jornadas SQL conservam comandos, contadores, ledgers e negativas; acrescentam a presença do alerta antes da escolha e sua ausência depois. Os oito casos puros novos verificam a identidade e os estados que não podem ser dispensados.

Revisão de autoria, Root e peer independente sem bloqueador concreto. Hashes/bytes before/after e patch foram conferidos antes da aplicação. Lint focado, whitespace e os 51 testes de `connected-application.test.ts` passaram em Node24/heap256/um worker, com TEMP/TMP privados do workspace e restaurados ao fim. A instalação local Vitest4.1.11 não substitui o lockfile canônico do CI.

### Reteste conectado em 6f4b8d8

Produto `6f4b8d8b75d52d57a90a396a0fe4841a8aecba28`, árvore `54b7e7942f1a263e9083e8cd4ea939db7f730133`, Preview READY `dpl_Bpy6tQJbWuN3EpjBt2HJyUvC7q9Z`, mesmo projeto/ator QA. A página sintética anterior foi reutilizada, preservando os demais fixtures e a aba humana.

As duas escolhas foram exercitadas em conflitos novos. Em cada uma, a versão vencedora foi salva uma vez e a outra aba fez uma única tentativa stale, conservando seu rascunho e exibindo o conflito. **Usar a versão salva** retirou o alerta do workspace e mostrou o vencedor no Reader. **Salvar meu rascunho sobre a atual** foi acionado uma única vez; houve confirmação de página salva e, após reload, o Reader continha o rascunho escolhido, sem editor, conflito ou alerta. Não houve reenvio automático ou exclusão de dados. Contagens independentes de banco continuam não observadas.

[Observação sanitizada dos dois percursos](evidence/doc18-connected-6f4b8d8-20261027/knowledge-conflict-two-choices.json).

O diagnóstico Doc18 dessa Source aprovou 409/409 casos, mas não selecionava os dois casos SQL específicos de Conhecimento. Os dois CIs gerais falharam antes do E2E: 3.736 unitários passaram e dois doubles antigos não forneciam `getCommandSnapshot`. Nenhuma falha nativa adicional foi observada; o saldo final foi 21 PASS/2 FAIL, sem reexecuções. Esse resultado não é convertido em CI aprovado pelo reteste de UI.

O ajuste seguinte completa os ports tipados dos doubles em todas as reatribuições do app e conserva os oráculos de versão/rascunho/troca de dono. O positivo usa o ID original; o negativo preserva um terminal estrangeiro que muda entre render e clique. Revisão Root/peer, lint e 70 testes focados de dois arquivos passaram localmente. Produto permanece igual ao 6f.

A lane rápida acrescenta os specs SQL existentes Issue22 e Issue28, mantendo permissões, SDKs, instalação, dois workers e limite de 20 minutos; não substitui os CIs gerais. O novo caso observacional de Capturar usa gravação canônica fora do journal da outra sessão, exige segurança de CAS/rascunho/journal/ledger e registra se o painel ofereceu v1 ou v2. Seu PASS não comprova frescor e não autoriza dispensar um conflito ou alterar o rebase. Esses testes de navegador ficam no GitHub.

### CI próprio de c88 e limite de estabilidade

HEAD de revisão `c88b825a0ba7becd20403d401281b7f065837fd4`, árvore `490fed5fceb24abba0b6616f8039c7daed2557f3`. Zero delta de produto frente ao 6f em src, public, design-system, schema, scripts e configuração/dependências; o Preview continuou em 6f, sem novo deploy para os ajustes de testes.

As 23 execuções concluíram com success no attempt 1, sem rerun manual. [Doc18](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40466975686), job122064635676, passou 420/420 com zero falhas/flaky/skips. Os specs SQL de Conhecimento foram selecionados e mantiveram os oráculos de comandos/versões/ledger.

[CI PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40466981674), job122064655451: 607 PASS, zero falhas/flaky/skips. [CI push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40466975667), job122064635697: 606 PASS e **1 flaky** de Metas, aprovado no retry automático. O saldo success não é ausência de instabilidade. O merge sintético PR `0b3a7658b2e2c448a5a0ec0286b98ef5333e10a5` tem pais main336 e c88 e a mesma árvore de c88, confirmados por API; nenhuma integração em main ocorreu. Capturas/limpeza próprias do push passaram, ainda com `hostedValidated=false` e `productionValidated=false`.

O caso instável `finance-goals-image-upload.spec.ts:151` leu `dd=[]` entre o início da consulta e sua resposta. A fonte mostra que a consulta limpa o alerta, publica `working` e remove temporariamente o diagnóstico; só depois do await publica `pending`. Assim, aguardar apenas a ausência do alerta não espera o diagnóstico. O ajuste delimitado usa polling da mesma lista exata de quatro valores, com o timeout padrão existente, preservando trace, upload e zero execução financeira. Não muda runtime nem torna a primeira tentativa aprovada retroativamente; exige seu próximo CI próprio.

### Achado separado em Capturar

O probe canônico c88 confirmou que o rebase oferecido após conflito em Capturar usa a versão em cache v1, e não a v2 gravada por outro contexto. Houve duas leituras antes da gravação externa e zero depois, um único POST stale recusado, rascunho preservado e nenhum commit indevido. O ajuste de aviso em Conhecimento não corrige nem mascara essa questão; PASS do probe é observacional, sem aceite de frescor. A correção precisa demonstrar snapshot atual, RAM preservada sem storage, falha de releitura e troca de sessão. Não usar refresh genérico que desmonte o editor e perca o rascunho. Esse achado permanece uma pendência própria da #122.

### Correção de Capturar posterior a c88 — qualificação própria necessária

O port obrigatório `readCaptureForConflict(id)`, nos produtores conectado e demo, reutiliza o GET, identidade, decoder e timeout existentes. Não publica loading/erro transitório na query de Capturar: o filho que possui o rascunho permanece montado. Só um DTO completo, do mesmo dono/revisão e com a nota ainda editável é publicado; ausência, exclusão ou promoção não habilitam um update como create. Não há endpoint, migration, SDK ou cache de usuário novo.

A intenção, UUID, dono, rascunho e época são ligados à releitura. Uma ref síncrona bloqueia novo envio enquanto o conflito não tiver escolha, inclusive antes do próximo render. Erro de leitura oferece somente retry explícito GET. Adotar não escreve; manter o rascunho atualiza a base CAS e exige outro save explícito, com novo UUID. A dispensa do aviso só atinge o terminal recusado original e não remove erro posterior distinto. Respostas tardias, outra nota/sessão ou desmontagem não resolvem o conflito atual. 401/403 fecham UI/cache preservando o journal do mesmo dono; mudança real de dono mantém a revogação existente. Uma nova gravação remota posterior à releitura continua protegida pelo CAS.

Revisão de autoria, Root e peer aprovou o pacote de cinco paths, patch SHA-256 `8efad6ad6a2d0ce0abd8b26abb7aa3639279e373e8b22522036608e18512b581`. A aplicação conferiu todos os hashes/bytes antes/depois. Os 82 testes focados passaram em Node24/heap256/um worker. Dois ajustes posteriores de lint — callback `runScenario` e invalidação das refs atuais no cleanup — receberam revisão independente, sem supressões; lint focado, portão de camadas (556 módulos/2.479 dependências), scanner de 2.786 arquivos e whitespace passaram. As variáveis temporárias dos testes foram restauradas. A versão Vitest local4.1.11 não substitui o lockfile canônico no GitHub.

Doze casos puros cobrem leitura, falha, isolamento, revisão, fechamento e journal incerto. Cinco percursos SQL adicionais verificam as duas escolhas, RAM com storage de draft indisponível e GET falho, sessão recusada e duas submissões durante GET retido. O observer passa a exigir v2 na fonte nova; a evidência falsa de c88 é preservada como diagnóstico histórico. O caso de dois submits não garante reproduzir a microjanela anterior ao commit React; o guard síncrono tem revisão própria. Testes SQL/navegador, CI completo e reteste conectado pertencem à fonte posterior publicada na PR #120/#122, sem herdar PASS de c88 ou 6f.

### Fonte c6: qualificação própria e sessão conectada

Produto `c6ebf21207d48c605cc7417db4377d9922b1f890`, árvore `e9193d848b406ce3788e130e6b72f4e9f6554ff4`; Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`, READY conferido por SHA/ref/ambiente, mesmo projeto pessoal QA. As 16 variáveis foram conferidas por nomes/escopos de Preview, sem ler seus valores ou alterar configuração. main e produção permaneceram preservadas.

[Doc18 próprio](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40479424365), job122105685443/a1, passou **425/425**, zero falhas/flaky/skips. O probe ofereceu a versão atual, não o cache, com um GET depois da gravação externa e um único POST stale recusado. Os cinco percursos novos passaram. [Recibo CI](evidence/doc18-connected-c6ebf212-20261027/ci-capture-fresh-conflict.json) conserva Source/árvore/log/casos; é SQL/navegador efêmero com transporte sintético, sem aceite hospedado ou de produção por si.

A sessão real criou somente uma captura sintética própria. Nas duas rodadas, uma aba salvou o vencedor e a outra enviou uma única tentativa stale, mantendo seu texto local. O painel mostrou o vencedor atual e bloqueou Save até a escolha. Adotar retirou erro/conflito e conservou o vencedor após reload. Manter o rascunho conservou o texto local, retirou erro/conflito e habilitou um save posterior explícito; o texto escolhido persistiu após reload. A aba auxiliar foi fechada sem rascunho pendente; a captura criada foi arquivada de forma recuperável, reconferida com conteúdo preservado e Restaurar disponível. A aba humana e a de preparação do Cofre foram preservadas.

Foram seis cliques Save (quatro percursos reconhecidos pela UI e duas recusas stale) e um clique de arquivamento. Esses cliques não são contagens independentes de transações, eventos ou recibos SQL/HTTP. Nenhuma exclusão permanente, upload, promoção ou confirmação financeira ocorreu. [Recibo conectado sanitizado](evidence/doc18-connected-c6ebf212-20261027/capture-fresh-conflict-two-choices.json). Falha real de rede/storage, zoom e aparelhos não foram alegados nesse percurso; as negativas efêmeras acima conservam seu recorte próprio. A captura nativa é recortada e não certifica largura completa.

**Resultado terminal próprio:** 23/23 workflows concluídos com success no attempt1. [CI push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40479424449), job122105685533, e [CI PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40479428499), job122105698687, passaram **612/612 E2Es cada**, zero falhas/flaky/skips. O caso de Metas antes instável passou na primeira tentativa nos dois eventos, mantendo os mesmos quatro valores e os oráculos de trace/upload. Recapturas e limpeza do push passaram; as recapturas exclusivas de push foram puladas pela condição no PR, sem E2E ignorado.

O checkout PR `6dabfc31af95f8629bf6a5bc7c27b5d942d8284b` foi confirmado por API com pais main336/c6 e árvore igual à c6; não é merge real. [Recibo terminal](evidence/doc18-connected-c6ebf212-20261027/ci-terminal-review.json) conserva runs/jobs/log hashes e limites. Esse resultado qualifica o código c6; não transforma um HEAD documental posterior em Source já executada nem promove provas demo/nativas a aceite de produção.

## Tarefas/Projetos, Início e Configurações em 6f

Na tarefa e projeto sintéticos existentes, Lista/Kanban conservaram o mesmo ID e contagem. Hoje ficou vazio para a tarefa sem prazo; essa observação não valida sozinha a inclusão de concluídas com prazo de hoje. Uma alteração explícita para Concluída persistiu após reload e o projeto passou a 1 de 1/100%. O formulário contextual Adicionar tarefa veio com o projeto correto e foi cancelado, sem criação. Em seguida, a tarefa foi restaurada explicitamente para Em andamento; reload confirmou o mesmo ID e o projeto voltou a 0 de 1/0%. Foram duas escritas de estado, não um ensaio sem mutação. [Recibo](evidence/doc18-connected-6f4b8d8-20261027/tasks-projects-roundtrip.json).

O cartão de páginas recentes do Início abriu a página sintética já usada no CAS. O Reader mostrou o conteúdo B3 confirmado anteriormente, com Editar disponível e sem editor montado. Nenhuma nova escrita de página. [Recibo](evidence/doc18-connected-6f4b8d8-20261027/home-recent-page.json).

O complemento de Hoje usou a mesma tarefa: prazo de 27/10 às 12h no fuso do app, uma alteração para Concluída e restauração de prazo vazio/Em andamento no mesmo formulário. A aba Hoje conservou a tarefa aberta e concluída; o formulário após reload confirmou a conclusão e o prazo. Outra recarga confirmou a baseline restaurada, prioridade Média e nenhum novo registro. Foram três submissões com mutação reconhecida, preservando o histórico de auditoria. Duas entradas iniciais pela automação não geraram o prazo persistido; o controle nativo foi usado e conferido antes do percurso válido. Não afirmar contagem independente zero de writes dessas duas submissões sem alteração. [Recibo específico](evidence/doc18-connected-6f4b8d8-20261027/tasks-today-due-roundtrip.json).

Na mesma página QA de Conhecimento, a toolbar aplicou Título2/centralizado, lista simples, numerada, checklist marcado, citação e código ao rascunho. Voltar à leitura mostrou o conteúdo confirmado, sem editor ou checklist não salvo. Retomar conservou o checklist marcado. O descarte explícito retirou apenas as formatações de teste; o Reader voltou à baseline, sem nova escrita de página. É observação desktop, sem aceite de retorno mobile ou perda de rede. [Recibo](evidence/doc18-connected-6f4b8d8-20261027/knowledge-toolbar-local-draft.json).

Configurações apresentou os cartões Claro/Escuro/Sistema, módulos, sessões e links legais. Escuro foi salvo e persistiu após recarga; Claro foi restaurado e reconferido após outra recarga. Foram duas escritas de preferência, sem mudar nome, módulos, entitlements ou selecionar arquivos. A captura nativa recorta a largura e não certifica a geometria completa nem os aparelhos. [Recibo](evidence/doc18-connected-6f4b8d8-20261027/settings-theme-roundtrip.json).

## Ordem restante, sem repetir motores já aceitos

1. Preservar a qualificação técnica de c6 e conferir os checks próprios de qualquer delta posterior. Capturar passou nas duas escolhas conectadas e nas negativas SQL acima; Conhecimento conserva seus percursos próprios. Não reimplementar esses ajustes por um checkpoint histórico.
2. Conservar o aceite limitado de contexto, Lista/Kanban, Hoje com abertas/concluídas e progresso de Projetos acima; completar estados adversos/aparelhos ainda não cobertos. Preservar D-081: sem status/prazo próprios de Projeto.
3. Início → página real e ida/volta do tema em Configurações passaram no recorte acima; conservar pendências de permissões, falhas e dispositivos que não foram exercitadas.
4. Cofre sintético em sessão real: foi observada a tela Criar Cofre na conta QA. A aba ficou preservada para o responsável preparar sua senha/kit e itens fictícios. Não houve entrada de credenciais, aceite da declaração ou criação de Cofre pelo agente. Testes sintéticos não substituem essa sessão; não fotografar, copiar ou publicar segredo/kit.
5. MainHTTP/onboarding: preparo inerte atualizado para c6/deployment atual; 15 pins de produto e oito arquivos públicos SDK idênticos à base6f, matriz64 e guardas conferidos por autoria/Root/peer. Manifesto de41membros SHA-256 `3664f4a8c74174495bbf6b210fcf93d2f0ae1c721dbfe77ad286210cb970be7f`. Aprovações false e link/janela/probes novos null; nenhum operador, teste MainHTTP, ator ou conexão foi executado. Antes de operar, completar proteção/canal, vínculos e janela atuais e o preflight antes de credenciais. O fetch protegido da Vercel pode criar/reusar link de23h; não foi acionado como se fosse uma simples leitura. Não executar pacotes antigos, remover throws ou usar cookies humanos. Os paths Windows ainda precisam de qualificação para transporte a outro runner.
6. Retenção hospedada: conferir o job e observar execução autônoma/saúde por canal PostgreSQL pessoal autorizado. R01–R07 nativos não são recibo de Cron hospedado. Não ativar Cron de produção nem expirar fixtures correntes para forçar aprovação.
7. Zoom nativo/aparelhos e aceite humano #44 permanecem próprios. Instalação PWA e tema sincronizado relatados pelo mantenedor continuam válidos no escopo relatado.

O estado implementado, validado e pendente de cada nova Source deve continuar separado. Nenhuma destas observações autoriza merge ou deploy de produção.

**Limite atual de operação:** o fallback somente leitura no painel pessoal de homologação redirecionou ao login do Supabase. Nenhuma consulta SQL, agendamento ou alteração foi feita pelo painel. A recusa MCP e a sessão expirada mantêm os contadores e a retenção hospedada como não observados; não foram contornados com chave privilegiada ou outra organização.
