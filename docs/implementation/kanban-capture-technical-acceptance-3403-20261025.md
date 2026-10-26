# Kanban e Capturar — aceite técnico de #73 e #75

Root e peer conferiram os critérios contra os casos efetivamente executados na Fundação push 3403, run 40234742944/job 121293777449. O original tem checkout real 3403 na linha 192 e árvore 7fdeb63d. Passaram 3624 unidades por fuso UTC/São Paulo, 2286 scripts sem falha/skip e 541 E2E individuais, sem retry. Camadas 558/2452, contraste 164 pares e Impeccable 0 achados também foram confirmados. [Comprovante público](evidence/foundation3403-technical-qualification-20261025.json).

| Entrega | Critérios e provas |
| --- | --- |
| #73 — coleção e projeções | Os casos de [Tarefas](../../tests/e2e/tasks.spec.ts) cobrem a mesma coleção/IDs em Lista e Kanban, filtros, contadores, criação e estados. Contratos de comando, replay/CAS/eventos/recibos e projeções existentes passaram nos dois fusos. |
| #73 — falha, foco e mobile | Três casos específicos Kanban, dentro dos 11 E2E do arquivo: 320 claro/1440 escuro, foco por teclado, colunas alcançáveis sem transbordo global, movimento reduzido, arquivo/lixeira e alternativas ao drag. Não se afirma aparelho físico. |
| #75 — documento e concorrência | Legado/normalização/links, contrato documental, journal e E4 passaram nos dois fusos. Dois grupos SQL canônicos e oito E2E de persistência cobrem CAS/replay, autosave, resposta perdida, duas abas e recusa de isolamento. |
| #75 — promoção e vínculos | Core E4 cobre as duas ordens de promoção, homônimos, renomeação, namespace, recibos e rollback, sem usar IDs de Captura como Página. Metadados privados das imagens e retentores conservam seus contratos. |
| #75 — editor e mobile | Doze casos CaptureShell e oito Captures, incluindo seleção 0/3, toolbar/foco, Ctrl+K local, referências, rascunho e geometria 320/390/1280 nos dois temas. A prova de promoção vem dos casos próprios, não dos pixels do shell. |

As suites de navegador usam a aplicação real com dados demo ou SQL canônico PGlite e seams explícitos de Auth/HTTP, conforme seu canal. Elas não são apresentadas como GoTrue, Storage ou Google hospedados. O positivo conectado histórico de Capturar/promoção é complemento delimitado; não foi repetido para gerar documentação.

Os oito critérios técnicos de #73/#75 estão atendidos na PR #120. Não há lacuna concreta que exija repetir manualmente as permutações já cobertas. O aceite global #44/#81, aparelhos físicos e restore #35/#42 continuam separados, assim como os ensaios expressamente conectados das outras issues. Merge e produção permanecem bloqueados.

As issues foram encerradas como concluídas após a revisão: [#73](https://github.com/kauanbarateli/Segundo-Cerebro/issues/73#issuecomment-6405241639) e [#75](https://github.com/kauanbarateli/Segundo-Cerebro/issues/75#issuecomment-6405242103). O épico #71 marcou somente essas filhas adicionais e permanece aberto.
