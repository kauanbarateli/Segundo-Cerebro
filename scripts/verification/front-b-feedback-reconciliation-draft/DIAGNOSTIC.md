# Diagnóstico sintético da barreira de feedback

O teste opt-in usa uma única instância PGlite em memória, com esquema e identidades sintéticas. Confere hashes da candidata, fixture, lockfile e metadados do pacote, exige Node 24 e remove o guard apenas de uma cópia em memória. Sem `FRONT_B_FEEDBACK_RUN_PGLITE=1`, falha antes de abrir o banco; não integra o glob normal de testes.

Os cenários propostos verificam serialmente recibos, conflito, cancelamento, colisão legada e privilégios entre papéis sintéticos. Eles **ainda não foram executados**. A fixture não comprova Supabase, Auth/RLS reais, concorrência nativa, segurança da cadeia de dependências inteira nem o corte de escritores antigos. A candidata no disco continua bloqueada e não é migration.

As verificações puras de guard e caminhos podem ser executadas com `node --test scripts/verification/front-b-feedback-reconciliation-draft/feedback-pglite-guard.test.mjs`. O diagnóstico deve rodar apenas em runner revisado e descartável, após `npm ci`, com opt-in explícito e evidência separada; o resultado não autoriza aplicação remota.
