# Detalhamento da Frente A — diferenças desta entrega

Base observada: `main` em `bd35288404c493d1b03f7a1a0208f808cc2079a2`. Documento preparado em 31/10/2026; **não publica issues, não implementa e não declara testes executados**.

## Recorte atual e método

O novo recorte de fase 1 prevalece sobre o pacote completo anterior: A entrega visual, texto, navegação e fluxos existentes; B entrega cadastro gratuito por e-mail/senha, UTM simples, métricas Master, feedback e atualizações. Google login, escrita Calendar, ClickUp, ADM separado e purga ficam para etapa posterior. Não carregar por herança preço, checkout, contador restritivo de teste, nova exclusão definitiva ou aviso de purga ainda inexistente.

Lidos `to-tickets`, instruções do repositório, doc08 do pacote pós-MVP e fontes das superfícies. Cada candidato abaixo entrega um percurso verificável usando contratos atuais. Não há ticket horizontal de “criar componentes” sem comportamento visível. Extrações pequenas entram no ticket que já entrega o benefício e antecedem seus consumidores.

Os IDs A01–A06 são chaves estáveis deste plano; os números reais estão no [registro publicado](05-registro-de-tickets.md). O mapa técnico fica neste documento; as issues usam comportamento e aceite, conforme `to-tickets`.

## Resumo para o plano publicado

| ID | Título proposto | Entrega demonstrável | Bloqueado por | Tamanho relativo |
|---|---|---|---|---|
| A01 | Simplificar landing e login com acesso gratuito coerente | Visitante entende o produto, altera tema e chega ao acesso disponível sem promessa falsa | Nenhum | S–M |
| A02 | Tornar tema imediato e padronizar cabeçalho e painéis | Usuário alterna tema e opera diálogos com foco, respiro e navegação consistentes | Nenhum | M |
| A03 | Simplificar os editores preservando rascunhos e formatação | Usuário escreve, formata, organiza e salva uma nota com menos controles expostos | Nenhum | M |
| A04 | Capturar uma nota sem sair da página atual | Usuário cria captura com imagens no modal e continua sua tarefa | A02 e A03 | M |
| A05 | Reorganizar Configurações e cards de Projetos | Usuário personaliza seu ambiente e abre projetos em composição responsiva consistente | Nenhum | M |
| A06 | Tornar a lista a única visualização do calendário | Usuário navega por data/fonte/evento sem seletores de vistas ou preferências sem efeito | Nenhum; coordenar autoria de Configurações com A05 | S–M |

A01, A02, A03 e A05 não esperam o backend de B. A06 coordena com A05 a edição do formulário de preferências. Essa coordenação não constitui bloqueio técnico e não será publicada como dependência nativa. A04 consome o editor extraído e o contrato de overlay já conferidos. A implementação de B avança em paralelo sem modificar os mesmos arquivos de A.

## Contratos mínimos entre A e B

### CTA de acesso e comunicação

- **A é dona da apresentação pública e login existente. B é dona da disponibilidade real de cadastro, da rota de cadastro, validação e backend.**
- A recebe um contrato mínimo de destino seguro/disponibilidade, com fallback funcionando sem B. Quando cadastro não estiver habilitado, o CTA leva a `/entrar` e se identifica como **Entrar** ou **Acessar minha conta**, sem anunciar criação aberta.
- Quando B concluir e habilitar cadastro no servidor, o mesmo ponto passa a **Criar conta gratuita**, apontando para a rota acordada `/criar-conta`. Essa ativação e o teste completo até onboarding pertencem ao ticket de B; não exigem reescrever a landing.
- A usa somente booleano/destino validado recebido da composição apropriada, não decide disponibilidade a partir de cookie livre, querystring ou existência presumida da página. O fallback é seguro por padrão. B mantém enforcement de cadastro no servidor independentemente do CTA.
- O login existente recebe o tratamento visual dos termos por A01. B cria formulário de cadastro separado ou reutiliza uma apresentação compartilhada aprovada, sem editar concorrentemente o estado/actions do login existente.
- Comunicação de fase 1: acesso gratuito, sem preço, cartão, cobrança, checkout ou botões Google/Apple. Não apresentar gratuidades como promessa de gratuidade vitalícia. Uma opção de login Google não aparece só porque conexão Calendar já existe.

### Feedback, atualizações e navegação Master

- A02 é dona do shell, header, sidebar e comportamento mobile. Prepara pontos opcionais para **Enviar feedback** e **Atualizações** (raio com nome acessível), com disponibilidade inicialmente falsa.
- B é dona das rotas e comportamentos completos de `/feedback` e `/atualizacoes`, seus dados, autorização e disponibilidade. Só ativar links quando o destino funcionar; antes disso manter Ajuda acessível, sem 404, formulário simulado ou botão sem ação.
- A02 aceita a indicação de disponibilidade no boundary de composição; B altera o produtor do contrato, não o JSX/CSS do shell. O integrador confere os dois estados. Se o shell precisar de ajuste adicional após B, o autor A o incorpora em patch pequeno.
- Métricas Master e operação mínima de feedback pertencem a B. A não desativa Admin/APIs existentes nesta fase nem move tudo para o subdomínio futuro. A aparência usa os componentes disponíveis; novo design de uma aplicação administrativa independente fica para etapa 2.

### Fronteiras de código

- A não altera Auth actions/guards, modelos de dados, adapters, RPCs, migrations, scopes OAuth ou agendamento. Usa APIs atuais; um teste conectado pode revelar defeito já existente e deve registrá-lo, sem expandir o ticket silenciosamente.
- B não altera os arquivos de apresentação de A simultaneamente. Mudanças em contrato compartilhado, shell, token, metadata ou formulário legado passam pelo integrador e dono do arquivo.
- Shared editor fica fora de features dependentes entre si. Shell pode compor uma feature de captura; `components/ui` permanece sem dependência de feature. Reutilização não pode ser uma segunda implementação de salvamento/rascunho.

## A01 — Simplificar landing e login com acesso gratuito coerente

**Objetivo / o que entregar:** o visitante vê uma apresentação curta e consistente com o login, entende o acesso gratuito desta fase e usa o caminho realmente disponível. A entrega funciona antes de B, com login existente, e já aceita a ativação futura de cadastro sem reescrita.

**Diagnóstico:** a landing tem Princípios, seletor de tema no footer, Configurações do aplicativo no footer e aviso de acesso fechado. Login tem links legais duplicados. O favicon oficial já existe; não é necessário desenhar uma marca nova.

**Bloqueado por:** nenhum. Cadastro de B não bloqueia construir, revisar ou entregar o estado de fallback.

**Critérios de aceite candidatos:**

- [ ] Retira seção Princípios, sua âncora e navegação correspondente, sem links quebrados; preserva os três capítulos e imagens reais coerentes com funções existentes.
- [ ] Usa marca em duas linhas conforme login; tema e Entrar ficam no header e continuam acessíveis no celular; footer conserva legais/suporte, sem Configurações do aplicativo.
- [ ] CTA com cadastro indisponível abre `/entrar`, com rótulo honesto; o estado habilitado recebe destino `/criar-conta` por contrato. Não há botão de contratação, preço, cartão ou login social.
- [ ] Copy comunica gratuidade desta fase sem prazo de bloqueio fictício ou promessa vitalícia; a disponibilidade de criação acompanha a capacidade real.
- [ ] Links Termos de Serviço/Política de Privacidade ficam nos respectivos textos da checkbox; clique no link não marca checkbox, submete formulário nem perde campos. Preserva validação, foco e recuperação de senha.
- [ ] Favicon/metadata corretos são conferidos antes de trocar assets. Claro/escuro, teclado e 320/390/768/1440 px sem header ou conteúdo cortados.
- [ ] Estado de fallback é validado sem novo Auth; quando B ativar cadastro, seu ticket valida landing → cadastro → onboarding. Nenhum stub é anunciado como produção.

**Fora:** cadastro backend, política de acesso, UTM, prova jurídica, novo favicon autoral, mudança de indexação/analytics não solicitada.

**Prova proporcional:** inspeção visual em lote, links e teclado; regressão focada do login/checkbox; uma verificação do contrato de CTA nos dois estados. Não criar snapshot de toda redação.

## A02 — Tornar tema imediato e padronizar cabeçalho e painéis

**Objetivo / o que entregar:** um clique alterna claro/escuro e os painéis existentes deixam espaço adequado sem perder foco, ações ou estabilidade mobile. A navegação recebe pontos opcionais para os recursos de B sem expor links mortos.

**Diagnóstico:** tema autenticado é select de três opções disfarçado de ícone; drawer comum ocupa altura total e encosta às bordas, abrindo à direita. O hook de tema já aplica a escolha e persiste na conta conectada.

**Bloqueado por:** nenhum. B apenas ativa os pontos opcionais quando prontos.

**Critérios de aceite candidatos:**

- [ ] Tema do header alterna imediatamente o tema resolvido sem abrir menu; ícone e nome acessível informam a ação. Sistema permanece nas Configurações/login.
- [ ] Usa o caminho de persistência existente, preservando sincronização entre abas/conta e aviso útil se salvar falhar; não cria API de tema nova.
- [ ] Diálogos e drawers existentes têm respiro e dimensão por uso, rolagem interna, safe areas e operação com teclado virtual; não impõem o mesmo tamanho a confirmação e editor longo.
- [ ] Escape, clique fora conforme contrato, foco inicial/devolvido, empilhamento e bloqueio de fechamento durante operação protegida continuam corretos.
- [ ] Header/sidebar/mobile oferecem pontos opcionais de feedback/Atualizações. Desabilitados, não exibem links novos; habilitados por B, mostram destinos acordados e nomes acessíveis, sem sobreposição a 320 px.
- [ ] Retira apenas mensagens rotineiras redundantes; mantém erros, conflito, rascunho, permissão, sessão e resultado incerto. Admin existente não é desativado nesta etapa.
- [ ] Conferência de consumidores representativos inclui Calendário, Financeiro, Cofre e imagem, nos dois temas, teclado e movimento reduzido.

**Fora:** nova navegação funcional de feedback/roadmap antes de B, exclusão de Admin/APIs, animação cinematográfica, novos tokens ou redesenho do DS.

**Prova proporcional:** smoke dos consumidores de overlay, foco por teclado, tema persistido/reload e falha de save. Testes novos só onde houver risco de regressão funcional.

## A03 — Simplificar os editores preservando rascunhos e formatação

**Objetivo / o que entregar:** em Capturar/Conhecimento, título e corpo protagonizam; formatação e organização aparecem sob demanda, mantendo o percurso real de editar/salvar/reabrir e as garantias do PR #120.

**Diagnóstico:** há repetição de título/estado e toolbar/metadados sempre expostos. Editor documental já é compartilhado; Captura e Página são modelos diferentes e não devem ser fundidos.

**Bloqueado por:** nenhum. Pode manter primitives existentes até A02 ser integrado, pois seu contrato de foco não muda.

**Critérios de aceite candidatos:**

- [ ] Retira rótulos/contagens redundantes como Nova nota repetida e Pronto para escrever; mantém uma ação de criar claramente identificada e estados operacionais úteis.
- [ ] Formatação abre menu com comandos existentes, preserva seleção e atalhos; abrir/fechar menu não desmonta editor nem altera conteúdo/salva implicitamente.
- [ ] Configurações da nota reúne controles atuais aplicáveis: tipo/categoria/projeto em Captura; caderno/página mãe e vínculos em Conhecimento. Não adiciona tipo novo a Página.
- [ ] Escrita/salvamento/reabertura preservam IDs, referências, anexos, Reader/Edit, promoção e rascunhos. Conflito CAS e resultado incerto continuam acionáveis.
- [ ] Extração frontend mínima do composer e de seu contrato de edição é usada pela página atual e fica disponível para A04, sem dependência cruzada entre features e sem duplicar protocolo de comandos.
- [ ] Demonstração e modo conectado conservam seus limites distintos. Tema, desktop/celular, teclado e foco de erro funcionam com texto longo, lista de notas e editor móvel.

**Fora:** autosave novo, alteração de schema/documento, novo tipo ou attachment, nova regra de purga/exclusão permanente.

**Prova proporcional:** cenários existentes de save, conflito, draft e promoção; percurso de formatação sobre seleção e reload. A extração deve ficar verde com a página existente antes de A04 consumi-la.

## A04 — Capturar uma nota sem sair da página atual

**Objetivo / o que entregar:** a pessoa cria uma captura com texto/imagens pelo cabeçalho, recebe confirmação e volta ao mesmo contexto; a nova captura fica disponível na coleção real.

**Diagnóstico:** Capturar do header hoje é link de navegação. O mesmo módulo já possui criação, upload, rascunho e idempotência; o modal precisa reaproveitar esse fluxo.

**Bloqueado por:** A02 (contrato de header/overlay) e A03 (composer reutilizável integrado e verificado).

**Critérios de aceite candidatos:**

- [ ] Capturar do header abre modal sem mudar URL, scroll/contexto de trabalho ou coleção em edição; sidebar/barra inferior conservam acesso à página Capturar.
- [ ] Cria por comandos e validações atuais; ao confirmar, fecha com feedback e ação Abrir nota; nova captura aparece corretamente após leitura/reload.
- [ ] Aceita somente texto/imagens atuais, com máximo de seis anexos e limites/formatos efetivos do pipeline. Não aceita PDF/áudio por mero `accept` amplo.
- [ ] Cancelar/fechar com conteúdo preserva rascunho ou exige descarte explícito; não sobrescreve um rascunho independente aberto na página de captura. A chave de rascunho separa dono/contexto sem mudar o banco.
- [ ] Save falho mantém texto/imagens; double-click, timeout e retry respeitam a mesma intenção, sem duplicar captura ou upload.
- [ ] Sessão revogada/troca de usuário não mostra nem envia rascunho de outra conta; o modal respeita os direitos atuais de Capturar.
- [ ] Foco inicial, Escape/fechamento protegido e retorno ao acionador funcionam nos dois temas e com teclado virtual. A nota não é salva ao apenas abrir/fechar o modal.

**Fora:** novo endpoint, schema, fluxo de conhecimento paralelo, nova quota ou política de armazenamento.

**Prova proporcional:** início em Tarefas/Calendário → captura com imagem → confirmação → abrir/reload; cancelar com draft; falha e envio incerto; troca de dono. Prova conectada usa conta QA e backend atual, não fixture como substituto.

## A05 — Reorganizar Configurações e cards de Projetos

**Objetivo / o que entregar:** a pessoa encontra e salva preferências em grupos equilibrados e explora projetos com capas e informações legíveis, sem perder funções já implementadas.

**Diagnóstico:** Configurações está limitada a uma coluna e contém cards informativos dispensáveis. Projetos já possui capas/progresso real; faltam proporções e adaptação consistentes em larguras intermediárias.

**Bloqueado por:** nenhum. A02 altera primitives em autoria separada; incorporar seu contrato compatível na revisão de integração.

**Critérios de aceite candidatos:**

- [ ] Configurações usa duas colunas quando os campos couberem e uma em telas menores, com ordem DOM/teclado coerente; grupos longos podem ocupar faixa inteira.
- [ ] Retira os cards Meus dados e instalação, além de âncoras órfãs; preserva perfil/avatar, tema, módulos, lembretes, sessões, senha, legais e suporte. Não remove PWA/runtime.
- [ ] Ajuda da imagem do Início fica “Limite de 8 MB.”, sem remover validação técnica ou alterar bytes aceitos; demais erros permanecem úteis.
- [ ] Salvar um grupo não perde rascunho ou escolha ainda não enviada em outro; links profundos de perfil/legais continuam válidos.
- [ ] Cards de Projetos têm capas proporcionais e grade por área útil; título longo, ausência de capa/descrição, zero/muitas tarefas não quebram a composição. Usam progresso real, sem prazo/status fictício do protótipo.
- [ ] Criar/editar/abrir projeto e trocar capa usam fluxos existentes; excluir/restaurar projeto conserva os itens vinculados. Não introduz novo campo de domínio.
- [ ] O formulário de preferências permanece compatível com os campos atuais. A06 assume depois o pequeno corte do seletor de vista e de seu payload; A05 não começa uma segunda implementação de preferências.

**Fora:** nova exportação de dados, exclusão de conta, reativação do Drive, novo editor de projetos ou prazo próprio.

**Prova proporcional:** salvar nome/tema/imagem em percursos independentes, título longo/sem capa e abrir detalhe; duas larguras de desktop com sidebar e celular nos dois temas. Não criar testes para fixar grid CSS.

## A06 — Tornar a lista a única visualização do calendário

**Objetivo / o que entregar:** a pessoa navega por data, período e fonte em uma lista coerente; links antigos e preferência anterior não a enviam a vistas removidas.

**Diagnóstico:** a lista lateralizada já existe, mas convive com Dia/Semana/Mês e preferência inicial. O drawer de evento, participantes e sincronização somente leitura já têm contratos aproveitáveis.

**Bloqueado por:** nenhum. Coordenar o trecho compartilhado de Configurações com A05; é ordem de autoria, não dependência técnica. Não depende de Google login, escrita Calendar, ClickUp ou Auth de B.

**Critérios de aceite candidatos:**

- [ ] Calendário abre sempre em lista, sem botões Dia/Semana/Mês/Lista; preserva Hoje, período anterior/próximo, data, paginação, fontes e detalhe de evento.
- [ ] URL legada com `view=day/week/month`, `date` e `event` abre lista no mesmo contexto; seleção do mini calendário não reativa vista removida.
- [ ] Retira Visão inicial das Configurações e não sobrescreve esse campo legado ao salvar outras preferências. Nenhuma migration ou atualização em massa é necessária; o calendário ignora a preferência antiga na apresentação.
- [ ] Eventos usam dados reais já presentes no DTO; participantes ausentes têm fallback honesto, sem fotos inventadas. Não adiciona descrição/Meet se isso exigir extensão backend fora da fase.
- [ ] Distingue período vazio, fontes ocultas, cache parcial e falha de sincronização; preserva permissão somente leitura, ações de nota vinculada e link Google existentes.
- [ ] Desktop/celular permitem ler data/título/fonte e abrir evento por teclado; seleção de data e paginação mantêm foco estável; não cria overflow horizontal global.
- [ ] Os controles de criar/editar/cancelar evento e nova opção de OAuth de edição não aparecem nesta fase. Integrações continua com conexão Calendar já existente.

**Fora:** novo scope, ACL/etag/campo remoto, criação/edição Google, fotos por People API, mudança de agendamento ou login social.

**Prova proporcional:** links antigos, troca rápida de período/data, filtros, evento multi-dia, detalhe/nota; salvar outra preferência conserva payload adequado. Testar com dados existentes em demo e conta QA, sem efeito remoto de escrita.

## Mapa técnico documental e autoria

Todos os caminhos abaixo foram observados na base; novas extrações são propostas, não arquivos já existentes. Levar este mapa ao documento do PR e linká-lo nas issues, evitando congelar todos os paths no corpo dos tickets.

| Dono | Pontos de partida existentes | Contratos preservados / divisão |
|---|---|---|
| A01 | `src/app/conheca/page.tsx`; `src/components/features/conheca/landing-page.tsx`, `landing-header.tsx`, `content.ts`, `access-action.tsx`, `landing.css`; `src/components/features/auth/auth-form.tsx`, `auth-frame.tsx`, `auth-theme-switcher.tsx`, `auth.css`; `src/components/ui/brand.tsx`; `src/app/icon.svg` | B não edita login existente simultaneamente. A muda apresentação legal, não actions/guards. B controla rota e disponibilidade de cadastro. |
| A02 | `src/components/layout/workspace-shell.tsx`, `workspace-shell.css`; `src/components/theme/theme-toggle.tsx`, `theme-toggle.css`, `theme-selector.tsx`; `src/components/ui/dialog.tsx`, `dialog.css`, `focus-stack.ts` | Um autor para primitives/shell. B entrega disponibilidades/destinos; não modifica o layout. A04 só altera o gatilho de Capturar após A02. |
| A03 | `src/components/editor/document-editor.tsx`, `document-editor.css`; `src/components/features/capturar/capture-view.tsx`, `capture.css`, `drafts.ts`, `requests.ts`, `model.ts`; `src/components/features/conhecimento/knowledge-connected-workspace.tsx`, `knowledge-editor.tsx`, `knowledge-drafts.ts`, `knowledge.css` | Extração frontend restrita para A04. Não reimplementar CAS, journal, modelos ou schemas; evitar imports feature→feature. |
| A04 | Composer extraído por A03; `src/components/layout/workspace-shell.tsx`; `src/components/features/capturar/images.ts`, `image-rules.ts`; `src/components/layout/file-upload.ts` | Shell liberado por A02. Endpoints existentes: `/api/capture-tasks`, uploads/arquivos atuais; backend permanece intocado. |
| A05 | `src/components/features/configuracoes/settings-workspace.tsx`, `settings-connected-workspace.tsx`, `settings.css`, `settings-legal-section.tsx`, `home-image-settings.tsx`, `own-sessions-section.tsx`; `src/components/features/projetos/projects-workspace.tsx`, `project-editor.tsx`, `projects.css`; `src/components/layout/entity-image-editor.tsx` | Preferências com save atual. A06 herda depois o campo da vista; nenhuma concorrência nesse arquivo. |
| A06 | `src/components/features/calendario/calendar-workspace.tsx`, `calendar-list.tsx`, `calendar-aside.tsx`, `calendar-event-detail.tsx`, `calendar-people.tsx`, `calendar-projections.ts`, `calendar.css`; trecho do seletor e save em `settings-connected-workspace.tsx` | Ignorar preferência antiga no front; não mudar contratos/API de Calendar. Preservar cache, fuso, URL de evento e nota. |
| B | Novos cadastro/feedback/atualizações e sua composição server; Auth services/actions/guards, contratos/rotas/adapters/dados, UTM e métricas Master | Não herdar escopo de Google login/novo ADM/purga. Definir flags e regras reais; a composição injeta disponibilidade para A. |

## Referências verificáveis para todas as issues

- Base: [main analisada](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2).
- [Tokens DS 2.1](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/design-system/tokens/tokens.json), [DESIGN.md](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/DESIGN.md) e [primitives](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/src/components/ui/README.md).
- [Protótipo doc17](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/17-evolucao-prototipo/prototipo) e [capturas com manifesto](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/17-evolucao-prototipo/capturas).
- Referências mais úteis: `capturar-1440-light.png`, `capturar-390-dark.png`, `calendario-1440-light.png`, `calendario-1440-dark.png`, `projetos-1440-light.png`, `configuracoes-390-light.png`. São protótipo demonstrativo, não execução nova ou prova de produção.
- [Convergência doc18](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/18-convergencia-prototipo-20261025) e [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120), para preservar comportamento entregue; não reutilizar seus resultados como testes desta fase.

## Padrão de conclusão da frente

Cada ticket entrega comportamento funcional com endpoints já existentes, diff revisável e prova apropriada. Claro/escuro, 320/390/768/1440 px quando relevante, campos ≥16 px, alvos ≥44 px, foco visível, movimento reduzido e contraste real seguem Impeccable/DS. Inspeção visual em lote, não testes que espelham classes CSS.

Reconciliar main antes de implementar, pois o SHA fixa a análise, não congela o projeto. Atualizar somente documentação afetada e registrar fronteiras com B. Recapturar imagens promocionais materialmente desatualizadas apenas após o fluxo correspondente existir. Não fechar ticket como concluído por mock, build isolado ou clique com toast sem persistência. A integração final B valida a ativação de cadastro/feedback/atualizações sem tornar esses backends pré-requisito artificial para as melhorias A já demonstráveis.
