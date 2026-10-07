# T-007 — Contratos do Núcleo e adapter de referência

Implementado em 07/10/2026, sem banco, SDK, framework, servidor ou interface. Fundamentação: [ADR-0001](../adr/0001-usuario-e-a-unidade-de-isolamento.md), [ADR-0002](../adr/0002-nucleo-e-a-unica-porta-para-os-dados.md), [ADR-0004](../adr/0004-toda-escrita-emite-evento-de-dominio.md), docs [02](../planejamento/02-arquitetura-proposta.md), [05](../planejamento/05-arquitetura-de-produto.md), [06](../planejamento/06-arquitetura-de-dados.md) e [T-007/T-009/T-010](../planejamento/13-tickets.md). Tipos e conversão comparados com o legado `ffdf06435a5b8dcd047574172cddf1cc772dfd09` (`database.types.ts`, actions e conversão de `0017_projetos.sql`). Nenhum SQL foi criado ou executado.

## API para integração M1

- `src/core/contracts`: `UnitOfWork`, `Transacao`, `ContextoDeEscrita`, `DependenciasDeDominio`, `ErroDeDominio`, tipos das entidades/eventos e ports por módulo.
- `src/core/capturas`: `criarCaptura`, `editarCaptura`, `arquivarCaptura`, `excluirCaptura`, `restaurarCaptura`, `converterCapturaEmTarefa` e seus tipos.
- `src/core/tarefas`: `criarTarefa`, `editarTarefa`, `alterarStatusTarefa`, `excluirTarefa`, `restaurarTarefa` e seus tipos.
- `src/adapters/memory`: `criarAdapterMemoria`, `EstadoInicialMemoria`, `OpcoesMemoria`.

Todos os comandos recebem `(store, deps, context, input)`. `deps` fornece `clock.now(): string` e `ids.next(): string`; o adapter não consulta relógio nem gera identificadores globais por conta própria. O contexto `{ user_id, canal }` vem do canal autenticado, nunca de um campo do formulário. Canais aceitos: `web`, `api`, `cron`.

```ts
const deps = { clock: { now: () => new Date().toISOString() }, ids: { next: () => crypto.randomUUID() } };
const store = criarAdapterMemoria({ ...deps, initial: universoDeExemplo });
const context = { user_id: usuarioDaSessao, canal: "web" as const };
const capture = await criarCaptura(store, deps, context, {
  client_id: idDaTentativa, type: "idea", title: "Revisar uma ideia", content: null,
  category_id: null, project_id: null,
});
const conversion = await converterCapturaEmTarefa(store, deps, context, {
  capture_id: capture.id, client_id: idDaConversao,
});
const tasks = await store.read(context.user_id).tarefas.list();
```

Criação recebe todos os campos editáveis, incluindo valores nulos explícitos. Captura admite `status` inicial opcional `draft`/`inbox`; a ausência mantém o `inbox` do legado. Edição recebe `{ id, client_id, patch }`, status de tarefa recebe `{ id, client_id, status }`, ciclo de vida recebe `{ id, client_id }`, conversão recebe `{ capture_id, client_id }` e retorna `{ captura, tarefa }`.

`read(userId)` expõe somente leitura. `get(id)` inclui registros próprios arquivados/na lixeira para permitir restauração; registro ausente ou alheio retorna `null`. `list()` exclui lixeira e arquivados, com opções `includeDeleted`/`includeArchived`; ordenação determinística por `created_at` e `id`. Filtros de inbox, datas e views ficam na projeção de cada módulo. Eventos são append-only e sua leitura também é isolada por usuário. Falhas de infraestrutura são propagadas, nunca convertidas em listas vazias.

Após um comando bem-sucedido, o provider deve invalidar/refazer as consultas afetadas. O retorno de um replay é o resultado original daquela tentativa; o estado atual pode ter sido alterado posteriormente. O provider controla permissões e pode evitar chamar o port quando um módulo estiver negado/oculto. Este adapter não implementa autenticação ou Entitlement.

## Inventário de campos

Os nomes persistentes foram mantidos para facilitar o futuro adapter real, sem importar os tipos gerados de banco.

| Entidade | Campos preservados do legado | Extensões do contrato |
| --- | --- | --- |
| Captura | `id`, `user_id`, `type`, `title`, `content`, `status`, `category_id`, `project_id`, `converted_task_id`, `captured_at`, `organized_at`, `created_at`, `updated_at` | `client_id`, `archived_at`, `deleted_at` |
| Tarefa | `id`, `user_id`, `title`, `description`, `status`, `priority`, `category_id`, `project_id`, `due_at`, `scheduled_start_at`, `scheduled_end_at`, `all_day`, `estimated_minutes`, `source`, `completed_at`, `archived_at`, `board_position`, `created_at`, `updated_at` | `client_id`, `origin_capture_id`, `deleted_at` |
| Categoria | `id`, `user_id`, `name`, `normalized_name`, `color_key`, `is_system`, `created_at`, `updated_at` | — |
| Projeto | `id`, `user_id`, `name`, `description`, `color_key`, `deleted_at`, `position`, `created_at`, `updated_at` | — |
| Hábito persistido | tipo puro `Habito` + `user_id`, `color_key`, `icon_key`, `position`, `created_at`, `updated_at` | — |
| Marcação esparsa | `id`, `user_id`, `habit_id`, `done_on`, `note`, `created_at` | — |
| Pausa | tipo puro `PausaHabito` + `id`, `user_id`, `reason`, `created_at` | — |

Tipos de captura: `idea/task/note/reminder`; estados: `draft/inbox/organized/archived`. Estados de tarefa: `todo/in_progress/done/archived`; prioridade: `low/medium/high/urgent`. `source: manual` permanece compatível com o legado; a procedência de conversão é expressa por `origin_capture_id`, não por um novo valor silencioso de `source`.

O financeiro importa exclusivamente os tipos públicos de `core/financeiro/index.ts`: `ContaFinanceira`, `CategoriaFinanceira`, `LancamentoFinanceiro`, `OrcamentoFinanceiro`. Os ports mantêm todos os campos desses tipos; `is_paid` não é entrada persistida. Os ports de hábitos e financeiro permitem leitura/escrita transacional, sem criar uma segunda implementação de suas regras puras. Comandos específicos desses módulos podem usar a mesma `Transacao` em M1.

## Escrita, evento e idempotência

`UnitOfWork.transaction(context, async tx => result)` é a fronteira explícita. Alterações, eventos e recibos são confirmados juntos ou totalmente revertidos. A implementação em memória serializa as transações da instância; leitores externos só observam o estado confirmado. Os ports da transação expiram ao fim do callback, incluindo após falha. Não se deve iniciar/aguardar uma transação aninhada da mesma instância; composição de comandos usa os ports do `tx` corrente.

Cada alteração deve possuir exatamente um evento com snapshots anterior/posterior correspondentes, mesmo usuário e canal, identificador da entidade, instante válido e ação permitida. Ausência, excesso ou divergência de evento rejeitam o commit. A lista fechada de entidades não admite Cofre; nenhum payload de segredo é aceito por esse contrato. Retenção e limpeza privilegiada de eventos pertencem ao adapter real futuro.

O recibo usa `(user_id, command, client_id)`, com impressão canônica do payload (ordem das propriedades não interfere). Payload diferente na mesma chave produz `CONFLICT`. A chave é independente entre criação, edição, status, ciclo de vida e conversão, e entre usuários. Replays devolvem uma cópia do resultado original sem gerar novos eventos. O recibo só fica visível com o commit; depois de falha é possível tentar novamente com o mesmo `client_id`.

Comandos: `capture.create/update/archive/delete/restore/convert` e `task.create/update/status/delete/restore`. Identificadores de criação não são modificados por edições. IDs de entidades e eventos são únicos entre todos os tipos dentro da instância, inclusive após a remoção física de uma marcação; colisões falham explicitamente. O gerador deve fornecer valores não colidentes; rollback pode consumir IDs sem persistir registros.

## Conversão e preservação do histórico

A conversão mantém o título da captura, ou os primeiros 120 caracteres de conteúdo; descrição com conteúdo integral quando existe título ou quando o texto ultrapassa os 120 caracteres do título gerado; estado `todo`, prioridade `medium`, `source: manual`; categoria preservada; projeto copiado apenas se ainda existir e não estiver excluído. A captura fica `organized`, com data e ligação para a tarefa. `capture.converted_task_id` e `task.origin_capture_id` são recíprocos e do mesmo usuário, verificados no commit. A tabela genérica de vínculos de T-015/T-021 ainda não existe.

Duas tentativas concorrentes geram uma tarefa. Uma tentativa nova sobre uma captura já convertida retorna a tarefa atual sem redefinir título, estado, projeto ou lixeira. IDs de origem, criação e `client_id` são imutáveis; a captura não pode trocar de tarefa após a primeira conversão.

Regressões tratadas nesta etapa:

- Edição de título não altera o status de tarefa concluída nem o instante de conclusão. Reabrir limpa `completed_at`; arquivar usa `archived_at`.
- Conteúdo de captura admite até 10 mil caracteres, enquanto nova descrição de tarefa admite 5 mil. A conversão preserva o conteúdo integral; uma edição não relacionada preserva a descrição herdada longa. Alteração explícita de descrição continua sujeita ao limite de 5 mil, sem truncamento silencioso.
- A conversão legada de captura sem título deixava descrição nula, mesmo ao abreviar conteúdo longo. O contrato preserva esse conteúdo completo na descrição quando ele não cabe no título gerado; para texto de até 120 caracteres, mantém o comportamento legado sem repetir o título na descrição.
- Referência histórica a projeto excluído não impede uma edição não relacionada. Criar/vincular um projeto excluído continua proibido; uma conversão nova não herda esse projeto.
- Datas impossíveis e horários sem fuso explícito são rejeitados. `Date.parse` sozinho normalizaria `2026-02-31`, `2026-02-29` e hora `24:00`; o contrato verifica calendário e relógio antes de aceitar o instante.

Categorias, projetos, origem de conversão, hábitos, contas/categorias financeiras e orçamento só podem referenciar registros do mesmo usuário. Falta de referência e referência estrangeira têm o mesmo `NOT_FOUND`. Marcações são únicas por `(user_id, habit_id, done_on)`; remover uma marcação usa exclusão física com evento, enquanto capturas/tarefas usam lixeira separada de arquivamento.

## Suíte reutilizável e evidência

`tests/contracts/adapter-contract.ts` recebe uma `ContractFactory` assíncrona que devolve `store`, `deps`, controle de relógio, injeção de falha e limpeza opcional. O arquivo não importa o adapter em memória. Um adapter real pode executar a mesma suíte com seed isolado, fault seam e limpeza de seu ambiente de teste.

São 40 casos reutilizáveis: campos integrais e relógio; isolamento de consultas, escrita, eventos e referências; cópia das fronteiras; replay e conflito de payload; concorrência; origem e conversão; texto longo; projeto excluído; rollback em escrita/evento/commit/callback; erro de leitura; correspondência escrita/evento; capacidade expirada; conclusão; arquivo/lixeira/restauração; IDs globais; marcação esparsa; ports financeiros; validações de entrada/calendário. Outros dois casos verificam instâncias independentes, cópia de seed e colisão no estado inicial.

Verificado: **42/42 testes em `TZ=UTC` e 42/42 em `TZ=America/Sao_Paulo`**, typecheck, ESLint focado e dependency-cruiser (27 módulos, 53 dependências, nenhuma violação). Nenhum build, servidor, banco ou alteração de pacote foi necessário nesta entrega.

Limites explícitos: a memória é descartável por instância, não é persistência offline nem backend seguro; seed é bootstrap de teste e não uma escrita de usuário auditada. A interface do repositório recebe entidades de domínio já validadas; canais externos devem validar DTOs e passar pelos comandos, não escrever ports diretamente. O adapter real deverá garantir atomicidade/serialização, unicidade, isolamento e contratos equivalentes com seus próprios mecanismos, sem usar a memória como evidência de RLS ou de transação de rede.
