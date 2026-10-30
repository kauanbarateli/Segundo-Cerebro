# Prompts de retomada — executar somente após o mantenedor retomar

## Entrada comum

> Retome o Segundo Cérebro em https://github.com/kauanbarateli/Segundo-Cerebro pela PR #120, branch `codex/mvp-goals-terminal-20261023`. Leia AGENTS.md, CONTEXT.md, D-077/D-078/D-079 e `docs/implementation/handoff-retomada-20261025-pausa-mvp.md`. Registre o HEAD/árvore realmente obtidos. Mantenha merge e produção bloqueados até testes/revisão. O escopo é MVP operacional, redesign, onboarding e landing do protótipo17; Asaas/checkout/abertura comercial/Drive estão fora e restore é pós-lançamento. Preserve os WIPs e dados QA. Não carregue SDKs, Next, SQL ou suites pesadas localmente; máquina8GB, Node24/checks leves seriais, execução pesada no GitHub. Entregue patch/branch isolada com implementado/validado/pendente, sem coautoria. Root revisará antes de incorporar. Não atuar nos mesmos paths de outra frente.

## Frente A — CI e foco de Metas

> Comece pelo bloqueio observado dos dois gerais ce7: `finance-goals-image-upload.spec.ts:137`, foco no alert do caso failed finalize. Use os recibos e linhas do handoff; não baixe novamente os originais locais existentes. Inspecione `goal-editor.tsx` e o commit real do erro antes de propor correção. O requestAnimationFrame anterior ao commit é hipótese, não causa provada. Preserve assert de foco, timeout/retries, lifetime/sessão, diagnóstico e ausência de reenvio/efeitos indevidos. Prepare correção pequena com regressão significativa; execute no GitHub. Não editar o Gallery ou o onboarding desta frente. Não executar restore nem abrir nova frente de baseline.

## Frente B — onboarding

> Qualifique a cadência itemv2 e o teste G4 V3 já integrados: legado JSON exato, protocolo externo1, dias específicos/meta1–7, edição parcial/retomada, foco/teclado, resumo, recuperação sem duplicatas e negativos de versão desconhecida. Reutilize as suites existentes e os novos testes sem relaxar gates. Confirme SQL descartável/Core/wrapper no GitHub; isso não é teste hospedado. Não criar migration nova para esses campos. Não reabrir a #76 concluída. Entregue resultados por SHA e correções mínimas para #63/#64/#80. O executor HTTP e as conexões são responsabilidade Root, não execute pacotes congelados com pins antigos.

## Frente C — landing e comparação com o protótipo

> Após a frente A liberar E2E e a captura, obtenha o artefato Gallery do Source exato. Qualifique os17 membros, recibo/EXIF/policy/hashes e oito imagens reais. Revise e aplique `docs/implementation/resume/20261025/landing-ui-v2/landing-three-chapters.patch` somente com dependências reais, conferindo before/after contra o checkout atual. Preserve doc17, DS2.1/Geist, layout/filtros/estados, três capítulos Captura/Agenda/Projetos e seletor Projetos/Kanban; manter animação Edge/hero priority, teclado, foco, mobile, temas e reduced-motion. Sem preço, contratação, formulário comercial ou Drive. Não usar screenshots do protótipo como imagens reais. Entregue capturas comparáveis e testes; não certificar visual apenas por CI verde.

## Root — conexões, revisão e release

> Revise cada delta das frentes e seus resultados antes de incorporar. Reconfira PR/source/Preview e use apenas Twry na homologação;001–027 já instaladas, sem reaplicação/reset/seeds. Reconcile o pacote HTTP Main V1 com o candidato final numa cópia nova, preservando gates/cookies oficiais/isolamento/orçamento e canal autorizado de Preview; os pins3403 e runs/janelas antigos não são válidos para código novo. Nunca reutilizar QA existente como ator descartável. Conclua os critérios restantes de #62–65/#80/#81 e aceite humano aplicável em #12/#44. Atualize issues sem encerrar critérios não cumpridos. Antes de qualquer corte de produção, conferir inventário de migrations, callbacks/variáveis e credenciais Google Production adiadas. Não promover ou mergear enquanto bloqueios persistirem. Restore/#42 e comercial/#83/#84 permanecem adiados, sem trabalho automático nesta retomada.
