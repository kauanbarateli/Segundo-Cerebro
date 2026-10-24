# ADR-0006 — Financeiro fundido e séries finitas

Estado: implementado no Núcleo e preparado em migration versionada; aplicação e validação PostgreSQL posteriores.

## Decisão

O Financeiro mantém a fusão D-006: ciclo de vida e exclusão lógica da v2, pagamento parcial e horizontes da main. Fatura é derivada. `is_paid` é coluna gerada de `paid_cents`; o chamador não escreve esse campo. Um único gatilho de projeção materializa a exceção da compra no cartão sem alterar seu status.

Parcelamento e recorrência finita são N lançamentos com `installment_group_id`, número, total e `serie_tipo`. Não há tabela de recorrência, execução automática ou promessa de série infinita. Parcelamento distribui o total e absorve o resto na última parcela; um pagamento parcial informado é distribuído uma vez. Recorrência repete o valor e conserva ocorrências futuras como planejadas. A competência explicitamente atribuída ao primeiro ciclo é incrementada nas próximas ocorrências e permanece histórica.

Encerrar recorrência exclui logicamente apenas ocorrências a partir de uma data presente/futura e ainda sem pagamento. Ocorrências planejadas/pendentes de cartão são elegíveis apesar do `paid_cents` derivado da exceção; pagamentos de fatura continuam distintos da realização dessas ocorrências. Passado e parcelas já pagas são preservados.

## Atomicidade e acesso

Comandos passam pelo Núcleo usando ports financeiros estreitos. O adapter prepara alterações/eventos/recibo e confirma uma transação CAS no servidor. As RPCs `transfer`, `pay_statement`, `create_series` e `close_account` são restritas a `service_role`, com ator/sessão verificados e Entitlement atual. O navegador envia intenção, nunca batch ou dono. A ordem de locks é Auth → lock por Usuário existente → verificação atual de acesso.

Transferência conserva duas pernas. Pagamento de fatura debita caixa, credita o ciclo selecionado e cria apenas juros/IOF no próximo ciclo quando há saldo remanescente. Não recria o principal em aberto. Arquivar conta preserva todos os lançamentos e a perna da conta sobrevivente. Mudança, eventos e recibo confirmam juntos ou revertem juntos.

## Consequências e limites

O contrato RPC planejado é explicitamente escrito no runtime; não representa tipos gerados de um schema remoto aplicado. A migration e as asserções manuais permanecem separadas. Testes com transportes injetados demonstram o contrato local; a atomicidade SQL e os grants reais dependem da execução posterior das asserções, sempre com rollback. Nenhuma aplicação automática em CI/build/deploy é criada.

Referências: doc 06 §2, doc 13 SPEC-04/T-018/T-019/T-020, ADR-0001/0002/0004; [funções Supabase](https://supabase.com/docs/guides/database/functions) e [colunas geradas PostgreSQL](https://www.postgresql.org/docs/17/ddl-generated-columns.html).

## Extensão de T-053 — séries com metadados, 23/10/2026

Estado desta extensão: candidatos de Núcleo e canal em revisão na #109, dependentes dos limites mensais da #108. A proposta SQL e a interface ainda exigem implementação e validação; nenhuma tabela ou RPC nova foi instalada por essa entrega. As regras anteriores continuam descrevendo os grupos legados e não autorizam inferir âncora ou pagamentos a partir deles.

O protocolo novo preserva os lançamentos financeiros existentes como fonte econômica e acrescenta metadados privados da série e um mapa explícito das ocorrências. A ausência de tabela de recorrência, descrita acima, permanece uma característica do contrato legado; ela não é uma restrição da extensão aprovada na #78 e no pacote 17. Não há conversão automática de grupos antigos.

A definição guarda tipo, frequência semanal/mensal/anual, âncora original, primeira posição registrada, total finito de 2 a 120 posições, término opcional, modelo das próximas ocorrências, estado, revisão e cursor. Cada ocorrência conserva identidade, ordinal, lançamento real e motivo de supressão. A data mensal deriva da âncora com clamp; 29 de fevereiro volta a 29 nos anos compatíveis. Uma ação explícita cria no máximo doze meses, com fim exclusivo. O cursor não consome posições ainda não materializadas ao encontrar um término temporário.

Parcelamento reparte o total original e conserva o resto na última posição; começar na posição 5 não cria nem declara pagas as posições 1–4. O total original parcelado é imutável. Recorrência usa o valor de cada ocorrência e permite mudar somente futuras elegíveis. Histórico pago, parcial, conciliado, passado e exclusão manual permanece protegido. Retomar reexibe as identidades futuras pausadas pela série; essa contagem é separada das novas criações no horizonte escolhido.

Ator, sessão e Entitlement são conferidos antes de qualquer leitura ou resultado. O mesmo lock financeiro do Usuário protege metadados, mapa, lançamentos, revisão, eventos e recibo. Replay da mesma intenção é resolvido antes do CAS; uma intenção nova precisa das revisões financeira e da série vistas na prévia. Alterar fechamento de cartão em outra aba exige reconferência, sem mudar silenciosamente a prévia. Competência já atribuída continua histórica.

O canal v2 recebe intenção, nunca dono, batch ou estado AFTER do navegador. Seus DTOs, eventos e recibos são separados dos contratos v1. O snapshot antigo mantém explicitamente suas cinco espécies financeiras para não falhar diante dos novos metadados. APIs, listas permitidas e leitores globais devem ser reconciliados antes da ativação.

Realização/pagamento de uma ocorrência comum exige estado e valor pago explícitos; realizar compra no cartão não paga sua fatura. O endpoint e o consumidor de quitação parcial/total precisam estar disponíveis antes de ativar guardas que recusem operações v1 em linhas geridas. Um permit interno, se necessário, será de uso único e vinculado a ator/linha/BEFORE/AFTER/transação; não será uma credencial do navegador. Grupos legados mantêm seu caminho anterior.

Persistência e rollout dependem de proposta SQL revisada, migration nova versionada, asserções, concorrência nativa, catálogo, tipos oficiais, compatibilidade com backup/restore e interface conectada. CI, build e deploy não instalam schema. Não há cron infinito, contratação comercial ou integração Asaas nesta extensão.
