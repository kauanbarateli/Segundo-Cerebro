# Financeiro B2 — qualificação do candidato

Este material acompanha uma proposta inerte. Não é instrução para executar SQL em produção. Nenhuma execução de Node, PGlite, PostgreSQL, API ou banco hospedado foi feita nesta autoria. Peer estático dos cinco SQL aprovado por outra frente; o resultado ainda precisa de revisão Root e evidência executada no SHA consolidado.

## Ensaio descartável no GitHub

Consolidar B1 V3, Core B2 V1 e canal B3 V1 antes do teste: o teste usa seus tipos e implementações reais, não cópias. Instalar dependências somente pelo lockfile existente e Node24. Não editar o coletor de fontes Auth/Admin/Recovery para contornar falhas; Root reconcilia os inventários separadamente.

1. TypeScript, ESLint dos arquivos novos, portão de camadas e varredura de segredos.
2. `npx vitest run tests/adapters/finance-series-canonical-sql.test.ts --maxWorkers=1 --no-file-parallelism`.
3. Suítes puras B1/B2, quatro suítes do canal B3, Financeiro v1/orçamento e SQL canônico. Em GitHub, acompanhar cada SHA; PASS anterior não certifica um delta posterior.

O helper exige exatamente a cadeia histórica001–025 e os cinco arquivos SQL com hashes revisados. Ele cria PostgreSQL em WASM, compõe cópias em RAM removendo somente cada aborto DRAFT e os wrappers BEGIN/ROLLBACK, e instala tudo em uma transação descartável. Nenhuma função histórica é substituída por mock, nenhum pin é recalculado pela observação do candidato e nenhum teste abre conexão externa. A mudança da fronteira para026/027 requer revisão explícita de Root; o helper não deve aceitar automaticamente migrations novas.

O teste serial atravessa Core→store/gateway→quatro RPCs SQL: criação, materialização, edição futura, cancelamento manual, realização parcial, pausa, retomada e encerramento. Confere quatro linhas/mapas,39 eventos reais,8 recibos e zero permits. Confere ainda Unicode UTF16/trim, âncora mensal/leap/cartão, RLS/grants, replay original apesar da revisão/conta mudadas, IDs do vencedor, intenção alterada, batch v1 forjado com BEFORE/AFTER/evento coerentes, isolamento de owner/sessão, filtro dos cinco eventos v1, consumo único e SET CONSTRAINTS ALL IMMEDIATE, residual recusado, falha real após todas as escritas antes do evento, omissão seletiva de efeito e cascade de identidade. A exclusão das fixtures deve produzir contagens positivas iguais a zero, não apenas ausência de erro.

## Gates ainda necessários antes de numerar/aplicar

- Revisar os cinco SQL e o oracle de forma independente contra os oito comandos congelados; um teste serial com quatro posições não substitui a massa histórica máxima.
- Adicionar/executar parcelas com first_index maior que1 e rateio do total original; corte de ends_on→extensão sem pular ordinal; horizon exclusivo de12 meses/53 novas posições; retomada de120 ocorrências já existentes; pagamentos parciais/confirmados/conciliados preservados.
- Cartão: datas antes/no/depois do fechamento31/fevereiro, atribuições explícitas, mudança de cartão, mudança de ciclo entre prévia e commit, realizado não é pagar fatura; juros/encargos v1 independentes continuam válidos.
- União histórica exata121/121/3630 e snapshot122/122/3660, Unicode no limite real de4MiB/8MiB; referência omitida/extra/estrangeira não passa. Não truncar.
- Testar body/event/result/BEFORE maliciosos com IDs/criação/fingerprint coerentes; vários commits na mesma transação após o primeiro SET CONSTRAINTS; trigger order e rollback depois do consumo/antes do receipt.
- Antes da promoção, ler catálogo autorizado somente leitura e confirmar **prosrc** de `app_private.finance_snapshot(uuid,uuid,text)` SHA855cff15825d78f988a87f0d017e802d33b1a4808060cd9c546091a9d0e539bb, ownerpostgres, SECURITY DEFINER e search_path vazio. Fonte canônica tem1831 bytesUTF8 semCR. Divergência deve abortar sem DDL residual; não trocar o pin por conveniência nem comparar a formatação de pg_get_functiondef como se fosse prosrc.
- Somente depois dos testes, Root gera uma migration nova por CLI oficial, compõe os mesmos bytes revisados, aplica supervisionadamente na homologação pessoal autorizada e gera tipos oficiais. Não aplicar por CI/build/deploy e não editar001–025/026/027.
- A instalação da guarda v1 depende do endpoint **e da UI B3 funcionais**, com pagamento parcial/total em conta comum, realização da compra separada da fatura, cancelamento manual, erro/incerto persistente, teclado/mobile e preço/checkout fora deste escopo. Backend sintético sozinho não libera a guarda.

## PostgreSQL nativo: duas sessões reais

PGlite usa uma sessão; Promise.all não prova corridas nativas. Em homologação isolada, criar somente fixtures identificadas e registrar baselines públicos (contagens/IDs sintéticos/versões), sem exportar ledger pessoal. Duas conexões da mesma conta de teste, cada uma com actor/sessão próprios verificados, fazem chamadas com barreiras explícitas. O lock compartilhado é exatamente `capture-task:<owner>`; não criar lock Financeiro concorrente separado.

| Corrida | Resultado exigido |
| --- | --- |
| Duas criações/materializações same-client, com UUIDs planejados diferentes | Um commit; o outro devolve receipt original antes de CAS/current refs. Mesmo conjunto de rows/maps/events e um receipt. |
| Mesma série, dois clientIds e mesma revisão | Primeiro confirma; segundo CONFLICT/stale, sem replanejar/gravar automaticamente. |
| Pausa versus realização parcial/total | Ordem serial legítima: realização confirmada preservada ou realização posterior recusa suppression. Nunca apagar pagamento. |
| Retomada versus cancelamento manual | Ação vencedora mantém identidade e suppression correto; cancelamento manual nunca é resurrected por retry. |
| Fechamento de cartão ou arquivo de conta versus commit | CAS global invalida prévia antiga; nenhuma competência silenciosamente recalculada no perdedor. Replay já autenticado mantém resultado original. |
| Revogação de feature/sessão versus replay | Auth/sessão/Entitlement atuais precedem receipt; replay não restaura acesso revogado. |
| Erro após consumo do permit / segunda entrada | Erro reverte row/map/metadata/events/receipt/revisão; segunda entrada sem novo permit recusa. Nenhum permit residual. |

Usar timeouts curtos e rollback controlado; nunca terminar à força uma conexão desconhecida. Registrar wait/lock/commit/SQLSTATE e contagens, sem payload privado. Ao fim, remover somente as fixtures autorizadas e verificar ausência por contagem em todas as tabelas, sessões, eventos, recibos e revisões correspondentes. Autorização real, grants hospedados, RLS, concorrência, backup/restore e aceite visual continuam gates distintos.

## Controle focal de instalação por Root, 23/10

Root conferiu os nove arquivos do freeze B2 por bytes/SHA-256, revisou os limites de permissão, plano independente, conjunto de efeitos, guardas e recibos, e incorporou a proposta somente ao candidato. Outro agente revisou estaticamente os cinco SQL. O lint dos nove TypeScript novos/alterados desta etapa passou.

O helper original `createFinanceSeriesCandidateSql` foi executado uma única vez com Node 24 e heap de 256 MiB, sobre a cadeia canônica001–025 no PostgreSQL em memória, em aproximadamente3,2s. A instalação da composição exata passou; Auth, eventos, recibos, séries, mapa e permits terminaram com contagem zero. Não foram executadas nessa rodada as asserções Core→SQL, sessões concorrentes, HTTP de Auth ou operações hospedadas. O PASS de instalação não libera a guarda v1, promoção de migration ou ativação da flag.

A disponibilidade do canal é desligada por padrão no servidor. As suítes reais de comandos/negativos e os demais gates do candidato são enviados ao GitHub; seus resultados deverão ser registrados pelo SHA executado. A promoção futura da026 de onboarding exige revisar explicitamente a boundary25 deste helper antes de combinar as migrations, sem trocar pins para fazer um teste passar.

## Correção do alias SQL e revisão Root, 23/10

No SHA `a47110d1a596f749a3fcee6a05d51d92b838745d`, os runs originais `39930341617` (PR) e `39930334390` (push) falharam no primeiro comando da suíte real Core→store/gateway→SQL. O PL/pgSQL tinha uma variável `c` e usava o mesmo nome sem qualificação como alias de `jsonb_array_elements`: SQLSTATE `42702`, referência ambígua. A classificação de resultado incerto pelo store foi preservada; não era motivo para enfraquecer sua política de repetição ou os testes.

Root revisou o diff, conferiu os nove payloads do freeze B2 V2 e incorporou somente três deltas: aliases explícitos `effect(value)`/`event(value)`, o hash correspondente do helper e quatro ataques negativos de duplicação/colisão. Cada negativo exige `23514`, contagens e revisão global inalteradas. Os seis arquivos sem mudança não foram recopiados. ESLint dos dois TypeScript passou, assim como a varredura de 2146 arquivos e `git diff --check`.

O controle serial da frente autora passou com os oito comandos e 125 asserções (113 originais e 12 novas), em PostgreSQL em memória. Esse controle não é Vitest, CI hospedado nem concorrência nativa. O novo SHA será validado pelos workflows originais no GitHub; os resultados do SHA anterior continuam registrados como falha. Nenhuma migration foi numerada ou aplicada e nenhuma flag foi ativada nesta correção.
