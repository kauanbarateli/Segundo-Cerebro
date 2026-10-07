# ADR-0003 — Entitlement e Preferência são separados

Estado: adotado com a conciliação D-019; sem billing no MVP (D-011).

## Decisão

Entitlement determina o direito do Usuário a uma Funcionalidade. Preferência determina se ela aparece e em qual ordem. São conceitos, estruturas e caminhos de atualização separados: o Usuário edita Preferência, nunca seu próprio Entitlement.

O Plano Pessoal é implícito: concede as Funcionalidades por padrão, com concessões ou vetos individuais para beta e disponibilidade. Não requer cobrança, assinatura ou catálogo comercial de planos.

## Motivo

O `user_modules` do legado representava visibilidade e ordem. Reutilizá-lo como autorização tornaria o direito de acesso editável pelo próprio Usuário e deixaria ambíguo o significado de “desligado”. A ausência de cobrança não elimina essa distinção de segurança.

## Consequências

A navegação considera Entitlement ∩ Preferência. O servidor verifica Entitlement em cada operação, inclusive quando a chamada contorna a UI. Esconder uma Funcionalidade por Preferência não é revogação de acesso; eventual veto de Entitlement precisa bloquear operações diretamente.

Caso a política comercial mude no futuro, o resolvedor poderá receber outra fonte, sem reinterpretar Preferências existentes. A mudança de produto exige decisão específica, não a criação antecipada de billing.

Origem: ADR-0003 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [D-011 e D-019](../planejamento/registro-de-decisoes.md); [arquitetura proposta](../planejamento/02-arquitetura-proposta.md), §2.2.
