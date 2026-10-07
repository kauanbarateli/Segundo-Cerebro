# Início — preparação T-008

Status: implementação T-008 integrada e testes de domínio/projeção executados; validação visual/E2E integrada ainda pendente. Rota `/`, entrada `src/app/(workspace)/page.tsx`, modo **Operate**. O contexto Impeccable desta sessão já foi resolvido pelo fallback documental; launcher não repetido. Skill, shape, operate e craft-floor lidos. A direção DS 2.1 já está aprovada. A evidência atual está em `docs/implementation/t008-inicio.md`.

## Proveniência e alvo

- **OBSERVADO:** doc 14 §§3/9, doc 08 §§1–4, T-008 e `docs/prototipo/prototipo-segundo-cerebro.html` linhas 530–613. Conferida a captura `docs/planejamento/evidencias/2026-09-29/01-home-desktop.png`.
- **OBSERVADO:** a superfície publicada é a casca de T-004: `WorkspacePage`, trilho/cabeçalho e estado de construção. Conferidas capturas `docs/implementation/evidence/t004-t006/home-1280.png` e `home-320.png` contra o código vigente. Não foi aberta outra sessão de navegador nem executado servidor.
- **OBSERVADO:** `.impeccable/surfaces/home.md` ainda descreve T-001/Read e a antiga entrada `src/app/page.tsx`. É contexto histórico; não foi alterado incidentalmente. Este brief orienta T-008.
- **RECOMENDADO:** preservar o shell vigente e substituir somente o conteúdo provisório. H1 `Início`, saudação/data de exemplo e ações `Ver o dia`/`Capturar` sem um segundo h1. Um único cartão inverso para a tarefa em foco; dados restantes em superfícies sólidas, sem vidro, ícones decorativos repetidos ou percentuais sem fonte.

## Composição e comportamento

DOM implementado: cabeçalho → Em foco → Tarefas de hoje → Agenda → Hábitos → pulso financeiro → Caixa de entrada/organização → estatísticas secundárias. **RECOMENDADO e implementado:** foco 12/12, trio operacional 4/12 e financeiro 7/12 + entrada 5/12. Organização integra a Caixa de entrada em todas as larguras, evitando uma cópia distante da mesma métrica; a disposição mantém o percurso de Tab e a ordem DOM no mobile.

**RECOMENDADO:** até três tarefas em 320–639px e cinco a partir de 640px, do mesmo array ordenado; CSS controla exposição e contador, sem `useMediaQuery`. Títulos têm até duas linhas; metadados e badges quebram. Alvos ≥44px, Geist/token de dado, raio/padding do DS, feedback de mutação por item, foco preservado e movimento reduzido. O essencial (foco, tarefas, agenda, hábitos e síntese financeira) precisa caber em ≤2,5 telas a 390px; organização e estatísticas ficam depois. Validar isso em medição de página, não por intenção.

Concluir/reabrir tarefa usa o mesmo ID do módulo Tarefas e atualiza contadores após commit; marcar/desmarcar hábito usa a mesma marcação esparsa do módulo Hábitos. Links abrem `/tarefas?task=<id>`, `/capturar?capture=<id>` e o recorte financeiro acordado com os outros módulos. A rota de destino precisa consumir esses parâmetros; até lá, não afirmar que houve foco no item.

## Universo compartilhado proposto

Os nomes abaixo são **OBSERVADOS**. IDs, datas de calendário, lançamentos e composição de marcações são **RECOMENDADOS** para transformar a demonstração em uma fonte calculável, sem preencher contadores artificialmente.

Relógio fixo de exemplo: `2026-09-23T17:00:00.000Z` (14h em America/Sao_Paulo). `hoje`, semana e mês derivam do Núcleo com esse relógio injetado; nunca `new Date()` dentro de seletores nem a data do sistema. Usuário sintético `demo-user`; nome de apresentação do protótipo, sempre acompanhado de “dia de exemplo”. Categorias comuns: `category-work` Trabalho, `category-personal` Pessoal, `category-study` Estudos. Projetos: `project-sc-v2` Segundo Cérebro V2 e `project-central-voe` Central VOE.

### Tarefas

| ID proposto | Título observado | Estado | Prazo em São Paulo | Organização |
|---|---|---|---|---|
| `task-proposta` | Enviar proposta Central T15 | todo | 22/09, dia inteiro | Trabalho / nenhum |
| `task-milestones` | Revisar plano de milestones do V2 | in_progress | 23/09 14:30 | Trabalho / Segundo Cérebro V2 |
| `task-fatura` | Pagar fatura do cartão Nubank | todo | 05/10, dia inteiro | Pessoal / nenhum |
| `task-rls` | Estudar RLS de moderação | todo | 24/09, dia inteiro | Estudos / nenhum |
| `task-spec` | Escrever spec do T-001 | todo | 25/09, dia inteiro | Trabalho / Segundo Cérebro V2 |
| `task-racao` | Comprar ração do Canto | done | 23/09, dia inteiro; concluída 10h | Pessoal / nenhum |
| `task-rodada` | Responder rodada 2 | done | 23/09, dia inteiro; concluída 11h | Trabalho / Segundo Cérebro V2 |

Foco inicial: `task-milestones` (em andamento). Esta coleção produz **5 abertas e 2 concluídas na semana**, não os literais 7/12 do HTML. Recomenda-se mostrar o resultado real. Para preservar 7/12, será necessário aprovar registros adicionais completos; não adicionar offsets aos contadores. “Tarefas de hoje” = atrasadas não concluídas + prazo/agendamento no dia, com concluídas do dia por último. A tarefa da fatura de outubro fica fora: o protótipo a colocava na lista de hoje sem um agendamento que justificasse isso.

### Capturas e organização

Preservar os sete IDs de origem do doc 14: `architecture`, `vision`, `journal`, `finance` em `organized`; `watch`, `accountant`, `book` em `inbox`; nenhuma arquivada/excluída. Títulos, tipos, categorias, projetos e corpos vêm integralmente do doc 14 §3; prefixar IDs de armazenamento apenas se o provider adotar isso uniformemente. O tipo task de `accountant` não significa tarefa convertida.

Derivar **4 de 7 organizadas** e **3 por organizar** da mesma coleção. O numerador considera `status=organized`; denominador exclui draft, archived e deleted. Inbox mostra até três registros e abre o mesmo ID em Capturar. Organização pertence à leitura de Capturar, sem consulta ao módulo Conhecimento para inventar um número paralelo.

### Agenda

| ID proposto | Evento observado | Intervalo local de exemplo | Nota |
|---|---|---|---|
| `event-daily` | Daily Maestri | 23/09 09:30–09:45 | Google Meet é rótulo ilustrativo; sem URL externa inventada |
| `event-voe` | Reunião Central VOE | 23/09 15:00–16:00 | não mostrar “nota vinculada” sem ID de nota correspondente |
| `event-academia` | Academia | 23/09 19:00–20:00 | pode referenciar `habit-academia`; conclusão não altera o evento |

São três compromissos no dia; às 14h, o próximo é **15h**. O literal 14:30 do rodapé do protótipo pertence à tarefa em foco e não deve ser reutilizado como próximo compromisso.

### Hábitos

- `habit-leitura`: Ler 20 minutos, daily, início 12/09/2026, marcações em todos os dias de 12 a 23/09 inclusive: sequência atual **12 dias**, hoje feito.
- `habit-academia`: Academia, weekly_target=3, início 17/08/2026. Marcar segunda/terça/quarta nas semanas iniciadas em 17/08, 24/08, 31/08, 07/09 e 14/09; nesta semana marcar 21 e 22/09. Resultado: **2 de 3**, cinco semanas anteriores cumpridas, hoje pendente.
- `habit-meditacao`: Meditar 10 min, weekdays=[1,3,5], início 21/09/2026, marcação 21/09, nenhuma pausa. Hoje pendente; terça anterior não elegível.
- Resumo desta semana até hoje pelo Núcleo: 4 oportunidades cumpridas em 6, **67%**. Marcar Academia em 23/09 atinge a meta, passando a 5/6, **83%**. O literal 68% do HTML não representa essa massa e deve ceder ao cálculo.

### Financeiro

Objetivos observados: entradas800000, saídas324760, resultado475240, Itaú431742, CDB1850000, dívida Nubank241280 (todos em centavos). Uma massa mínima coerente que preserva esses valores:

- `account-itau`, checking, saldo inicial195222; `account-cdb`, investment, saldo inicial1370000; `account-nubank`, credit_card, saldo inicial0, fechamento28, vencimento5 e limite recomendado500000.
- Receita em Itaú800000 em05/09. Despesa Moradia em Itaú83480 em05/09. Transferência Itaú→CDB480000 em06/09, duas pernas no mesmo transfer_group_id e excluída do resultado por competência.
- Compras Nubank com statement_month=2026-09-01: Alimentação123410 em20/09, Transporte45420 em21/09, Saúde38990 em15/09, Outras32440 em16/09 e Moradia1020 em10/09. Total da fatura241280; fechamento28/09, vencimento05/10, estado derivado aberto no relógio do exemplo.
- Todas essas linhas confirmed, deleted_at=null e source=manual. Cash pago integral; compras de cartão passam por normalizarPagamento. Nenhuma linha de pagamento da fatura: fatura aberta integral.
- Opcional para a próxima tela financeira: Internet fibra9990, vencimento28/09, pending e paid_cents0; não altera os totais reais. Cenários dos cinco estados de fatura devem ser fixtures de teste controladas, sem quebrar o universo inicial.

O pulso usa totaisFinanceiros, saldosFinanceiros, faturaFinanceira e a regra de status existente. Não contém valor monetário formatado como fonte de cálculo nem soma própria no JSX.

## Provider, consultas e acesso

**CONFIRMADO pela coordenação:** provider único em `src/lib/demo/application.ts` + `demo-provider.tsx`, montado no layout workspace dentro de DemoAccessProvider. Uma instância do adapter por sessão/usuário, relógio/IDs injetados e invalidação após comandos. Queries subscritas recarregam; as demais ficam stale. Dados de domínio permanecem em memória nesta etapa.

`useDemoQuery(key, enabled=true)` devolve `{ status: 'idle' | 'loading' | 'ready' | 'error', data: T | null, error: string | null, retry() }`. `useDemoApplication()` fornece `userId`, `today()`, `clock` e `commands`. Chaves e retornos acordados:

| Chave | Dados |
|---|---|
| tasks | items:Tarefa[], categories:Categoria[], projects:Projeto[] |
| captures | items:Captura[], categories:Categoria[], projects:Projeto[] |
| habits | items:HabitoDoUsuario[], entries:MarcacaoHabito[], pauses:PausaDoUsuario[] |
| finance | accounts, categories, transactions, budgets |
| agenda | items:AgendaEvent[] |

HomeView compõe essas queries e seletores puros em `projections.ts` sem criar outro store. Cada chamada recebe enabled conforme a política abaixo. Estado idle significa nenhuma leitura, não vazio nem carregamento falso. Comandos de hábito acordados: marcarHabito(store,deps,context,{habit_id,done_on,done,client_id}) e registrarPausaHabito(...,{habit_id,starts_on,ends_on,reason,client_id}).

Nenhuma consulta até `useDemoAccess().ready`. Resolver allowed e visible separadamente; criar a chamada somente quando ambos forem verdadeiros. Preferência oculta o bloco e cancela sua leitura no Início, mas não proíbe abrir a rota do módulo; entitlement negado impede a operação. Desligar Tarefas remove também foco/estatísticas desse módulo; desligar Capturar remove entrada/organização; sumário não contém contadores de módulos que não foram consultados. Categorias são taxonomia compartilhada; não consultar Projetos só para o subtítulo se esse módulo está desligado. Respostas de uma leitura iniciada antes de desligar precisam ser descartadas, sem reaparecer no estado.

## Lacunas e divisão de arquivos

1. **Agenda:** root publicará AgendaEvent e query agenda por intervalo local; é leitura de exemplo, sem integração Google. Não colocar agenda como array privado no componente.
2. **Hábitos:** comandos em preparação no recorte T-008, com evento na mesma transação. Política confirmada: futuro proibido pelo dia do app; nova marcação respeita cadência e pausa; desmarcar uma linha existente continua possível se pausa/cadência mudaram; pausa futura permanece permitida. A UI não escreve diretamente no Map.
3. **Reatividade:** provider coordenado invalida queries subscritas e marca as demais stale. Não instanciar um adapter para cada feature.
4. **Drill-down:** acordar parâmetros estáveis com T-009/T-010/T-011. Origem ID permanece a autoridade; busca por texto do título do protótipo não é contrato.

Ownership implementado: root mantém `src/lib/demo/application.ts`, `demo-provider.tsx`, o seed compartilhado, layout e portas; agente Início assume `src/components/features/inicio/**`, `src/app/(workspace)/page.tsx`, `tests/features/home-projections.test.ts` e `tests/e2e/home.spec.ts`. O recorte deste agente inclui `core/habitos/use-cases.ts` e `tests/core/habit-commands.test.ts`, integrados após a publicação T-007. Nenhuma feature importa outra; o ponto compartilhado é provider/contratos do Núcleo.

## Evidência a produzir na implementação

Teste do agregador com relógioUTC e spies: módulos ocultos/negados recebem zero chamadas; erro não vira lista vazia; reativação consulta; conclusão usa o mesmo ID/contagem em duas rotas; marcação de hábito atualiza taxa via Núcleo. E2E a 320/390/768/1280, claro/escuro e uma passagem de teclado/reduced-motion; medir a meta de 2,5 telas em 390px. Estados de vazio por bloco com CTA de seu módulo, skeleton com a geometria final, erro legível+retry e estado de comando sem remover foco. Estes são critérios planejados, não verificações já executadas.
