# #78 — classificação do atalho de recorrência

Implementado para revisão em delta posterior aos pacotes congelados de Finance B3. Não há execução local de runtime, compilador, lint, navegador, API ou banco nesta autoria; os testes estão escritos. Não aplica SQL, não muda configurações Vercel e não habilita flags. A instalação e o rollout continuam com Root.

## Comportamento

O atalho **Encerrar recorrência** do detalhe de lançamento conectado consulta uma classificação própria antes de abrir o editor legado. O resultado precisa ser positivo, autenticado e vinculado ao grupo pedido. Grupo legado próprio abre o editor v1 existente; grupo gerido disponível abre seu detalhe na seção Dívidas e contas recorrentes, inclusive se não estiver na primeira página. Grupo gerido indisponível mostra esse estado e permite reconferir por ação humana, sem encaminhar ao v1. Erros 401/403/404/503, timeout ou resposta malformada nunca autorizam o caminho legado. A demonstração conserva o fluxo local existente.

A consulta devolve somente `version`, `group_id`, `kind` e, para `managed`, `available`. Não retorna lançamentos, descrições, contas, recibos ou eventos. Auth, Entitlement e dono esperado precedem o resultado. Grupo inexistente/estrangeiro não recebe classificação legado. O transporte usa GET relativo fixo, cookies same-origin, expected-user header, sem redirect/cache, timeout de 15s e resposta de até 4KiB. Não despacha comandos ou cria intenção financeira.

O sinal servidor `FINANCE_SERIES_V2_SCHEMA_STATE` tem estados fechados `legacy_only` e `classified`. Ausência significa pré-schema `legacy_only`; valor inválido é indisponibilidade. Disponibilidade v2 exige **classified e ENABLED=true**. No pré-schema, a classificação usa apenas a apresentação financeira v1 já instalada, sem chamar RPC desconhecida. Depois da instalação aceita, `classified` permanece mesmo quando a funcionalidade é desligada. Nesse estado, o detalhe v2 existente distingue o grupo gerido do grupo legado próprio; erro de detalhe não simula ausência. O checklist de configuração é proposta separada para revisão Root, sem editar `.env.example` ou o build nesta fatia.

Somente o gateway de commit de `finance.series.stop` é envolvido. O Store v1 também chega ao commit quando o Core encontrou um recibo, por isso o wrapper reconfere o recibo próprio primeiro e devolve seu resultado original antes da classificação atual. Mesmo UUID/corpo não é bloqueado por mudança posterior de configuração. Sem recibo, só a classificação positiva `legacy` permite chamar o commit v1 original, preservando CAS, envelope e resultado. A guarda SQL sob o lock financeiro compartilhado continua sendo a autoridade atômica contra corridas ou bypass; não se alega atomicidade da consulta anterior.

Nenhum DTO financeiro v1, regra Core, SQL histórico ou comando diferente foi alterado. O módulo puro novo de contrato de transporte está em `src/lib/finance-series-classification-contract.ts`; não acrescenta infraestrutura ao Core. Não há fallback para SDK, evento ou comando de outro domínio.

## Interface e cercas

Button compartilhado e estilos existentes preservam os alvos de 44px, foco e temas. A ação tem estado de carregamento, mensagem de resultado/erro e reconsulta explícita. Os consumidores cercam dono, época do provider, geração, serviço e unmount depois de cada await/finally. O encaminhamento ao detalhe também possui sequência local: uma resposta antiga não consome o novo pedido humano nem abre o detalhe anterior em outra sessão. Esse contador não é UUID de comando e nunca é enviado ao servidor.

## Testes escritos e pendências

As suítes novas cobrem pré-schema sem RPCv2, grupo inexistente/estrangeiro, gerido com flag falsa, configuração inválida, DTO fechado, Auth/Entitlement/dono/query, wrapper novo legado/gerido, replay real pelo Core/Store, recibo incorreto, transporte sem fallback e sucesso/erro/timeout tardio após mudança de serviço. O teste anterior da disponibilidade foi ajustado para exigir declaração de schema junto da flag, preservando as negativas de valores diferentes de `true`.

Root precisa revisar o delta, executar typecheck/lint/camadas/secrets e testes no SHA integrado no GitHub, validar o encaminhamento e foco no navegador em 320/390px e nos temas, conferir concorrência e receipt-first na implementação SQL e fazer aceite conectado isolado antes da promoção. A guarda permanece inerte até o consumidor completo e essas evidências existirem. Não fechar #78 pela existência do código ou de fixtures sintéticas.
