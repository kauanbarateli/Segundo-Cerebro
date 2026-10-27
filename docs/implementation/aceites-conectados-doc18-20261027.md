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

**Pendente na redação:** CI próprio do ajuste de testes, o resultado desse probe e os demais aceites operacionais/humanos. A aprovação de b17 não é herdada. Os resultados exatos continuam vinculados à Source na PR #120/#122.

### Achado separado em Capturar

O rebase oferecido após conflito em Capturar pode usar `items.current`/`before`, sem uma leitura comprovadamente posterior ao save da outra aba. O ajuste de aviso em Conhecimento não corrige nem mascara essa questão. Antes de alterar o rebase, demonstrar snapshot atual, rascunho preservado, comportamento sem storage e falha de releitura. Não usar refresh genérico de todos os módulos para esconder uma recusa. Esse achado permanece uma pendência própria da #122.

## Ordem restante, sem repetir motores já aceitos

1. Retestar a correção de Conhecimento e qualificar seus checks próprios; analisar separadamente a leitura atual de Capturar.
2. Smoke conectado de Tarefas/Projetos: contexto do formulário, Hoje com abertas/concluídas, filtros e Lista/Kanban. Preservar D-081: Projeto continua baseado em progresso das tarefas, sem status/prazo próprios.
3. Smoke de Início → página real e apresentação de Configurações, com mudanças reversíveis e baseline restaurada quando necessárias.
4. Cofre sintético em sessão real: foi observada a tela Criar Cofre na conta QA. A aba ficou preservada para o responsável preparar sua senha/kit e itens fictícios. Não houve entrada de credenciais, aceite da declaração ou criação de Cofre pelo agente. Testes sintéticos não substituem essa sessão; não fotografar, copiar ou publicar segredo/kit.
5. MainHTTP/onboarding: pacote novo vinculado a Source/deployment/origem/proteção/janela atuais, com preflight antes de credenciais. Não executar os pacotes antigos inertes, remover seus throws ou usar cookies humanos.
6. Retenção hospedada: conferir o job e observar execução autônoma/saúde por canal PostgreSQL pessoal autorizado. R01–R07 nativos não são recibo de Cron hospedado. Não ativar Cron de produção nem expirar fixtures correntes para forçar aprovação.
7. Zoom nativo/aparelhos e aceite humano #44 permanecem próprios. Instalação PWA e tema sincronizado relatados pelo mantenedor continuam válidos no escopo relatado.

O estado implementado, validado e pendente de cada nova Source deve continuar separado. Nenhuma destas observações autoriza merge ou deploy de produção.
