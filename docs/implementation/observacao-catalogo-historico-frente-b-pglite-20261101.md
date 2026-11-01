# Observação local do catálogo histórico após as candidatas da Frente B

Esta é uma experiência descartável em PGlite 18.3, **não** um catálogo aprovado de 30 migrations, uma autorização de promoção ou evidência do QA. O catálogo histórico e o classificador PT409 não foram alterados. Foram carregados as 27 fontes por hash, o patch operacional PT409 e as três candidatas por hash, nessa ordem, somente em memória.

A composição das 27 fontes, antes do patch e das candidatas, produziu `ok: true`, 2.512 verificações e nenhum desvio. A composição com o patch e as três candidatas produziu `ok: false`, 2.650 verificações e **26 desvios**. O número de verificações varia porque o catálogo também enumera objetos encontrados; não é uma medida de cobertura nova nem de compatibilidade em outra versão do PostgreSQL.

Classificação limitada à experiência:

- `onboarding_function`: o catálogo das 27 espera o wrapper histórico; o patch operacional PT409 altera o wrapper. Sua identidade e permissões são verificadas separadamente pelo classificador PT409.
- `onboarding_relation`: a candidata de admissão altera a origem do onboarding, incluindo colunas e restrições. O verificador aditivo examina essas alterações.
- `finance27_domain_events_predicate`: admissão e feedback ampliam a constraint de tipos de evento preservando a estrutura anterior; o verificador aditivo examina a definição instalada.
- 23 ocorrências de `service_function_allowlist`: 11 funções privadas e 12 públicas de cadastro, métricas e feedback não pertenciam à allowlist histórica. Isso não constitui validação de permissões; o verificador aditivo as examina separadamente. A forma `app_private.app_private.` abaixo reproduz o identificador retornado pelo catálogo histórico, sem correção cosmética.

Lista exata dos 26 pares `check` / `object` observados:

- `finance27_domain_events_predicate` — `public.domain_events.domain_events_entity_type_check`
- `onboarding_function` — `public.onboarding_call(uuid,uuid,text,jsonb)`
- `onboarding_relation` — `app_private.onboarding_entries`
- `service_function_allowlist` — `app_private.app_private.feedback_list(uuid,uuid,timestamp with time zone,uuid)`
- `service_function_allowlist` — `app_private.app_private.feedback_submit(uuid,uuid,uuid,text,text)`
- `service_function_allowlist` — `app_private.app_private.signup_attest_password_reset(uuid,uuid,uuid,text)`
- `service_function_allowlist` — `app_private.app_private.signup_complete(uuid,uuid,uuid,text,text,text,boolean,text)`
- `service_function_allowlist` — `app_private.app_private.signup_discard_pending_origin(uuid,uuid,uuid,text)`
- `service_function_allowlist` — `app_private.app_private.signup_find_bound_intent(uuid,uuid,text)`
- `service_function_allowlist` — `app_private.app_private.signup_intent_create(text,text,text,text,timestamp with time zone,jsonb,text)`
- `service_function_allowlist` — `app_private.app_private.signup_origin_status(uuid,uuid)`
- `service_function_allowlist` — `app_private.app_private.signup_origin_withdraw(uuid,uuid)`
- `service_function_allowlist` — `app_private.app_private.signup_prune()`
- `service_function_allowlist` — `app_private.app_private.signup_recover_verified_intent(uuid,uuid,text,text,text)`
- `service_function_allowlist` — `public.feedback_list(uuid,uuid,timestamp with time zone,uuid)`
- `service_function_allowlist` — `public.feedback_submit(uuid,uuid,uuid,text,text)`
- `service_function_allowlist` — `public.signup_attest_password_reset(uuid,uuid,uuid,text)`
- `service_function_allowlist` — `public.signup_complete(uuid,uuid,uuid,text,text,text,boolean,text)`
- `service_function_allowlist` — `public.signup_discard_pending_origin(uuid,uuid,uuid,text)`
- `service_function_allowlist` — `public.signup_find_bound_intent(uuid,uuid,text)`
- `service_function_allowlist` — `public.signup_intent_create(text,text,text,text,timestamp with time zone,jsonb,text)`
- `service_function_allowlist` — `public.signup_metrics(uuid,uuid,date,date,text,text)`
- `service_function_allowlist` — `public.signup_origin_status(uuid,uuid)`
- `service_function_allowlist` — `public.signup_origin_withdraw(uuid,uuid)`
- `service_function_allowlist` — `public.signup_prune()`
- `service_function_allowlist` — `public.signup_recover_verified_intent(uuid,uuid,text,text,text)`

O teste `node --test tests/scripts/front-b-historical-observation.test.mjs` fixa essa lista e exige, em conjunto, resultado positivo do classificador PT409 e do verificador aditivo. Um `GRANT SELECT` em `public.profiles` para `anon` gera o 27º desvio e é recusado; um grant indevido no wrapper é recusado pelo verificador PT409. Ao substituir a constraint nova do onboarding por `CHECK(true)`, o catálogo histórico mantém os mesmos 26 desvios: o verificador aditivo detecta a alteração. Essa demonstração impede tratar a igualdade da lista histórica, isoladamente, como prova de segurança.

A igualdade da observação composta é somente uma regressão local para as fontes e o motor fixados; não substitui reconciliação de schema, versão real do PostgreSQL, ledger, testes com serviços hospedados, análise de permissões, gates ou aprovação de deploy. Um catálogo de estado novo e as fontes definitivas ainda exigem revisão e provas próprias.
