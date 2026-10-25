# Preview fe04 — retomada e foco do onboarding

**OBSERVADO:** o deployment isolado `dpl_DtnpYycxhUoQWu8A2qqcMdL4NpHQ` ficou READY, `target=null`, Source `fe04ea927bf7ed697defd9a3db8203d234a5b844`, árvore `ee9eca1f8ac8f2ba9162f5ac642ef7f3dea56ee4`, na branch `codex/homologacao-twry-20261022`. Projeto Vercel `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, equipe pessoal `team_BqlhayzOBFfZT7Rv16j4OeUK`. O [CI próprio do candidato](ci-fe04-20261025.md) passou antes da seleção. A coorte criada pelo avanço da branch também encerrou, separadamente, **9runs/10jobs SUCCESS**, incluindo o [geral40212677656](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40212677656). [Recibo da branch](evidence/ci-fe04-homolog-20261025.json):13créditos, sem repetir lista ou detalhes dos oito runs já terminais, sem logs/artefatos. Essa observação é somente de metadados, sem qualificar envelopes nativos ou checkout real.

Somente essa branch remota avançou por fast-forward de a8e para fe04. Main remota `336e1b7c2a2f5efba871eb0ad461b04bba065c41`, Main humana local e branch local de homologação foram preservadas. As três proteções `deploymentEnabled=false` continuam intactas. O redeploy usou o deployment anterior da homologação e confirmou Source/ref/alvo; não passou valores de variáveis. A consulta sem decriptação mostrou 16 nomes exclusivos desse Preview: os 14 anteriores e as duas flags de Metas. Não houve importação de segredos, aplicação de schema, merge ou deploy de produção.

## Recorte conectado observado

Após recarga integral, a sessão comum já existente continuou autenticada. O Financeiro carregou o planejamento e as duas Metas QA anteriores; o consumo de R$900 sobre o limite antigo de R$0,50 continuou visível. Não foi efetuada operação financeira nesse recorte.

Pelo link **Preparar meu espaço** em Configurações, o onboarding retomou na etapa de Google, com duas conexões somente leitura e rascunho salvo. Não foi iniciado OAuth, alterada seleção de calendários nem revogada conexão. Avançar levou à etapa de hábito, com foco inicial no título.

No hábito, adicionar uma escolha temporária ao **rascunho** moveu o foco ao botão de adicionar outra. Abrir esse editor moveu o foco ao campo. Remover a escolha temporária manteve o foco no campo remanescente. O campo observado tinha fonte de 16px, altura aproximada de 52px e outline visível no tema escuro efetivo. Essa medida é de um campo/viewport, não aceite global de contraste ou mobile.

O percurso terminou de volta na etapa Google, com duas conexões e mensagem de escolhas salvas. A escolha temporária foi removida do rascunho. Seu prazo foi renovado pela alteração efetiva para 24/11/2026 às13h45 de Brasília. Não foi acionada a conclusão do resumo nem verificada contagem SQL neste recorte; não declarar imutabilidade integral do banco a partir da interface.

## Erro local identificado

**REPRODUZIDO no hábito:** enviar **Adicionar** com nome vazio exibiu “Dê um nome para adicionar o hábito.”, mas manteve o foco no botão em vez do campo inválido. AX e leitura DOM de `document.activeElement` concordaram, inclusive após a renderização. O ramo local de submit em `draft-steps.tsx` somente define o erro e retorna. A correção mínima deve focar o mesmo campo existente, com regressão de teclado nos editores compartilhados. Não alterar layout, autosave, chaves, dados ou regras de domínio.

O comportamento nos editores de projeto e tarefa compartilha código, mas **não foi reproduzido neles nesta rodada**. A correção ainda requer revisão, CI e reconferência no Preview correspondente. Os positivos acima não aceitam esse negativo, a quinta escolha, todo o onboarding, aparelhos físicos ou a #44. A comparação das imagens da landing e os negativos financeiros/conectados continuam em registros próprios.

## Prévia financeira adicional, sem confirmação

Na mesma sessão QA, o detalhe da Meta de reservas continuou em R$150/R$2.000. Uma revisão de aporte fictício de R$0,01 usando a primeira conta QA exibiu saldo real R$1, reservado R$0 e disponível R$1, com prévia da Meta em R$150,01. Foi escolhida **Voltar à edição**, sem clicar em Registrar aporte. A mesma quantia/data, agora na segunda conta QA de reservas, recebeu “Confira os campos e as datas. Para aportes, verifique também o saldo disponível da conta.” e não abriu a confirmação. Fechar o diálogo devolveu o foco ao botão da Meta, que continuou mostrando R$150.

Isso observa prévia e recusa no aplicativo conectado com um ator. **Não** identifica o código HTTP/SQL exato, prova o ramo SQL de insuficiência, mede o disponível negativo na UI ou substitui consulta de eventos/intents e imutabilidade no banco. A primeira revisão pode manter estado operacional da prévia; não foi feita limpeza ou afirmação de zero escritas internas. O número−R$50 continua pertencendo à observação RO anterior. Nenhum comando final de aporte/liberação/lançamento foi acionado nesse recorte.

O onboarding permaneceu salvo na etapa Google, sem escolha temporária de hábito; a aba foi deixada no planejamento financeiro, com o diálogo fechado e a sessão preservada. Merge e produção seguem bloqueados; homologação continua exclusivamente em `twrydxsdemaykgvdlpyd`, preservando migrations001–027 e os dados QA.
