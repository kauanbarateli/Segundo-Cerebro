# Contrato escolhido — frequência v2 da escolha de hábito

Proposta externa autorizada pelo Root para #63/#80. A #76 permanece CLOSED. Não altera o schemaVersion1 do envelope, a versão da rodada, SQL026, migrations, ACLs ou o domínio Hábitos.

## Forma fechada e compatibilidade

```ts
type HabitFrequencyChoice =
  | { cadence: 'daily' | 'three_per_week'; version?: never }
  | { version: 2; cadence: 'daily' }
  | { version: 2; cadence: 'weekdays'; weekdays: number[] }
  | { version: 2; cadence: 'weekly_target'; weeklyTarget: number };
```

O item do draft acrescenta key/name/startedOn; a substituição acrescenta kind:'habit'/name/startedOn, sem key. Campo version ausente identifica o legado, cujo decoder/JSON continuam sem campo novo. Version2 explícita identifica os novos formatos; qualquer outra versão, versãoundefined própria ou combinação de campos incompatíveis é recusada. Não substituir o draft por vazio ao recusar.

Novas escolhas usam v2. Leitura e edição somente do nome de uma escolha antiga preservam cadence/startedOn/key e a ausência de version. Alteração explícita da frequência pode gerar uma escolha v2 com a mesma key. Não regravar payload no load nem renovar30dias por consulta/tema/retry.

Estrutura de dias: inteiros0–6, únicos, array denso com no máximo7. Save pode conservar dias[] ainda em edição; Add/confirm/replacement exigem ao menos um dia. Meta é inteira1–7. Daily não aceita weekdays/weeklyTarget; weekdays não aceita weeklyTarget; weekly_target não aceita weekdays. Getters/protótipos/extras continuam recusados sem leitura de accessor.

## Planner, recuperação e estado desconhecido

O planner reutiliza habit.create: daily→weekdays[]/weekly_targetnull; weekdays→dias ordenados/targetnull; weekly_target→dias[]/targetN. O legado three_per_week mantém exatamente o comando target3 e sua forma de choice sem version. Repetição determinística conserva corpo/clientId; criação não marca dias cumpridos.

Decoder de replacement e seletor da recuperação suportam legado/v2. Confirmados e rounds concluídos não são reescritos. Intenção pending/unknown mantém input/fingerprint/clientId/version idênticos; o fluxo atual impede substituição incompatível até resolver a tentativa original. Nenhum novo slot/recibo/evento é criado pela leitura ou abertura de editor.

Um cliente antigo recusa o item v2 no seu decoder fechado; não inventa um draft vazio. Uma aba com leitura antiga conserva a revisão antiga e o CAS do servidor continua impedindo sobrescrita stale. Não se afirma que schemaVersion1 ganhou novos campos no envelope ou que houve prova de cliente arbitrário malicioso.

## Por que não exige DDL neste recorte

Onboarding_rounds.draft e intents.choice são JSONB. O SQL026 valida o envelope/top-level/bytes e guarda choice, sem enum de cadence nem fields específicos desse item; o comando de domínio e seus campos já existem. O versionamento está no item JSON, não na coluna schema_version da rodada. Os wrappers, locks, geração, CAS, TTL e envelopes não precisam mudar.

A autoria deve provar isso com o adapter/Core reais sobre o helper canônico descartável, incluindo save/confirm/advance/replay e legacythree_per_week. Se aparecer restrição SQL incompatível durante a revisão, parar e documentar; não editar026 nem repinar catálogo para passar. Nenhum SQL/migration/DDL será autorado ou executado nesta proposta.

## UI e testes finitos

Reutilizar DS2.1, Field16px, Button44px, fieldset/legend e controles de dias com nome e estado acessíveis. A etapa e a recuperação compartilham o seletor. Erro em dias/meta abre o detalhe e foca o primeiro controle inválido somente após ação explícita/validação; autosave/render comum não move foco. Preservar o foco já corrigido de Add/open/remove.

Paths de produto previstos: types.ts, validation.ts, server-planning.ts, draft-steps.tsx, recovery-choices.tsx e, somente se necessário ao resumo, onboarding-workspace.tsx. Testes: decoder/planner reais com legacy/v2/unknownVersion/extras/getters/dias/meta; SQL canônico real no CI; E2E original de edição/pausa/reload/resumo/teclado. Sem executar Node, browser, SDK ou DB nesta autoria. Layout e bodies comerciais ficam fora.

A recomendação anterior de considerar versão da rodada/migration foi preservada em pre-root-item-version-decision/. A decisão Root posterior escolheu versão explícita do item JSON e preservação integral da coluna/wire1; é esta a direção ativa.
