# Aceite e validação da aplicação do layout

**Este arquivo é um checklist de execução futura.** Nenhum item marcado abaixo declara teste da aplicação realizado por este PR de planejamento. A referência foi examinada sobre [`61d03c7`](https://github.com/kauanbarateli/Segundo-Cerebro/tree/61d03c7); o [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) não foi incorporado. Resultados de produção, harness local e protótipo devem permanecer separados.

Execução: **[#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46)**. Aceite final: [frente D #44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44). Consultar [mapa de integração](03-mapa-integracao.md), [plano de execução](04-plano-execucao.md), [onboarding simplificado](07-onboarding-simplificado.md) e as seis jornadas obrigatórias do [doc 05](../05-arquitetura-de-produto.md#3-jornadas-âncora-critério-de-aceite-do-produto-inteiro). As jornadas adicionais de onboarding estão na seção 7; não substituem as seis jornadas do produto.

## 1. Condições da comparação visual

- [ ] Registrar SHA da aplicação, branch/base, modo (demo/harness local/conectado), navegador, viewport, tema, estado da lateral e data/fuso de teste.
- [ ] Usar o [protótipo final](prototipo/index.html), [DESIGN](prototipo/DESIGN.md) e tokens DS 2.1 como referência. Excluir da comparação cromática capturas anteriores ao último alinhamento de cores.
- [ ] Usar dados sintéticos determinísticos somente em demo/harness. Em dados reais, não publicar informações pessoais ou segredos em screenshots/logs.
- [ ] Capturar as 12 superfícies: Início, Capturar, Tarefas, Calendário, Conhecimento, Projetos, Hábitos, Financeiro, Cofre, Atividade, Integrações e Configurações; comparar as capacidades adicionais da produção sem exigir que sumam para ficar iguais ao mock.
- [ ] Acrescentar as nove telas do onboarding simplificado conforme a matriz da seção 7: boas-vindas, sete etapas opcionais e resumo. A composição inicial de duas colunas e os resultados históricos não aprovam a implementação simplificada.
- [ ] Cobrir claro/escuro, 1440px, largura intermediária 768/900px, 390px e 320px; desktop com lateral expandida/recolhida e mobile com menu aberto/fechado.
- [ ] Cobrir normal, vazio, loading, erro recuperável, acesso negado e operação ocupada/incerta onde o módulo já os prevê. Testar dados longos e listas densas.
- [ ] Sem transbordamento horizontal da página, cortes de texto essencial, botões encobertos, sobreposição ou mudança indevida de árvore ao redimensionar. Rolagem interna intencional em tabela/timeline deve ser clara e operável.
- [ ] Medir contraste nos fundos efetivos: texto normal ≥4,5:1; indicadores/contornos/foco relevantes ≥3:1. Não reutilizar apenas o relatório de tokens para aprovar composição com alpha, seleção ou fundo inverso.
- [ ] Campos ≥16px, alvos ≥44 × 44 px, nomes acessíveis e informação além da cor; ícones e controles equivalentes usam a mesma escala/espessura/estado.

## 2. Navegação, tema, foco e movimento

- [ ] Sidebar recolhe/expande com controle claro, nome acessível, `aria-expanded`, ativo por `aria-current`, dicas no hover e foco; preferência persiste e falha de armazenamento é tolerada.
- [ ] Ordem/visibilidade personalizadas e Entitlements continuam efetivos; acesso direto negado continua negado pelo servidor. Admin/Ajuda/Atividade/Integrações/Sair não desaparecem por ausência no menu do mock.
- [ ] Menu mobile retém/restaura foco, torna fundo inerte, fecha com Esc e navegação; rodapé/safe areas não ocultam ações.
- [ ] Tema Sistema/Claro/Escuro preserva escolha da conta e do navegador, reação ao SO, sincronização entre abas, primeiro paint, `theme-color` e política CSP. Os modelos de tema mostram as duas paletas corretas em qualquer tema ativo.
- [ ] Trocar tema, recolher lateral ou mudar largura conserva campos não salvos, editor TipTap, seleção e rascunhos; não causa envio de formulário nem marcação extra.
- [ ] Teclado: skip link, Tab/Shift+Tab, busca Ctrl/Cmd+K, setas/Enter/Esc, menus, drawers aninhados e restauração de foco. Tooltips fecham com Esc sem bloquear o próximo controle.
- [ ] Foco legível inclusive no cartão inverso, selected/hover/disabled/loading. Mensagens de erro têm associação ao campo/alerta; estados de processamento têm anúncio apropriado.
- [ ] Entrada/saída e inversão de lateral/menus/drawers são rápidas e interrompíveis; navegação frequente por teclado não espera animação.
- [ ] Em `prefers-reduced-motion: reduce`, remover movimento sem perder estado/feedback. Fechar superfície sensível não depende de esperar animação; qualquer cleanup temporal possui fallback.

## 3. Seis jornadas-âncora do produto

Os nomes e metas abaixo vêm do doc 05. Uma etapa futura ainda não disponível na base deve ser registrada como lacuna preexistente com issue responsável; não transformar o teste do mock em evidência de implementação. O layout precisa preservar o que já funciona e tornar explícito o que falta para o aceite global.

### J1 — “Tive uma ideia”

- [ ] A partir do acesso disponível (atalho/palette/share/botão), abrir Capturar e persistir ideia em até 5s, medindo do disparo até confirmação durável; registrar método/condições da medição.
- [ ] A captura cai na Caixa de entrada e pode ser organizada com tipo, projeto e vínculos; anexos reais de imagem e rascunhos continuam disponíveis conforme contrato.
- [ ] Converter em Tarefa é idempotente, preserva origem e não duplica após retry/resultado desconhecido.
- [ ] Promover a Conhecimento escolhe Caderno, mantém origem e transfere edição ao modelo persistente. TipTap, wiki-link/backlink e referências por identidade continuam íntegros.
- [ ] Rascunho recupera no escopo correto; logout/troca de Usuário limpa superfícies e impede resposta atrasada de repovoá-las.
- [ ] Se o requisito de fila offline não estiver implementado no baseline, registrar como pendente da jornada; não declarar sucesso offline porque o protótipo usa localStorage.

Evidência mínima: execução browser→canal→persistência→reload no harness aprovado, ausência de duplicata e demonstração de origem/vínculo. Referências: `tests/e2e/captures.spec.ts`, `issue22-capture-persistence-sql.spec.ts`, `issue28-knowledge-sql.spec.ts`, `issue28-knowledge-conflict-sql.spec.ts`.

### J2 — “O que é hoje?”

- [ ] Início em mobile atende à meta do doc 05 de próximo movimento, três tarefas, agenda e hábitos em UMA tela. A página mobile longa do snapshot não comprova esse aceite: produzir um resumo compacto acima da dobra e manter os detalhes abaixo, preservando a hierarquia e os alvos de 44 px; se houver impossibilidade na largura/zoom testados, registrar o desvio para decisão explícita da frente #44, sem reduzir a meta silenciosamente.
- [ ] Concluir/reabrir tarefa e marcar/desmarcar hábito a partir do Início atualiza a mesma coleção usada no módulo correspondente.
- [ ] Abrir evento mantém data/contexto e permite voltar; agenda respeita fontes/contas selecionadas.
- [ ] Privacidade financeira, módulos ocultos e módulos negados refletem a conta e não mostram dados por fallback indevido.
- [ ] Datas e projeções usam o fuso de produção e o relógio/harness pertinente; dia fixo do protótipo não foi copiado.

Evidência mínima: ações no Início conferidas nos módulos e depois de reload, mais capturas mobile e estados sem dados/permissão. Referências: `tests/e2e/home.spec.ts`, `home-account-preferences.spec.ts`, `issue23-home-activity-sql.spec.ts`, `issue30-habits-sql.spec.ts`.

### J3 — “Gastei / paguei”

- [ ] Acesso ao lançamento em até três toques a partir do Início ou atalho; registrar a contagem e o ponto de início, separando acesso ao formulário da digitação necessária.
- [ ] Compra no cartão entra na competência/fatura correta segundo o domínio; não gera saída imediata de caixa nem despesa duplicada ao pagar a fatura.
- [ ] Painel reflete o resultado confirmado, com centavos inteiros, estados e pagamento parcial quando aplicável.
- [ ] Permanecem cinco abas, contas/cartões, categorias/etiquetas, orçamento, transferências, filtros, ordenação/paginação, lixeira/restauro e privacidade.
- [ ] Navegação rápida e falha de rede não aplicam resposta antiga à rota/filtro atual; retry não duplica lançamento.

Evidência mínima: lançamento/pagamento e totais derivados conferidos no harness; capturas de lista, resumo e editor nos dois temas. Referências: `tests/e2e/finance.spec.ts`, `issue26-27-finance-sql.spec.ts`, `tests/features/finance-navigation-race.test.ts`, `tests/core/finance-legacy-v2-regression.test.ts`, `credit.test.ts`.

### J4 — “Onde está aquilo?”

- [ ] Ctrl/Cmd+K abre busca com foco e fecha por Esc com restauração; resultado contextual é percorrido por setas/Enter e clique.
- [ ] Busca real respeita ranking, tipos ativos, limite, acentos, permissões e estado da conta; o Cofre fica excluído e Drive não é reintroduzido como entrega MVP.
- [ ] Abrir resultado chega ao registro correto, incluindo rotas profundas; navegar por Relacionado/wiki-links/backlinks preserva identidade após renomear/mover.
- [ ] Estados vazio, sem resultado, erro, resposta atrasada e sessão encerrada não exibem conteúdo antigo de outra conta.

Evidência mínima: consulta→registro→vizinho no browser, testes de acesso/privacidade no harness e captura da busca nos dois temas. Referências: `tests/e2e/search.spec.ts`, `issue33-search-sql.spec.ts`, `knowledge-workspace.spec.ts`, `tests/core/search.test.ts`.

### J5 — “Reunião de amanhã”

- [ ] Evento Google somente leitura mostra nome, fonte, horário/fuso, local e contexto; nota vinculada abre pelo evento.
- [ ] Criar/vincular nota e registrar decisões conserva a relação; as decisões podem virar tarefas vinculadas ao mesmo evento por contratos reais. Se algum trecho estiver ausente na base, registrar lacuna/issue e não simular sucesso.
- [ ] Conexão de até duas contas, fonte selecionada, reautorização, revogação pendente/retomar desconexão e sync por período permanecem disponíveis.
- [ ] Dia/Semana/Mês/Lista, Hoje/anterior/próximo e mini calendário mantêm seleção/URL coerentes. Lista usa janela mensal e não modifica silenciosamente a preferência persistida existente.
- [ ] Sobreposição, evento curto/título longo, travessia da meia-noite, dia inteiro com término exclusivo, mês vazio e dezembro→janeiro permanecem corretos no fuso real.
- [ ] Integrações e Calendário mostram o mesmo estado/serviço de contas, sem duplicação ou importação entre features; fontes afetam também Início/lembretes.

Evidência mínima: harness determinístico de calendário/contratos OAuth e screenshot das quatro visões. Teste com conta Google real, se necessário ao aceite existente, exige ambiente/credenciais de teste autorizados e registro separado; não é pré-condição para tirar screenshots. Referências: `tests/e2e/calendar-google.spec.ts`, `calendar-timeline.spec.ts`, `calendar-workspace-browser.spec.ts`, `tests/adapters/calendar-oauth-sql.test.ts`, `tests/features/calendar-projections.test.ts`.

### J6 — “Preciso da senha do banco”

- [ ] Entrar no Cofre e desbloquear com senha mestra pelo fluxo real; visual não elimina criação/recuperação/kit nem troca criptografia por exemplos locais.
- [ ] Copiar valor sintético de teste e limpar a área de transferência em 30s; permissão negada e cópias concorrentes recebem tratamento correto.
- [ ] Auto-lock por inatividade/ocultação e logout/troca de sessão seguem contrato; transição visual não deixa segredo exposto após bloqueio.
- [ ] Edição/arquivo/restauro, privacidade e eventos apenas com metadados permitidos permanecem íntegros. Nenhum segredo aparece em busca, logs ou evidência publicada.

Evidência mínima: testes de criptografia/contrato e ciclo de vida no harness, evidência visual mascarada. Referências: `tests/e2e/vault.spec.ts`, `issue31-vault-sql.spec.ts`, `tests/features/vault-lifecycle.test.ts`, `logout-sensitive-surfaces.test.tsx`, `tests/core/vault-crypto.test.ts`.

## 4. Capacidades adicionais e regressões obrigatórias

- [ ] Configurações: perfil/avatar, tema persistido da conta, ordem/visibilidade de módulos, lembretes, instalação, sessões próprias e troca de senha mantidos. Exportar/restaurar exemplos não vira funcionalidade fictícia de conta.
- [ ] Conhecimento: TipTap/JSON, árvore, cadernos, conflitos/versionamento, referência pendente/criação de destino, archive/trash/restore e rascunhos por sessão.
- [ ] Projetos: associação de contêineres e exclusão/restauro preservam os itens; estados de carregamento/erro de cada seção são independentes.
- [ ] Hábitos: cadências, pausas globais/individuais com intervalo/motivo, histórico de 26 semanas e sequência; restrições de dia futuro/início/pausa respeitadas.
- [ ] Atividade: paginação/cursor e recuperação da sessão, campos sanitizados, destinos e dados reais; histórico local de demonstração não substitui auditoria.
- [ ] Auth, Admin, PWA, Ajuda, erros e `/conheca` seguem operáveis após mudar primitivas/globais; privilégios de Admin e conteúdo pessoal continuam separados.

## 5. Portões técnicos existentes

Os comandos abaixo existem em [package.json](../../../package.json). Executá-los na implementação, anotando ambiente e resultado. A existência do comando/teste nesta lista não implica execução por este pacote.

| Portão | Comando/arquivo | Evidência exigida |
|---|---|---|
| Tipagem | `npm run typecheck` | Resultado sem erro no commit entregue. |
| Lint | `npm run lint` | Zero warnings conforme script vigente. |
| Unitários/contratos | `npm test` | Resultado de Vitest; destacar regressões de módulos tocados. |
| Fronteiras | `npm run check:layers` | Nenhuma dependência feature→feature, UI→feature ou SDK de banco no browser. |
| DS | `npm run tokens:generate` quando tokens mudarem; `npm run check:design-system` | JSON/CSS consistentes, cores sem literais paralelos, contraste/pisos do validador mantidos. |
| Revisão visual | `npm run check:impeccable` e fluxo da skill local | Registrar achados/disposição sobre os arquivos alterados; o detector não substitui inspeção de telas, contraste real ou testes de teclado. |
| Timezone | `npm run test:timezones` para mudanças em projeção/datas | Resultado dos ambientes previstos; não substituir `FUSO_DO_APP` pelo fuso do mock. |
| Scripts/SQL local | `npm run test:scripts`, `npm run test:local-sql`, `npm run check:sql-editor` | Harness local previsto, sem schema remoto/reset/seed. |
| Segurança de fontes | `npm run check:secrets`; `npm run check:client-auth` após build | Sem segredo no Git/client bundle e sem regressão da política de Auth. |
| Build | `npm run build` | Usar configuração de demonstração/harness apropriada e instruções do repositório; `prebuild` valida ambiente. Não declarar build conectado sem executá-lo. |
| E2E | `npm run test:e2e` | [playwright.config.ts](../../../playwright.config.ts) usa APP_MODE=demo, servidor de produção local em 127.0.0.1:3100, sem reaproveitar servidor; fazer build compatível antes. Suites SQL têm harness próprio. |
| Portão composto | `npm run check` | Confirmar o script vigente; inclui tipagem, lint, unitários, camadas, DS, SQL editor, scripts, SQL local, segredos, build e cliente/Auth. Não aplica migrations remotas. |
| CI GitHub | Workflow pertinente do PR de implementação | URL do run e conclusão observada. CI verde só pode ser declarada após resultado confirmado. |

Suites transversais a executar/ampliar: `tests/e2e/theme.spec.ts`, `navigation.spec.ts`, `primitives.spec.ts`, `surfaces.spec.ts`, `data-ui.spec.ts`, `design-system.spec.ts`, `visual-guards.spec.ts`, `search.spec.ts`; `tests/design-system.test.ts`, `theme.test.ts`, `ui-contract.test.ts`, `navigation.test.ts`, `architecture.test.ts`; `tests/adapters/visual-ref-css-order.test.ts`. O mapa aponta as suítes por módulo.

Acrescentar assertivas significativas para lateral persistida sem remontagem, preferências/Entitlements com agrupamento, Lista/URL, reutilização de contas em Integrações e as jornadas de onboarding da seção 7. Não substituir testes funcionais por snapshots novos nem escrever apenas testes que repetem implementação CSS. Os scripts acima foram conferidos no `package.json`; na execução, reconfirmar o script e o contrato na base recebida da outra frente, preservando verificações já existentes.

## 6. Registro de resultado e aceite

Para cada lote/jornada, preencher uma linha no relatório da implementação:

| Item | Commit/ambiente | Executado | Resultado/evidência | Limitação ou issue |
|---|---|---|---|---|
| Exemplo: J1 | SHA + harness/local/demo/conectado | Comando/fluxo exato | Link do log/screenshot/check | Pendência explícita ou nenhuma |

- [ ] Relatório separa **implementado**, **validado** e **pendente** e liga as evidências ao commit efetivamente entregue.
- [ ] Diagnóstico inicial e polish final foram confrontados com as capturas; diferença intencional está justificada por capacidade real ou contrato do produto.
- [ ] Não existem falhas de navegação, perda de rascunho, vazamento entre contas, remoção de capacidade ou regressão material de acessibilidade ainda sem resolução.
- [ ] As seis jornadas têm resultado verificável; metas/lacunas não exercitadas estão explicitadas, sem dedução a partir do mock.
- [ ] L3O tem resultado por tela e por jornada da seção 7, incluindo pausa, conclusão, falha parcial, isolamento e retorno Google; nenhum aceite foi deduzido dos testes do protótipo. Lotes já concluídos pela outra frente foram reaproveitados e suas regressões relevantes verificadas.
- [ ] Revisão final e CI pertinente confirmadas antes de solicitar aceite #44; pendências globais permanecem rastreadas nos pais [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7), [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12), [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35).

As issues históricas fechadas referenciadas no [plano](04-plano-execucao.md#5-rastreabilidade-com-issues) servem de fonte de contratos/evidência, não de lista nova de pendências. Os 70 checks do protótipo base, os 31 testes Node/VM do onboarding simplificado e seus relatórios de cor/navegador validam o artefato de referência em seus respectivos contextos; não comprovam execução, persistência, OAuth, isolamento ou aceite da aplicação React. Aprovar este PR docs-only não fecha [#46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) nem #44.

## 7. Onboarding simplificado — matriz e jornadas de produção

Autoridade adicional: [07-onboarding-simplificado](07-onboarding-simplificado.md). Esta seção especifica a prova a produzir em L3O; nenhum checkbox está concluído neste planejamento. Separar resultados do protótipo estático, da aplicação em `APP_MODE=demo`, dos harnesses que exercitam canais/persistência e de ambiente conectado. O E2E padrão é demo e não comprova sozinho Auth, banco ou Google real.

### Matriz das nove telas

| Tela | Comportamento de aceite | Estados a capturar/exercitar |
|---|---|---|
| Boas-vindas | Frase breve, `Começar` e `Explorar por conta própria`; esta saída dá acesso ao painel sem criação obrigatória. | Primeiro acesso elegível, rodada pausada, Usuário existente, entrada profunda. |
| 1 · Seu nome | Campo principal imediato; foco opcional em detalhe recolhido. Nome só altera o perfil após confirmação da rodada; vazio preserva o nome existente. | Vazio, preenchido, nome longo, limite do contrato real, erro associado ao campo. Não copiar o limite de 50 caracteres da demo sobre o contrato atual de 120. |
| 2 · Sua agenda | Reutiliza conexões Google reais, até duas contas totais e somente leitura; distingue conta já conectada, conexão em curso e seleção de fontes. | Loading, zero/uma/duas contas, acesso negado, cancelamento/erro OAuth, reautorização, revogação pendente e retorno à etapa. |
| 3 · Um hábito | Nome imediato, frequência nos detalhes; preparar gera lista compacta e `Adicionar outro`. Criação usa cadência válida do domínio. | Vazio, uma/várias escolhas, título em edição, limite da rodada, validação e remoção. |
| 4 · Um projeto | Nome imediato, contexto nos detalhes; preparar e remover preservam a identidade das demais escolhas. | Vazio, lista compacta, contexto válido, projeto com tarefas/notas pendentes vinculadas. |
| 5 · Uma tarefa | Próxima ação imediata; projeto/prazo nos detalhes; pode se vincular a projeto preparado ou existente do mesmo Usuário. | Sem prazo, prazo válido no fuso do app, vínculo, projeto removido/indisponível, erro e título ainda em edição. |
| 6 · Suas notas | Caderno é escolha explícita; primeira nota e vínculo aparecem sob demanda. Validar contrato real de caderno/página/TipTap e preservar identidade dos vínculos. | Sem escolha, só caderno, nota preenchida, título faltante/conflitante, detalhe que se abre para mostrar erro. Não criar caderno padrão por visitar a tela. |
| 7 · Outros espaços | Financeiro, Arquivos e Cofre ficam em detalhes recolhidos, com orientação curta e capacidade real claramente apresentada. | Nenhuma ação obrigatória. Sem lançamento fictício, novo módulo/upload de Arquivos ou coleta de segredo/senha mestra/kit do Cofre. |
| Resumo | Mostra somente escolhas desta rodada, acesso recolhido a `Revisar escolhas` e confirmação `Acessar meu painel`. Distingue rascunhos de conexões Google já efetivadas. | Sem escolhas, preenchido, processando, falha parcial, resultado incerto, concluído e revisão posterior sem reaplicação. |

- [ ] Capturar **cada uma das nove telas** em claro/escuro e nas larguras **320, 390, 900 e 1440 px**; registrar altura, SHA e dados sintéticos usados. Acrescentar detalhes abertos, menu de etapas e estados críticos de erro/loading/resumo preenchido nas larguras em que possam alterar o layout.
- [ ] Coluna principal de até 560 px, sem trilho lateral ou painel ilustrativo; campo principal visível de imediato, copy curta e detalhes secundários recolhidos por padrão. Listas compactas e resumo não apresentam módulos/contadores não escolhidos.
- [ ] Campos com texto ≥16 px, controles ≥44 × 44 px, contraste medido nos fundos efetivos DS 2.1; nenhuma rolagem horizontal global, ação encoberta ou corte de conteúdo com títulos longos, detalhes abertos e zoom de 200%.
- [ ] Teclado alcança todos os controles: ordem coerente de Tab/Shift+Tab, Enter/Espaço nos detalhes e ações, Esc fecha o menu e devolve foco. Mudança de etapa leva foco ao título; erro revela o detalhe, identifica e foca o campo; progresso e estado atual têm nomes/semântica acessíveis. Revisar o anúncio de salvamento/processamento/erro sem repetição excessiva.
- [ ] `prefers-reduced-motion: reduce` remove deslocamento de etapa sem atrasar navegação; tema/resize não recriam formulário, perdem seleção ou enviam dados. Registrar teste de zoom, movimento reduzido e eventual limitação de leitor de tela separadamente.

### OB1 — Entrar, explorar e retomar

- [ ] O acesso conectado exige sessão válida. Primeiro acesso elegível abre a configuração; Usuários existentes continuam entrando normalmente e têm entrada explícita em Configurações. Um registro ausente de onboarding não força recadastro nem apaga preferências.
- [ ] Link profundo autorizado chega ao destino solicitado, inclusive após login; destino externo/inválido é rejeitado. A configuração não cria loop entre Auth, Início e onboarding nem intercepta recuperação/troca obrigatória de senha.
- [ ] `Explorar por conta própria`/`Fazer depois` permitem usar o produto. Retomada pelo Início ou Configurações recupera a etapa e escolhas da mesma rodada; recarregar e trocar tema preservam campos, sem criação de registros de domínio.
- [ ] Pular todas as sete etapas permite concluir sem dados novos e sem preencher defaults sobre preferências existentes. Visitar etapas ou abrir detalhes não equivale a consentir criação.

### OB2 — Preparar, revisar e corrigir escolhas

- [ ] Percorrer o fluxo completo com perfil, hábito, projeto, tarefa, caderno/nota e retorno entre etapas. `Continuar`, `Voltar`, `Ver etapas` e ida direta ao resumo preservam títulos em edição; todo caminho para resumo prepara/valida o conteúdo pertinente, sem ignorar campos fora da etapa atual.
- [ ] Campos opcionais permanecem opcionais; ao escolher criar, entradas inválidas impedem somente o avanço/confirmação pertinente e exibem correção clara. O resumo mostra apenas escolhas válidas e não promete criação antes do comando final.
- [ ] IDs de rascunho são estáveis; tarefas/notas conservam vínculos explícitos a projetos válidos do mesmo Usuário. Remover projeto preparado limpa ou exige resolver seus vínculos pendentes; não redireciona silenciosamente para outro projeto homônimo.
- [ ] Duplicatas, limites por rodada e correspondência com registros existentes seguem os contratos definidos em 07 e no domínio, com teste de normalização. A restrição local de títulos do demo não vira unicidade global nova para hábitos/projetos/tarefas; caderno/página não contornam validação real.

### OB3 — Confirmar uma vez e preservar dados existentes

- [ ] Antes de `Acessar meu painel`, apenas o rascunho/progresso pode ter sido salvo. Perfil, hábitos, projetos, tarefas e conhecimento não foram escritos nos módulos; conexão OAuth tem a exceção explícita de OB5.
- [ ] Confirmar a rodada usa canais/Núcleo/adapters reais com validação, Entitlement, isolamento e Evento de domínio atômico por escrita. O Início e os módulos leem os registros confirmados e os conservam após reload.
- [ ] Duplo clique, retry, recarga, retorno de navegador e concorrência entre abas não duplicam itens ou eventos. Repetir comando usa a mesma identidade/recibo e verifica resultado, sem gerar um comando novo diante de resposta perdida.
- [ ] Rodada concluída pode ser revista em Configurações sem reaplicar itens, preferências ou nome e sem desfazer edições posteriores. `Configurar mais recursos` inicia outra rodada explícita, preservando os registros anteriores; resumo continua descrevendo aquela rodada.

### OB4 — Persistência, falhas e isolamento

- [ ] O contrato produtivo define armazenamento, versão, recuperação e eventual migração do rascunho. Não ler/importar automaticamente localStorage/chaves/IDs do demo nem tratar seu `version: 2` como schema de produção.
- [ ] Falha ao ler/salvar progresso, rede indisponível, sessão expirada e carregamento inicial exibem estados verdadeiros e ação de recuperação. Não anunciar `salvo`/`concluído` com escrita pendente; não apresentar dados de exemplo ou lista vazia como resposta a erro real.
- [ ] Forçar falha de um comando após outro confirmado; o resumo identifica resultados confirmados, pendentes e desconhecidos e preserva o rascunho restante. Retry atua somente sobre o necessário e reconcilia o resultado desconhecido; não reaplica itens já confirmados nem declara conclusão parcial como sucesso total.
- [ ] Dois Usuários e chamadas diretas comprovam isolamento de leitura/escrita, Entitlement e vínculos. Preferência não concede direito. Logout/troca de sessão limpa a superfície e invalida respostas atrasadas; uma aba/retorno OAuth da sessão anterior não repovoa o rascunho de outro Usuário.
- [ ] Conteúdo do rascunho não aparece em logs/telemetria indevida; nenhuma credencial Google ou informação secreta do Cofre é armazenada no progresso, eventos, mensagens de erro ou capturas.

### OB5 — Conectar Google e voltar à configuração

- [ ] Antes da ação, a interface informa que a conexão será efetivada no fluxo Google e que pausar/pular o onboarding não a desfaz. O resumo distingue esse resultado real dos itens ainda preparados; desconectar usa o comando existente e seu ciclo de revogação.
- [ ] Reutilizar `/api/calendar/oauth/start` e callback/serviços existentes, preservando vínculo à sessão, PKCE/estado e consumo único. O retorno atual para `/calendario?notice=...` deve ser conciliado com a retomada de onboarding por contexto autenticado validado, sem aceitar URL arbitrária nem refletir código, estado ou erro privado na mensagem.
- [ ] Exercitar sucesso, cancelamento, erro do provedor, retorno expirado/repetido, reautorização, troca de Usuário e ida/volta pelo navegador. A etapa e o rascunho retornam corretamente, com aviso seguro e opção de continuar sem Google quando cabível.
- [ ] O limite de duas contas considera contas existentes; pular não remove conexões, seleção de fontes ou permissões. Calendário, Integrações, onboarding e Início observam o mesmo estado; chamadas diretas não ultrapassam limite/Entitlement e não pedem escrita Google.

Evidência: contratos OAuth no harness existente mais testes do retorno/retomada acrescentados pela implementação. O ensaio com provedor real, quando exigido pelo contrato pertinente, permanece identificado por ambiente autorizado e separado da prova local; não exigir conta pessoal para capturas nem declarar OAuth real validado por mocks.

### OB6 — Limites e regressões após a conclusão

- [ ] Início, Configurações e os módulos tocados preservam seus controles e registros; executar as regressões relevantes de J1/J2/J4/J5, sem repetir trabalho concluído apenas para reconstruir o layout.
- [ ] Arquivos/Drive permanece fora da entrega MVP conforme D-032; nenhuma orientação promete upload ou reativa módulo retirado. Dados/infraestrutura históricos não são apagados.
- [ ] Cofre leva ao fluxo seguro existente quando solicitado e permitido, sem recolher segredos durante o onboarding. Financeiro respeita a privacidade e não recebe contas/lançamentos fictícios.

### Evidência técnica mínima de L3O

Reutilizar os portões da seção 5 e as suítes dos módulos alterados. Acrescentar testes de estado/domínio para elegibilidade, preparação, pausa/retomada, conclusão idempotente e falha parcial; testes de canal/persistência para dois Usuários, permissões e recibos; e E2E de entrada, pular tudo, fluxo preenchido, revisão e retorno OAuth. Uma suíte nova como `tests/e2e/onboarding.spec.ts` é **saída prevista**, não teste existente ou já executado.

Relacionar os resultados aos contratos reais de Configurações, Hábitos, Projetos, Tarefas, Conhecimento e Calendário indicados no mapa. O `npm run test:e2e` padrão não substitui os harnesses SQL/Auth nem a prova conectada. Se algum contrato ainda estiver pendente na base de implementação, registrar a lacuna, seu responsável e a parte do aceite bloqueada; não simulá-lo como concluído. Entregar relatório por OB1–OB6 e tela, anexando logs sanitizados e capturas do SHA entregue.
