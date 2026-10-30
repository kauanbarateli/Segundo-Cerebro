# Pacote de testes026 — proposto, não executado

Este delta é separado do freeze backendV2. Não altera seus31paths nem aplica migrations. A frente autora não executou Node/npm/SQL/PGlite, não abriu conexão e não fez commit/push. Root precisa revisar e usar o GitHub para os ensaios pesados.

## Helper e duas fases

`tests/helpers/onboarding-candidate-sql.ts` é um helper **novo**. Não modifica `local-canonical-sql.ts`, `scripts/test-local-sql.mjs` ou os antigos fixtures de25migrations. Lê somente três proposals por nomes fechados: foundation, reserved-guards e retention. Remove cada guarda DRAFT e cada wrapper BEGIN/ROLLBACK por ocorrência exata e única; compõe uma transação. **Não inclui Cron**, não instala extensão de Cron, não aceita caminho/SQL remoto nem credenciais.

Os cinco pins são a cópia pública de hashes do catálogo somente leitura entregue pelo Root, `tests/fixtures/onboarding-026-catalog-pins.json`, projeto `twrydxsdemaykgvdlpyd`, cadeia001–025. Não contém corpos de funções nem dados pessoais. Só o alias observado `settings_commit(...)` é convertido explicitamente em `public.settings_commit(...)`; nenhuma outra assinatura é normalizada. Os hashes são colocados nos cinco placeholders exatos e a própria SQL continua conferindo `pg_get_functiondef` antes da injeção.

Se PGlite/cadeia canônica gerar definição diferente da observada em homolog, o ensaio **deve abortar**; não substituir o pin pelo observado local, enfraquecer a comparação ou promover PASS canônico a aceite hospedado. Root deve comparar as definições/cadeias e resolver a divergência por revisão independente. Um erro legítimo é evidência de divergência, não autorização para contorná-lo.

Fase1 exige exatamente25migrations canônicas. Carrega-as com o helper antigo e aplica a cópia candidata somente nesse banco em RAM. Fase2 admite a única026 nomeada `20261023061901_onboarding_foundation.sql` **apenas quando seus bytes normalizados em LF forem exatamente iguais ao candidato revisado**; então o loader canônico a aplica e o helper não reaplica. Qualquer migration extra/026 diferente fecha o gate e exige revisão. `prepareOnboardingCandidateSql()` exporta `{sql,sha256}` para Root comparar/preservar a promoção; não executa banco.

## Arquivos propostos e promoção

- Promover `proposals/tests/onboarding-canonical-sql.test.ts` para `tests/adapters/onboarding-canonical-sql.test.ts` após revisão. Os imports foram escritos para funcionar nas duas posições de profundidade2.
- Manter `proposals/tests/onboarding-behavior.sql` inerte: `runOnboardingCandidateAssertions` remove somente sua guarda conhecida ao executá-la explicitamente no candidato descartável, além das asserções de catálogo revisadas. A transação inteira termina em rollback e precisa deixar Auth vazio antes do teste dos Núcleos.
- `calendar-oauth-sql.test.ts` passa a usar o helper candidato e permite **apenas** o RPC adicional `onboarding_call/oauth_classify` com argumentos exatos, service_role real do catálogo local e resultado `{kind:'direct'}`. Sem fallback de rede. Os testes diretos anteriores continuam usando o pipeline real de Calendar e a resposta Google sintética explicitamente declarada.

Não copiar asserções para `supabase/tests` e ao mesmo tempo deixá-las duplicadas no runner. Root decide a promoção final após a fase2; nenhuma dessas mudanças altera o inventário de tipos oficiais por conta própria.

## O que o pacote cobre

Asserções SQL serializadas: elegibilidade manual dos existentes, ausência de heurística de data, draft incompleto persistível, conclusão recusada sem efeito, prazo exato720h, prepare/amend replay, conflito de corpo no mesmoID, fecho de dependentes, versões anteriores seladas/scrubbed, omissão explícita, troca de sessão/dono, namespace sem permit, consumo único/segunda entrada negada, residual forçado com rollback, diagnóstico antigo sem recibo ignorado depois de emenda de outro slot, expiração de unknown sem login com usuário bloqueado, health e coorte/evento na finalização **real** da saga Admin em catálogo sintético.

O Vitest usa `onboardingForRequest` real com transporte HTTP fechado em RAM; segue planner → store durável → SDK/Gateway existente → Núcleos/Stores reais de Hábitos e Projetos → wrapper SQL → funções históricas. Confere target semanal3 sem dias inventados, contexto separado, eventos/recibos/entidades únicos, zero permits, bloqueio da RPC histórica direta inclusive replay de recibo existente, perda de resposta depois de commit e falha de evento após consumo do permit sem resíduo de entidade/evento/recibo. O `SET CONSTRAINTS ALL IMMEDIATE` de Rotinas é executado pelo corpo original, não removido nem simulado.

## O que continua pendente

Nenhum comando foi executado por esta frente. Primeiro: typecheck/lint/portão de arquitetura/secrets e testes no SHA consolidado. Comando proposto, após promoção do arquivo de teste: `npx vitest run tests/adapters/onboarding-canonical-sql.test.ts tests/adapters/calendar-oauth-sql.test.ts`, em Node24.19, um processo pesado de cada vez no GitHub.

PGlite é serial e Auth/Storage são catálogos sintéticos. Não comprova AuthHTTP, OAuthGoogle, banco hospedado, bloqueio em duas sessões, providerwait real, latência, memória em aparelho, extensão/job Cron ou retenção física no SLO. Permanecem os gates reais do roteiro `proposals/onboarding-concurrency-acceptance.md`, ativação supervisionada e medição do Cron. Nunca usar esses testes para fechar a corrida real commit×amend×expiry.
