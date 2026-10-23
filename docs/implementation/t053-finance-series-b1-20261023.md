# T-053 / #78 — contrato puro de séries administráveis

Fatia B1, base `313f1c6a57798e794aa80e1208f3d26a6b74edb3`. Complementa [limites mensais](t053-finance-monthly-plan-20261023.md); não altera seus quinze arquivos congelados. Referências: [issue #78](https://github.com/kauanbarateli/Segundo-Cerebro/issues/78), [contratos do doc 17](../planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md), [auditoria](../planejamento/17-evolucao-prototipo/auditoria-financeiro-habitos.md) e [ADR-0006 vigente](../adr/0006-financeiro-series-finitas.md).

**Implementado:** tipos/DTOs/ports, calendário, elegibilidade e plano puro v2, em `src/core/financeiro/series/`. **Não implementado nesta fatia:** executor transacional, persistência/SQL, rotas, UI ou integração com o financeiro v1. Nenhum teste foi executado. Portanto, estes contratos não tornam a funcionalidade disponível nem atualizam o estado de implementação da ADR vigente.

## Recorte aprovado para construção

O protocolo v2 usa metadados de série e mapa durável de ocorrências. Cada ocorrência conserva grupo, ordinal, identidade e motivo de supressão separado (`series_pause`, `manual`, `ended`). Âncora e frequência são imutáveis após criar; editar próximas ajustará template/término. Mudar frequência exige uma nova série explícita. Isso segue a evolução finita proposta no doc 17; não cria rotina infinita, cobrança Asaas ou pagamentos implícitos.

Posição inicial é 1…total, com total 2…120. `anchor_on` é a data dessa primeira posição registrada, não uma data reconstruída para a parcela 1. Registrar a parcela 5 de 12 não gera as quatro anteriores nem as trata como pagas. Parcelamento calcula o valor de cada ordinal sobre o total original e conserva o resto na última parcela original. Recorrência repete o valor; futuras ficam `planned`.

As datas mensais partem sempre da âncora original, com clamp 29/30/31 e restauração no mês seguinte. Semanal soma sete dias civis. Anual usa 28/fev nos anos comuns e restaura 29/fev no bissexto. Os dias permanecem entre os anos 0001 e 9999. O horizonte é explícito, começa hoje/futuro e possui fim exclusivo de no máximo doze meses; no máximo 12 ocorrências mensais, 53 semanais ou 1 anual por ação. Leitura nunca cria uma ocorrência.

Um corte por `ends_on` conserva o cursor no primeiro ordinal ainda não materializado; `exhausted` pode representar o término atual, sem consumir essa posição. Estender/remover esse corte reavalia somente posições futuras ainda não materializadas. Mapas existentes continuam sendo a autoridade de identidade: não são renumerados, e exclusões manuais/encerramentos não são restaurados pelo planejador. A V2 acrescenta o cenário cortar → estender → materializar → repetir sem duplicação; o freeze V1 permanece preservado.

## Cartão e histórico

Competência é um modo declarado: `none` para conta que não é cartão; `account_cycle` pela data real/fechamento da conta; ou `explicit` com competência individual por ordinal criado. Modo explícito sem a decisão necessária é recusado integralmente. Atribuição fora do lote ou repetida é recusada. Uma série semanal/anual nunca desloca meses pelo número da parcela. Mapas existentes conservam a atribuição histórica; não passam pelo planejador como novas linhas.

O valor `paid_cents` de compra prevista no cartão pode ser a projeção do principal conforme a exceção já existente; o status continua `planned`. Isso não registra realização ou pagamento de fatura. A operação de realização proposta é separada da edição futura e só aceita status confirmado/conciliado e centavos pagos; não aceita mudar valor, data, conta, grupo ou competência. Não reduz um pagamento já registrado, não ultrapassa o valor e não desfaz conciliação.

Pausa, edição futura e encerramento conservam passado, confirmado/conciliado, cancelado e parcial/pago real. Retomar requer estado pausado e motivo `series_pause`; nunca restaura exclusão manual ou encerramento. Ocorrência que passou durante a pausa não vira compromisso retroativo. Estado encerrado não pode ser reativado por essa política. Editar/encerrar/cancelar uma ocorrência suspensa mantém a exclusão até uma intenção explícita compatível; não cria restauração silenciosa.

## Fronteiras e próximos passos

DTOs v2 são fechados e recebem intenção, UUID, revisão esperada e campos próprios; não aceitam dono, batch de linhas, eventos, papel ou pagamento por padrão. A revisão é decimal limitada ao intervalo bigint não negativo. Espécies novas de evento estão no port v2, que só admite metadados da série/mapa e eventos dos lançamentos reais. Não foram inseridas no contrato fechado de eventos ou snapshots v1.

Na V3, **todas** as intenções v2, inclusive criar/realizar, exigem `expected_finance_revision` textual canônica, além da revisão da série quando ela existe. A leitura v2 informa `finance_revision` no envelope da página. Não converter a revisão por `Number`. Dentro do mesmo lock, o executor verifica o recibo primeiro (replay do mesmo corpo permanece válido) e depois confere revisão financeira e revisão da série antes de qualquer mutação. Conta, categoria, fechamento ou ledger alterados entre prévia e confirmação exigem reconferir a prévia; não recalcular silenciosamente seu resultado. Os freezes V1/V2 permanecem preservados.

O próximo executor deve usar o mesmo lock financeiro por Usuário, reconferir ator/sessão/Entitlement atual, vínculo/estado/revisões e confirmar metadados, mapa, lançamentos, eventos e recibo juntos. A revisão financeira compartilhada deve observar mudanças v2. A projeção v1 de eventos/recibos deve continuar restrita às espécies/comandos que seus leitores entendem. Não basta acrescentar eventos `finance_series` à seleção `finance_%` existente: isso quebraria o decoder antigo. O adapter v2 e o SQL supervisionado precisam tratar esse ponto explicitamente.

Grupos legados ficam reconhecíveis com seu detalhe/encerramento existentes. Não serão convertidos por inferência nem usados para provar uma âncora desconhecida. Rollback de UI não pode remover mapas ou história novos. A Root atribuirá a numeração de SQL após a reserva 026 do onboarding e revisará inventários/restore; nesta fatia não há proposta SQL nem migration.

## Validação preparada, sem execução

```text
npx vitest run tests/core/finance-series-calendar.test.ts tests/core/finance-series-contract.test.ts tests/core/finance-series-policy.test.ts tests/core/finance-series-planning.test.ts
```

Os quatro arquivos testam âncoras e limites civis, posição atual/rateio, três frequências/horizonte, pausa versus exclusão manual, preservação de parcial/realizado, vínculos adulterados, cartão semanal/anual, competência explícita, ausência de efeito e DTOs fechados. A fixture é sintética e não se conecta a serviço algum. Testes puros não provam SQL, RLS, idempotência hospedada, concorrência ou experiência de interface.

Validado na autoria: leitura estática e, no freeze, diff-check e hashes nativos. Pendente: peer independente, compilador/lint/camadas/testes no CI combinado, executor B2, asserções SQL de duas sessões/CAS/rollback/grants, UI e aceites conectados/mobile. Nenhum Node, npm, banco, API de produto, navegador, commit ou push foi executado por esta frente. Não fechar #78 ou promover produção com base neste pacote.
