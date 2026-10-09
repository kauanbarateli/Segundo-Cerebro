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
