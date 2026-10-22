# T-051 / #76 — contrato puro de vigência

Registro histórico da fatia pura da PR #87 (`3b9bae6beaed98f43986407e2f741d23cc7d0caf`). Os limites abaixo descrevem aquela entrega. A evolução vertical atual está em [t051-habitos-vertical-spec08.md](t051-habitos-vertical-spec08.md), preservando a origem deste contrato.

Refs #76. Part of #71. Base fixada: `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. ADR0012 aceita pelo mantenedor em 21/10/2026. A Root autorizou esta fatia menor após revisar a proposta: contrato/versionamento/resolução de vigência apenas. A branch financeira `90e2bd150f78d9262c578c628f64a43a5d493009` continua preservada; esta fatia não deriva dela. Branch local: `codex/spec08-habit-frequency-history-20261021`. HEAD e hashes exatos constam do manifesto de entrega.

## Implementado

`VigenciaDeFrequenciaV1` usa campos fechados: `version:1`, `habit_id`, `user_id`, `effective_from`, `schedule_kind`, `weekdays`, `weekly_target`. Reutiliza `daily|weekdays|weekly_target`, dias0–6 e alvo inteiro1–7. Não cria ID, timestamp, evento, entidade persistida ou nomenclatura paralela do protótipo.

`normalizarHistoricoDeFrequencia({habito,historico?})` valida a projeção estrutural do hábito atual e todas as vigências. A projeção do hábito pode vir acompanhada de seus metadados existentes; linhas de vigência e envelopes das funções são fechados. Entradas incompatíveis, owner/habit divergente, versões desconhecidas, campos ausentes/extra, datas impossíveis, início anterior ao hábito e duas linhas no mesmo início são recusados com erro de domínio `VALIDATION`.

Ausência ou `undefined` representa **histórico legado ainda não fornecido**. Nesse caso somente, a função gera uma baseline de compatibilidade na `started_on`, com a frequência conhecida, e declara `baseline_provenance:legacy_known_frequency`. Isso não afirma que o hábito nunca mudou antes nem reconstrói edições antigas. Histórico fornecido usa `supplied_history`; esse marcador descreve a entrada recebida, sem certificar sua origem operacional. `null`, lista vazia ou histórico cujo primeiro início difere de `started_on` são inválidos, sem fallback silencioso. Falha de leitura não pode ser convertida em ausência por um futuro consumidor.

Os períodos são ordenados sobre cópias e têm `effective_until` exclusivo derivado da próxima data; o último é `null`. A data final não é aceita como segunda autoridade de entrada. Não há lacuna nem sobreposição entre mudanças únicas e ordenadas. Arrays retornados não compartilham referências mutáveis com os dados fornecidos. Listas esparsas, accessors e propriedades fora do contrato são recusadas.

`resolverFrequenciaNoDia({habito,historico?,day})` valida todo o snapshot e resolve o intervalo `[effective_from,effective_until)`. Antes da data inicial devolve `status:not_started,period:null`; a partir dela devolve `status:resolved` e período. Mesmo uma consulta anterior ao início recusa histórico inválido, em vez de esconder corrupção. Um hábito cuja data inicial ainda não chegou fica explicitamente não iniciado nesse dia consultado.

Datas usam `SO_DATA` e `instanteValido` do Núcleo, inclusive a validação gregoriana real. Não há relógio, `Date.now`, offset fixo ou fuso do host. Uma data futura fornecida pode ser resolvida como frequência declarada; isso não autoriza gravar uma alteração futura ou marcar o hábito. A autoridade de “hoje” e a operação de escrita pertencem ao contrato futuro. Não se inventa histórico de arquivo/restauração, atividade, marca ou pausa.

## Limite deliberado da fatia

Não há algoritmo de desempenho, barras, `records`, `expected`, `fulfilled`, `rate`, agrupamento ou denominador. As leituras divergentes registradas na proposta de métricas permanecem pendentes de revisão técnica, sem nova entrevista das decisões humanas. Nenhum consumidor, sequência, mapa de calor, Home, e-mail, onboarding, UI, CRUD, adapter, contrato persistido ou SQL foi alterado. A função pura não concede acesso ou Entitlement; apenas confere consistência do escopo recebido.

Duas edições no mesmo dia são **inválidas como duas linhas do snapshot**. A futura persistência deve substituir deterministicamente a linha daquele dia sob CAS e preservar eventos/recibos de ambas as intenções. Nenhuma substituição, transação ou replay é executado aqui.

Quatro arquivos reservados: módulo puro `frequency-history.ts`, export de `habitos/index.ts`, teste focal e este documento. Não há migration ou timestamp a reservar nesta entrega. Não foram modificados `habits.ts`, módulos compartilhados, workflow, package/lock, tipos SQL, esquema ou migration histórica. O export acrescenta um módulo alcançável; a Root deve conferir os inventários reais da base integrada antes de publicar, sem presumir a contagem da baseFFC.

## Preparado, validado e pendente

Preparado `tests/core/habit-frequency-history.test.ts`: baseline ausente/fornecida, ordem e limites de mudança, hábito não iniciado, versões, owners, campos e datas inválidas/bissextos/anos0001 e0099, campos incompatíveis de frequência, duplicata no mesmo dia, snapshots congelados, cópias, accessors e listas esparsas. Nenhuma fixture declara desempenho, transação, imagem, gravação ou prova conectada.

Validação desta rodada é leitura estática independente e `git diff --check`, com resultado final no manifesto. O revisor não identificou bloqueio concreto no contrato, nas relações/limites, no recorte ou nos casos TS/Vitest por leitura. **Nenhum Node, Vitest, TypeScript, lint, script de lote, build, banco ou navegador local foi executado**, conforme a fila e o limite de RAM. Testes preparados não são testes PASS. Não se transfere resultado das PRs83–86 ou de outro SHA.

Lote remoto proposto após revisão Root: Node24, `npx vitest run tests/core/habit-frequency-history.test.ts --maxWorkers=1`, em UTC e America/Sao_Paulo; ESLint dos dois arquivos TypeScript e do teste; TypeScript e camadas afetadas. Reconciliar inventários finitos e negativas conforme o coletor real do SHA integrado. Nenhum SQL remoto em CI/build/deploy.

Nenhum push, PR, merge ou deploy desta fatia. O contrato é entregue como commit/patch local para revisão antes de ativação. #72 continua uma dependência do ticket completo; esta preparação pura não o dá como integrado. #76/#71/#81 permanecem abertos, sem aceite global a partir destes helpers.
