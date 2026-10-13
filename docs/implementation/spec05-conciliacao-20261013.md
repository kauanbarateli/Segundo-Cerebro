# SPEC-05: conciliação das sete histórias — 13/10/2026

Root revisou as sete histórias e decisões de teste originais da #6/doc 13, as fontes pertinentes e o mapa independente do agente. A conciliação usa os canais já registrados; não decorre apenas do estado dos filhos e não declara uma nova execução de todas as suítes.

| História original | Fonte e prova pertinente |
| --- | --- |
| Nota em blocos, criação por wiki-link e backlink | [Jornada editor→SQL→link→backlink](../../tests/e2e/issue28-knowledge-sql.spec.ts), caso iniciado na linha 153: documento salvo/texto derivado, destino persistido e navegação; identidade preservada após rename/reload. Extração pura e contratos mantêm suas suítes próprias. |
| Referências e vínculos navegáveis | A mesma jornada abre backlink; [lixeira de subárvore](../../tests/e2e/issue28-knowledge-tree-sql.spec.ts), linha 216, também abre Relacionado→Captura. O [painel compartilhado](../../src/components/layout/related-panel.tsx) valida destinos fechados e a identidade da fonte. Não se afirma clique em todos os nove tipos nem desempenho hospedado. |
| Lixeira de páginas/cadernos | Os dois casos de subárvore/caderno, linhas 216/234 do spec acima, preservam árvore, vínculos, referências e exclusões anteriores. Suas passagens próprias em `940` não reclassificam a outra falha daquele lote como PASS global. A alteração posterior do oracle de cópia não modifica esses dois casos. |
| Projetos agrupando itens, criar aqui e vincular existente | [Jornadas SQL de Projetos](../../tests/e2e/issue30-projects-sql.spec.ts), linhas 197/202/210/218: captura/caderno/tarefa navegáveis, vínculo/desvínculo/revínculo sem copiar conteúdo, exclusão/restauração do projeto sem apagar os itens. Preservação histórica de pastas/arquivos não reintroduz Drive no MVP. |
| Hábitos, pausas, passado e sequência | [Jornadas SQL de Hábitos](../../tests/e2e/issue30-habits-sql.spec.ts), linhas 119/148/192: 230 dias além das 182 células, pausas gerais/individuais sem apagar marcações, passado aceito/futuro recusado na tela/Core/SQL e dia civil de São Paulo sob UTC. |
| Cofre, prova do kit e item ilegível preservado | [GUI SQL do Cofre](../../tests/e2e/issue31-vault-sql.spec.ts), linhas 246/294: prova byte a byte, contexto limpo, recuperação com kit antigo, AAD e diagnóstico do item ilegível sem ocultá-lo. [Contrato de cifra](../../tests/contracts/real-vault-cipher.test.ts) verifica envelopes/isolamento e ausência de segredo/kit nos dados do servidor. |
| Duas agendas, multidia e lembrete | [Duas contas, filtros, aviso/retirada e cron pessoais](google-producao-20261012.md); multidia e expansão sem reload conservam suas fixtures montadas. A [composição OAuth/PKCE/AAD/evento/desconexão](t025-oauth-composition-20261013.md) passou Root 86/86 e peer focado 1/1 com HTTP Google sintético explícito. |

## Decisões de teste e limites

O [planejamento](../planejamento/13-tickets.md) permite Google mock/fixture e define o seam do editor como documento salvo/texto derivado, sem depender do DOM interno do TipTap. Extração pura, contratos dos adapters, cifra/AAD e jornadas possuem suas provas próprias. As fixtures GUI usam componentes/runtime/SDK/SQL canônicos com Auth/HTTP/SSR declarados; não são serviço hospedado, aparelho físico ou importação de backup.

Na leitura atual do GitHub, #28/#30/#31/#32 estavam `CLOSED/COMPLETED`; Drive/#29 continua retirado como `not_planned`, sem aceite presumido. Root conferiu os quatro estados separadamente. As sete histórias podem ser conciliadas e #6 encerrada após publicar este mapa, preservar integralmente o histórico e confirmar o readback.

Esta revisão de fontes não executou serviços, SQL remoto, testes adicionais de navegador ou abriu relatórios/capturas privados. Restore, fecho seguro dos runners, aceite humano de release, aparelhos e manutenção das dependências mantêm suas próprias pendências. Nenhum resultado global falho foi convertido em PASS.
