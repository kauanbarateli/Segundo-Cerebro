# Financeiro f91 — seis envelopes qualificados

**VALIDADO pelo Root:** quatro originais completos do CI, seis envelopes, 46 observações de casos N12+D3/I8, Source `f91ae89fde384d798f933e5be84b9e54ab1152b7`, árvore `2c538f84d8117125dafbead0ddf018aae728e9a4`. O [recibo público](evidence/finance-f91-qualified-20261025.json) delimita esse aceite. Não substitui a [coorte fe04](ci-fe04-20261025.md), os negativos hospedados ou um ensaio de restore.

| Evento / run | Job | Envelopes |
| --- | --- | --- |
| [push 40193823356](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40193823356) | 121170276912 | N12, 12 casos; D3, três casos |
| mesmo push | 121170955327 | I8, oito grupos |
| [PR 40193826754](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40193826754) | 121170287223 | N12, 12 casos; D3, três casos |
| mesma PR | 121170830314 | I8, oito grupos |

Os originais tiveram EOF natural, saída zero e limites de transporte preservados. A extração conferiu o JSON bruto antes de projetá-lo, recusando duplicatas inclusive escapadas, cenários desconhecidos, formatos e contagens inesperados, valores fora dos limites e relatórios fora da etapa produtora. Metadados de job/step, timestamps, janela e checkout observado foram vinculados aos mesmos originais. Não foi necessária uma segunda coleta.

## Contratos, fontes e limpeza

Os três validadores puros foram obtidos da própria Source f91 e aprovados para os seis envelopes completos. Foram exigidos os estados dos casos, contagens específicas de cada confronto, ausência de `unknown`, escritas incertas e pending, limitações falsas e cleanup completo reportado. Os campos compartilhados entre N12 e D3 no mesmo job e os inventários entre push/PR também coincidiram.

Root executou dez controles puros do extrator e 28 do qualificador, todos aprovados, incluindo recusas de matriz, fontes omitidas, duplicadas e fora do namespace, divergência de dependências, pending e cleanup. Depois executou a qualificação completa em Node24.19.0, heap128, e o vínculo por `git cat-file --batch`, com saída zero e stderr vazio. Não iniciou PostgreSQL, SDK, Next ou navegador para repetir os ensaios nativos localmente.

Os **187 membros de Source** foram derivados pelo fechamento dos imports/entradas, vinculados a bytes e SHA-256 dos blobs Git f91, sem exceções `node_modules` nesse inventário. As **45 dependências** foram conferidas pelo grafo e lock da mesma Source, incluindo o sentinela vazio `server-only`. Essa é a evidência das dependências reportadas pela instalação do CI; não afirma uma verificação independente dos tarballs do registry ou da instalação local compartilhada.

Nos dois jobs de PR, o checkout efetivamente observado é `c8e0ddf40b473afd8881f4a2972a48444a7ef2ad`. Uma única consulta original do commit confirmou a árvore f91 e, na ordem, os pais Main336e e f91. Os jobs push observaram diretamente f91. Não se confundiu o head da API com o checkout de merge.

## Alcance e pendências

Os produtores usaram Node24.21.0, CLI2.120.0 e PostgreSQL17.11. O escopo é **histórico001–026 mais companions financeiros pinados**, com N12, D3 e I8. Não é instalação direta observada da migration027 canônica. D3 comprovou o confronto pelo gate stale correspondente; o ramo de insuficiência financeira do SQL não foi observado por esse resultado. Não transformar esse ramo em PASS.

A observação não aceita HTTP/app hospedado, bytes de Storage em homologação, duas identidades conectadas, replay/CAS remoto, mobile físico, interface completa, restore ou produção. A validação continua vinculada a f91; os quatro jobs financeiros verdes de fe04 precisam dos próprios envelopes para esse nível de qualificação. O resultado geral de f91 também conserva a falha histórica isolada de Recovery.

As issues #77/#78/#79 mantêm os critérios conectados e humanos ainda pendentes. Nenhuma migration foi aplicada, dado QA apagado, issue encerrada, merge ou deploy de produção executado para essa qualificação.
