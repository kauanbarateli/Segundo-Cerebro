# Avatar — diagnóstico passivo da preparação do CI

O original próprio de b900, [run40222181848/job121255942564](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40222181848/job/121255942564), registra `CASE_FAILED`, fase `stack`, zero migrations aplicadas, zero checks de catálogo e `caseReport=null`. O checkout b900 consta na linha123; o relatório, na488. O caso de upload não começou. Isso não identifica qual comando falhou nem prova que a stack não foi criada. Os checks de grupo e limpeza falsos também não identificam a causa: o wrapper existente fecha seu latch em qualquer rejeição.

Root coletou o original uma vez:64.828bytes, SHA-256 `260661dca1bc4b4e47501dfe79ded2ee9056e361fca2b3f8cea0b3b92102c939`, recibo `3f94aae547df41c033602630b40c4b0e2142cb22637e75ae40d03b3a3c8e1278`. Transporte EOF/exit0 não significa sucesso do ensaio. [Resultado completo da coorte](ci-b900-20261025.md).

## Delta implementado para a próxima execução

O runner pode emitir um único registro auxiliar de seis campos: versão, cenário, SHA da Source, fronteira nominal, código de processo de uma lista permitida e `groupConfirmed` booleano ou nulo. As sete fronteiras cobrem start, status e as inspeções de DB, Kong, Auth, REST e Storage. A observação lê somente dados próprios; não avalia getters, proxies, mensagens, stacks, argumentos, ambiente ou streams.

O registro é ligado à referência interna do relatório por WeakMap e consumido antes da emissão. Falha de seu writer não substitui o relatório principal ou seu exit. O DTO principal, primeiro erro, latch de grupos, argumentos, prazos, limites, quiescência, cleanup e ausência de retry permanecem preservados. O novo módulo entra no inventário explícito de Sources. Esperam-se97Sources e45dependências; a coleta real do próximo CI ainda precisa confirmar esse conjunto e seus blobs.

## Revisão e validação

Autor, peer e Root revisaram os três paths. O primeiro controle novo de Proxy falhou no próprio `assert.rejects`, cuja função assíncrona assimilava a razão Proxy como um valor e acessava `then`. O resultado V1,7PASS/1FAIL, foi preservado; não foi atribuído ao recorder. A V2 troca somente esse controle por captura local da rejeição e igualdade da mesma referência, mantendo zero leituras/traps e o latch fechado.

Root executou os **oito controles novos:8PASS**, stderr0, Node24/heap64, processo único e reporter TAP. O loader usou o trecho real dos novos testes, com imports restritos a Node e ao helper; os corpos reais de run/main e os três arquivos espelhados têm bytes do freeze. Não importou o runner completo, SDK, processos nativos ou banco. As três sintaxes também passaram. Isso não é execução dos17 testes completos, QA do grafo, ensaio Avatar ou prova de quiescência real.

Freeze V2 `52cc97adbed407bd2cc1d7a33f53b933e12a3e5a37524c7283e98e678214f046`; patch `b8100c5d41e6e78efbb0bfb226f353d61fed0f72376a27c153976d9d0ed75b36`; peer `746374121de05410a26f2941cb691f355890f68c390b8ef747f1f10e004f344f`; stdout Root `ba3d97989f604d8b20c979989100ba521815302235b28ef8553c35fa414804e0`.

**Pendente:** CI próprio, suíte completa, Source inventory e eventual observação auxiliar. O diagnóstico não cobre falhas de decode/ownership após um processo bem-sucedido; ausência de registro auxiliar não concede aceite. Não há correção comprovada da causa de b900. Nenhum acesso hosted, alteração de schema remoto, merge, produção, backup ou restore ocorreu.
