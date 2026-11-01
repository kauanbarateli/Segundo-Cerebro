# Feedback #138 — candidata atômica para instalação nova

`feedback-reconciliation-fresh.guarded.sql.txt` reúne a fundação de feedback e a barreira de reconciliação em uma transação. Os dois escritores legados são revogados antes do commit. O preflight recusa uma fundação preexistente: nesse caso é necessário um corte separado, após suspender e drenar os escritores antigos.

O arquivo não pertence à cadeia de migrations e começa com uma guarda que sempre interrompe a transação. Não remova a guarda nem execute em ambiente remoto a partir desta proposta; o gate de envio permanece fechado. Uma segunda guarda independente bloqueia a composição antes de criar qualquer objeto: o contrato da constraint `domain_events_entity_type_check` após admissão ainda precisa ser observado e fixado em PostgreSQL 17. Antes de substituí-la, a futura migration deverá bloquear `public.domain_events` e comparar a definição e os atributos da constraint sob o mesmo lock. Nenhuma execução SQL desta composição foi realizada.

Fontes fixadas no HEAD 15733dd:

- `20261101013633_feedback_requests.sql`: SHA-256 `736a9113322317e63e676a4554f6f57231becc9d67065c7f95c97572ad0cc9d6`.
- `scripts/verification/front-b-feedback-reconciliation-draft/candidate-legacy.sql.txt`: SHA-256 `f22de2bf553485a4786aa211ba6991dd8388a1d1270e0800d0df2c972b74c234`.
- Candidata combinada com guarda: SHA-256 `ebd9bb38717f5acd339e428461921274c7191e1f28ae242bdea23f71b3fe91c8`.

Antes de propor ativação, é indispensável qualificar o SQL exato em PostgreSQL 17 descartável e depois em QA autorizado, incluindo percurso autenticado API → PostgREST → banco, isolamento entre usuários, moderação, envio/replay/conflito, falha após commit e concorrência envio/cancelamento. Verificar que os grants legados foram revogados, que apenas o serviço acessa os novos wrappers e que o cache do PostgREST reconhece as assinaturas. Atualizar e revisar o catálogo de release com os fingerprints observados; preservar as verificações de ledger e PT409 existentes. Definir retenção/exclusão das barreiras e compatibilidade de normalização NFC/trim. Criar a migration definitiva com a CLI somente após essas qualificações e seus gates próprios; sua execução remota e a abertura do gate são ações posteriores e separadas. A issue #134 permanece encerrada.
