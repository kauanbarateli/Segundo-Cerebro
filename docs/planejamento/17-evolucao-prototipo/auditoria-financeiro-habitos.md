# Auditoria de lacunas — Hábitos, Financeiro e imagens

Base **OBSERVADA**: `main@f3d18960a41076e99aa60dcc9f6b46967970ebb5`, em 21/10/2026. Referência: `prototipo/` deste pacote (cópia integral da entrega). Inspeção estática; não executa testes nem prova schema remoto aplicado. Caminhos de produção abaixo são relativos à raiz do repositório.

## Resultado e fronteira de decisões

O domínio de Hábitos já suporta as três cadências solicitadas. O Financeiro já é persistente e possui mais capacidades que a demonstração. A implementação deve transportar a apresentação e acrescentar contratos ausentes, sem substituir esses motores pelos arquivos JavaScript do protótipo.

**Decisões de produto CONFIRMADAS pelo mantenedor em 21/10/2026:**

1. **Meta financeira / aporte:** reserva virtual vinculada à conta de origem. O saldo real e o patrimônio permanecem; diminui o disponível para uso. Alternativa: transferência real entre contas, exigindo destino e duas pernas. Não portar a dedução de caixa sem contrapartida do protótipo como contabilidade de produção. O contrato abaixo deve aplicar a reserva virtual; transferência real não é este aporte.
2. **Alteração de cadência:** a nova cadência vale da data da alteração em diante, conservando o passado, como a demonstração. Hoje o produto recalcula o passado pela cadência atual e o informa no editor. A migration temporal deve preservar essa decisão sem inventar histórico legado.

**Evolução recomendada de arquitetura, dentro do escopo solicitado:** recorrências semanais/mensais/anuais e pausa/retomada continuam finitas. Uma ação explícita materializa um horizonte de até 12 meses, limitado pelo número de parcelas; sem cron infinito. Registrar revisão da ADR-0006 e compatibilidade das séries existentes antes da migration. Não confundir isso com cobrança Asaas da assinatura do produto.

## Hábitos: matriz de informações e implementação

| Informação/fluxo | Estado observado em produção | Alteração necessária / referência |
|---|---|---|
| Nome, cadência e início | `src/core/habitos/habits.ts`: `Habito {id,name,schedule_kind,weekdays,weekly_target,started_on,archived_at}`. `schedule_kind=daily\|weekdays\|weekly_target`; dias 0=domingo…6=sábado; alvo 1…7. | Reutilizar no onboarding e editor. Não criar outro modelo com `cadence`, `title`, `weeklyTarget` do JS demo. Referência: `onboarding.js`, `habits.js`. |
| Campos de apresentação | `HabitoDoUsuario`, em `src/core/contracts/modules.ts`, acrescenta dono, `color_key`, `icon_key`, `position`, timestamps. Não contém imagem. | `image_file_id: UUID|null` proposto, arquivo privado finalizado e do mesmo dono. Usar a mesma imagem em Hábitos e “Pequenos hábitos” no Início. Ausência, remoção e erro de leitura usam ícone; imagem decorativa junto a nome acessível. |
| Criação/edição | `src/core/habitos/crud.ts`, `CamposHabito`, allowlist em `src/adapters/db/projects-habits-commands.ts`; `habit.create/update` idempotentes. `started_on` não pode mudar depois de criado. | Expandir o contrato estritamente para imagem e, cadência temporal confirmada. Atualizar command validation, DTO, ports/store, mocks, SQL validator, eventos e tipos gerados juntos. |
| Marcação | `src/core/habitos/use-cases.ts::marcarHabito` recebe estado desejado `done`, não toggle. Existe apenas o dia cumprido; impede futuro/pré-início, arquivado, pausa e dia fora da cadência. Remover marca anterior continua permitido após mudar cadência. | Preservar replay idempotente, unique `(user_id,habit_id,done_on)`, eventos atômicos e regra do dia civil. UI otimista deve reverter e manter contexto se escrita falhar. |
| Pausas/arquivo | `habit.pause.create/delete`; pausa geral ou por hábito, passada/futura/aberta; arquivar/restaurar conserva marcações. | Preservar todos esses controles, mesmo que o protótipo mostre apenas “Pausar/Retomar”. Não reduzir modelo a um booleano. |
| Semana | `habits-workspace.tsx` já tem grade semanal, navegação, arquivados e motivo de indisponibilidade; `habit-editor.tsx` já seleciona dias/alvo. | Ajustar composição à referência `references/habits-monthly.png`, incluir miniatura, menu contextual e progresso semanal. Rotina permanece grade de sete dias. |
| Desempenho | Produto usa `resumirHabitos`, sequência, mapa de calor de 26 semanas e pausas; não tem painel mensal da demo. | Adicionar Semana/Mês, período civil, filtro de hábito compartilhado pelo gráfico e rotina, barras diárias, consistência por hábito e tabela acessível. Manter mapa de calor/pausas por divulgação progressiva; não apagar capacidades existentes. |
| Histórico da frequência | Produto só persiste frequência atual; editor declara recálculo histórico. Demo `habits-model.js` mantém `scheduleHistory`, `activityHistory`, exceção de marca já feita hoje. | Preservação confirmada: acrescentar períodos efetivos por hábito (`effective_from`), sem sobreposição; derivar cadência da data. Legado recebe baseline explícito a partir de `started_on`, sem inventar mudanças passadas. Mesma regra para marcar, gráficos, Home, sequências e resumo por e-mail. |

### Contrato de análise a fechar na implementação

`resumirHabito` usa **dias elegíveis** em daily/weekdays e **semanas cumpridas** em weekly_target. Não somar essas unidades e rotular o resultado “práticas previstas”. A demonstração calcula práticas com metas limitadas aos dias disponíveis no recorte, portanto é uma projeção diferente, não uma função equivalente.

**RECOMENDADO:** manter o motor de sequências existente e criar uma projeção explícita `habitPerformance` para a nova UI, com `records`, `fulfilled`, `expected`, `rate|null`, `byDay`, `byHabit` e unidade declarada. Barras contam marcações reais; consistência limita contribuição ao alvo semanal; ausência de expectativa retorna `null`/“Sem práticas previstas”, não 0% de falha. Fixar exemplos tabelados para semana parcial, mês que começa no meio da semana, mudança de cadência no meio da semana e pausa parcial antes de escrever o algoritmo. A função pura compartilhada decide o resultado; HTML, Home e e-mail não recalculem números por conta própria.

### Persistência e testes de Hábitos

Migration atual: `supabase/migrations/20261009152200_projects_habits.sql`. `habits`, `habit_entries`, `habit_pauses` usam payload validado estritamente; ampliar só o TypeScript falhará no SQL. Preservar CAS por Usuário, FK composta por dono, gatilho de eventos e recibos. Atualizar espelho `supabase/sql-editor/installation` pelo gerador oficial e regenerar tipos quando aplicável; aplicação supervisionada segue OP-009.

Reaproveitar `tests/core/habits.test.ts`, `habit-commands.test.ts`, `projects-habits.test.ts`, `tests/adapters/projects-habits-{store,route,gateway}.test.ts`, `tests/e2e/projects-habits.spec.ts`, `issue30-habits-sql.spec.ts` e SQL `projects-habits-{catalog,behavior}.sql`. Acrescentar casos de métricas/parcial/pausas/fuso, migration de legado, replay, rollback, usuário B tentando arquivo/hábito de A e foto refletida no Início após salvar/recarregar/remover.

## Financeiro: nove estados visuais, dados reais preservados

Fontes da referência: `references/finance-nine-screens.png`, `finance-model.js`, `finance.js/css`, `finance-cards.js/css`, `finance-goals.js/css`. A imagem mostra nove estados de interação, não nove rotas.

| Estado da referência | Existente no produto | Plano de aplicação |
|---|---|---|
| 1. Visão geral | `finance-panels.tsx::FinanceDashboard` tem patrimônio/dívida, lançamentos, orçamentos, fluxo; atualmente o plano mostrado soma limites de categorias. | Composição em área principal + coluna de meta/cartões; lançamento rápido; gráfico temporal cumulativo com tabela; três lançamentos recentes e recorrências. Saldo atual separado de período selecionado. Usar `planoDoMesFinanceiro` para limite total explícito, não somar categorias. |
| 2. Novo lançamento | `finance-editors.tsx::TransactionEditor`, `finance-form.ts`, core create/update. Campos reais: conta, categoria, natureza, centavos, `paid_cents`, descrição, favorecido, data, status, vencimento, notas, competência e etiquetas. | Aplicar formulário compacto Entrada/Saída, conta/cartão, detalhes progressivos. Conservar cinco estados, pagamento parcial, etiquetas, competência histórica, validações e detecção de possível duplicata. A demo não cobre tudo. |
| 3. Adicionar cartão | `AccountEditor`, `ContaFinanceira` em `types.ts`. Cartão é conta `credit_card`; limite/ciclo/cor já existem. | Novo editor visual com os mesmos comandos de conta. Acrescentar `last_four` opcional e `default_payment_account_id` opcional (campos propostos), validar exatamente quatro dígitos e conta ativa do mesmo dono que não seja cartão. Não armazenar PAN/CVV. |
| 4. Detalhe do cartão | `FinanceAccounts`, `faturaFinanceira`, `finance.statement.pay`; fatura derivada por competência. | Drawer com Fatura/Compras/Configurações, mês, fechamento, vencimento, limite e pagamento. Manter parcelamento, crédito excedente e juros/IOF opcionais presentes no produto; não importar teto da demo que proíbe pagamento acima do aberto. |
| 5. Nova recorrência | `finance.series.create/stop` em `use-cases.ts`; mensal, finita de 2…120 ocorrências, grupos nos lançamentos. ADR-0006. | Acrescentar gestão visual das séries e frequência semanal/mensal/anual; contagem e término explícitos, pausa/retomada/editar futuras. Toda geração finita e idempotente; preservar legado e comprovados/pagos. |
| 6. Meta financeira | Não há entidade/port/SQL de meta ou aporte em main. | Criar nome, alvo em centavos, prazo opcional, `image_file_id`, estado e timestamps do dono. Nova meta começa em zero; exemplo R$2.400 é apenas seed demo. Editor, troca/remoção de imagem, seletor da meta em destaque e aporte com prévia. Sem simular produção com localStorage. |
| 7. Selecionar período | `finance-route.ts` serializa mês e filtros na URL e protege corrida de navegação. | Picker mês/ano com setas, teclado, Mês atual, preservando deep links, filtros e voltar/avançar. Não converter saldos atuais em saldos do mês sem novo rótulo/cálculo. |
| 8. Limite do mês | `FinanceBudget.category_id` já aceita null; `salvarOrcamentoFinanceiro` e `planoDoMesFinanceiro` suportam total independente de categorias. SQL `20261010044217_finance_monthly_plan.sql` existe. UI só expõe categoria e soma limites. | Expor total mensal + linhas por categoria. Soma de categorias pode superar o total e gera informação de sobrealocação; não bloquear nem transformar total em soma. Repetição por 12 meses exige comando composto atômico ou resultado parcial retomável explícito, não 12 chamadas silenciosas. |
| 9. Lançamentos | Busca, filtros, tabela/paginação/ordem, duplicar, excluir lógico, lixeira/restaurar, transferências e estados reais já existem. | Refinar densidade e menu; preservar recursos existentes e URLs. Não permitir edição/duplicação independente de uma perna de transferência nem de parcela agrupada. |

### Navegação sem regressão

`finance-route.ts` enum atual: `painel`, `lancamentos`, `contas`, `categorias`, `orcamentos`. **RECOMENDADO:** adaptar rótulos/composição, podendo mostrar os quatro grupos principais da referência, mas manter Contas, Categorias/Etiquetas e Orçamentos acessíveis em subáreas com compatibilidade dos cinco valores antigos da URL. Um redirect/mapeamento explícito preserva query, mês, conta, filtros e voltar. Esconder controles antigos sem substituição não atende ao requisito.

### Regras financeiras que continuam sendo autoridade

- `src/core/financeiro/fused.ts`: `planned|pending|confirmed|reconciled|cancelled`, `deleted_at`; só confirmados/conciliados não excluídos participam do realizado. A demonstração usa menos estados. Conta comum considera pagamento; cartão cria dívida pelo valor da compra. `is_paid` é derivado, nunca gravado pelo cliente.
- `mesDeCompetencia`, `statement_month` e `faturaDe` governam o período. Alterar fechamento não move compras históricas; lançamentos sem competência continuam visíveis para correção. Não misturar gráfico de **caixa por pagamento** com **despesa por competência** sob o mesmo rótulo. Reusar projeções do Núcleo e declarar a base do gráfico.
- Transferência conserva duas pernas e não compõe receita/despesa/orçamento. Pagamento de fatura conserva caixa + crédito do ciclo; juros/IOF, quando informados, são despesas distintas do principal. Estorno em categoria de despesa reduz consumo do orçamento.
- Saldos, faturamento e reservas não são números retirados da imagem. As contas demonstrativas e a data fixa de 17/10/2026 não entram no produto autenticado.
- O comando de pagamento atual admite crédito além do aberto; a UI o explica. Não introduzir o limite mais restrito da demo nem proibição geral de saldo negativo sem decisão de produto.

### Contratos propostos para metas e reservas

Decisão confirmada: documentar termos no glossário. Contrato técnico proposto para **reserva virtual**:

- `FinancialGoal`: `id,user_id,name,target_cents,deadline|null,image_file_id|null,archived_at|null,created_at,updated_at`.
- `GoalContribution`/Reserva: `id,user_id,goal_id,account_id,amount_cents,occurred_on,created_at`; reserva não é Lançamento de despesa. Liberações parciais usam registros próprios `id,user_id,reservation_id,amount_cents,occurred_on,client_id`, sem mutar o aporte original. `saved_cents` deriva do aporte menos liberações; soma liberada não ultrapassa o aporte. Ver contrato refinado no doc03.
- `available(account)=saldo real−reservas ativas` e disponível do painel considera também faturas com rótulo explícito; patrimônio inclui o dinheiro reservado uma vez. Escrita usa lock por Usuário para duas reservas concorrentes não prometerem o mesmo disponível. Débito financeiro posterior que deixe disponível negativo deve ser exibido, sem apagar reserva silenciosamente.
- `finance.goal.create/update/archive/restore`, `finance.goal.contribute/reverse` são intenções propostas; um recibo por operação e evento na mesma transação. A interface mínima de correção de aporte pode ser histórico com estorno confirmado. Arquivar meta com reservas não libera nem apaga valor automaticamente; não excluir metas financiadas sem política explícita.
- Proibir aporte futuro, centavos inválidos, conta/cartão indevido, alvo zero, arquivo de outro dono; permitir ultrapassar alvo com progresso textual real e barra limitada a 100%. Alterar alvo/nome/prazo/imagem não altera aportes.
- Migração aditiva com tabelas/repositórios próprios, FKs compostas por dono, eventos, acesso/entitlement Financeiro, retenção/backup/restore/export e recibos. Não criar bolsa no localStorage autenticado, coluna de imagem base64 ou saldo inicial fictício.

Transferência real continua sendo o comando existente entre duas contas e não o aporte confirmado para metas. Não somar o progresso da meta novamente ao patrimônio.

### Contratos propostos para recorrências

Manter `installment_group_id`, `installment_no/total` e `serie_tipo` do legado. Acrescentar metadados da série (`frequency`, âncora civil, estado ativo/pausado/encerrado, fim/quantidade, cursor/horizonte materializado) sem reinterpretar pagamentos já realizados. A identidade de ocorrência é estável por série+data/índice e única por dono. Um comando de edição futura transforma apenas ocorrências elegíveis; canceladas manualmente não ressuscitam ao retomar.

Mensal usa âncora original para 29/30/31 com clamp no mês curto e restauração em mês longo; semanal soma sete dias; anual cobre29 de fevereiro explicitamente. Parcelamento distribui o total com resto na última parcela, recorrência repete o valor. Parcela atual/total da UI precisa de semântica definida: registrar a posição atual não inventa parcelas passadas pagas. Futuras continuam `planned` conforme produto, não `confirmed`; conta/cartão continua preservando competência. Pausar/encerrar não apaga passado nem pagamento parcial. Retomar gera somente pendências futuras ainda devidas, nunca cobra automaticamente.

Propor nova migration/RPC e atualização do ADR-0006; não alterar migrations históricas nem fazer o novo cadastro chamar várias vezes `create_series` com grupos diferentes para emular retomada. Migração de séries legadas pode conservar o conjunto existente e marcar metadados como legado quando não houver evidência suficiente para reconstruir uma âncora.

## Imagens: infraestrutura existente e extensão necessária

Infra compartilhada já existe mesmo com Drive fora do MVP (D-032). `src/core/drive/types.ts::TipoArquivo` hoje aceita somente `drive|capture_image|avatar`. Não disfarçar capa de hábito/meta como avatar ou captura.

**RECOMENDADO:** acrescentar tipos fechados `habit_image`, `project_cover`, `home_focus`, `financial_goal_image`, com mapeamento de Entitlement correto. Atualizar `core/drive/rules.ts`, rota `app/api/files/uploads/route.ts`, `files-runtime.ts`, `files-processor.ts`, validators e SQL `file_upload_reserve/complete/read_metadata` e vínculo das entidades. Cada vínculo valida propriedade, tipo e estado finalizado; arquivo removido usa fallback.

Reaproveitar `components/layout/file-upload.ts`: reserva → signed upload em staging → finalização → vínculo ao salvar. Upload é separado da edição do registro; Cancelar não muda referência ativa, órfãos seguem limpeza segura. `files-processor.ts` mede bytes, MIME real, pixels (24 milhões), reencoda via sharp, remove metadados e fixa saída PNG/JPEG. Limite atual de imagem8 MiB; entrada WebP é aceita e reencodada. Read usa URL assinada60 s através de `/api/files/read`, sem bucket público nem URLs remotas arbitrárias. Avatar 512×512 não é corte correto de capa; propor proporção distinta sem ampliar upload ilimitado.

Preservar quota e falhas reserving/uploading/validating, retry idempotente, timeout e troca de sessão. Testar usuário B / arquivo A, URL expirada, EXIF, MIME forjado, imagem corrompida, excesso de bytes/pixels, remover/trocar/cancelar/recarregar e escrita concorrente da entidade. Reusar `tests/features/file-upload.test.ts`, `tests/adapters/files-{route,runtime,processor,store}.test.ts` e SQL `drive-storage-{catalog,behavior}.sql`; não reativar aba Drive para poder personalizar imagens.

## Recortes de tickets recomendados e ordem

1. **Mídia privada compartilhada e referências de imagem** — pré-requisito de capas, Hábitos e metas. Contratos/endpoints/SQL/testes, sem redesign completo no mesmo ticket.
2. **Hábitos: imagem, desempenho e cadência coerente** — consumir lote 1; integrar seletor no onboarding da issue #63 sem duplicar sua orquestração. Home usa o mesmo DTO/imagem. A decisão confirmada de histórico orienta a migration; UI independente pode prosseguir.
3. **Financeiro: composição, cartões, períodos e ledger** — reaproveitar regras, cinco rotas compatíveis, gráfico/table, novos metadados de cartão; não esperar metas para melhorar shell. Cartão e assinatura Asaas são conceitos distintos.
4. **Financeiro: plano mensal e gestão finita de recorrências** — total independente já existe no Núcleo; expor corretamente, acrescentar comandos/migration para repetição de limites e evolução finita da série.
5. **Metas financeiras com imagem e aportes** — depende do lote de mídia e aplica a decisão de reserva confirmada; catálogo/editor pode avançar antes de contabilização. Núcleo/SQL/UI juntos por fatia vertical.
6. **Aceite integrado** — novos testes nas suítes existentes e cenário cruzado onboarding → hábito → Início; meta → disponível → pagamento; tema/filtro/mês; retomada após erro. Usar issue #44 para aceite visual global e#68 para jornada comercial, evitando novos épicos duplicados para os mesmos portões.

### Casos mínimos de aceite financeiro

- Centavos exatos, parcial, reconciliação, cancelamento, lixeira/restore, estorno e registros sem categoria/competência.
- Compra no fechamento,29/30/31, ano bissexto; mudança do ciclo preserva histórico; pagamento parcial/total/excedente não duplica despesa; juros/IOF uma vez.
- Transferência de duas pernas, conta arquivada e saldo negativo permanecem coerentes.
- Total mensal diferente da soma das categorias, sobrealocação visível, duplicação de categoria rejeitada; cópia12 meses com atomicidade/retry sem duplicação.
- Recorrência semanal/mensal/anual: horizonte finito, pausa/retomada, editar futuro, parcela já paga, pendência excluída manualmente, retry/idempotência, dois comandos simultâneos.
- Meta: sem imagem, upload, substituição/remoção, múltiplas metas, aporte concorrente, insuficiência, estorno, alvo menor que o guardado, ocultar valores inclusive gráfico/percentual; saldo/patrimônio coerentes com reserva.
- Regressão `tests/core/finance-{commands,transactions,fused,legacy-v2-regression}.test.ts`, `tests/features/finance-{form,route,navigation-race}.test.ts`, `tests/adapters/finance-{store,gateway}.test.ts`, `tests/e2e/finance.spec.ts`, `issue26-27-finance-sql.spec.ts`, SQL `finance-{catalog,behavior,monthly-plan-catalog,monthly-plan-behavior}.sql`.

Nenhum teste acima foi executado nesta auditoria; são critérios para a frente implementadora. Gates operacionais do repositório e aplicação de migration supervisionada continuam necessários, independentemente da assinatura Vercel PRO.

## Textos para integrar ao glossário e aos ADRs

### Glossário canônico, sem implementação

**Meta financeira:** conquista para a qual o Usuário estabelece um valor desejado e, opcionalmente, um prazo. Pode ter uma imagem pessoal. Seu progresso representa as Reservas destinadas a ela.

**Reserva para meta:** parcela do dinheiro de uma Conta que o Usuário separa virtualmente para uma Meta financeira. Continua pertencendo à Conta e ao patrimônio; reduz o disponível para uso. Não é despesa, receita nem transferência entre Contas.

**Aporte à meta:** ação de acrescentar uma Reserva para meta a partir de uma Conta. Não movimenta dinheiro para fora da Conta. É distinto de um pagamento de Fatura e da cobrança da Assinatura.

**Disponível para uso:** parcela do saldo de uma Conta que ainda não está reservada. Quando uma tela também desconta faturas, precisa identificar esse recorte adicional.

**Cadência vigente:** frequência de um Hábito aplicável a um período. Alterar a frequência inicia uma nova vigência; não redefine o que era esperado antes da alteração.

**Ocorrência de recorrência:** Lançamento previsto em uma data de uma série finita. Uma recorrência financeira pessoal não é a renovação da Assinatura comercial do Segundo Cérebro.

### ADR proposto — reservas virtuais e patrimônio

**Estado:** decisão de produto confirmada pelo mantenedor em 21/10/2026; implementação e validação pendentes.

**Contexto:** a interface demonstra adicionar valor a uma meta escolhendo uma conta de origem, sem destino. Deduzir somente a origem faria o patrimônio desaparecer; tratar como despesa distorceria orçamento e resultado. Uma transferência real exigiria destino e representaria outra ação.

**Decisão:** aporte cria reserva virtual na própria conta. Saldo real e patrimônio permanecem intactos; disponível para uso considera reservas ativas. Progresso da meta é derivado das reservas. Imagem, nome, alvo e prazo não alteram valores reservados. Uma reversão libera disponibilidade, mantendo rastreabilidade.

**Consequências:** catálogo de metas, reservas, concorrência, isolamento e eventos precisam de persistência própria. As projeções financeiras devem distinguir saldo, disponibilidade e patrimônio. Uma compra posterior pode deixar a disponibilidade negativa e deve ser apresentada, sem apagar reservas. Migration não gera o saldo demonstrativo inicial nem movimentações fictícias. Registros financeiros e referências de mídia permanecem exportáveis e recuperáveis segundo a política vigente.

### ADR proposto — cadência de hábitos com vigência

**Estado:** decisão de produto confirmada pelo mantenedor em 21/10/2026; implementação e validação pendentes.

**Contexto:** o produto atual recalcula todo o passado pela cadência editada; a interface nova promete preservação dos registros e expectativas anteriores. Só manter marcações não basta para manter indicadores coerentes.

**Decisão:** alterações de cadência passam a valer no dia civil da alteração. Cada dia consulta a vigência correspondente; marcações realizadas não são apagadas quando o dia deixa de ser esperado. O dia inicial continua imutável. Marcações, elegibilidade, pausas, sequências, resumo e gráficos usam a mesma regra no Núcleo.

**Consequências:** persistir vigências e migrar hábitos existentes com baseline da cadência conhecida, declarando que não há como reconstruir alterações pretéritas inexistentes. Duas alterações no mesmo dia devem gerar resultado determinístico e preservar eventos de auditoria. Revisões concorrentes não podem deixar períodos sobrepostos. A operação de desfazer uma marcação existente continua possível após mudar a frequência.

### Evolução proposta da ADR-0006 — séries finitas administráveis

**Estado:** proposta técnica para executar as interações de recorrência solicitadas, sem revogar a finitude da ADR-0006.

**Contexto:** a série atual é um conjunto finito mensal de lançamentos. Pausar, retomar e alterar próximas ocorrências exigem identificar intenção e fronteira materializada; repetir criações independentes duplica compromissos.

**Decisão proposta:** persistir metadados de gestão da série e materializar ocorrências finitas por comando explícito, até 12 meses, limitado também pelo término/parcelas. Acrescentar frequências semanal e anual sem geração contínua em background. Manter identidade de grupo e ocorrência e distinguir suspensão pela série de exclusão manual.

**Consequências:** atualizar port/RPC/recibos/SQL e migrar séries legadas sem refazer o histórico. Pausar/editar alcança apenas ocorrências futuras elegíveis; retomada não ressuscita exclusões manuais ou pagamentos. Competências de cartão permanecem históricas; parcelamento continua distribuindo total e recorrência repetindo valor. A nova entidade administra séries pessoais e não tem acesso ao Asaas nem ao sistema comercial.
