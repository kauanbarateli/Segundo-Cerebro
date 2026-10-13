# Retomada do MVP — 13/10/2026

O HEAD principal consultado foi `2c159fc17265ac71c713a48974eb9781c589eba3`. Continuam 12 issues abertas, oito de execução e quatro épicos. Seis workflows desse HEAD concluíram com sucesso; Admin no navegador e Recovery falharam. Os metadados atuais não recebem as contagens privadas dos runs anteriores como provas próprias. A landing da PR #39 já foi incorporada e publicada, com layout e 31 imagens preservados.

## Quatro frentes

A retomada segue a nova orientação do mantenedor: agentes em paralelo para Auth/Admin/Sessões, Calendário/Configurações/PWA e investigação offline de restore; a raiz assume conexões, validações reais, revisão e consolidação. Os agentes entregam recortes isolados. Root e peer revisam antes de incorporar. Não há acesso à BlackSheep/VOE, retomada do Drive ou reaplicação de 001–019.

## Avanços conectados

O [primeiro disparo automático observado](evidence/google-cron-first-schedule-20261013.json) do Calendário terminou com sucesso: evento `schedule`, run `38399742787`, SHA `2c159fc`, job e etapa do operador aprovados. A criação ocorreu às 12:46:06 UTC, 09:46:06 em Fortaleza, embora a agenda seja 05:17 UTC/02:17 local. Não assumir pontualidade do GitHub. A UI conectada mostrou duas contas e sincronização às 09:46. Os logs brutos não foram lidos; o HTTP e as contagens dessa execução não foram capturados diretamente. O contrato revisado do operador exige HTTP 200 e zero falhas para saída 0, mas essa inferência é distinta da captura factual do run manual anterior. Revogação e expansão conjunta sem reload continuam pendentes.

A conexão MCP pessoal ainda recusou a consulta do projeto com falta de permissão. O [quinto restore supervisionado](restore-ensaio-20261013.md) via perfil privado retornou falha, com causa desconhecida. Reconferências readonly anteriores/posteriores mostraram zero nas quatro contagens selecionadas e nos buckets do alvo. Não repetiremos a importação sem diagnóstico novo revisado; nenhuma causa anterior foi reatribuída, owner/ACL suprimido ou migration aplicada.

## Construção e revisão

O ajuste F1 de Admin impede que a expiração sobrescreva a primeira falha. Sem falha anterior, o prazo continua recusando no limite exato. Incerteza, requests pendentes e veto de limpeza permanecem. A raiz revisou o patch integral e executou **88/88 controles offline**; peer independente aprovou o recorte e executou quatro controles pertinentes. A primeira execução no sandbox passou 77 e recusou 11 composições com `GRAPH_REFUSED`; a repetição offline fora dele passou todos os 88. Isso não demonstra EOF nativo nem corrige por inferência as falhas do CI.

O primeiro recorte do Calendário monta o componente original de confirmação do journal e prova, com HTTP sintético, desconexão incerta 503, ocultação de fontes/eventos e retry com o mesmo `client_id` até confirmação. A raiz leu os três arquivos e repetiu **5/5 cenários Chromium**. Uma reprodução posterior mostrou que `Retomar desconexão` gerava outro identificador e era recusado pelo journal. O segundo recorte corrige a retomada usando a intenção original, com filtro de comando e conta; uma pendência divergente é recusada antes de HTTP. Root e peer revisaram o pacote completo. Na integração Main, a raiz repetiu **80/80 testes unitários e 8/8 cenários Chromium**, além de tipos, lint, camadas, design system e scanner. Esses resultados são locais e herméticos; não comprovam revogação Google hospedada.

O [diagnóstico opcional do comando Fetch](t017-fetch-command-observation-20261013.md) de Auth/Admin foi revisado por Root e dois peers e integrado. Ele distingue ACK de rota, resolução/rejeição do comando e evento terminal; nenhum desses recortes fornece autorização sintética de cleanup. A raiz executou no checkout Main **98/98 controles de suporte Admin, 59/59 de Recovery e 38/38 do runner Admin**, sem serviços reais. A próxima execução nativa deve ter evidência própria; os mocks não identificam a causa das falhas anteriores.

A conferência direta das versões encontrou `package.json` com `^4.1.0`, lockfile e runtime com **Vitest 4.1.11**. O intervalo declarado aceita essa versão; não foi encontrada divergência entre runtime e lockfile. Nenhuma dependência foi instalada ou alterada nesta rodada.

O build de produção da integração terminou com saída 0, incluindo os 31 documentos estáticos gerados. A checagem posterior de autenticação passou nos **79 bundles públicos**, sem assinaturas de SDK, tokens ou segredos do servidor. CI e deployment deste novo recorte ainda precisam de resultados próprios.

## Limites externos

A [advisory oficial de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), reconferida em 13/10, continua sem versão corrigida. A mitigação restrita ao lint permanece; #36 não está concluída. O [suporte oficial do ESLint](https://eslint.org/version-support/) mantém a linha 9 como EOL. Não forçar peers incompatíveis ou remover o gate de audit para obter aprovação.

Instalação física Android/iOS, revisão humana e custódia externa da chave continuam adiadas pelo responsável. As provas emulada, sintética ou local não recebem aceite físico. Acompanhamento de #32/#34/#35/#37 e dos épicos mantém os critérios originais; nenhum checklist foi fechado por estas validações parciais.
