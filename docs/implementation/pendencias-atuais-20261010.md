# Segundo Cérebro — próximos passos e SQL manual

Atualização de 10/10/2026. O MVP possui código, migrations e testes dos módulos; a liberação completa continua condicionada aos aceites abaixo. A issue #25 foi encerrada e as outras 22 permanecem abertas. Este arquivo é uma lista de execução; o histórico e as provas completas estão em `docs/implementation/entrega-mvp-pendencias.md`.

## Banco pessoal: executar somente o que falta

Destino exclusivo: projeto Supabase `rishenjoikgmfubmnfiu`. Não utilizar BlackSheep ou Sistema VOE.

1. A aplicação das migrations 001–016 foi informada pelo mantenedor; a conferência hospedada pós-016 aprovou 1.246 checks. **Não reaplicar 001–016 nem bootstrap.**
2. A última consulta hospedada bem-sucedida, de 10/10 às 08:57 UTC, não encontrou os efeitos da 017. O mantenedor informou que iria aplicá-la, sem confirmação posterior. Se ainda não foi executada, aplicar manualmente somente [017 — plano financeiro mensal](../../supabase/sql-editor/installation/017_20261010044217_finance_monthly_plan.sql) no SQL Editor pessoal. Se já foi executada, conferir os efeitos antes de qualquer nova execução.
3. Reconferir em leitura: categoria nula permitida para plano total; `user_id` obrigatório; constraint do payload; índice único do plano total por dono/mês. O hash SHA-256 da migration é `a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf`.
4. Após a confirmação da 017, obter novo export oficial TypeScript do schema público e executar a comparação conforme [guia de tipos](../operations/database-types.md). O export integrado atual é pós-016; aprovação local não comprova freshness hospedada.

Não executar asserções com fixtures, seeds ou reset na base pessoal. CI/build/deploy não aplicam schema remoto. A limpeza exata anteriormente autorizada foi reconferida sem resíduos no conjunto examinado; não repetir a operação.

## Validações em andamento

Os dois CIs próprios de `df601ff5bc1c1af8a79580a4aacd622700cce8b5` passaram. O [Auth local 38061752212](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38061752212) comprovou logout, isolamento de duas contas/eventos e troca normal de senha pela GUI; a extensão de Capturas/Tarefas aprovou persistência, dois replays, lixeira/restauração, eventos/recibos atômicos e ausência dos registros temporários após a limpeza. O recorte passou 11 estágios/12 checks, com 45 HTTP/29 RPC/16 leituras públicas. A [Foundation 38061752200](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38061752200) aprovou 1.558 testes por fuso, 350 scripts mais dois controles separados de scanner, 187 E2E demo/zero flaky e SQL 17/35/catálogo 1.243. [Provas e limites](t015-capture-task-persistence-local-ci.md). Testes novos de preferências/Drive e colisão de `client_id` ainda aguardam rodada própria; não herdam esse aceite.

A revisão humana do navegador de produção está **adiada por escolha do mantenedor**. Testes demo, transportes sintéticos e Supabase local têm limites separados das jornadas hospedadas.

## Pendências por issue

| Issue | Aceite que ainda precisa ser concluído |
| --- | --- |
| [#20 — dados](https://github.com/kauanbarateli/Segundo-Cerebro/issues/20) | 017 e export oficial; gate de tipos/no-op; isolamento dos demais módulos e operação hospedada. |
| [#21 — autenticação](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) | SMTP pessoal e recuperação/PKCE; senha forçada, refresh e concorrência; jornadas de produção/aparelho. |
| [#22 — Capturar/Tarefas](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22) | Colisão/escopo de `client_id`, contrato M1 completo contra adapter real; jornadas entre contextos; anexos reais/EXIF; erro RLS apresentado na interface. Os replays nativos passaram, mas o critério composto de unicidade continua pendente de prova própria. |
| [#23 — Início/eventos](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23) | Prova integrada de preferências ocultando consultas; todos os comandos/eventos, Início e paginação de Atividade na interface conectada. |
| [#24 — administração](https://github.com/kauanbarateli/Segundo-Cerebro/issues/24) | Jornadas entre sessões, veto/último master sob concorrência, usuário com senha provisória e reconciliação Auth incerta. |
| [#26](https://github.com/kauanbarateli/Segundo-Cerebro/issues/26) e [#27 — financeiro](https://github.com/kauanbarateli/Segundo-Cerebro/issues/27) | Interface conectada: filtros/reload, privacidade, Desfazer e operações concorrentes. UI do plano total pertence à fase 2. |
| [#28 — conhecimento](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) | Edição/reload/promoção/restauração conectados e leitor/acessibilidade. Consulta em lote já possui prova separada. |
| [#29 — Drive](https://github.com/kauanbarateli/Segundo-Cerebro/issues/29) | Uso composto de bytes/DTO/interface; upload/download real, MIME/tamanho falso/EXIF, revogação, falha objeto→commit e cron autenticado de limpeza. |
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
2. Integrar e executar os testes novos de preferências/Drive e colisões; atualizar as issues mantendo critérios e histórico.
3. Preparar SMTP, Google, cron e destino de backup pessoais conforme os runbooks existentes.
4. Quando o mantenedor retomar o aceite hospedado, executar as jornadas com conta comum descartável, sem utilizar a conta master como fixture; conferir limpeza dos conjuntos exatos.
5. Executar restore/aparelhos/auditoria visual e só então encerrar os critérios completos e liberar o release.

Não enviar senhas, tokens, chaves ou kit do Cofre pelo chat. Configurações externas ainda pendentes não equivalem a falha nos testes locais já concluídos.
