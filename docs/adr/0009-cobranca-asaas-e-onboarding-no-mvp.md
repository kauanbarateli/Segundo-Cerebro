# ADR-0009 — Cobrança Asaas e onboarding integram o MVP

Estado: aceita quanto à ampliação de escopo em 18/10/2026 (D-034). Especificação, direção técnica e divisão em 18 tickets aprovadas em D-064; publicação autorizada, sem iniciar implementação.

O mantenedor decidiu ampliar o MVP atual, em vez de criar uma etapa comercial posterior, para incluir entrada pela `/conheca`, assinatura Asaas de R$ 29,90/mês com Pix, cartão ou boleto, criação do cadastro após o primeiro pagamento reconhecido e onboarding facultativo de nove telas. O aceite do MVP passa a precisar dessas entregas, além dos critérios anteriores; isso não constitui implementação ou aprovação das decisões ainda abertas.

## Alternativa e consequência

Adiar a cobrança para depois do MVP reduziria seu corte, mas não corresponde à decisão humana da Q1. D-034 substitui somente a proibição de cobrança de D-011/D-019 e do ADR-0003. Isolamento por Usuário, Entitlement separado de Preferência, Núcleo independente e eventos atômicos permanecem; Drive continua retirado por D-032.

O planejamento distingue autenticação, direito comercial, situação da Cobrança e configuração inicial. Não usar bloqueio administrativo para inadimplência nem interpretar retorno do gateway como prova de pagamento. O ADR-0007 continua exigindo Master para suas operações: a criação automática paga exige contrato próprio a ser definido, sem expor comandos administrativos ao checkout.

## Decisões complementares

- Q2/D-035: conta Asaas de produção em CPF. Não presumir elegibilidade para Pix Automático ou emissão fiscal habilitada.
- D-036: concordância em mudar para Vercel Pro quando necessário à operação comercial. Domínio próprio é distinto de plano; nada foi contratado ou configurado nesta etapa.
- Q3/D-037: checkout próprio para dados, método, Pix e boleto; captura do cartão na fatura hospedada do Asaas. A conciliação com a assinatura e os ciclos seguintes exige homologação futura, sem guardar dados completos de cartão no aplicativo.
- Q9/D-043: preservar o acesso gratuito das contas atuais, incluindo Master, sem retirar vetos/moderação. Conferir o conjunto elegível na execução; não inferir isenção para contas futuras ou por ausência de estado comercial.
- Q11/D-045: Master pode conceder isenção manual, explícita e auditada a novas contas. Isso não é efeito automático do papel ou da criação administrativa.
- Q12/D-046 e Q13/D-047: âncora mensal no primeiro pagamento reconhecido; tolerância até o fim de D+5 e suspensão a partir de D+6 às 00h de São Paulo, calculada no acesso. Ajuste da recorrência será homologado na execução.
- Q14/D-048 e pedido direto/D-049: bloquear os módulos durante suspensão, preservando login e gestão da conta; criar a aba **Assinatura e cobranças** em Configurações, também acessível nesse estado. Não apagar dados por suspensão nem prometer exportador automático como requisito já implementado.
- Q15/D-050: no cancelamento comum, interromper as próximas renovações e preservar acesso até o fim do período já pago. Direitos de arrependimento e reembolso têm tratamento separado, e a execução deve contemplar faturas antecipadas sem apagar dívidas por suposição.
- Q16/D-051: pausar novas mensalidades durante a suspensão, mantendo a cobrança que a motivou para regularização. A pausa deve alcançar também os efeitos de faturas futuras já emitidas.
- Q17/D-052: regularização após suspensão concede mês completo desde o pagamento reconhecido e nova âncora, sem cobrar meses suspensos. Dentro da tolerância, manter calendário. É exceção explícita à regra de não reancorar todo atraso; execução exige conciliação e homologação Asaas.
- Q18/D-053: primeiro vencimento três dias corridos após gerar a cobrança, independente da validade do QR e do ciclo pago. Q19/D-054: comprovar e-mail por link antes de cobrar, sem criar conta Auth antecipada. Q20/D-055: avisos somente por e-mail, com responsabilidades de envio coordenadas.
- Q21/D-056: preservar módulos por 180 dias após o término efetivo do acesso pago ou suspensão sem retorno, com aviso prévio e canal de solicitação de dados. Identidade, registros legais/financeiros e atribuição têm retenção separada; não executar limpeza nem aplicá-la a contas gratuitas/isentas ativas por esta decisão de planejamento.

A [entrevista e suas pendências](../planejamento/16-checkout-asaas-onboarding/README.md) definirá detalhes de atribuição, vínculo seguro de e-mail existente, prazo/revogação de isenções, cancelamento, retenção e persistência/retomada do onboarding. Eventos anteriores à existência do Usuário precisam de desenho explícito; não criar Usuário fictício para satisfazer o modelo atual.

Esta etapa autoriza documentação e planejamento, não construção, aplicação de migrations ou alteração da conta Asaas. A lista de tickets será apresentada para aprovação antes de publicar issues de execução.
