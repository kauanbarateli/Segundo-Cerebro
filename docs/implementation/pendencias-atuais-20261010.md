# Segundo Cérebro — próximos passos e SQL manual

Atualização de 10/10/2026. O MVP possui código, migrations e testes dos módulos; a liberação completa continua condicionada aos aceites abaixo. A issue #25 foi encerrada e as outras 22 permanecem abertas. Este arquivo é uma lista de execução; o histórico e as provas completas estão em `docs/implementation/entrega-mvp-pendencias.md`.

## Banco pessoal: executar somente o que falta

Destino exclusivo: projeto Supabase `rishenjoikgmfubmnfiu`. Não utilizar BlackSheep ou Sistema VOE.

1. A aplicação das migrations 001–016 foi informada pelo mantenedor; a conferência hospedada pós-016 aprovou 1.246 checks. **Não reaplicar 001–016 nem bootstrap.**
2. A [conferência hospedada somente leitura de 10/10 às 16:11:22 UTC](evidence/hosted-017-readonly-20261010.json), pelo painel pessoal já autenticado, confirmou que os efeitos da 017 continuam ausentes. O mantenedor informou que iria aplicá-la, sem confirmação posterior. Aplicar manualmente somente [017 — plano financeiro mensal](../../supabase/sql-editor/installation/017_20261010044217_finance_monthly_plan.sql) no SQL Editor pessoal. Se houver uma aplicação posterior à conferência, verificar os efeitos antes de qualquer nova execução.
3. Reconferir em leitura: categoria nula permitida para plano total; `user_id` obrigatório; constraint do payload; índice único do plano total por dono/mês. O hash SHA-256 da migration é `a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf`.
4. Após a confirmação da 017, obter novo export oficial TypeScript do schema público e executar a comparação conforme [guia de tipos](../operations/database-types.md). O export integrado atual é pós-016; aprovação local não comprova freshness hospedada.

Não executar asserções com fixtures, seeds ou reset na base pessoal. CI/build/deploy não aplicam schema remoto. A limpeza exata anteriormente autorizada foi reconferida sem resíduos no conjunto examinado; não repetir a operação.

## Validações em andamento

O [contrato M1 de Capturas/Tarefas contra o adapter real](t015-real-m1-contract-20261010.md) passou com fonte própria `3a44b7473a05322463cd10463bd64fcb596aa8a7`. A [Foundation 38067281220](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38067281220) aprovou 1.593 testes por fuso, 350 scripts mais dois controles separados de scanner, 188 E2E/zero flaky (187 demo + um de composição), SQL 17/35/catálogo 1.243; os 31 casos reais, 42 Memória preservados e duas regressões de IDs passaram nos dois fusos. O [Auth 38067281227](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38067281227) aprovou o agregado schema4 e suas limpezas. A [projeção fechada](evidence/real-m1-contract-ci-passed-20261010.json) conserva origem, hashes e limites. **O primeiro critério da #22 também exige diff visual ≈ zero: o contrato passou, mas esse critério composto permanece aberto.** O adapter estreito não certifica os demais writers do `UnitOfWork` amplo. Os dois novos E2E de Início/Atividade e a nova composição dos GETs reais permanecem sem aceite de CI próprio neste checkpoint.

Prova anterior, preservada no próprio recorte:

Os dois CIs próprios de `39c38802d1c322065ef3fa1d9f20c75578442b47` passaram. O [Auth local 38064949955](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38064949955) comprovou logout, isolamento de duas contas/eventos e troca normal de senha pela GUI; Capturas/Tarefas aprovou persistência, dois replays, lixeira/restauração, eventos/recibos atômicos e ausência dos registros temporários após a limpeza. O recorte passou 11 estágios/12 checks, com 45 HTTP/29 RPC/16 leituras públicas. A [Foundation 38064949967](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38064949967) aprovou 1.560 testes por fuso, 350 scripts mais dois controles separados de scanner e 188 E2E/zero flaky (187 demo + um de composição), SQL 17/35/catálogo 1.243. A [matriz de todos os 13 comandos de Capturas/Tarefas](t016-all-capture-task-writes-20261010.md) comprovou eventos `web` com diff persistido, replays/no-op sem eventos e rollback; usa PGlite e transporte/Auth de fixture. A [composição de preferências/Drive e as colisões de `client_id`](t016-t022-contract-composition-20261010.md) conserva seu aceite próprio de `854d905`, com HTTP/Auth sintéticos onde declarado; nenhum desses recortes comprova jornadas de produção.

A revisão humana do navegador de produção está **adiada por escolha do mantenedor**. Testes demo, transportes sintéticos e Supabase local têm limites separados das jornadas hospedadas.

## Pendências por issue

| Issue | Aceite que ainda precisa ser concluído |
| --- | --- |
| [#20 — dados](https://github.com/kauanbarateli/Segundo-Cerebro/issues/20) | 017 e export oficial; gate de tipos/no-op; isolamento dos demais módulos e operação hospedada. |
| [#21 — autenticação](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) | SMTP pessoal e recuperação/PKCE; senha forçada, refresh e concorrência; jornadas de produção/aparelho. |
| [#22 — Capturar/Tarefas](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22) | Diff visual da troca de adapter e exceções do porte original; jornadas entre contextos; anexos reais/EXIF; erro RLS apresentado na interface. O componente de contrato M1 de Capturas/Tarefas [passou](t015-real-m1-contract-20261010.md), sem completar o checkbox composto. Replay e unicidade/escopo de `client_id` passaram: por dono/tabela de registros e dono/comando/recibo, sem regra global. |
| [#23 — Início/eventos](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23) | Aceite próprio dos novos E2E de Início com banco/fuso e paginação de Atividade, e da composição dos GETs reais, ainda em preparação. Todos os 13 comandos/eventos passaram na matriz de orquestrador com SQL canônico local. Preferência da conta→zero consulta pelo spy passou com componentes/adapter reais e HTTP sintético; Auth/SQL no navegador são aceites separados. |
| [#24 — administração](https://github.com/kauanbarateli/Segundo-Cerebro/issues/24) | Jornadas entre sessões, veto/último master sob concorrência, usuário com senha provisória e reconciliação Auth incerta. |
| [#26](https://github.com/kauanbarateli/Segundo-Cerebro/issues/26) e [#27 — financeiro](https://github.com/kauanbarateli/Segundo-Cerebro/issues/27) | Interface conectada: filtros/reload, privacidade, Desfazer e operações concorrentes. UI do plano total pertence à fase 2. |
| [#28 — conhecimento](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) | Edição/reload/promoção/restauração conectados e leitor/acessibilidade. Consulta em lote já possui prova separada. |
| [#29 — Drive](https://github.com/kauanbarateli/Segundo-Cerebro/issues/29) | Upload/download real, MIME/tamanho falso/EXIF, revogação, falha objeto→commit e cron autenticado de limpeza. Uso exibido contra soma dos registros passou por SQL canônico→DTO→SSR/ARIA; não certifica bytes de objetos Storage. |
| [#30 — projetos/hábitos](https://github.com/kauanbarateli/Segundo-Cerebro/issues/30) | Vínculos e arquivo/restauração conectados; histórico e heatmap em navegador/aparelho. |
| [#31 — Cofre](https://github.com/kauanbarateli/Segundo-Cerebro/issues/31) | Recuperação/reload e arquivos do kit; worker/clipboard no aparelho; concorrência, revogação e bloqueio visual no logout. |
| [#32 — Google](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) | Credenciais OAuth pessoais; duas contas e recusa da terceira; paginação/410/revogação reais e cron. Sem criação de eventos Google. |
| [#33 — busca](https://github.com/kauanbarateli/Segundo-Cerebro/issues/33) | Jornadas conectadas e acessibilidade; orçamento de 50 mil registros hospedados. O timeout demo anterior e a correção da espera de prontidão têm provas próprias. |
| [#34 — configurações](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) | Persistência de tema/ordem/visibilidade/avatar/agenda em produção e senha forçada com SMTP. |
| [#35 — release](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Backup agendado fora de pasta sincronizada e restore que destrava Cofre; seis jornadas em desktop/iPhone; auditoria Impeccable final e catálogo hospedado pós-017. A prova de allowlist Sentry cobre eventos e transações, sem exigir credencial ativa para esse teste. |
| [#36 — dependências](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) | Correção compatível oficial da cadeia de lint: última auditoria registrou produção sem alertas e cinco high de desenvolvimento. Não aplicar downgrade incompatível ou remover lint para ocultar alertas. |
| [#12 — PWA](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) | Instalação e jornadas em Android/iPhone reais; revisão final de acessibilidade. |
| [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) e [#4–7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/4) | Consolidar os aceites dos tickets vinculados antes de encerrar os épicos. |

## Ordem sugerida de conclusão

1. Confirmar 017 e atualizar os tipos oficiais.
2. Concluir o aceite visual restante do critério composto da #22, validar os novos recortes de Início/Atividade em CI próprio e prosseguir com as jornadas conectadas pendentes; atualizar as issues mantendo critérios e histórico.
3. Preparar SMTP, Google, cron e destino de backup pessoais conforme os runbooks existentes.
4. Quando o mantenedor retomar o aceite hospedado, executar as jornadas com conta comum descartável, sem utilizar a conta master como fixture; conferir limpeza dos conjuntos exatos.
5. Executar restore/aparelhos/auditoria visual e só então encerrar os critérios completos e liberar o release.

Não enviar senhas, tokens, chaves ou kit do Cofre pelo chat. Configurações externas ainda pendentes não equivalem a falha nos testes locais já concluídos.
