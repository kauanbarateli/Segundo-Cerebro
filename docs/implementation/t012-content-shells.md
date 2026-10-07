# T-012 — Calendário, Hábitos, Conhecimento e Projetos

As quatro cascas usam o provider da sessão e os componentes DS 2.1. Nenhuma importa outra feature. O recorte preserva as entidades compartilhadas e separa acesso ao módulo de preferência de navegação.

## Fontes e limite

Referências: docs 05, 09, 13/T-012 e 14/§§3–9; protótipo de 29/09/2026; Impeccable local, Operate e Craft Floor. O launcher já havia falhado nesta sessão e o contexto foi mantido pelo fallback documental. Os briefs de cada superfície registram proveniência e composição.

Os dados continuam sendo demonstração em memória. Calendário não conecta contas externas; Conhecimento não contém editor; projetos são contexto de leitura; a criação de hábitos e o CRUD completo de cadernos/projetos seguem fases posteriores. Não foram introduzidas promessas de sincronização, notificações ou autenticação.

## Calendário

Dia, semana e mês compartilham a coleção agenda. A URL conserva visão/data/evento; entrar com um ID de evento escolhe seu dia quando não há data explícita. Drawer abre o evento exato e oferece vínculos autorizados. ID desconhecido aparece como estado próprio.

Mês usa grade com dias da semana no desktop e lista por dia abaixo de 768px. A semana usa rolagem interna, sem ampliar a página. A grade horária reserva colunas para eventos sobrepostos e para a altura mínima dos botões de eventos curtos. Eventos de dia inteiro têm faixa separada. A lista mensal é a alternativa de leitura de todos os eventos no celular.

As projeções usam o dia civil de São Paulo e o intervalo semiaberto do Núcleo: um evento cujo término é meia-noite não aparece no dia seguinte. A agenda adicional começa amanhã e preserva os três compromissos de hoje do Início. Não há arrays de eventos particulares da tela.

## Hábitos

Hoje, histórico de 26 semanas e pausas leem a mesma coleção de hábitos/marcações. O mapa é uma visualização não interativa com resumo e legenda; a edição acessível usa o formulário Registrar dia, com controles de tamanho real. O Núcleo define cadências, sequência, pausa, passado permitido e futuro proibido.

Registrar dia envia estado desejado; Registrar pausa permite hábito individual ou todos, intervalo fechado ou sem fim e motivo de até 200 caracteres. Tentativas do mesmo envio conservam client_id; mudanças de formulário geram novo pedido. O comando emite evento transacional; a tela não altera arrays/Maps persistidos. Marca existente pode ser removida após uma pausa posterior. Erro do comando permanece na tela/formulário; erro de leitura oferece retry.

## Conhecimento

Query knowledge tem gate próprio. Ela projeta as mesmas Capturas organizadas/vivas; Capturar vetado não impede ler Conhecimento permitido. Cadernos e memberships são metadados separados, sem cópia de título/corpo. Novas notas organizadas sem membership aparecem em Sem caderno.

Lista, busca, leitor, wiki-links resolvidos e referências usam IDs/títulos atuais. Renomear uma nota em Capturar deve atualizar a leitura após invalidação. Editar em Capturar só aparece quando esse módulo está autorizado. Nota ausente não abre outra nota silenciosamente. A árvore usa navegação/listas e expansão de caderno, sem declarar um widget ARIA tree incompleto.

## Projetos

Query projects lê as entidades Projeto diretamente, independente de projectsVisible usado no enriquecimento das outras telas. O detalhe compõe somente as queries das seções permitidas e visíveis. Nenhuma leitura relacionada começa antes de localizar o projeto válido.

Contagens e progresso vêm das tarefas vivas; capturas, cadernos e pastas usam project_id do contêiner. A agenda mostra eventos vinculados às notas visíveis daquele projeto. Dados ocultos não geram um contador paralelo. Não há CRUD ou ações vazias de projeto.

## Estados e integração

Cada feature define sua própria geometria de skeleton: grades/lista de agenda; linhas/mapa de hábitos; árvore/leitor; cards de projeto e linhas de seção. Os erros vêm de QueryState produzido pelo reader do provider, não de um botão que oculta a lista. Retry chama a leitura novamente. Vazio válido tem orientação e destino permitido; acesso negado permanece no WorkspacePage.

Rotas com search params ficam sob Suspense com o skeleton da própria superfície. Os tokens existentes fornecem cores, radii e tipografia, e os controles reutilizados preservam reduced-motion e foco. Sem gradientes decorativos; a grade de horas usa linhas como escala de tempo.

## Evidência executada deste recorte

| Verificação | Resultado |
|---|---|
| Projeções Calendário | 10 testes: formato/data, semana/mês, navegação mensal, multi-day, UTC, DST, clipping, sobreposição, botões curtos e imutabilidade. |
| Regressão de comandos Hábitos | 29 testes mantidos. |
| TZ=UTC e TZ=America/Sao_Paulo | 39/39 em cada fuso. |
| ESLint do recorte | Sem erros. |
| Dependências | 63 módulos / 177 dependências, sem violações. |

Typecheck global concluído sem erros após a integração das novas keys da fachada.

tests/e2e/casca-content.spec.ts contém 15 contratos: 320/390/768/1280, mês em lista, navegação/IDs, dia passado/pausa, Conhecimento com Capturar vetado, renomeação compartilhada, detalhe de projeto e IDs ausentes. Os controles de Configurações plantam uma falha real de reader por módulo e um cenário vazio do adapter; os testes verificam erro/retry e orientação própria, sem simular estados no DOM. A execução E2E, screenshots, contraste computado e revisão visual ficam para a integração coordenada; não são declarados aprovados por este documento.

Não houve build, servidor, navegador, commit ou acesso a banco neste recorte.
