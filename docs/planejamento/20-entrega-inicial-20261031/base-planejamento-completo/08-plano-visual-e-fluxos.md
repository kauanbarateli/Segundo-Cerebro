# 08 — Plano visual e fluxos

Data: 31/10/2026. Base técnica observada: `main` em `bd35288404c493d1b03f7a1a0208f808cc2079a2`, após incorporação do PR #120. Este documento orienta implementação posterior; não declara telas novas, testes executados ou publicação.

## 1. Direção e decisões aplicadas

O Segundo Cérebro mantém a identidade existente: Geist, neutros DS 2.1, acento monocromático, superfícies sólidas e imagens pessoais como conteúdo. A revisão reduz informação repetida e deixa controles secundários disponíveis sob demanda. Preserva dados, rascunhos, vínculos, estados de erro e funcionalidades fora do corte explícito.

- **OBSERVADO:** o código atual já tem componentes de marca, tema, modal/drawer, editor compartilhado, lista do calendário, capas de projetos e configuração por seção. As mudanças devem reutilizá-los.
- **DECIDIDO:** cadastro aberto com e-mail e Google; Apple posterior; teste de 7 dias, continuidade gratuita no beta, sem preço e sem cobrança automática; gratuidades existentes preservadas.
- **DECIDIDO:** captura rápida com texto e imagens atuais; reorganização dos controles de notas, sem novo modelo de tipos; lixeira de 7 dias para tarefas, capturas e páginas, com carência de 7 dias para itens legados.
- **DECIDIDO:** calendário apenas em lista; edição completa de eventos avulsos conforme permissões; recorrências somente leitura nesta etapa.
- **DECIDIDO:** ClickUp em seção própria de Tarefas, com comentários; pai como contexto; atualizar ao abrir, manualmente e a cada 5 minutos em segundo plano conforme política de sincronização.
- **DECIDIDO:** roadmap autenticado; feedback privado com categoria/texto e retorno no aplicativo; retenção de 12 meses após encerramento. Administração separada em `adm.segundocerebroapp.com.br`, com contas, feedback, liberações de módulos, métricas e UTM por usuário. Desativar página/APIs Admin antigas somente após contingência operacional definida.
- **RECOMENDADO:** as rotas novas mencionadas abaixo são contratos de navegação propostos. Confirmar sua compatibilidade com middleware e convenções ao implementar; não presumir que já existam.

### Aplicação da Impeccable

Aplicar `shape` para esclarecer composição e fluxo, `distill` para eliminar redundância e usar `operate` no ambiente autenticado e administrativo. A landing é **Persuade**; páginas legais são **Read**. A revisão final usa `polish`, com inspeção de capturas em lote nos dois temas e correção dos problemas observados.

“Menos texto” não elimina nome acessível, label, limite necessário, mensagem de erro, condição do beta ou consequência de exclusão. Alertas de conflito, rascunho local, envio incerto e sessão expirada são informação de trabalho. Não ocultá-los junto aos textos rotineiros.

## 2. Autoridade visual e arquivos de referência

1. As decisões acima e o briefing atual substituem os pontos conflitantes dos protótipos históricos.
2. `design-system/tokens/tokens.json`, `src/components/ui/aliases.css`, `src/components/ui/README.md` e `DESIGN.md` descrevem o sistema existente.
3. `docs/planejamento/17-evolucao-prototipo/prototipo/` é referência de composição. `docs/planejamento/18-convergencia-prototipo-20261025/README.md` registra a convergência do produto; não reconstruir módulos já entregues.
4. As [seis capturas anexadas](referencias/README.md) foram copiadas sem alteração do snapshot. São **referências do protótipo**, coletadas originalmente em 21/10/2026, não capturas novas da produção.

| Referência deste pacote | Usar para | Não copiar como regra nova |
|---|---|---|
| [Calendário claro](referencias/calendario-1440-light.png) e [escuro](referencias/calendario-1440-dark.png) | Mini calendário lateral, datas, eventos em lista, hierarquia de fonte/participantes | Seletor de 4 vistas, rostos fictícios, descrição ou permissão inexistente no DTO |
| [Projetos desktop](referencias/projetos-1440-light.png) | Capa, nome, descrição, progresso e organização da grade | Prazo/status próprios de projeto que não existem no modelo persistente |
| [Configurações mobile](referencias/configuracoes-390-light.png) | Agrupamento, controles e ritmo em uma coluna | Exportação demonstrativa, afirmações de armazenamento local ou cards retirados pelo briefing |
| [Capturar desktop](referencias/capturar-1440-light.png) e [mobile escuro](referencias/capturar-390-dark.png) | Trilho/editor, foco no conteúdo, comportamento em tela estreita | Textos repetidos, toolbar sempre exposta ou funcionalidades só demonstrativas |

Não há referência aprovada do **novo Admin separado**. Sua direção abaixo é RECOMENDADA a partir do DS e do modo Operate, não uma réplica inventada de screenshot.

## 3. Contratos globais de interface

### 3.1 Tipografia, cor, medidas e estados

- Reutilizar tokens sem introduzir valores de cor literais. Campos ≥16 px, controles com alvo ≥44 × 44 px, contraste de texto ≥4,5:1 e elementos gráficos necessários ≥3:1 nos fundos efetivamente usados.
- Preservar um título principal por página, títulos de grupo e texto auxiliar em escala existente. Tabelas e números comparáveis usam alinhamento e numerais tabulares.
- Largura e quantidade de colunas respondem à área real de conteúdo, inclusive com sidebar expandida. Não esconder overflow global para disfarçar erros.
- Estados mínimos: padrão, hover, foco, pressionado, selecionado, desabilitado, carregando, vazio, sucesso e erro. Cor complementa texto/ícone; não é o único sinal.
- Preservar motion oficial de feedback/superfície, atualmente 120 ms/180 ms, e preferência de movimento reduzido. Nenhuma animação atrasa teclado, submissão ou fechamento.
- Mostrar apenas o conteúdo carregado que tenha validade conhecida. Cache parcial, integração desconectada e coleção vazia são estados diferentes.

### 3.2 Cabeçalho e navegação autenticada

Em `src/components/layout/workspace-shell.tsx`, manter breadcrumb, busca, tema, atividade, captura e avatar. Adicionar raio com nome acessível **Atualizações**, apontando para `/atualizacoes` proposta. Capturar passa a ser botão de modal no cabeçalho; a navegação lateral para `/capturar` permanece.

No celular, preservar acesso às ações sem reduzir alvos. Usar o menu de navegação para ações secundárias quando a largura não comportar todas; Atualizações deve continuar descobrível. A barra inferior conserva a navegação para módulos, sem transformar sua entrada da coleção de Capturar em comportamento diferente silenciosamente.

Substituir Ajuda por **Enviar feedback** na sidebar e no menu do perfil. `/ajuda` antiga pode redirecionar para `/feedback`, preservando o canal público de suporte no login/legais. Remover Admin do catálogo visível, busca e preferências quando o corte operacional for autorizado; ocultar navegação sozinho não desativa rotas/APIs.

### 3.3 Tema imediato

Trocar `ThemeToggle` de select por botão: se tema resolvido é claro, aplicar escuro; se escuro, aplicar claro. Se preferência anterior era Sistema, o clique vira escolha explícita. **Sistema permanece disponível em Configurações** e no padrão de 3 opções do login/landing.

Reutilizar `useThemeChoice()` em `theme-selector.tsx`, que já aplica no navegador e grava a preferência da conta conectada. Preservar tratamento de falha: a troca visual imediata não deve afirmar que houve confirmação de gravação quando ela falhou. Nome acessível deve informar a ação, por exemplo **Ativar tema escuro**; ícone e tooltip acompanham o estado.

### 3.4 Modais e painéis

`src/components/ui/dialog.tsx` e `focus-stack.ts` são a base comum. O drawer atual abre **à direita**, com 560 px e colado às bordas em desktop, e 100 dvh no celular. Ajustar o padrão para respiro superior/lateral em desktop, respeitando formulários e safe areas.

Separar três necessidades: confirmação curta centralizada; edição focada em painel/modal; detalhe longo com rolagem interna. Não converter todo fluxo para o mesmo tamanho. Em telas estreitas, privilegiar conteúdo, teclado virtual e ação final alcançável; manter respiro quando couber, sem tornar formulário impraticável.

Preservar foco inicial e de retorno, Escape, clique fora conforme contrato, backdrop, empilhamento e bloqueio de fechamento durante operação protegida. Revisar os consumidores em Calendário, Financeiro, Projetos, imagem, sessões e Cofre antes de alterar CSS compartilhado.

## 4. Entrada: landing, cadastro, login e onboarding

### 4.1 Fluxo principal

`/conheca` → **Quero acesso** → `/criar-conta` proposta → e-mail confirmado ou Google → ciência dos termos no fluxo apropriado → onboarding existente → `/` autenticado.

Quem já possui conta usa **Entrar** no cabeçalho → `/entrar` → destino interno seguro preservado. Não repetir onboarding concluído nem apagar rascunho iniciado. Recuperação/troca de senha e encerramento de sessão permanecem nos fluxos existentes.

### 4.2 Landing antes/depois

| Antes observado | Depois planejado |
|---|---|
| `#principios` e link Princípios no header | Removidos em conjunto, incluindo conteúdo/CSS órfão |
| Tema no rodapé | Tema no cabeçalho fixo, padrão visual do login |
| Entrar apenas no bloco de acesso | Entrar no cabeçalho, inclusive mobile |
| Quero acesso abre aviso de acesso fechado | Direciona ao cadastro real quando backend estiver pronto |
| Aviso longo sobre capturas demonstrativas | Mensagem curta de benefício; provenance das imagens preservada nos arquivos |
| Link Configurações do aplicativo no footer | Retirado; legais e suporte permanecem |
| Logo compacta/horizontal divergente do login | Marca stacked com duas linhas e símbolo proporcional, reutilizando `Brand` |

Manter os 3 capítulos Captura, Agenda e Projetos. Texto sugerido para revisão editorial: **“Ideias, tarefas e compromissos no mesmo lugar.”** Oferta: **“Experimente por 7 dias. Durante o beta, seu acesso continua gratuito, sem cobrança automática.”** Não mostrar preço, checkout, cartão obrigatório ou prazo de futura cobrança.

Telas de demonstração devem representar funções disponíveis, ter dados sintéticos e variantes claro/escuro/mobile. Quando alteração de interface tornar uma captura materialmente divergente, recapturar pelo pipeline existente `scripts/landing/`, registrar origem/SHA e revisar a imagem de compartilhamento. Não gerar interface fictícia com IA para anunciá-la como funcional.

### 4.3 Login e cadastro

Em `auth-form.tsx`, os textos **Termos de Serviço** e **Política de Privacidade** viram links dentro da frase de ciência; retirar links independentes Ler termos/Ler política do card. Clicar no link não deve alternar checkbox, submeter formulário ou perder os campos preenchidos. Preservar links legais do footer.

Eliminar descrição de cadastro fechado somente na entrega conjunta com abertura real. Separar ação Entrar de Criar conta, manter labels e erros associados. Google login não implica autorização ao Calendar: apresentar conexão de calendário no onboarding/Integrações com propósito e permissão próprios. Apple não aparece como botão indisponível nesta entrega.

No onboarding, conservar etapas puláveis e rascunho versionado já existentes. Novas conexões Google passam a informar somente leitura versus leitura/edição sem levar complexidade de console ao usuário. Ao concluir, resumo do que foi configurado e acesso ao dashboard. Se autorização externa for cancelada, retornar à etapa com opção continuar sem conexão.

**Arquivos envolvidos:** `src/components/features/conheca/{landing-page,landing-header,content,access-action,product-shot}.tsx` — `content` é `content.ts`; `landing.css`; `src/components/features/auth/{auth-form,auth-frame,auth-theme-switcher}.tsx`; `src/components/features/onboarding/`; `src/app/(auth)/entrar/page.tsx`; `src/app/(onboarding)/onboarding/page.tsx`; novos arquivos de cadastro, conforme arquitetura do plano técnico.

**Aceite:** sem âncoras quebradas ou CTA fictício; cadastro e login por e-mail/Google mantêm destinos seguros;7 dias/beta estão claros sem preço; novos/legados têm comportamento aprovado; onboarding não duplica registros; links legais funcionam por teclado; header320 px permanece utilizável; favicon aparece nas rotas públicas e privadas. O favicon `src/app/icon.svg` já existe: diagnosticar metadata/cache antes de recriar.

## 5. Captura, Conhecimento e exclusão

### 5.1 Captura rápida

De qualquer página autenticada → botão **Capturar** → modal com título opcional, corpo e anexar imagem → **Salvar nota** → confirmação e retorno ao ponto de trabalho, com ação **Abrir nota**. Criar na Caixa de entrada; configurações estruturais podem ser abertas se necessárias, sem obrigar projeto/tipo na primeira captura.

Usar pipeline atual de imagens e máximo atual de 6 anexos por captura; formatos e limites efetivos do servidor prevalecem. Não adicionar PDF/áudio/Drive. Estado de upload informa progresso/erro de forma localizada, preservando texto. Ao cancelar com alteração, preservar rascunho ou oferecer descarte explícito; não salvar silenciosamente. Submissão incerta mantém a mesma intenção/recibo, sem reenvio duplicado.

### 5.2 Páginas de edição

Em `/capturar` e `/conhecimento`, título e corpo são o foco. Retirar rótulos duplicados Nova nota, localização redundante, “Pronto para escrever” e contagens vazias sem utilidade. A ação de criar nota/página permanece identificada; não transformá-la em ícone sem nome.

O botão **Formatação** abre menu/popover com comandos já suportados pelo editor compartilhado `src/components/editor/document-editor.tsx`. Manter atalhos, estado ativo e seleção do texto ao mover foco para o menu. Não desmontar/recriar editor ao abrir menus. `Configurações da nota` reúne apenas controles já aplicáveis: tipo/categoria/projeto em Captura; caderno/página mãe e vínculos em Conhecimento. Não criar um campo Tipo novo para Páginas.

Vínculos de projeto/tarefa/nota continuam disponíveis. Reader antes de Editar em Conhecimento, CAS, preservação de rascunho e escolhas de conflito do PR #120 permanecem. Erro de salvamento ou envio não confirmado deve ser visível até resolução; mensagens rotineiras de armazenamento podem sair.

### 5.3 Lixeira

Em tarefas, capturas e páginas: ação de mover para lixeira separada de arquivar; lixeira oferece **Restaurar** e **Excluir permanentemente**. Mostrar prazo por item quando útil e aviso único de remoção automática após 7 dias. Itens legados recebem carência de 7 dias a partir da ativação definida no plano de dados; não aparentar que já venceram no primeiro acesso.

Exclusão permanente exige confirmação com nome do item, consequência e Cancelar inicialmente focado. Durante envio, evitar operação repetida; se resposta ficar incerta, usar reconciliação. Se job excluir entre abrir a tela e restaurar, mostrar item indisponível sem tratar como sucesso. Arquivamento não inicia contagem de lixeira.

**Arquivos envolvidos:** `src/components/layout/workspace-shell.tsx`; `src/components/features/capturar/capture-view.tsx`, `capture.css`, `images.ts`; `src/components/editor/document-editor.tsx`, `document-editor.css`; `src/components/features/conhecimento/knowledge-connected-workspace.tsx`, `knowledge-editor.tsx`, `knowledge-drafts.ts`; `src/components/ui/dialog.tsx`; páginas/ações da lixeira mapeadas no diagnóstico técnico.

**Aceite:** captura rápida não navega nem perde conteúdo; após salvar aparece na coleção real; editor mantém formatação/seleção/links; cancelar/sessão expirada/conflito não perdem rascunho; exclusão é permanente somente após confirmação ou prazo; restauração e limites do job são verificados no backend, não apenas por toast.

## 6. Calendário e integrações

### 6.1 Lista como única vista

`/calendario` exibe mini calendário/fontes na lateral e eventos em lista. Preservar seleção de data, Hoje, período anterior/próximo, Ver mês completo, paginação e filtros de fonte. Retirar Dia/Semana/Mês/Lista do topo e Visão inicial das Configurações. A seleção de uma semana no mini calendário deixa de trocar a vista.

Normalizar links antigos com `view` para lista, conservando `date` e `event`. Navegar rápido entre períodos usa o último destino solicitado, não estado obsoleto. Seleção mobile de data/fonte permanece simples e não disputa espaço com os eventos.

Cada evento destaca data/horário, título, fonte e estado relevante; local, Meet e descrição resumida entram quando realmente fornecidos. Participantes usam fotos apenas quando disponíveis e autorizadas; caso contrário, iniciais. Não inferir fotos pelo e-mail nem incluir recursos/salas como rostos. Elenco parcial deve ser indicado sem criar participantes falsos.

### 6.2 Detalhe e edição Google

Conectar conta → escolher **Somente leitura** ou **Leitura e edição** → autorização Google → escolher fontes → lista. Conta existente somente leitura permanece assim até consentimento explícito de ampliação.

Evento avulso com permissão → detalhe → **Editar** → título, data/hora/duração, dia inteiro, descrição, local, participantes e Meet conforme capacidade → revisar envio de convites/alterações → salvar → refletir confirmação remota. Criação oferece fonte gravável claramente identificada. Cancelamento/exclusão requer confirmação e explica impacto em convidados.

Recorrências e calendários sem permissão ficam somente leitura, com motivo curto e **Abrir no Google Calendar**. Não apresentar controles ativos que servidor recusará por regra conhecida. Conflito remoto pede recarregar/revisar antes de sobrescrever; falha preserva rascunho sem afirmar atualização concluída.

### 6.3 ClickUp em Tarefas

`/integracoes` → conectar ClickUp → escolher espaço autorizado conforme contrato → `/tarefas`, seção **ClickUp**. Separar visualmente tarefa externa de tarefa local, mostrando origem/link. Não importar como tarefa local duplicada por padrão.

Lista contém abertas atribuídas à pessoa conectada. Subtarefa atribuída ao usuário pode aparecer com pai como contexto, mesmo que o pai não esteja atribuído a ela; contexto não concede edição nem expõe irmãos fora do escopo. Detalhe oferece informações permitidas, status da lista, descrição e comentários; **mensagens** significa comentários de tarefa, não chat de workspace nesta entrega.

Atualizar ao abrir, manualmente e a cada 5 minutos quando permitido pela política operacional. Mostrar último estado confirmado e indicador discreto de atualização. Offline/429/permissão removida preservam cache identificado e orientam nova tentativa. Conclusão confirmada retira item da lista aberta; erro mantém item, rascunho e ação útil. Não simular tempo real.

**Arquivos envolvidos:** `src/components/features/calendario/{calendar-workspace,calendar-list,calendar-aside,calendar-event-detail,calendar-people,calendar-integrations,calendar-accounts}.tsx`; `calendar-projections.ts`, `calendar.css`; `src/components/features/configuracoes/settings-connected-workspace.tsx`; `src/components/features/tarefas/`; integração ClickUp e formulários de eventos novos, com adapters/contratos separados conforme plano de integrações.

**Aceite:** data/evento de link antigo conservados; fontes ocultas e cache parcial distinguíveis; formulário só permite operação autorizada; recorrência permanece somente leitura; evento confirmado aparece após releitura; convidados/Meet não são inventados; ClickUp exibe só o escopo autorizado e comentários não duplicam após retry.

## 7. Configurações e Projetos

### 7.1 Configurações

Reorganizar `/configuracoes` em duas colunas quando a área disponível permitir, sem masonry que altere ordem de teclado. Em tela menor, uma coluna. Grupos recomendados: Perfil, Aparência, Imagem do Início, Preferências, Módulos, Sessões e Privacidade/termos. Grupos longos podem ocupar a largura total; edição permanece independente por seção.

Retirar Meus dados e sua âncora: no snapshot é texto, não contém exportação/exclusão funcional. Retirar InstallHelp desta página, sem desativar manifesto, service worker ou outra frente de distribuição. Manter links legais, suporte, sessão/senha e direitos reais existentes.

Imagem do Início usa ajuda **“Limite de 8 MB.”**. O processamento/validação atual permanece; o texto não muda o limite de bytes nem dispensa controles de pixels/metadados. Preferências removem seleção de vista inicial da agenda. Configurar módulos não altera entitlement; módulos indisponíveis não são liberados por UI.

**Aceite:**2 colunas com espaço real para campos;1 coluna a 320/390 px; salvar tema não apaga rascunho de nome; âncoras de Perfil/Privacidade continuam; nenhuma função existente perdida ao retirar cards; sessões e links legais alcançáveis.

### 7.2 Projetos

Refinar grade em 3/2/1 colunas conforme largura útil. Ordem do card: capa → título/descrição → progresso real → resumo de vínculos/ação. Reduzir ícone/badge redundante quando competir com capa. Sem capa, usar superfície neutra coerente sem imagem inventada; descrição ausente não exige frase genérica longa.

Capa usa mesma proporção entre cards e recorte consistente. Títulos longos quebram linha sem colidir com ação; progresso usa tarefas reais permitidas. Preservar criação, capa, edição, vínculo/desvínculo e lixeira do projeto. Excluir projeto mantém registros vinculados, conforme contrato atual.

O protótipo possui prazo/badge de projeto. O modelo atual não possui esses campos: não copiá-los como funcionalidade. Mostrar estado derivado somente se já houver regra aprovada; o plano é refinamento visual.

**Arquivos envolvidos:** `src/components/features/configuracoes/{settings-connected-workspace,settings-workspace,settings-legal-section,home-image-settings,own-sessions-section}.tsx`, `settings.css`; `src/components/features/projetos/{projects-workspace,project-editor,project-context-section}.tsx`, `projects.css`; `src/components/layout/{private-image,entity-image-editor,entity-image-picker}.tsx`.

**Aceite:** cards com/sem capa e conteúdos longos alinhados; links inteiros acessíveis, sem botão aninhado em link; estados de carregamento/erro sem progresso falso; contextos e dados preservados nos dois temas.

## 8. Feedback e atualizações do usuário

### 8.1 Fluxo privado

**Enviar feedback** → `/feedback` proposta → categoria + texto → enviar → confirmação de recebimento + item em histórico próprio. Retorno ocorre no aplicativo; não prometer e-mail ou prazo não definido. Sem anexo nesta etapa. Usuário visualiza apenas suas solicitações e respostas; reclamação não é publicada automaticamente.

Categorias seguem briefing: sugestão, reclamação, problema, ideia de melhoria e outro. Campos curtos, limite textual claro e validação junto ao campo; contexto técnico automático, se previsto no plano de dados, não inclui conteúdo pessoal ou tokens.

### 8.2 Roadmap autenticado

Raio **Atualizações** → `/atualizacoes` proposta → quadro com **Planejado**, **Em análise**, **Em andamento**, **Em fase de testes**, **Lançado**, na ordem solicitada. Conteúdo publicado é editorial; feedback bruto permanece privado. Uma solicitação pode apontar para melhoria pública sem revelar autor/texto original.

Desktop: colunas com título, contagem e cards enxutos; detalhe com descrição curta, estado e atualizações relevantes. Mobile: navegar por colunas de forma acessível, com título/estado visível e alternativa a arrastar; nenhuma rolagem horizontal do documento inteiro. Usuário acompanha e envia sugestão, mas não movimenta status.

Histórico próprio mostra status, resposta e encerramento. Informar retenção de 12 meses após encerramento em localização apropriada; não repetir prazo em todos os cards. A capacidade de resposta depende do Admin separado, não de mock de interação.

**Aceite:** feedback A não aparece para B; item não publicado não aparece no roadmap; envio duplo não duplica; falha conserva texto; associação pública não vaza identidade; estados com zero/muitos cards são legíveis; retorno e encerramento são reais.

## 9. Admin separado — direção recomendada

### 9.1 Limite e identidade

Destino decidido: `adm.segundocerebroapp.com.br`. Mesma marca, Geist, tokens e temas, com identificação persistente **Administração** no cabeçalho e shell próprio. Modo **Operate**: tabelas, filtros claros, ações explícitas e resumos objetivos. Não copiar a experiência pessoal Início/Hábitos/Financeiro para um painel de administração genérico. O cadastro é de **Usuários**, conforme glossário; “alunos” não cria entidades de curso ou uma plataforma de ensino. Evitar “Contas” na navegação administrativa para não confundir com contas financeiras.

Nenhum screenshot anexado representa o novo Admin. Usar os componentes existentes como base e registrar o novo brief de superfície antes de implementar. Dados sintéticos para capturas/testes; nunca imagens de conteúdos privados de clientes.

### 9.2 Navegação proposta

| Rota no host administrativo (proposta) | Informação principal | Ação e limite |
|---|---|---|
| `/entrar` | Identificação de ambiente administrativo | Autenticação e autorização próprias; entrar como usuário comum não concede Admin |
| `/usuarios` | Usuários, situação de acesso/beta/gratuidade e busca | Abrir usuário; mostrar apenas metadados autorizados, sem notas, eventos privados, financeiro ou Cofre |
| `/usuarios/[id]` | Perfil administrativo, acesso e origem UTM permitida | Alterar liberações/vetos por módulo com motivo e confirmação; preservar diferenças entre entitlement e preferência |
| `/feedback` | Fila privada, categoria, status, autor autorizado e data | Triar, responder no app, associar a melhoria, encerrar; separar resposta privada de publicação |
| `/roadmap` | Quadro editorial de melhorias | Editar/publicar/mover item; ação alternativa por menu para teclado, sem depender de drag |
| `/metricas` | Medidas agregadas com período e definição | Filtrar e consultar; detalhamento UTM por usuário apenas no escopo autorizado |
| `/funcionalidades` | Catálogo de funcionalidades e política de disponibilidade | Consultar estado de liberação e administrar concessões/vetos autorizados; não confundir com preferência de visibilidade do usuário |
| `/auditoria` | Histórico de ações administrativas | Filtrar por operador, ação e período; somente metadados permitidos, sem conteúdo pessoal ou segredos |

Painel inicial, se necessário, deve trazer pendências reais e atalhos; não adicionar coleções decorativas de KPIs sem definição. Métrica precisa período, população e tratamento de ausência de dados. UTM indica atribuição registrada, não prova de conversão causal. Origem ausente aparece **Não informada**, sem inferência inventada.

### 9.3 Fluxos administrativos sensíveis

- **Liberação de módulos:** conta → módulo → estado atual/proposto → motivo → confirmar → feedback confirmado + registro de auditoria. Não gravar alterações ao clicar numa linha ou navegar entre contas.
- **Feedback:** abrir → ler contexto permitido → responder em campo separado → enviar → resposta visível ao autor. Publicar no roadmap exige resumo editorial e ação explícita; nunca expor reclamação bruta por mudança de status.
- **Roadmap:** criar/editar rascunho → prévia da versão pública → publicar. Mover para Lançado exige informação factual da entrega; andamento não deve prometer prazo.
- **UTM e métricas:** filtros por período/fonte, rótulos consistentes e estado sem dados. Controles de acesso limitam detalhes pessoais; não oferecer exportação ampla ou rastreadores adicionais sem escopo de dados.
- **Corte do Admin antigo:** primeiro inventariar funções e aprovar contingência; depois retirar navegação e desativar página/APIs antigas. A mensagem de rota indisponível não revela dados nem mantém endpoint acessível por trás de botão oculto.

**Arquivos atuais a aproveitar/analisar:** `src/components/features/admin/admin-workspace.tsx`, `admin.css`, `calendar-admin-runs.tsx`; `src/core/admin/index.ts`; `src/adapters/db/admin-runtime.ts`; `src/app/(workspace)/admin/page.tsx`; `src/app/api/admin/route.ts`; `src/app/api/calendar/admin-runs/route.ts`. A arquitetura física do novo host segue o plano técnico; a presença desses arquivos não autoriza copiá-los integralmente nem manter suas permissões sem revisão.

**Aceite:** host/shell distinguíveis; usuário comum recebe recusa no servidor; nenhuma UI abre conteúdo pessoal de cliente; feedback privado e roadmap público têm estados separados; alterações de acesso/respostas são auditáveis; confirmação e foco adequados; Admin antigo desativado após contingência verificada; nenhuma restrição depende só do front-end.

## 10. Sequência recomendada e risco visual

Prioridades e esforço total são regidos pelo doc 05. A tabela abaixo distingue o recorte visual das frentes completas; não reduz os gates de dados, integrações ou administração.

| Entrega | Prioridade / esforço relativo | Dependência | Principal risco |
|---|---|---|---|
| Marca, copy, retirada Princípios, legais | P1 / S | Plano validado; CTA aguarda cadastro | Prometer acesso/cobrança ainda inexistente |
| Header, tema imediato e overlays | P1 / M | Componentes compartilhados | Quebrar foco/fechamento ou apertar header mobile |
| Calendário lista única | P1 / M | Normalização de preferência/URL | Perder data/evento e confundir vazio/cache parcial |
| Captura rápida e editor simplificado | P1 / M–L | Contratos de rascunho/upload/comando | Perder seleção/rascunho ou duplicar escrita |
| Cadastro/trial/onboarding | P0 / L (F02) | Auth, política de acesso, e-mail/Google | Bloquear legados ou iniciar trial incorretamente |
| Lixeira com prazo e exclusão | P0 / L (F08; visual M) | Backend/job/carência | Remover legado antes da carência ou confundir arquivar |
| Configurações e cards Projetos | P2 / M | Componentes existentes | Remover ação funcional junto ao ruído |
| Escrita Google e ClickUp | P1 / L (F06), XL (F07) | Permissões/APIs/sincronização | Prometer operação que a conta não permite |
| Feedback/roadmap | P1 / L (F10) | Dados, autorização administrativa, operação e publicação | Expor feedback privado |
| Admin separado | P0 / XL (F11) | Sessão própria, contingência e corte | Manter canal antigo aberto ou perder suporte |

S/M/L são tamanhos relativos, não prazo prometido. Entregas visuais independentes podem avançar separadas de integrações, sempre com fixtures honestas e sem apresentar funcionalidade simulada como pronta.

## 11. Validação de implementação e polimento

Matriz mínima: 320, 390, 768 e 1440 px; claro/escuro; sidebar expandida/recolhida quando aplicável; mouse, teclado, zoom de 200%, movimento reduzido e teclado virtual. Capturas devem registrar rota, estado, tema, viewport e SHA.

1. **Navegação:** uma h1, skip link, foco após mudança de rota, links antigos normalizados, formulários sem alteração indevida ao voltar, nova ação de feedback em todos os acessos.
2. **Componentes:** foco visível nos fundos reais, alvos de 44 px, campos de 16 px, popovers fora de recortes de overflow, diálogos sem conteúdo inacessível e confirmação com retorno ao acionador.
3. **Conteúdo extremo:** título longo, projeto sem capa, nota vazia/extensa, nenhum/muitos eventos, todos calendários ocultos, elenco parcial, feedback longo e quadro vazio/cheio.
4. **Persistência visível:** sucesso somente após confirmação; estado pendente/incerto distingue de erro definitivo; salvar seção não apaga outro rascunho; retry respeita intenção existente.
5. **Permissão:** Calendar readonly/avulsoeditável/recorrência; ClickUp revogado; feedback cruzado; usuário comum no Admin; URL direta e API não podem contornar a UI.
6. **Privacidade:** dados sintéticos nas imagens, segredos ausentes de tela/log, UTM com campo ausente tratado, publicação editorial separada do feedback privado.
7. **Polish:** comparar capturas em lote, corrigir desalinhamento/corte/ruído/contraste e conferir o lote final. Registrar o que foi inspecionado e limites; não declarar certificação de acessibilidade só por screenshot.

## 12. Atualizações documentais junto à implementação

Atualizar `DESIGN.md`, briefs `.impeccable/surfaces/`, documentação de navegação e componentes que mudarem. Registros históricos permanecem históricos: substituir as afirmações vigentes de acesso fechado, calendário de 4 vistas e Admin no workspace sem apagar evidências anteriores.

Na entrega, separar **implementado**, **validado localmente**, **validado com provedores** e **pendente de operação**. Este planejamento e as imagens anexadas não autorizam iniciar execução antes da validação consolidada nem atestam qualquer nova funcionalidade em produção.


