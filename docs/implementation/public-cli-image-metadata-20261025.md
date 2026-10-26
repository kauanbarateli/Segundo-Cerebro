# Observação pública da imagem PostgreSQL do CI — 25/10/2026

Este lote acrescenta uma leitura dos metadados públicos da imagem do banco já pertencente ao job descartável de Avatar. O propósito é identificar a imagem executada antes de vincular o ambiente público do restore. Não acessa backups, Operations, perfis privados ou bancos hospedados; não executa restore.

## Implementado e revisado

O runner captura o `imageId` somente depois de admitir o lease do container DB e aguarda a admissão dos cinco containers esperados. Antes do primeiro SQL ou fixture, executa uma vez `docker image inspect`, com template fixo restrito a `RepoDigests`, `Os`, `Architecture` e `Id`. Não lê configurações, variáveis, mounts ou labels da imagem.

O adaptador conserva o executor compartilhado e seu rastreamento de processos. Um marker exclusivo e sincronizado precede a chamada; saída e marker impedem repetição. O ambiente do filho contém somente PATH, LANG, LC_ALL, TZ e NO_COLOR. Há limites independentes de 64 KiB para stdout e 4 KiB para stderr; stderr é contado, sem retenção de conteúdo. O prazo total de 15 segundos inclui preparação, comando, confirmação do grupo, leitura e admissão final.

Uma observação exige spawn natural, fechamento de stdin, EOF natural de ambas as saídas, exit/close únicos com código zero e ausência de sinal, confirmação do grupo próprio e leitura do mesmo descritor exclusivo. Chamar o executor ou receber seu callback inicial não prova que o processo nasceu. EOF sintético, JSON ambíguo, duplicação de chaves, campos extras, UTF-8 inválido ou expiração recusam a observação.

O resultado é um companion separado. O DTO principal, SQL, migrations, workflows, guardas de execução, deadlines globais e rotinas de limpeza anteriores não mudam. Uma recusa segue o encerramento conservador existente. As duas listas de Sources incluem os quatro arquivos novos; a previsão estática passa de 97 para 101 Sources, com as 45 dependências preservadas. O inventário nativo da nova Source ainda precisa confirmar esses valores.

## Validado localmente

Revisão independente do pacote V3: manifesto `a1ec13a639ca5509712031de147f5386baeecc8a59321299871ebd47a2fa33c0`, patch `04a1521ab26dc9ea26c545b6d352e8d394a5c218c9b08f5b92e55f4980cd1757`. Os cinco arquivos, seus hashes e o espelho de 101 Sources foram conferidos. O peer aprovou estaticamente o delta, preservando as versões anteriores.

Root executou cinco verificações de sintaxe e **20/20 testes puros**, com Node 24.19.0, limite de heap de 64 MiB e um processo por vez. O lint dos cinco arquivos alterados passou sem avisos; o scanner final verificou 2.597 arquivos versionáveis sem achados, ambos com heap limitado a 128 MiB. Sem Docker, SDK de cliente, PostgreSQL, rede ou credenciais. Os testes exercitam as funções reais com filho/executor sintéticos e arquivos temporários próprios; isso não é execução nativa.

Foram preservadas duas falhas do ambiente local: `mkdtemp` recusou o caminho temporário longo do Windows e, usando caminho curto, o sandbox recusou a criação da junction. Os mesmos arquivos passaram 20/20 ao executar fora dessa restrição, mantendo as guardas de propriedade antes da remoção temporária. Nenhum teste foi ignorado ou afrouxado; não se afirma correção de produto a partir dessas duas falhas.

## Pendente e limites

O próximo SHA exige seus checks no GitHub, incluindo lint, regressões, inventário e execução Avatar. Os checks verdes do código `3403a5aa1901c166e6cfc1206848bfdc1c34957a` e do commit documental `f39b76f078dac2cdd770a0fdd32d235af9a42107` não são execução deste lote.

O checker estático com TypeScript 5.9.3 confirmou os hashes dos 101 arquivos, os quatro novos literais nas duas composições e a sintaxe dos cinco deltas. A fila de imports relativos `.mjs` parte das duas raízes reais do runner: 20 arquivos e 31 arestas; os outros 81 são membros de hash, sem alegação de execução. O checker inicial percorreu indevidamente também esses seeds e recusou uma dependência de `scripts/test-local-sql.mjs`; a recusa foi preservada e o recorte corrigido para o contrato efetivo, sem acrescentar Sources ou mudar o produto. Não foi executado o coletor nativo nem importado o SDK por essa conferência.

Mesmo uma observação bem formada mantém `STOP_ROOT_REVIEW_REQUIRED`. `imageId` não é tratado como digest de manifest; índice versus plataforma, origem/build público, bootstrap e extensões ainda precisam dos vínculos previstos. A observação não qualifica baseline, fixture, ensaio de restore, aceites hospedados ou produção. As [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) e [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42) continuam abertas. Merge e deploy de produção permanecem bloqueados.
