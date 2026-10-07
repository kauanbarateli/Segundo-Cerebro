# Tarefas — brief de T-010

## Estado, propósito e autoridade

Modo **Operate**. `/tarefas` opera na sessão demonstrativa: encontrar um compromisso, mudar seu estado e editar seus dados sem perder status, horário ou origem. A UI está implementada sobre o provider compartilhado; a inspeção visual e os E2E aguardam a rodada integrada. A composição D-030 está aprovada e permanece vigente.

**OBSERVADO:** doc 13, T-010 exige DataTable e cartões do mesmo array, categorias dinâmicas, busca sem acento, Drawer completo, ações equivalentes entre desktop e mobile, preservação de status e fuso, vazios distintos. Doc 05 §§2–3 exige identidade contínua entre Capturar, Tarefas e Início. Doc 14 §§2/8/9 e `docs/prototipo/prototipo-segundo-cerebro.html` (`s-tarefas`, `drawer-tarefa`) fornecem hierarquia, tabela, filtros, metadados e formulário; seus contadores fixos e arrays mobile divergentes não são dados de implementação.

**OBSERVADO:** `DESIGN.md`, `PRODUCT.md`, tokens DS 2.1 e componentes T-003/T-006 são a autoridade visual local. Foram lidas a Impeccable local e suas referências `shape`, `new-work` e `operate`; o contexto usa o fallback documental já resolvido nesta sessão. Não há nova direção visual nem alteração de DESIGN.md. `craft-floor` deve ser aplicado imediatamente antes da futura edição de UI.

**OBSERVADO:** doc 09 exige isolamento, conteúdo fora de logs e erros visíveis. Em M1, o adapter é descartável em memória, com usuário demonstrativo fixado pelo provider; o formulário não escolhe usuário, canal ou identidade de evento. A restrição operacional vigente de migrations manuais prevalece sobre o texto histórico do doc 09 §2.9.

## Estrutura e interação

- **OBSERVADO:** cabeçalho com uma h1 Tarefas, resumo derivado da coleção e ação Nova tarefa. Escala operacional 28px/24px, campos de pelo menos 16px, alvos 44px. Herda a moldura e suas safe areas.
- **RECOMENDADO:** filtros de período/estado e categoria acima da DataTable. Categorias vêm do snapshot; incluir Todas e Sem categoria. Estados permitem Abertas, Concluídas, Arquivadas e Lixeira sem perder a possibilidade de recuperar um item. Os rótulos de categoria do protótipo são dados de exemplo, nunca constantes de filtro.
- **OBSERVADO no componente T-006:** DataTable já executa busca sem acento, ordenação estável e paginação sobre um único `view.rows`. O módulo fornece uma coleção filtrada e colunas; não mantém arrays separados para tabela e cartões. A troca estrutural ocorre abaixo de 768px. Colunas propostas: Tarefa/contexto, Estado, Categoria, Prazo, Prioridade e Ações. Projeto e origem entram no contexto do título para conter a largura.
- **RECOMENDADO:** mesma função de renderização das ações nas duas apresentações, com instâncias sem IDs repetidos. Ação primária contextual Concluir/Reabrir e menu Ações de [título] com Editar, Arquivar/Reabrir e Excluir. Em Lixeira, Restaurar substitui edição e mudança de estado. Não implementar exclusão definitiva.
- **OBSERVADO:** criar/editar usa Drawer compartilhado, que vira tela cheia no mobile conservando a mesma árvore. Título recebe foco inicial; rodapé Salvar/Cancelar fica alcançável com teclado e safe area. Erros de campo ficam associados a Field; falhas de escrita permanecem no formulário com os dados digitados. Uma única operação em andamento bloqueia submissão duplicada.
- **RECOMENDADO:** ações curtas no mobile usam BottomSheet ou popover nativo fora de contêiner rolável; nenhuma ação depende de hover ou arrastar. Exclusão usa ConfirmDialog e permite Desfazer pelo comando de restauração em Toast. Ao fechar, o foco retorna ao acionador; se o item desapareceu, ao título da lista ou a outro destino estável.
- **Limite do ticket:** a entrega obrigatória é lista/cartões. O quadro do protótipo fornece contexto para `board_position`; não mostrar botão Quadro sem uma implementação funcional. Vínculos gerais/Relacionado, drag-and-drop e integrações pertencem aos tickets correspondentes.

## Os 13 atributos funcionais e o formulário

O contrato novo contém **12 propriedades editáveis** em `CamposTarefa` e **source='manual'** em `Tarefa`. O legado confirma esse source fixo. Os 13 atributos são preservados, mas o décimo terceiro é proveniência, não uma escolha inventada no formulário. IDs, `client_id`, origem, timestamps de criação/alteração/conclusão/arquivo e exclusão são controlados por infraestrutura ou casos de uso.

| Atributo | Apresentação e regra |
| --- | --- |
| `title` | Título obrigatório; até 200 caracteres; primeiro campo. |
| `description` | Descrição opcional; até 5.000 em criação/alteração. Texto maior herdado de captura permanece integral quando não alterado. |
| `category_id` | Categoria dinâmica, opção Sem categoria. Não depende do projeto. |
| `project_id` | Projeto dinâmico, opção Sem projeto. Edição conserva null mesmo que a abertura tenha contexto externo. |
| `status` | Estado explícito: A fazer, Em andamento, Concluída, Arquivada. Carrega o valor da tarefa; defaults só na criação. |
| `priority` | Baixa, Média, Alta, Urgente; seleção explícita. |
| `due_at` | Prazo, com data/hora ou apenas data conforme Dia inteiro. Opcional. |
| `scheduled_start_at` | Início planejado, separado do prazo. Opcional. |
| `scheduled_end_at` | Término planejado, também editável; não pode anteceder início. Opcional. |
| `all_day` | Switch Dia inteiro; preserva os dias e a memória das horas durante a alternância. |
| `estimated_minutes` | Estimativa em minutos; inteiro positivo ou vazio/null. |
| `board_position` | Ordem no quadro em seção recolhível de organização; número finito ou null. Preservar quando intocado, sem conversão para inteiro. |
| `source` | Proveniência somente leitura: entrada manual. Quando `origin_capture_id` existe, apresentar também Abrir captura de origem com o ID original. |

**RECOMENDADO:** organizar em Título/Descrição → Categoria/Projeto/Estado/Prioridade → Planejamento (Dia inteiro, prazo, início, término, estimativa) → detalhes de ordem/proveniência. Uma coluna no mobile; pares só quando couberem. Não inserir identificadores técnicos nos rótulos do produto.

## Status, fuso e patches

**OBSERVADO no núcleo:** `criarTarefa`, `editarTarefa`, `alterarStatusTarefa`, `excluirTarefa` e `restaurarTarefa` validam e emitem evento na mesma transação. Edição é `Partial<CamposTarefa>`; a omissão de status o preserva. `completed_at` e `archived_at` são derivados pelo caso de uso. Exclusão altera apenas `deleted_at`, conservando a origem da conversão.

**RECOMENDADO:** o formulário mantém o modelo carregado e envia somente os campos modificados. Isso impede defaults de reabrirem tarefas concluídas e permite editar uma descrição herdada de captura com mais de 5.000 caracteres sem reenviá-la ou truncá-la. Se essa descrição for alterada, mostrar o limite do domínio como erro; não encurtar conteúdo silenciosamente.

**OBSERVADO:** `FUSO_DO_APP` é `America/Sao_Paulo`, independente do servidor, navegador ou localização atual. Na borda do formulário, converter entrada civil por `instanteDe` e preencher por `paraCampoLocal`. Guardar dia e hora separadamente para cada um dos três instantes; alternar Dia inteiro não apaga o dia nem a hora lembrada antes de salvar. Nunca usar `new Date(valorDoCampo)` nem `toISOString().slice(...)` para simular horário local.

Datas sem hora viram o primeiro instante válido do dia. Horários inexistentes por DST seguem a política compatible já portada (avançar pelo salto); ambiguidades usam a ocorrência anterior. A mensagem de fuso acompanha os campos. Regressões usuais devem provar ida e volta idêntica em UTC e em outro fuso do navegador, inclusive próximo da meia-noite; exceções históricas de DST têm expectativa explícita conforme o núcleo.

## Interface mínima da sessão compartilhada

**IMPLEMENTADO sobre a composição do integrador:** `DemoApplicationProvider` acima de Início/Capturar/Tarefas/Financeiro, montado uma vez no grupo workspace. Ele compõe **uma** instância de `UnitOfWork`, `DependenciasDeDominio` e `ContextoDeEscrita` demonstrativo; as features consomem uma fachada comum sem importar umas às outras nem criar adapters locais. Tarefas monta o hook apenas no filho permitido de `WorkspacePage`.

Contrato mínimo necessário a Tarefas:

```ts
// src/lib/demo/demo-provider.tsx
const { status, data, error, retry } = useDemoQuery("tasks");
// data: { items: Tarefa[]; categories: Categoria[]; projects: Projeto[] } | null
// status: idle | loading | ready | error; error: string | null
const app = useDemoApplication();
// app.today(): dia civil da demonstração
// app.commands.tasks.{create, update, status, remove, restore}: Promise<Tarefa>
// Payloads mantêm os tipos e client_id dos casos de uso.
```

O snapshot canônico de tarefas deve ser lido com `{includeArchived:true, includeDeleted:true}` para que filtros e restauração operem sobre o mesmo universo. Filtros da tela definem o recorte visível. Projetos usados nas opções devem estar ativos; referências antigas continuam identificáveis para não serem apagadas ao editar outro campo. Capturas/origens pertencem ao snapshot comum ou à leitura por ID da mesma sessão.

Após um comando confirmado, o provider relê/publica o snapshot para todos os consumidores; um comando de conversão em Capturar precisa disparar essa mesma atualização. `client_id` é gerado uma vez por intenção, mantido em repetição após falha e renovado quando o conteúdo da intenção muda. `user_id`, canal web, relógio e gerador de IDs vêm da composição, nunca de campos editáveis. Não expor `transaction`/repositórios de escrita como controles de UI.

Erros de leitura devem chegar à barreira da rota ou ao estado de erro com Tentar novamente, sem retornar array vazio silencioso. M1 mantém memória da sessão montada; persistência no navegador ou entre dispositivos não é presumida. Datas das fixtures usam a mesma referência/relógio injetado: se for um dia fixo, deve aparecer como dia de exemplo.

## Massa necessária e evidência futura

**RECOMENDADO:** reutilizar IDs e títulos aprovados do universo único; pedir os seguintes papéis de fixture, não criar uma coleção própria na feature:

- Pelo menos seis tarefas ativas para exercitar paginação, incluindo Revisar plano de milestones do V2 (mesmo registro no Início), uma atrasada, uma com horário, uma de dia inteiro, uma sem data/categoria/projeto e uma com prioridade urgente.
- Uma tarefa concluída com `completed_at`, uma arquivada com `archived_at`, uma excluída e uma tarefa convertida com captura e laço reverso consistentes. Conversão deve adicionar o mesmo registro à lista sem duplicação.
- Categorias dinâmicas (inclusive nome acentuado) e dois projetos; uma tarefa de título longo e descrição herdada de captura acima de 5.000 caracteres para regressão de patch.
- Um caso com prazo, início e término distintos, estimativa preenchida e posição fracionária; não basta testar somente o prazo simplificado do protótipo.

Estados a verificar: carregando, erro recuperável, vazio real (Criar primeira tarefa), vazio de categoria/período/busca (Limpar filtros), salvando, erro de validação e escrita, sucesso, arquivadas, lixeira e restauração. As contagens de abertas/atrasadas/concluídas são derivadas dos mesmos registros no fuso do app.

Evidência futura por rota: editar concluída preserva status e timestamps; criar/editar todos os atributos editáveis; categorias sem nomes fixos; busca sem acento; concluir/reabrir/arquivar/excluir/restaurar em 320px e desktop; mesma identidade/ordem entre tabela e cartões; horário e Dia inteiro sobrevivem a salvar/reabrir em UTC; captura convertida aparece uma vez; erro de leitura aparece; vazios são distintos. Reusar os portões T-005 de overflow, alvos e campos e a inspeção conjunta claro/escuro, desktop/mobile. Este brief não afirma que esses testes já foram executados.

## Ownership proposto

T-010: `src/components/features/tarefas/**`, `src/app/(workspace)/tarefas/{page,error,loading}.tsx`, testes puros da borda do formulário/filtros, `tests/e2e/tarefas.spec.ts` e este brief. Não alterar o núcleo, adapter, provider compartilhado, fixtures globais, shell, tokens, componentes UI ou rotas de outros módulos sem coordenação.

Integrador T-007/T-008: provider/fachada, fixture única, composição do layout e atualização compartilhada. Contratos resolvidos: hook em `src/lib/demo/demo-provider.tsx`, relógio por `app.today()` e origem em `/capturar?capture=<id>`. Links `?task=<id>` abrem o registro no estado correto; `?view=hoje` aplica o recorte do dia. O snapshot fixo da demonstração é sinalizado na tela; a feature não contém datas nem IDs das fixtures. Evidência local: 16 testes focados de formulário/filtro em ambiente padrão/UTC, lint e typecheck passaram; os resultados integrados serão registrados em `docs/implementation/t010-tarefas.md`.
