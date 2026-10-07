# T-008 — Início e comandos de hábitos

O Início agora monta o panorama a partir do provider compartilhado de demonstração, usando o mesmo adapter e os mesmos IDs de Capturar/Tarefas. Concluir e reabrir uma tarefa altera a entidade; marcar e desmarcar um hábito usa o comando transacional. Os contadores são recalculados após a invalidação dessas leituras.

## Referências e decisões

- **OBSERVADO:** T-008 no doc 13, doc 14 §§3/9 e captura do protótipo de 29/09/2026. DS 2.1, PRODUCT, DESIGN, doc 08 e Impeccable local/craft-floor orientam a composição.
- **RECOMENDADO:** um cartão inverso de foco, seguido de tarefas, agenda, hábitos, financeiro e entrada/organização; a mesma ordem permanece no DOM e no mobile. Organização integra a Caixa de entrada, para reunir a métrica e a ação sobre a mesma coleção.
- **CONFIRMADO na coordenação:** relógio de exemplo `2026-09-23T17:00:00.000Z`; sete tarefas reais produzem 5 abertas/2 concluídas, substituindo os offsets 7/12 do HTML. Hábitos produzem 67%, substituindo 68% arbitrário. A factory compartilhada aceita outro relógio.
- Proveniência detalhada e massa acordada: [brief Início](../../.impeccable/surfaces/inicio.md).

## Composição e estados

`HomeView` consulta `tasks`, `captures`, `habits`, `finance` e `agenda` via `useDemoQuery`. Cada consulta recebe `enabled = ready && acessoAoInicio && allowed && visible`. Preferência esconde o bloco/atalho e seus contadores; entitlement impede o acesso. Nenhum bloco oculto exige uma consulta própria. Projetos no subtítulo ficam condicionados à política de Projetos; o provider controla o enriquecimento da taxonomia.

Cada bloco de dados oferece carregamento anunciado, erro com tentativa novamente e vazio com link para seu módulo. Uma revalidação preserva os dados existentes; mutações bloqueiam somente o item em andamento e exibem resultado/erro legível. IDs e textos são renderizados por React, sem HTML inserido.

Tarefas do dia combinam foco em andamento, atrasadas abertas, prazo/agendamento no dia e concluídas hoje. São três linhas em 320–639px e até cinco a partir de 640px, provenientes do mesmo array. Ao concluir, o foco é mantido naquela entidade para permitir reabrir. Se uma linha deixa a lista móvel, o foco de teclado retorna à ação principal. Os links usam `/tarefas?task=<id>`, `/tarefas?view=hoje` e `/capturar?capture=<id>`, contratos confirmados com as telas.

A agenda usa sobreposição com intervalo semiaberto do dia de São Paulo. A semana de hábitos começa na segunda-feira e usa as funções portadas do Núcleo, incluindo cadência semanal e pausas. O financeiro reutiliza competência, saldo, fatura e datas do Núcleo; não faz soma monetária no JSX. A organização deriva 4/7 notas ativas e 3 capturas de entrada.

Os controles têm alvos de 44px, nomes acessíveis e estados explícitos. Títulos de linhas ocupam até duas linhas; valores monetários mantêm dígitos tabulares. Tokens existentes fornecem cores nos dois temas. O CSS remove as transformações de ativação sob movimento reduzido. A safe area continua sendo responsabilidade do shell.

## Comandos de hábitos

`marcarHabito(store, deps, context, { habit_id, done_on, done, client_id })` recebe estado desejado explícito. Marcações e eventos ocorrem na mesma transação; repetição do mesmo client_id recupera a resposta sem duplicar evento. Desmarcar remove fisicamente a marca, registra evento deleted (before=marca/after=null) e um remarcar usa novo ID.

Validações: entidade do usuário, hábito ativo, data civil válida, dia não anterior ao início e não posterior a hoje no fuso do app. Nova marcação respeita pausa/cadência; weekly_target aceita qualquer dia elegível. Remover uma marca existente continua possível se pausa/cadência mudaram depois dela, mas exige hábito ativo e data dentro do intervalo permitido. A projeção conserva o botão Desmarcar nesse caso.

`registrarPausaHabito(store, deps, context, { habit_id, starts_on, ends_on, reason, client_id })` permite pausa individual ou geral, intervalo passado/futuro ou aberto. Exige fim maior ou igual ao início, motivo até 200 caracteres e, no recorte individual, hábito ativo do usuário com início da pausa a partir do início do hábito.

**Conciliação aprovada com o legado:** a tolerância antiga de marcação até UTC+2 dias foi substituída pelo dia civil real do app. Pausas futuras continuam permitidas; uma data futura não pode receber marcação antecipada. Datas inválidas não são normalizadas silenciosamente. A política e o relógio são testados perto da virada UTC.

O barrel de hábitos exporta os comandos explicitamente. O import de tipos em contracts/modules aponta diretamente para habits.ts, evitando ciclo entre contratos e casos de uso. Nenhuma dependência de framework/SDK foi introduzida no Núcleo.

## Validação executada

| Verificação | Evidência |
|---|---|
| Comandos de hábitos | 29 testes: dono, intervalo, cadência, pausa, idempotência concorrente, rollback de evento/commit e isolamento de entradas/retornos. |
| Projeções Início | 12 testes: massa coerente, conclusão/reabertura, virada UTC, ciclo de vida, organização, cadências/pausas, remoção após pausa, agenda semiaberta, competência/fatura e coleções vazias. |
| TZ=UTC e TZ=America/Sao_Paulo | 41/41 em ambos os fusos. |
| ESLint do recorte e typecheck | Sem erros no momento da validação. |
| Portão de camadas do recorte | 52 módulos/132 dependências, sem violações. |

`tests/e2e/home.spec.ts` foi atualizado com contratos para 320/390/768/1280, 3/5 linhas, navegação, teclado, alvos, tema/reduced-motion, concluir/reabrir, marcar/desmarcar, preferência/entitlement e meta de 2,5 telas. A execução desses E2E, a revisão visual dos screenshots e a medição no navegador ficam para a integração coordenada; não são declaradas aprovadas aqui. Não houve execução de build, servidor ou banco por este recorte.

Não se declara teste em aparelho real, Safari ou leitor de tela. Calendário/Hábitos ainda têm destinos de fase posterior; os links existem, mas este ticket não implementa seus CRUDs completos. Persistência da sessão é a demonstração em memória, não persistência de produção.
