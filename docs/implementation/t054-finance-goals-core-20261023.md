# T-054 / #79 — Núcleo de metas e reservas

Fatia técnica em base `19e2bee0cbb1b0271a38a9bc25811c81e0856e6b`, branch `codex/finance-goals-core-20261023`. Issue#79 e ADR0011 definem reservas virtuais na própria Conta. Este pacote implementa somente Núcleo e testes puros escritos; persistência, mídia, UI e validações reais continuam pendentes. Não altera Séries, orçamento, Financeiro v1, SQL, tipos gerados, workflows ou hospedagem.

## Implementado

Novos tipos, validadores, projeções, ports e sete comandos em `src/core/financeiro/goals/`. Entrada pública é intenção fechada, com `client_id` UUID e `expected_finance_revision` decimal canônico. Os comandos são `finance.goal.create/update/archive/restore/highlight/contribute/release`. Metadata usa CAS da Meta; destaque tem agregado único `id===user_id` e revisão própria. Nome/alvo/prazo/imagem opcionais não constituem movimento de dinheiro.

Reservation e Release são modelos imutáveis e ports somente insert. Liberação parcial é novo registro, preservando aporte/conta/data/valor originais. Progresso e disponível são derivados, sem `saved_cents` persistido ou contador paralelo. Aportes exigem Conta própria ativa BRL sem cartão, Meta ativa, valorpositivo e disponível suficiente no **mesmo snapshot financeiro completo**; data manual não reconstrói saldo histórico. Meta pode ultrapassar o alvo, com texto em valores reais e só barra limitada100%.

Liberação consome remanescente da própria reserva sob a mesma revisão. Não depende da Meta/Conta atuais para recuperar legado próprio arquivado/ausente/inconsistente, nem de imagem ou saldo suficiente. Data da nova liberação não é futura; um aporte legado indevidamente futuro não impede liberação explícita hoje. Não se concede acesso a dados de outro dono por essa recuperação.

Receipt é consultado depois da autorização/lock do adapter e antes de CAS, relógio ou referências atuais. Intenção diferente no mesmo command/clientId conflita. Resultado original é validado e clonado; Core não tenta novamente um callback após conflito/incerteza. Cada efeito escreve exatamente seu evento no mesmo port transacional e um recibo por intenção. No-op produz recibo sem evento adicional; não se presume incremento da revisão por receipt-only.

V2 preserva o freezeV1 e endurece duas fronteiras identificadas na segunda revisão: o adapter recebe clone independente do contexto, sem referência ao actor capturado pelo Core; a revisão financeira é capturada uma única vez após o recibo/CAS e todos os totais posteriores usam essa baseline, mesmo se um port defeituoso mudar uma propriedade/getter durante await. Os dois cenários têm negativos próprios escritos; ainda não são resultado de execução.

Escolhas técnicas aprovadas para construção por Root, sem representar aceite humano de produção: arquivar a Meta destacada limpa só o destaque atomicamente, sem escolher outra ou liberar valores; restaurar não destaca automaticamente; editar metadata arquivado é permitido, novos aportes continuam bloqueados. Atualizar nome conservando imagem removida usa fallback; só **nova vinculação** exige port de arquivo finalizado próprio da finalidade `finance_goal_image`. Port contém apenasUUID/dono/finalidade/estado, sem bytes, URL ou segredo.

## Contrato para adapters

`GoalUnitOfWork.transaction(context,work)` entrega `GoalTransaction` escopado ao dono, ports vencidos ao terminar callback, `financeRevision`, Meta/reservas/liberações/destaque, referências mínimas, totais fechados, eventos e recibos. A Conta exposta ao Core tem somente `id,user_id,kind,currency,archived_at`; saldo e reservado são apuração separada de mesma revisão.

Os três ports de totais retornam `user_id`, identidade consultada, `finance_revision` e valores inteiros seguros: Conta `{real_balance_cents,reserved_cents}`, Meta `{saved_cents}`, reserva `{released_cents}`. Nenhum é soma de uma página truncada. Saldo real reutiliza `saldosFinanceiros`/view SQL equivalente; eventos, registros e recibos são transação única sob o lock financeiro existente `capture-task:<owner>`. Auth/sessão/Entitlement precisam preceder todo retorno, inclusive replay/null. Uma revisão stale exige nova conferência humana; não replanejar automaticamente.

Catálogo e histórico futuros devem ter keyset explícito e limite1…50, agregados completos separados de conteúdo paginado, sem carregar ledger/histórico inteiro ou impor limite total artificial de aportes. Fonte de imagem é consultada pelo servidor, nunca por `finalized:true` vindo do formulário. A guarda efetiva de `finance.account.close` contra reserva ativa é obrigatória no futuro SQL/adapter; `mayCloseAccount` puro não a substitui. Leituras/liberações de legado continuam disponíveis para recuperação própria.

O comentário histórico da issue#79 registra PR#90 (`948cd3c…`) com apuração pura de arrays de reservas/liberações e CI próprio. `goal-reserves.ts` desse PR não está nesta base19e2; este pacote não copia nem redefine aquela função. Totais completos de persistência e projeções de disponibilidade complementam sua apuração, que não prova autoridade/completude de um histórico fornecido.

## Validação escrita e pendente

Duas suítes e fixture serializada exercitam cenário1000→reservar200→liberar50, patrimônio inalterado, gasto posterior900→disponível−50, ultrapassar alvo, imagens, sete comandos/no-ops, global/Meta/HighlightCAS, remanescente/owner/revisão, liberação legada, rollback após metadata+destaque e em write/event/receipt/commit, resultado incerto após commit e replay, input/context mutáveis durante await, cópias independentes, portas encerradas e duas intenções concorrentes no port injetado. Testes de contrato incluem chaves extras/accessors/protótipos, centavos, bigint, UnicodeUTF16, datas civis e faixa de revisão.

**OBSERVADO:** arquivos novos e inspeção estática; diff-check nativo deve ser registrado no freeze. **Não executado nesta autoria:** Node, TypeScript, ESLint, Vitest, banco, API, navegador, build ou hospedagem. Concorrência da fixture é somente contrato de port injetado, não PostgreSQL real.

Root deve revisar o delta e executar TypeScript/ESLint, camadas/segredos e `npx vitest run tests/core/finance-goals-contract.test.ts tests/core/finance-goals-use-cases.test.ts --maxWorkers=1 --no-file-parallelism` no GitHub do SHA consolidado. Acrescentar SQL/RLSA-B, mesma revisão do saldo real, CAS/recibo/efeito/evento atômicos, concorrência nativa, guards de fechamento de Conta, retenção/export/backup/restore, finalidade/mídia #72, mascaramento de todos os valores, UI/mobile/acessibilidade e jornadasJ9/J11 antes de aceitar#79/#71/#81. Nada aqui fecha essas issues ou promove produção.
