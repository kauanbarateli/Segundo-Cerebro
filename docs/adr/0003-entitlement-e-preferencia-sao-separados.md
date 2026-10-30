# ADR-0003 — Entitlement e Preferência são separados

> Estado atualizado em 26/10/2026: os parágrafos datados preservam a evolução da decisão. Implementação e aceites posteriores estão reconciliados no [doc18](../planejamento/18-convergencia-prototipo-20261025/01-diagnostico.md). Não tratar status offline/pendente histórico como ausência atual de código. Comercial fica fora desta execução por D-077; onboarding permanece no MVP. Nenhum novo aceite de produção é concedido aqui.

Estado: distinção Entitlement/Preferência preservada. A restrição histórica de ausência de billing no MVP (D-011/D-019) foi substituída em 18/10/2026 por D-034 e pelo [ADR-0009](0009-cobranca-asaas-e-onboarding-no-mvp.md).

## Decisão

Entitlement determina o direito do Usuário a uma Funcionalidade. Preferência determina se ela aparece e em qual ordem. São conceitos, estruturas e caminhos de atualização separados: o Usuário edita Preferência, nunca seu próprio Entitlement.

O Plano Pessoal é implícito: concede as Funcionalidades por padrão, com concessões ou vetos individuais para beta e disponibilidade. Não requer cobrança, assinatura ou catálogo comercial de planos.

Esse parágrafo descreve a política original e o comportamento anterior à ampliação comercial. D-034 inclui cobrança no MVP planejado; D-043 preserva gratuitas as contas atuais e D-045 permite isenção explícita e auditada pelo Master. O contrato técnico dessa convivência ainda está em entrevista. Não inferir isenção por ausência de estado comercial, conversão automática ou remoção dos vetos existentes.

## Motivo

O `user_modules` do legado representava visibilidade e ordem. Reutilizá-lo como autorização tornaria o direito de acesso editável pelo próprio Usuário e deixaria ambíguo o significado de “desligado”. A ausência de cobrança não elimina essa distinção de segurança.

## Consequências

A navegação considera Entitlement ∩ Preferência. O servidor verifica Entitlement em cada operação, inclusive quando a chamada contorna a UI. Esconder uma Funcionalidade por Preferência não é revogação de acesso; eventual veto de Entitlement precisa bloquear operações diretamente.

Caso a política comercial mude no futuro, o resolvedor poderá receber outra fonte, sem reinterpretar Preferências existentes. A mudança de produto exige decisão específica, não a criação antecipada de billing.

Essa decisão específica foi tomada em D-034. O contrato da nova fonte comercial, sua precedência e a validação equivalente nas operações e no banco continuam em planejamento; este registro não afirma sua implementação.

Origem: ADR-0003 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [D-011 e D-019](../planejamento/registro-de-decisoes.md); [arquitetura proposta](../planejamento/02-arquitetura-proposta.md), §2.2.
