# Pesquisa — cobrança recorrente com Asaas (18/10/2026)

**Estado:** insumo de planejamento. Não é decisão aprovada nem autoriza implementação. A cobrança continua fora do escopo vigente até o mantenedor registrar a decisão correspondente (ver §1).

**Como foi coletado:** buscas na documentação oficial do Asaas (`docs.asaas.com`), na central de ajuda e em fontes de comparação. O ambiente da pesquisa não abriu as páginas diretamente; cada item cita a página de origem e precisa ser conferido nela e no sandbox antes de virar contrato.

**Legenda:**
- **[doc]** confirmado na documentação oficial do Asaas.
- **[terceiro]** fonte não oficial (blog de parceiro, relato, comparador).
- **[verificar]** não confirmado; testar no sandbox ou ler a página antes de usar.
- **RECOMENDADO** proposta desta pesquisa, sem aprovação.

---

## 1. Escopo e restrições do projeto

- **Cobrança está fora do escopo aprovado.** D-011 ("uso pessoal + pessoas próximas, sem cobrança"), [ADR-0003](../adr/0003-entitlement-e-preferencia-sao-separados.md) ("sem billing no MVP") e [CONTEXT.md](../../CONTEXT.md) ("sem cobrança no MVP").
- **O gatilho já estava previsto** no [roadmap](../planejamento/12-roadmap.md): "billing/planos reais (gatilho: primeiro usuário pagante à vista — a estrutura de entitlements já espera; sair do Vercel Hobby junto)".
- **Antes de implementar:** nova decisão no [registro de decisões](../planejamento/registro-de-decisoes.md), ADR de cobrança, atualização do glossário (Assinatura, Cobrança, Inadimplência, Período de tolerância) e tickets no GitHub Issues.
- **Hospedagem:** o plano Hobby da Vercel é para uso não comercial; a mudança de plano acompanha a cobrança.
- **Regras do AGENTS.md que se aplicam:**
  - Toda escrita de domínio grava evento na mesma transação.
  - Alteração de banco só por migration versionada, aplicada de forma supervisionada conforme OP-009.
  - Segredos fora do Git e de pastas sincronizadas.
  - Adapters implementam integrações; rotas e Actions são canais finos que chamam casos de uso de `src/core/`.

## 2. Fluxo de negócio pedido pelo mantenedor

1. A pessoa entra no funil e escolhe pagar R$ 29,90 por mês com Pix, cartão ou boleto.
2. Após o **primeiro pagamento**, a conta é criada automaticamente.
3. Com a conta criada, ela segue para o onboarding (a desenvolver).
4. Todo mês recebe a cobrança no método escolhido.
5. Pagamento recebido: o acesso continua.
6. Sem pagamento até **5 dias após o vencimento**: o acesso é bloqueado.

## 3. Ambientes, autenticação e credenciais

| Item | Sandbox | Produção | Fonte |
|---|---|---|---|
| URL base | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` | [doc] Autenticação |
| Prefixo da chave | `$aact_hmlg_` | `$aact_prod_` | [doc] Authentication |
| Header da chave | `access_token: <chave>` (não usar `Authorization: Bearer`) | igual | [doc] Autenticação |

- **User-Agent obrigatório** para contas raiz criadas a partir de 13/06/2024. Enviar um valor que identifique a aplicação. [doc]
- Chave e URL precisam ser do mesmo ambiente. Erros: `access_token_not_found` (sem header) e `invalid_environment` (chave de outro ambiente), ambos 401. [doc]
- Até **10 chaves por conta**, cada uma com nome, data de expiração e opção de desativar. Chave apagada não volta. [doc]
- TLS 1.2 e 1.3 (1.3 recomendado). [doc]
- A documentação recomenda variáveis de ambiente ou cofre de segredos, nunca código, front-end, logs ou repositório. [doc]
- Existe webhook para eventos de chaves de API (criada, ativada, desativada, apagada). [doc]

**RECOMENDADO para este repositório:**
- Variáveis somente de servidor, sem prefixo `NEXT_PUBLIC_`: `ASAAS_API_URL`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`. Acrescentar só os nomes, sem valores, ao `.env.example`.
- Na Vercel: chave de produção apenas em Production; chave de sandbox em Preview e Development. Localmente, `.env.local` (já ignorado pelo `.gitignore`).
- Recusar na inicialização uma combinação de URL e prefixo de chave de ambientes diferentes, no padrão de `scripts/check-build-env.mjs`.
- Acrescentar ao `scripts/check-secrets.mjs` uma regra para chaves `$aact_prod_`/`$aact_hmlg_`; hoje o scanner não as reconhece.
- O mantenedor já tem as chaves de produção e de sandbox. **Elas não devem aparecer em issue, chat, commit ou neste arquivo.** Se uma chave vazar, gerar outra e apagar a antiga no painel.

## 4. Clientes (`/v3/customers`)

- Criação: `POST /v3/customers`; a resposta traz o `id` do cliente, que deve ser guardado. [doc]
- `cpfCnpj` é o documento e o critério comum de duplicidade. Se é obrigatório: [verificar]. Para cobrar boleto, o documento é necessário na prática. [verificar]
- `externalReference`: identificador no seu sistema, "altamente recomendado". [doc]
- `notificationDisabled`: desliga as notificações do Asaas para o cliente. [doc]
- **A API aceita clientes duplicados.** Buscar por `cpfCnpj` ou `externalReference` antes de criar. [doc]

## 5. Assinaturas (`/v3/subscriptions`)

### Criação
- `POST /v3/subscriptions` com `customer`, `billingType`, `nextDueDate`, `value`, `cycle` e `description`. [doc]
- `nextDueDate` é o vencimento da primeira cobrança. [doc]
- `cycle`: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUALLY`, `YEARLY`. [doc]
- `externalReference` recomendado para ligar a assinatura ao seu sistema. [doc]
- Multa, juros e desconto são objetos: `fine` e `interest` (`value`, `type`) e `discount` (`value`, `dueDateLimitDays`, `type`). [doc]
- **Criar a assinatura não significa pagamento recebido.** [doc]
- `billingType`: `BOLETO`, `CREDIT_CARD` e `PIX` confirmados. `UNDEFINED` (o pagador escolhe na fatura) está confirmado para cobranças avulsas e links de pagamento; **para assinaturas: [verificar]**.

### Geração das cobranças
- Cada cobrança da assinatura é criada **40 dias antes do vencimento** por padrão, configurável na conta para 14 ou 7 dias. [doc]
- Consequência: logo após um pagamento já costuma existir a cobrança do mês seguinte em aberto. **Cobrança pendente ainda não vencida não é inadimplência.** [doc + inferido]
- Relato de terceiro: ao gerar a cobrança, o Asaas avança o `nextDueDate` da assinatura para o ciclo seguinte. O próximo vencimento real é a cobrança pendente mais próxima, não o `nextDueDate`. [terceiro, verificar]
- `GET /v3/subscriptions/{id}/payments` lista apenas as cobranças já geradas. [doc]

### Alteração, pausa e remoção
- `PUT /v3/subscriptions/{id}` altera a assinatura. Por padrão a mudança vale para as próximas cobranças; `updatePendingPayments` estende às pendentes já geradas. [doc]
- Pausa temporária: atualizar com status `INACTIVE` em vez de remover. [doc]
- `DELETE /v3/subscriptions/{id}` encerra a recorrência e **apaga as cobranças pendentes ou vencidas**; as pagas ficam no histórico. [doc]
- Valores de status (`ACTIVE`, `INACTIVE`, `EXPIRED`): [verificar] na referência do objeto.
- `GET /v3/subscriptions` serve para conciliação (`includeDeleted`, `deletedOnly`). A documentação desaconselha consultas repetidas no lugar de webhooks. [doc]

### Cartão de crédito
- A assinatura com cartão recebe `creditCard` e `creditCardHolderInfo`, ou `creditCardToken`, mais `remoteIp`, que deve ser o IP do cliente e não o do servidor. [doc]
- O cartão é validado na criação, o que não garante a aprovação das cobranças futuras. [doc]
- Tokenização: `POST /v3/creditCard/tokenizeCreditCard`. O token fica vinculado ao cliente. Em produção **depende de habilitação** pelo Asaas. [doc]
- Alterar valor ou vencimento de assinatura com cartão exige tokenização habilitada. [doc]
- Troca de cartão sem cobrar: `PUT /v3/subscriptions/{id}/creditCard`; as cobranças pendentes passam a usar o novo cartão. [doc]
- Novas tentativas quando o cartão é recusado: 3 no dia do vencimento, a cada 6 horas, e mais 2 a cada 24 horas; depois, a cobrança fica vencida. [terceiro: blog Asaas; verificar]
- **Preferir a fatura do Asaas (`invoiceUrl`) para captar o cartão.** Assim o número do cartão não passa pelo servidor do projeto (menor escopo de PCI). RECOMENDADO

### Nota fiscal (NFS-e) automática
- `POST`/`PUT`/`DELETE /v3/subscriptions/{id}/invoiceSettings`. [doc]
- `effectiveDatePeriod`: `ON_PAYMENT_CONFIRMATION`, `ON_PAYMENT_DUE_DATE` ou `BEFORE_PAYMENT_DUE_DATE` (5, 10, 15, 30 ou 60 dias). `taxes` é obrigatório. [doc]
- A configuração não garante autorização da prefeitura; acompanhar `INVOICE_AUTHORIZED` e `INVOICE_ERROR`. [doc]

## 6. Cobranças (`/v3/payments`)

- `invoiceUrl` é a fatura hospedada pelo Asaas. Com `billingType` `CREDIT_CARD` ou `UNDEFINED`, a fatura oferece cartão (e débito). [doc]
- `callback.successUrl` redireciona após pagamento por cartão, débito e Pix; **boleto não redireciona**. [doc]
- **O redirecionamento não confirma pagamento.** Só o webhook confirma. [doc]
- QR Code Pix: `GET /v3/payments/{id}/pixQrCode` devolve `encodedImage` (Base64), `payload` (copia e cola) e `expirationDate`. Aceita cobranças `PIX`, `BOLETO` e `UNDEFINED`. [doc]
- Sem chave Pix cadastrada, o QR vale só até 23:59 do dia, e essa opção será descontinuada. **Cadastrar uma chave Pix na conta.** [doc]
- Linha digitável: `GET /v3/payments/{id}/identificationField`. Buscar de novo após `PAYMENT_UPDATED`, porque muda com valor ou vencimento. [doc]
- GET com corpo não vazio pode receber 403. [doc]
- Estorno: Pix aceita estorno integral ou vários parciais; `DELETE /v3/payments/{id}` não é estorno. [doc]

## 7. Asaas Checkout (alternativa à fatura)

- `chargeTypes`: `DETACHED`, `INSTALLMENT` ou `RECURRENT`; `RECURRENT` exige o objeto `subscription` (`cycle`, `nextDueDate`, `endDate`). [doc]
- **`billingTypes` do Checkout aceita apenas `PIX` e `CREDIT_CARD` — não aceita boleto.** O exemplo oficial de assinatura usa só cartão; se `RECURRENT` aceita Pix: [verificar]. [doc]
- `callback` com `successUrl`, `cancelUrl` e `expiredUrl`; `minutesToExpire` entre 10 e 1440. [doc]
- Eventos: `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`. [doc]
- Como o boleto é um requisito, o caminho mais provável é **criar cliente e assinatura pela API e enviar a pessoa para a `invoiceUrl` da primeira cobrança**. RECOMENDADO

## 8. Webhooks

### Configuração e entrega
- `POST /v3/webhooks` com `url`, `email`, `enabled`, `interrupted`, `authToken`, `sendType` (`SEQUENTIALLY` ou `NON_SEQUENTIALLY`) e a lista de `events`. Até **10 webhooks por conta**. [doc]
- O `authToken` chega no header **`asaas-access-token`**. Se não for enviado, o Asaas gera um; o valor só aparece na criação. [doc]
- Entrega **at least once**: o mesmo evento pode chegar mais de uma vez. Usar o `id` do evento para idempotência. [doc]
- **Só HTTP 200 conta como sucesso.** 201, 204, 3xx, 4xx e 5xx contam como falha. Tempo máximo de resposta: **10 segundos**. [doc]
- **Após 15 falhas consecutivas a fila daquele webhook é interrompida.** Os eventos ficam guardados, mas são apagados depois de 14 dias, e a fila precisa ser reativada. [doc]
- IPs de origem em produção: 52.67.12.206, 18.230.8.159, 54.94.136.112 e 54.94.183.101; o sandbox pode usar outros. User-Agents `Asaas_Prod/3.0` e `Asaas_Sandbox/3.0`. [doc]
- Na Vercel, validar o token é mais prático que filtrar IP.

### Eventos de cobrança (seleção) [doc]
| Evento | Significado |
|---|---|
| `PAYMENT_CREATED` | Cobrança gerada. A página indica uma exceção para cobranças de assinatura: [verificar] se o webhook chega para elas. |
| `PAYMENT_UPDATED` | Valor ou vencimento alterado. |
| `PAYMENT_CONFIRMED` | Pagamento efetuado, saldo ainda não disponível. |
| `PAYMENT_RECEIVED` | Valor disponível na conta Asaas. |
| `PAYMENT_OVERDUE` | Cobrança vencida. |
| `PAYMENT_DELETED` / `PAYMENT_RESTORED` | Removida / restaurada. |
| `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS` | Estornos. |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Falha na captura do cartão. |
| `PAYMENT_AWAITING_RISK_ANALYSIS`, `PAYMENT_APPROVED_BY_RISK_ANALYSIS`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Análise manual de risco do cartão. |
| `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` | Chargeback. |

Lista completa: página "Eventos para cobranças".

### Sequências que afetam a regra de acesso [doc]
- **Cartão:** `PAYMENT_CONFIRMED` no pagamento e `PAYMENT_RECEIVED` cerca de **30 dias depois**. Liberar acesso só no `RECEIVED` deixaria o cliente de cartão um mês sem conta.
- **Boleto:** `CONFIRMED` sempre antes de `RECEIVED`; pagamento atrasado passa antes por `OVERDUE`.
- **Pix em conta pessoa física:** `CONFIRMED` pode ser temporário, com bloqueio cautelar de até 72 horas, e terminar em `RECEIVED` ou `REFUNDED`.
- **Boleto ou Pix pago com atraso:** `PAYMENT_CREATED` → `PAYMENT_OVERDUE` → `PAYMENT_RECEIVED`.

### Eventos de assinatura [doc]
`SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED` (há ainda dois eventos de split, irrelevantes aqui).

## 9. Limites da API [doc]
- Cota de **25.000 requisições a cada 12 horas** por conta, somando todos os endpoints. Polling não justifica aumento.
- Até **50 GETs concorrentes** por conta.
- Alguns endpoints têm rate limit próprio, informado nos headers `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`. Excesso responde HTTP 429.

## 10. Notificações do Asaas ao cliente
- Ao cadastrar um cliente, o Asaas cria notificações padrão do ciclo de cobrança: aviso 10 dias antes, no vencimento, de atraso e 7 dias após o vencimento. Canais: e-mail, SMS e, em alguns casos, ligação. [doc]
- Cada notificação pode ser alterada (canais, destinatários, antecedência) ou desativada. [doc]
- Custo de SMS, WhatsApp e voz: [verificar] no painel ou na tabela de preços.
- Definir antes quem avisa o quê (Asaas ou o app) para não duplicar mensagens. [doc]

## 11. Pix Automático
- É diferente de assinatura com `billingType: PIX`: no Pix Automático a pessoa autoriza uma vez e o débito acontece sem nova confirmação. [doc]
- **Elegibilidade:** conta pessoa jurídica aprovada, CNPJ ativo há pelo menos 6 meses e sem restrições de Pix. [doc]
- Fluxo: `POST /v3/pix/automatic/authorizations` gera o QR do primeiro pagamento. A ativação exige `PAYMENT_RECEIVED` e depois `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`; recusa gera `..._REFUSED`. `paymentCreationMode`: `MANUAL` ou `SUBSCRIPTION`. [doc]
- Para o MVP de cobrança: fora, até haver CNPJ elegível. RECOMENDADO

## 12. Sandbox
- O saldo de teste não é automático: criar cobrança Pix ou boleto e **confirmar o pagamento manualmente na interface do sandbox**. [doc]
- Cartão de teste aprovado: `4444 4444 4444 4444`, CVV `123`, validade futura; há números específicos para simular recusa. Usar só dados fictícios. [doc]
- Pagar um QR Pix pela API exige duas contas sandbox (`POST /v3/pix/qrCodes/pay`). [doc]
- Sucesso no sandbox não garante o comportamento em produção. [doc]

## 13. Taxas de referência (conferir no painel)
| Método | Taxa | Por mensalidade de R$ 29,90 |
|---|---|---|
| Pix | R$ 1,99 por recebimento (R$ 0,99 nos 3 primeiros meses) | R$ 1,99 |
| Boleto pago | R$ 1,99 (R$ 0,99 nos 3 primeiros meses) | R$ 1,99 |
| Cartão | 1,99% a 2,99% + R$ 0,49 (a página oficial e uma tabela de 16/10/2026 divergem) | R$ 1,09 a R$ 1,38 |

- Sem mensalidade. O cartão é repassado em 32 dias por parcela confirmada. [doc: Preços e taxas; terceiro: QUASA]

## 14. Encaixe na arquitetura — RECOMENDADO

1. **Núcleo (`src/core/cobranca/` ou nome definido no glossário).**
   - Regra de acesso por assinatura e porta `GatewayDeCobranca`, sem SDK nem HTTP.
   - O ADR-0003 já prevê que "o resolvedor poderá receber outra fonte": o status da assinatura vira essa fonte para o Entitlement em `src/core/access/resolve-access.ts`.
2. **Adapter Asaas.** Chamadas `fetch` com `access_token` e `User-Agent`, só no servidor (`server-only`). Não entra em componentes nem no navegador; rodar o portão de dependências (`npm run check:layers`).
3. **Funil.**
   - Formulário com nome, e-mail e CPF.
   - Server Action valida e chama o caso de uso, que busca ou cria o cliente e cria a assinatura com `externalReference`.
   - Redirecionar para a `invoiceUrl` da primeira cobrança.
4. **Webhook (`/api/billing/asaas` ou similar).**
   - Route Handler fino que valida `asaas-access-token` em tempo constante, como as rotas de cron validam seus segredos.
   - Grava o evento com `id` único; repetição vira no-op.
   - Responde **200** em menos de 10 s, inclusive para eventos ignorados, para não somar falhas e interromper a fila.
   - Confirmar que o middleware de sessão não intercepta essa rota.
5. **Quando considerar pago.**
   - Cartão: `PAYMENT_CONFIRMED`.
   - Pix e boleto: `PAYMENT_RECEIVED`.
   - Estorno ou chargeback: rever o acesso.
6. **Criação da conta.**
   - Hoje o cadastro é fechado e as contas nascem pela saga do Admin (ADR-0007, `src/adapters/db/admin-runtime.ts`), com senha provisória.
   - Para o funil: reaproveitar a saga, mas enviar link para a pessoa definir a senha em vez de senha provisória.
   - E-mail já cadastrado: ligar a assinatura ao Usuário existente.
   - Exige atualização do ADR-0007 ou ADR novo.
7. **Bloqueio por inadimplência.**
   - Não usar "Bloquear conta" do Admin: o ban derruba login e sessões, e a pessoa não vê como regularizar nem exporta dados.
   - Bloquear pelo Entitlement: login continua, Funcionalidades recusam no servidor e a interface mostra a tela de regularização com a `invoiceUrl` em aberto.
8. **Regra dos 5 dias.**
   - Calcular no servidor a cada requisição, sem depender de tarefa agendada nem do `PAYMENT_OVERDUE`.
   - Acesso permitido enquanto não houver cobrança da assinatura com vencimento + 5 dias anterior a hoje sem pagamento.
   - Cobranças futuras geradas com 40 dias de antecedência não contam.
   - Usar datas no fuso `America/Sao_Paulo` e cobrir com `npm run test:timezones`.
9. **Conciliação diária.** Consultar a API para corrigir eventos perdidos, sem polling frequente (cota de 25.000 por 12 h). Monitorar `interrupted` dos webhooks.
10. **Banco.**
    - Migration versionada com tabelas de assinatura (Usuário, ids do Asaas, status, método) e de eventos recebidos (id único, tipo, recebido em, processado em), com RLS.
    - Evento de domínio na mesma transação de cada mudança de estado.
    - Sem dados de cartão.

## 15. Decisões pendentes do mantenedor
- Conta Asaas como pessoa física ou CNPJ. Afeta Pix Automático, nota fiscal, tributação e o bloqueio cautelar de Pix em conta PF.
- O que acontece com os dados após o bloqueio: leitura, exportação, prazo de guarda e exclusão.
- Cancelamento e reembolso, incluindo o direito de arrependimento de 7 dias em compras online (CDC, art. 49).
- Quem avisa o cliente sobre vencimento: Asaas, o app ou ambos.
- Situação das contas atuais (mantenedor e pessoas próximas): continuam no Plano Pessoal sem cobrança?
- Teste grátis, troca de preço e emissão de NFS-e desde o início.

## 16. Verificar no sandbox antes de fechar o contrato
- [ ] `billingType: UNDEFINED` em assinatura: a fatura oferece Pix, boleto e cartão, e o que acontece nos meses seguintes.
- [ ] `PAYMENT_CREATED` chega para cobranças geradas por assinatura.
- [ ] Sequência real de eventos por método, incluindo atraso, recusa de cartão e estorno.
- [ ] Comportamento de `nextDueDate` depois da geração antecipada.
- [ ] `cpfCnpj` obrigatório para cliente e para boleto.
- [ ] Valores de status da assinatura e efeito de `INACTIVE`.
- [ ] Regra atual de novas tentativas no cartão recorrente.
- [ ] Habilitação de tokenização em produção, se for necessária.
- [ ] Pausa e reativação da fila de webhook após falhas.

---

## Fontes

### Asaas — documentação oficial
- [Autenticação](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1) · [Authentication (EN)](https://docs.asaas.com/docs/authentication) · [Postman](https://docs.asaas.com/docs/postman) · [Comece por aqui](https://docs.asaas.com/reference/comece-por-aqui)
- [Chaves de API](https://docs.asaas.com/docs/chaves-de-api) · [Eventos para chaves de API](https://docs.asaas.com/docs/eventos-para-chaves-de-api) · [Erros comuns e boas práticas](https://docs.asaas.com/docs/erros-comuns-e-boas-pr%C3%A1ticas)
- [Criar novo cliente](https://docs.asaas.com/reference/criar-novo-cliente) · [Cadastro de clientes](https://docs.asaas.com/docs/criando-um-cliente)
- [Assinaturas (recorrência)](https://docs.asaas.com/docs/assinaturas-recorrência) · [Criando uma assinatura](https://docs.asaas.com/docs/criando-uma-assinatura) · [Criar nova assinatura](https://docs.asaas.com/reference/criar-nova-assinatura) · [Atualizar assinatura existente](https://docs.asaas.com/reference/atualizar-assinatura-existente) · [Remover assinatura](https://docs.asaas.com/reference/remover-assinatura) · [Listar assinaturas](https://docs.asaas.com/reference/listar-assinaturas) · [Listar cobranças de uma assinatura](https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura) · [FAQ — Assinaturas](https://docs.asaas.com/docs/faq-assinaturas)
- [Criando assinatura com cartão de crédito](https://docs.asaas.com/docs/criando-assinatura-com-cartao-de-credito) · [Criar assinatura com cartão](https://docs.asaas.com/reference/criar-assinatura-com-cartao-de-credito) · [Atualizar cartão sem cobrança](https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura) · [Tokenização de cartão](https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito) · [Cobranças via cartão](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Emitir notas fiscais automaticamente para assinaturas](https://docs.asaas.com/docs/emitir-notas-fiscais-automaticamente-para-assinaturas) · [Criar configuração de notas fiscais](https://docs.asaas.com/reference/criar-configuracao-para-emissao-de-notas-fiscais)
- [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca) · [Redirecionamento após o pagamento](https://docs.asaas.com/docs/redirecionamento-apos-o-pagamento) · [Cobranças via Pix](https://docs.asaas.com/docs/cobrancas-via-pix) · [Obter QR Code Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix) · [Cobranças via boleto](https://docs.asaas.com/docs/cobrancas-via-boleto) · [Obter linha digitável](https://docs.asaas.com/reference/obter-linha-digitavel-do-boleto) · [Estornar cobrança](https://docs.asaas.com/reference/estornar-cobranca) · [Excluir cobrança](https://docs.asaas.com/reference/excluir-cobranca)
- [Asaas Checkout](https://docs.asaas.com/docs/checkout-asaas) · [Introdução — Checkout](https://docs.asaas.com/docs/introdu%C3%A7%C3%A3o-1) · [Checkout com assinatura](https://docs.asaas.com/docs/checkout-com-assinatura-recorrente) · [Criar novo checkout](https://docs.asaas.com/reference/criar-novo-checkout) · [Eventos para Checkout](https://docs.asaas.com/docs/eventos-para-checkout)
- [Introdução — Webhooks](https://docs.asaas.com/docs/sobre-os-webhooks) · [Receba eventos no seu endpoint](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook) · [Criar webhook pela API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api) · [Referência: criar webhook](https://docs.asaas.com/reference/criar-novo-webhook) · [Tokens obrigatórios (changelog)](https://docs.asaas.com/changelog/obrigatoriedade-e-auto-gera%C3%A7%C3%A3o-de-tokens-para-webhooks) · [Fila pausada](https://docs.asaas.com/docs/fila-pausada) · [Read Timed Out](https://docs.asaas.com/docs/erro-read-timed-out) · [Polling vs. Webhooks](https://docs.asaas.com/docs/polling-vs-webhooks) · [IPs oficiais](https://docs.asaas.com/docs/ips-oficiais-do-asaas) · [Atualização de IPs (changelog)](https://docs.asaas.com/changelog/atualização-na-lista-de-ips-oficiais-dos-webhooks-asaas)
- [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas) · [Payment events (EN)](https://docs.asaas.com/docs/payment-events) · [Novo fluxo de eventos em boletos](https://docs.asaas.com/changelog/novo-fluxo-de-eventos-em-boletos) · [Eventos para assinaturas](https://docs.asaas.com/docs/eventos-para-assinaturas)
- [Limites da API](https://docs.asaas.com/reference/rate-e-quota-limit) · [Outros erros](https://docs.asaas.com/docs/outros-erros)
- [Notificações padrões](https://docs.asaas.com/docs/notificacoes-padroes) · [Introdução — Cobranças](https://docs.asaas.com/docs/guia-de-cobrancas)
- [Pix Automático](https://docs.asaas.com/docs/pix-automatico) · [Implementação](https://docs.asaas.com/docs/pix-automatico-implementacao) · [FAQ](https://docs.asaas.com/docs/faq-2) · [Fluxos de webhook](https://docs.asaas.com/docs/fluxos-de-webhook) · [Criar autorização](https://docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico) · [Pix Automático × Assinaturas](https://docs.asaas.com/docs/diferen%C3%A7a-entre-pix-autom%C3%A1tico-e-assinaturas)
- [FAQ — Sandbox](https://docs.asaas.com/docs/faq-sandbox) · [O que pode ser testado](https://docs.asaas.com/docs/o-que-pode-ser-testado) · [Saldo no sandbox](https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes) · [Testar QR Code Pix](https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix)
- Índice para agentes citado pela própria documentação: `https://docs.asaas.com/llms.txt`

### Asaas — central de ajuda, preços e blog
- [Preços e taxas](https://www.asaas.com/precos-e-taxas) · [Como funcionam as cobranças por assinatura](https://central.ajuda.asaas.com/hc/pt-br/articles/31975240886555-Como-funcionam-as-cobran%C3%A7as-por-assinatura-recorrentes-no-Asaas) · [NFS-e em assinaturas](https://central.ajuda.asaas.com/hc/pt-br/articles/54589317488283-Como-emitir-nota-fiscal-para-assinaturas) · [Cobrança recorrente no Asaas (blog)](https://blog.asaas.com/cobranca-recorrente-no-asaas/) · [Tarifa Pix (blog)](https://blog.asaas.com/pix-cobra-taxa)

### Terceiros (usar com cautela)
- [QUASA — tarifas Asaas e iugu, 16/10/2026](https://quasa.io/pt/media/asaas-ou-iugu-tarifa-publicada-vence-ate-o-volume-pedir-proposta)
- [Relato sobre `nextDueDate` (PR no GitHub)](https://github.com/CaioAlexanderx/Aura-backend/pull/809)

### Comparativo considerado (Stripe e Appmax)
- **Stripe:** [Pix recorrente (changelog, 22/04/2026)](https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support) · [Assinatura com Pix](https://docs.stripe.com/billing/subscriptions/pix) · [Pix recorrente](https://docs.stripe.com/payments/pix/accept-a-recurring-payment) · [Suporte: Pix no Brasil](https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil) · [Boleto em assinaturas](https://docs.stripe.com/payments/boleto/set-up-subscription) · [Boleto em faturas](https://docs.stripe.com/payments/boleto/set-up-invoices) · [Conta no Brasil](https://support.stripe.com/questions/brazil-specific-information-to-open-a-stripe-account) · [Wise — taxas Stripe](https://wise.com/br/blog/stripe-pagamentos-online) · [Flexprice — preços 2026](https://flexprice.io/blog/stripe-pricing-breakdown-2026)
- **Appmax:** [Conceitos (recorrência em beta)](https://docs.appmax.com.br/guides/conceitos) · [Webhooks](https://docs.appmax.com.br/en/guides/webhooks) · [Desenvolvedores](https://www.appmaxbrasil.com.br/desenvolvedores/)
- **Motivo da escolha do Asaas:** é o único dos três com Pix, boleto e cartão nativos na mesma assinatura, aceita conta PF e envia lembretes de cobrança. No Stripe, o boleto recorrente obriga o cliente a redigitar os dados a cada mês e o Pix recorrente depende de Pix Automático recém-lançado. Na Appmax, a recorrência está em beta e o aviso de pagamento é descartado após 3 tentativas.
