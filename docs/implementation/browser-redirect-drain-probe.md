# Contraste público de GET direto e redirect

Produtor novo e manual, separado dos testes Auth. Não usa aplicação Next, banco, Supabase, e-mail, credenciais, cookies de usuário ou endpoints do produto. Implementado em quatro arquivos novos; nenhum spec, gate de limpeza ou autoridade do relay Auth foi alterado. Root ainda precisa revisar, executar QA própria, publicar, fazer um único dispatch e preparar um leitor original novo. O implementador não executa navegador, HTTP ou workflow.

## Pergunta e limites

O fence só reduz callbacks futuros de route. O experimento compara uma leitura GET já continuada diretamente com uma que chegou ao mesmo endpoint público por um único 303. Ele mede também recebimento/conclusão do servidor e prova de fechamento da fonte antes da decisão. Isso não atribui causa às pendências Auth 801b.

Cada caso tem servidor e contexto próprios: controle finito, GET direto retido e GET com redirect retido. O fetch consome `arrayBuffer()` quando a resposta chega, sem aguardar o body para estacionar. Não há interceptação por Service Worker, cache, writes, login ou requests POST. Depois de receber o endpoint retido, arma o fence original, permanece online, usa stopLoading e blank, fecha a fonte própria e espera terminais originais. O controle recebe seu corpo finito antes de fechar a fonte; seu EOF natural deve ser observado antes de qualificar a matriz.

## Identidade e recusa conservadora

O ledger guarda os objetos Request originais. A ligação root/target exige `target.redirectedFrom() === root` e `root.redirectedTo() === target`. Não há casamento por URL ou tempo; paths fixos selecionam somente a função pública da request. Duplicatas de callback/terminal ou linhagem incompatível recusam, sem deduplicação artificial. O GET direto e o root do redirect precisam de um callback e seu ACK original de `continue`. Um redirect pode continuar sem callback de route para o target; esse número zero é observado, não inventado. Se houver callback do target, seu ACK também é necessário.

O observador CDP é o existente, com pins públicos exatos. Suas ambiguidades permanecem intactas. Como redirects podem reutilizar um ID de rede e esse observador não certifica múltiplos hops, o caso redirect pode terminar `INCONCLUSIVE/PROTOCOL_UNAVAILABLE` mesmo quando houve terminais públicos. Essa é uma limitação deliberada: os contadores de origem/route/linhagem continuam úteis, mas a ambiguidade não vira prova de terminal ou sucesso. Não se apaga o mapa interno do Playwright nem se emite evento artificial.

## Runtime e orçamento

Linux x64, Node `v24.19.0`, Playwright `1.63.0`, Chromium `153.0.8010.12`, revisão `1243`. Reutiliza os quatro pins públicos de `FENCE_PUBLIC_PINS` e confere bytes/hash/arquivo real antes de abrir serviços. Recusa `.env` além do exemplo e ambiente mais amplo que a allowlist. Import e `--help` não iniciam serviços.

Um único deadline absoluto de 15.000 ms por caso inclui startup e estacionamento; o fence, a fonte e o drain não renovam o prazo. Relógio regressivo/não finito veta. Um callback antecipado a 14.999 ms não produz `PENDING`. O primeiro código de falha permanece registrado; outra recusa depois do timeout também impede qualificação como `PENDING`. A decisão sela contadores/protocolo antes de cancelar ou limpar. Cleanup tem cinco segundos próprios, exige encerramentos observados e não pode alterar a decisão anterior. Cleanup incompleto impede o caso seguinte.

## Relatório fechado

Somente enums, contadores, tempos relativos e flags. Não expõe URLs, IDs de protocolo, conteúdo, bodies, stack ou mensagens de fornecedor. No máximo 16 requests/sockets/counters e 16 KiB por relatório. Portas injetadas são sempre modo `synthetic`; somente a fábrica interna recebe `native`. JSON/validator é projeção, não capacidade ou aceite do aplicativo.

- `CONTROL_PASSED`: resposta finita, terminais público/CDP correspondentes, fonte comprovadamente fechada, prazo válido.
- `DRAINED`: terminais originais correspondentes do GET final e todos os Requests públicos concluídos antes do prazo, sem body do endpoint retido.
- `PENDING`: no deadline real, somente o target continua pendente nos dois canais, com identidade exata e a mesma entrada/sessão; fonte fechada e fatores íntegros.
- `INCONCLUSIVE`: contrato incompleto ou CDP ambíguo; não é PASS de Auth.
- `REFUSED`: fonte, autoridade, relógio, limite ou protocolo recusados.
- `NOT_RUN`: controle ou cleanup anterior não qualificado.

`applicationAccepted=false` e `diagnosticOnly=true` permanecem sempre. Workflow success exige os três resultados qualificados e todos os cleanups; uma recusa ou inconclusão legítima produz failure diagnóstico. Nenhum resultado fecha issues ou comprova limpeza de dados.

## Validação e próxima operação

QA própria em Node `v24.19.0`, serial e exclusivamente em RAM: **21/21 PASS**, zero skips, `395,9455 ms`. Lint dos dois `.mjs`: PASS, zero warnings. Os casos cobrem linhagem exata, duplicatas, controle finito, source close sem prova, terminais no cleanup, janela e clocks, timer antecipado em ambos os candidatos, CDP ambíguo, veto tardio antes e depois do timeout, contadores introduzidos em microtask, argumentos/relatório sem getters e bloqueio da matriz. A fixture injetada nunca recebe modo `native`. Esses resultados não são aceite hospedado nem validação de Auth.

Nenhum navegador, listener HTTP, workflow ou conexão foi iniciado pelo implementador. Root precisa revisar os quatro pins finais e obter verificação própria antes da publicação. O workflow fixa Node `24.19.0`; os pins públicos existentes continuam exigindo Playwright/Chromium exatos.

O workflow só tem `workflow_dispatch`, conteúdo de leitura e nenhum secret/artifact. Não foi disparado. A futura captura será única, via job REST original, com binding/paths novos; capturas anteriores permanecem encerradas. Se esse contraste não responder a dúvida, decidir outro recorte público antes de repetir runs ou alterar o produto.
