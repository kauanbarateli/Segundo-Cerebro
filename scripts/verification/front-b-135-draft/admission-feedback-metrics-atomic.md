# Candidata atômica: admissão, feedback e métricas

`admission-feedback-metrics-atomic.sql.txt` é rascunho guardado e **não é migration nem autorização de execução**. Conserva a guarda que interrompe a transação antes de qualquer alteração; a abertura dos gates de cadastro, feedback e métricas não faz parte desta proposta. Os arquivos originais e suas guardas permanecem intactos.

A composição usa os seguintes bytes da base `e145ebc`:

- Admissão e fence: `admission-fence-atomic.sql.txt`, SHA-256 `bcf4da212db7fc310df9b72df252fab226b6cde6ea9c2b1f3715740f73c151fd`.
- Feedback fresh: `supabase/operations/candidates/feedback-reconciliation-fresh.guarded.sql.txt`, SHA-256 `62d32577c5946474895c6e6e485b68d0de4fac034442b4b296430b6b09b85f0b`.
- Métricas: `scripts/verification/front-b-metrics-dictionary-draft/catalog-integration.sql.txt`, SHA-256 `0aedd039e38e03ce61469ee97268f5ced3419cfb8bc6bfa32f9d3054e7009f67`; a versão do dicionário coincide com a gerada para a API nessa base.
- Composição guardada: SHA-256 `1318cc5a656153777040885d85ea249b67637e1e5225b08ee2bcaf3fd4a4f729`.

Após a composição, a tabela de barreiras recebeu uma chave estrangeira para `auth.users` com `ON DELETE CASCADE`. Assim, as barreiras permanecem enquanto a conta existir e são removidas na exclusão física da identidade. A candidata original de feedback permanece inalterada; essa alteração está apenas na composição conjunta. Um ensaio em PGlite com a definição exata da tabela confirmou a chave única e a exclusão física de duas barreiras sem afetar outra conta. Esse ensaio não cobre exclusão lógica, o fluxo completo de Auth ou concorrência real. A retenção após encerramento do feedback continua pendente.

A admissão bloqueia `public.domain_events` em `ACCESS EXCLUSIVE` e confere a definição e atributos da constraint 027 antes de ampliá-la. O feedback é incluído depois, antes do mesmo commit, sem liberar esse lock; por isso, apenas nesta composição, sua guarda secundária de contrato é substituída pela sequência pin → alteração da admissão → alteração do feedback sob o mesmo lock. A guarda principal permanece. O preflight do feedback recusa fundação ou escritores legados preexistentes; o writer antigo não é instalado. Se houver fundação anterior, este caminho não serve: um corte próprio precisa suspender e drenar os escritores.

A composição confere ACLs diretas e privilégios efetivos de anon, authenticated e service_role para as 52 funções de admissão/fence e feedback, inclusive helpers, leitores e escritores revogados. Papéis que herdem privilégios exigem revisão separada. Métricas são incluídas após a admissão, com preflight de dependência e ausência da RPC e conferência de privilégios ao final da transação. A presença deste SQL não prova a autorização real do Master, nem a privacidade dos agregados no ambiente implantado. Uma falha em qualquer bloco reverte toda a transação.

A composição exata ainda não foi executada. Antes de criar uma migration, é necessário qualificá-la em PostgreSQL 17 descartável e QA autorizado: lock e concorrência, cortes e ACLs, Auth/Admin legados, API → PostgREST → banco, resultados de métricas, recuperação de feedback, retenção e exclusão, normalização de texto e versão do dicionário. Atualizar o catálogo de release a partir das observações e preservar os verificadores de ledger e PT409; a issue #134 permanece encerrada. Aplicação remota, merge, deploy e ativação seguem gates próprios.
