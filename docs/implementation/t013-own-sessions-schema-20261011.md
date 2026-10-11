# T-013 — preparação isolada do schema de sessões próprias

Preparação da issue #37, derivada do requisito original de Configurações/Auth. Este lote pertence à branch `codex/own-sessions-schema`, iniciada em `0c0985f`. As contagens abaixo foram derivadas desta cópia isolada.

## Migration e validação SQL

A migration `20261011113751_own_sessions.sql` (019) acrescenta a RPC pública `my_sessions()` e seu helper privado. A leitura usa o proprietário e o SID do JWT autenticado; retorna somente sessões próprias, com a atual primeiro, datas nullable e limite de 100 linhas. `has_more` decorre da leitura limitada a 101 registros. `refreshed_at` identifica refresh, sem equivalência com último uso. Não há revogação individual, emissão de eventos ou uso da chave de serviço nesta RPC.

O corpo SQL aprovado foi preservado. A alteração de cabeçalho identifica a migration 019 e exige revisão supervisionada separada. O arquivo canônico e a cópia de instalação têm 4.115 bytes e SHA-256 `0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57`. As 36 fontes/cópias das migrations 001–018 foram comparadas com os blobs Git e permanecem idênticas.

O catálogo recebeu quatro guardas para corpo/configuração/ACL e a allowlist da assinatura exata de `my_sessions()`; as fixtures locais refletem `auth.sessions.refreshed_at` nullable sem timezone e RLS. A assertiva `supabase/tests/own-sessions.sql` cobre dono/SID, moderação, ACL, datas nullable, ordenação, truncamento e ausência de efeitos, com rollback. O SQL Editor foi gerado pela ferramenta existente: 19 migrations e 38 arquivos separados de execução manual/validação.

As duas fixtures descartáveis retornaram **1.266 verificações e zero desvios**. Os runners nativos esperam **19 migrations e 1.269 verificações**; esses números são expectativas de execução, ainda sem evidência nativa desta branch.

## Inventários derivados e controles locais

| Frente | Fontes próprias / dependências |
| --- | --- |
| Administração backend | 49 / 45 |
| Administração navegador | 338 / 50 |
| Recuperação de senha | 189 / 50 |
| Drive navegador | 227 / 50 |
| Avatar Storage | 52 / 45 |
| Fundação | 38 / 2 |

Os inventários usam as fontes transitivas desta branch; os testes de coletores usam somente uma seam sintética de leitura Git e dependências instaladas. Não equivalem a execução nativa de Auth/Storage/navegador. Foram preservados o contracaso PostgreSQL major 18, a contagem sintética de inspeções SQL do Drive e a geometria visual de 18px.

QA focada: **188/188 controles Node**, **11/11 testes do backend de administração**, **18/18 controles Vitest do inventário visual**, TypeScript global sem emissão, lint dos 28 arquivos JS/TS alterados e `git diff --check` passaram. Os quatro controles do catálogo estão incluídos na bateria de 188. O primeiro ensaio encontrou apenas uma contagem de leituras Git no teste (HEAD + 49 arquivos = 50); a assertiva corrigida passou na bateria final.

## GAP intencional dos tipos oficiais: 54 → 55 RPCs

`src/lib/supabase/database.generated.ts` continua com os tipos oficiais anteriores, de 54 RPCs. Nenhuma assinatura foi adicionada por overlay. Na execução local completa, as 19 migrations aplicaram no banco descartável e o contrato recusou a etapa `committed public database contracts` com **LOCAL_RPCS_DIFFER**. A suíte SQL completa não passou; as assertivas focadas e o catálogo foram validados separadamente.

O próximo passo é obter o artefato de tipos produzido pelo gerador oficial a partir desta cadeia local, conferir seu vínculo ao run/attempt/commit e às provas de migração/catálogo/cleanup, revisar a diferença e incorporar a 55ª RPC. O CI geral pode recusar o contrato até essa atualização; o bloqueio não deve ser contornado. Somente depois entram adapter/API/UI de sessões próprias e os controles adequados.

Este lote não certifica aplicação hospedada da 019, tipos oficiais de 55 RPCs, adapter, API, interface ou jornadas reais de navegador. A aplicação no projeto pessoal permanece sujeita à revisão e execução manual supervisionada; as migrations anteriores não devem ser reaplicadas.

## Atualização posterior — tipos oficiais e aplicação pessoal

O checkpoint acima descreve o commit inicial `a3268b6`; permanece como histórico. Seu [run Foundation 38139415548](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38139415548/attempts/1) confirmou 19 migrations, catálogo 1.269, segunda aplicação sem pendências e descarte completo. A falha foi exclusivamente a divergência do baseline: uma RPC adicionada, sem alteração dos contratos anteriores. A barreira de seis conexões não foi executada nesse run.

O export oficial foi baixado uma vez, revisado como texto/AST e incorporado no commit `aa1b526`, conforme a [proveniência dos tipos 019](t013-local-types-019-20261011.md). A suíte SQL completa então passou: 19 migrations, 35 tabelas, uma view, 55 RPCs, 326 colunas, 194 argumentos, 36 arquivos de assertivas e catálogo PGlite 1.266/zero desvios. TypeScript global, lint do baseline e integridade do bundle SQL também passaram.

A raiz aplicou somente a 019 no SQL Editor autenticado do projeto pessoal `rishenjoikgmfubmnfiu`, após conferir os pré-requisitos e a ausência das funções. O editor foi comparado com o texto revisado de 4.115 bytes antes de uma única execução, concluída com `Success. No rows returned`. A consulta posterior, somente de catálogo e com rollback, confirmou corpos, assinaturas, owners, configurações e ACL das duas funções; RLS e o fechamento do acesso direto a `auth.sessions` permanecem corretos. Não houve reset, seed, reaplicação de 001–018 nem leitura de registros de Auth.

A [evidência fechada da 019](evidence/own-sessions-schema-019-20261011.json) separa o run local, os tipos locais e essa verificação hospedada restrita. Ela não certifica catálogo hospedado completo, export oficial hospedado, API/UI, login no navegador de produção ou release. A integração da aplicação e sua nova validação continuam pendentes neste checkpoint.

O [Foundation 38141763254, fonte aa1b526](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38141763254/attempts/1) foi então conferido por captura única própria, revisada antes da leitura. Seu [summary público fechado](evidence/native-foundation-019-aa1b526-20261011.json) registra `PASSED`: 19 migrations, 1.269 verificações, no-op zero, tipos de 55 RPCs iguais por AST com zero diferenças, cinco controles de drift recusados corretamente e seis conexões PostgreSQL reais. A barreira identificou seis backends distintos na mesma janela de um minuto, com cinco chamadas permitidas e uma negada. Limpeza individual e descarte da infraestrutura foram confirmados, sem pendências ou escrita incerta; 38 fontes Git e duas dependências declaradas conferem. Esse aceite local não certifica banco hospedado completo ou jornadas de navegador.
