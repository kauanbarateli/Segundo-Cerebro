# Decisões e contratos de integração

## Árvore de decisões — grill-with-docs

| Ramo | Resultado | Fonte / consequência |
|---|---|---|
| Produto e visual → identidade/fluxos | Resolvido | Pedidos atuais, DS 2.1, snapshot; preservar o produto existente |
| Reserva → saldo e patrimônio | **Confirmado**: reserva virtual na conta | Resposta do mantenedor em 21/10; [ADR 0011](../../adr/0011-metas-com-reservas-virtuais.md) |
| Frequência → passado | **Confirmado**: preservar histórico | Resposta do mantenedor em 21/10; [ADR 0012](../../adr/0012-cadencia-de-habitos-com-vigencia.md) |
| Recorrência → geração | Proposta técnica: finita, até 12 meses por ação | Implementar frequências/lifecycle solicitados, conservando ADR 0006; revisar metadados antes de migrar |
| Fotos de convidados → origem | Limite factual: Calendar não fornece fotos | Iniciais como fallback; rostos demo não provam integração; não ampliar OAuth silenciosamente |
| Contratação → métodos/e-mail/acesso | Já resolvido no pacote 16 | #50–#68 e PR #70; sem nova cobrança antes dos portões |
| Execução → memória/deploy | Atualizado pelo pedido atual | Vercel Pro informada; retomar #52/#53 após mudanças e RAM livre ≥1 GB |

As escolhas técnicas abaixo são **RECOMENDADAS** e podem ser refinadas com evidência mantendo os comportamentos aprovados. Não há decisão de produto escondida em uma migration. Se surgir conflito material novo, isolar a fatia afetada e continuar os lotes independentes.

## Contrato compartilhado de imagens

Reutilizar upload privado existente, com finalidades fechadas propostas `project_cover`, `habit_image`, `finance_goal_image`, `home_focus_image`. Os nomes são proposta única deste pacote; harmonizar as variações nominais das auditorias. Avatar conserva `avatar_file_id` e suas regras.

Cada entidade referencia um arquivo finalizado do mesmo Usuário e finalidade; ausência é `null`. Fluxo: selecionar → preparar/preview → upload/finalize → salvar vínculo. Cancelar ou falhar preserva vínculo anterior. Sem base64 persistente, bucket público, URL arbitrária ou concessão de Drive. Limites existentes: 8 MiB e 24 milhões de pixels; reencode remove metadados. Corte de capa é distinto do avatar.

Estender o conjunto completo: tipos/allowlists, reserve/complete/read, comandos da entidade, DTOs/projeções, validação SQL, RLS/FKs compostas, eventos/recibos, limpeza de órfãos, export/backup/restore e testes de acesso comercial #53. Coordenação E1 cria infraestrutura; cada consumidor implementa seu vínculo no próprio domínio, sem features importarem features.

## Hábitos: vigência e desempenho

Reusar `schedule_kind=daily|weekdays|weekly_target`, `weekdays` 0–6, `weekly_target` 1–7, `started_on` imutável. Nova vigência começa hoje no fuso civil do produto; não editar o passado por acidente. Uma edição no mesmo dia substitui a vigência daquele dia de forma determinística e mantém eventos. Uma marcação já feita hoje continua preservada se a nova frequência excluir esse dia; desfazê-la permanece possível. Manter pausas gerais/individuais, inclusive intervalos futuros, arquivo/restauração e mapa de calor existentes.

**Projeção recomendada e testável:** barras = marcações reais. Consistência = práticas cumpridas limitadas à expectativa / práticas previstas, cortadas até hoje. Agrupar por semana civil e vigência dentro do recorte; daily/weekdays contam dias elegíveis, ativos e não pausados; weekly_target usa `min(meta, dias disponíveis no grupo)`. Marca existente preservada conta uma única vez. Somar numeradores/denominadores, não médias de percentuais. Denominador zero → “Sem práticas previstas”, não falha de 0%. Sequência histórica existente é outra métrica e conserva sua unidade.

| Exemplo do novo painel | Esperado |
|---|---|
| Seg/Qua/Sex, corte quarta, segunda feita | 1 de 2 = 50%; sexta futura excluída |
| Meta 3/semana, corte terça, um registro | 1 de 2 = 50% |
| Meta 3/semana, semana completa com 5 registros | Barras: 5; consistência: 3 de 3 = 100% |
| Três dias elegíveis, dois pausados e restante sem registro | 0 de 1; pausa não é falta |
| Meta 3 até quarta, diária a partir de quinta, corte quinta | Grupos: até 3 + 1 práticas; nenhum recálculo da vigência anterior |
| Mês começa quinta, meta 3, quatro dias disponíveis nessa semana | Expectativa 3 para o trecho; não contar dias do mês anterior |

Esses exemplos precisam virar fixtures puras e ser conferidos com a apresentação da expectativa no gráfico. Na migração, frequência antiga conhecida vira baseline, com essa limitação documentada; não inventar períodos anteriores. Onboarding #63 usa o mesmo seletor/validação e salva sem criar marcação automática.

## Metas: reserva virtual e disponibilidade

Modelo proposto: Meta com dono, nome, alvo em centavos, prazo/imagem opcionais, arquivo e timestamps; Reserva com dono, meta, conta, centavos, data, reversão e recibo. Progresso é derivado, não contador paralelo. Comandos propostos: criar/editar/arquivar/restaurar meta, aportar e liberar reserva. Histórico com “Liberar valor” oferece correção explícita; arquivar não apaga ou libera reservas. Não excluir definitivamente meta financiada neste fluxo.

Invariantes: `saldo_real` não muda por aporte/liberação; `reservado = soma(reservas ativas)`; `disponível = saldo_real − reservado`. Se o painel deduz também faturas, rotular “Após reservas e faturas” e descontar cada parcela uma vez. Patrimônio nunca soma reserva novamente. Exemplo: conta R$1.000 + aporte R$200 → saldo R$1.000, reserva R$200, disponível R$800, despesa R$0; liberar R$50 → disponível R$850. Uma despesa real posterior de R$900 deixa saldo R$100 e disponível −R$50: mostrar insuficiência sem apagar reserva ou inventar entrada.

Só novas reservas exigem disponibilidade suficiente; duas operações concorrentes compartilham lock/controle transacional do dono e não podem reservar o mesmo dinheiro. Conta origem não é cartão; data não pode ser futura. Meta pode superar alvo: texto real, barra até 100%. Alterar alvo/prazo/imagem conserva aportes. Sem saldo inicial fictício. Mesmo recibo repetido não duplica reserva; revisão falha não deixa evento sem dado ou dado sem evento.

**Liberação parcial:** manter aporte original imutável e registrar liberações com ID, dono, reserva, centavos, data e recibo. Soma das liberações não ultrapassa o aporte; saldo ativo = aporte − liberações, sob o mesmo lock. `reversed_at` isolado não representa liberação parcial. Liberar R$50 duas vezes com o mesmo recibo libera somente R$50; nova intenção pode liberar mais até o saldo restante.

**Arquivamento da Conta:** integrar a guarda ao comando existente `finance.account.close`: reservas ativas impedem arquivamento e a mensagem oferece acesso à liberação explícita. Não eliminar reservas ou dinheiro para completar o fechamento. Contas legadas já arquivadas conservam suas condições anteriores; se houver referência de reserva inconsistente/importada, leitura e liberação continuam disponíveis para recuperação, sem criar novos aportes nessa conta.

## Financeiro: reconciliação da referência

Preservar `planned/pending/confirmed/reconciled/cancelled`, lixeira, estorno, juros/IOF, transferências pareadas, crédito excedente e competência histórica. Período na URL filtra análise; saldos atuais têm rótulo próprio. Gráfico que inclui compra no cartão deve ser chamado **Entradas e despesas do mês**, com base de competência indicada; não apresentar como caixa por pagamento. A tabela acessível explicita os valores e a regra do Núcleo usada.

No gráfico por competência, registros cujo `occurred_on` está fora do mês selecionado entram num ponto inicial **“Anteriores desta competência”**, antes do dia1. A tabela conserva data original e competência; a linha acumula esse ponto e os dias do mês. Exemplo: compra29/set na faturaout começa no ponto inicial deout. O último ponto tem de igualar o total mensal do Núcleo. Registros sem competência continuam acessíveis para correção, sem serem silenciosamente atribuídos a outro mês.

Plano total com `category_id:null` já existe no core/SQL. Ligar a UI a ele; limites por categoria são independentes. Repetir 12 meses precisa atomicidade ou resultado parcial recuperável explícito, com idempotência por lote. Não somar categorias para inventar limite total.

Recorrências pessoais evoluem o ADR 0006: guardar metadados/cursor/frequência/estado, gerar finitamente por comando até 12 meses e limite de parcelas; ocorrência única por dono+série+data/índice. Pausar/editar atinge apenas futuras elegíveis; retomar não recria exclusões manuais nem altera pagos/conciliados. Mensal preserva âncora 29/30/31 com clamp; anual define 29/2; semanal soma sete dias. Não criar retroativamente parcelas pagas. Legados ficam reconhecíveis sem reconstruir âncora desconhecida. A cobrança Asaas é outro contexto.

## Compatibilidade e migração por fatia

1. Comparar HEAD efetivo e schema, inventariar colunas/DTOs/comandos; adicionar schema compatível e contratos aceitos, sem alterar migrations aplicadas.
2. Expandir adapters/snapshots e leitores com fallback de campos ausentes. Captura antiga vira parágrafos de texto, nunca HTML executável; documentos novos usam TipTap JSON validado e revisão/CAS.
3. Migrar baseline de hábitos e referências vazias com evidência; no legado financeiro conservar IDs, grupos, competências e estados. Sem backfill de números demo.
4. Habilitar UI ligada a contratos e registrar falhas/retry. Testar cliente antigo tentando sobrescrever documento novo; rejeitar perda silenciosa.
5. Gerar espelhos SQL e tipos pelo fluxo do projeto; aplicação supervisionada somente no projeto autorizado de OP-009. Registrar migration aplicada separadamente de teste local. Build/deploy não aplica schema.
6. Rollback funcional mantém dados novos: recuar UI/flag/comando sem DROP de histórico/reservas. Recuperação de dados exige roteiro próprio; não usar reset/seed como rollback.

## Vínculos ao promover Captura

`linked_capture_ids` referencia Capturas; `wikiLink.target_id` de Conhecimento referencia Páginas. Nunca copiar um ID de Captura para o namespace de Página. Destino já promovido pode ser mapeado pela relação `origin_capture_id` à Página correspondente; destino ainda não promovido permanece vínculo tipado com a Captura e texto identificável. Não associar pelo título a uma Página homônima. Cobrir A→B promovendo A antes/depois deB, renomeando e repetindo operação sem perda/duplicação. Origem, anexos e identidade continuam preservados.
