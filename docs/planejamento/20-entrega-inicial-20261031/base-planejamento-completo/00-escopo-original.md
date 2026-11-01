# Planejamento de execução --- Segundo Cérebro

## 1. Contexto do projeto

**Repositório:** `git@github.com:kauanbarateli/Segundo-Cerebro.git`\
**Pull Request do MVP:** `#120`\
**Branch principal:** `MAIN`

O PR #120 do MVP já foi mesclado na branch `MAIN`. A próxima etapa é
planejar e executar as melhorias funcionais, visuais e de integração
descritas neste documento.

## 2. Objetivo e forma de trabalho

Quero que você analise as pendências abaixo e estruture um plano de
execução completo, organizado por frentes de trabalho, dependências,
prioridades e critérios de aceite.

Antes de fechar o planejamento:

1.  Utilize as skills **`grill-me`** e **`grill-with-docs`** para
    conduzir um questionário interativo e esclarecer as lacunas,
    ambiguidades e decisões em aberto.
2.  Faça perguntas objetivas, preferencialmente em blocos pequenos e
    sequenciais. Não presuma decisões importantes que ainda não foram
    definidas.
3.  Consulte a documentação oficial das APIs e serviços envolvidos,
    especialmente ClickUp, Google Calendar, Google Cloud e autenticação
    social.
4.  Utilize a skill **`impeccable`** para orientar as melhorias de
    interface e experiência visual, mantendo consistência com a
    identidade do produto e com os protótipos fornecidos.
5.  Analise a estrutura atual do repositório antes de propor alterações.
    Identifique componentes, fluxos, serviços, banco de dados,
    integrações e limitações que possam afetar a implementação.

Ao final do questionário, entregue um plano dividido em etapas
executáveis. Para cada frente, detalhe:

- Objetivo e escopo;
- Diagnóstico da implementação atual;
- Solução proposta;
- Arquivos, componentes, serviços e estruturas de dados potencialmente
  envolvidos;
- Dependências e pré-requisitos;
- Alterações necessárias no banco de dados, APIs e variáveis de
  ambiente;
- Riscos, questões de segurança e compatibilidade;
- Testes necessários;
- Critérios objetivos de aceite;
- Prioridade e estimativa relativa de esforço.

Não comece a implementar antes de concluir as perguntas essenciais e
apresentar o planejamento consolidado para validação.

---

# 3. Pendências e requisitos

## 3.1. Identidade visual e elementos globais

- Adicionar ao site o favicon correspondente à logo oficial do Segundo
  Cérebro.
- Revisar a aplicação da identidade visual para manter consistência
  entre landing page, login e ambiente autenticado.

## 3.2. Google Cloud Console e publicação

- Elaborar um roteiro completo para publicação e configuração do
  projeto no Google Cloud Console.
- O roteiro deverá identificar os serviços necessários, configurações,
  credenciais, domínios autorizados, URLs de redirecionamento, telas
  de consentimento, permissões e variáveis de ambiente.
- Detalhar os passos necessários para disponibilizar as integrações do
  Google, incluindo autenticação social e calendário, conforme o
  escopo aprovado.
- Identificar quais configurações precisam ser realizadas manualmente
  no console e quais podem ser automatizadas.

- atualmente ele está em teste então aparece as informações de não seguro etc.., além de ter limites de contas.

## 3.3. Landing page

### 3.3.1. Protótipo e estrutura

- Remover integralmente a seção `id="principios"`, pois apresenta
  detalhes técnicos que não são relevantes para o visitante.

- Revisar a composição visual e a hierarquia das informações para
  comunicar com clareza o valor do produto.

### 3.3.2. Cabeçalho e tema

- Mover o seletor de tema que atualmente está no rodapé para o
  cabeçalho fixo da página.
- Utilizar o mesmo padrão visual e comportamento adotado na página de
  login.
- Retirar do rodapé o botão **"Configurações do aplicativo"**.

### 3.3.3. Acesso e autenticação

- Na seção `id="acesso"`, remover o botão **"Já tem uma conta?
  Entrar"**.
- Adicionar a opção de entrar no cabeçalho da landing page, seguindo o
  padrão visual definido para o site.
- Ao clicar em **"Quero acesso"**, direcionar o visitante para o fluxo
  de criação de conta e acesso gratuito.
- Após o preenchimento dos dados de cadastro, encaminhar a pessoa para
  o onboarding da plataforma.
- Avaliar a possibilidade de oferecer cadastro e autenticação por meio
  das contas Google e Apple. Verificar requisitos técnicos, custos,
  configuração e limitações de cada provedor.

### 3.3.4. Comunicação e proposta de valor

- Substituir a frase:

  > "As telas desta página são capturas do aplicativo em modo
  > demonstração, com dados fictícios."

  por uma mensagem curta que explique o objetivo do Segundo Cérebro e
  o benefício principal da plataforma.

- Revisar a comunicação da landing page para apresentar a experiência
  de assinatura, mesmo que o sistema de cobrança ainda não esteja
  disponível.

- Comunicar claramente que o usuário terá **7 dias gratuitos para
  testar a plataforma**, com acesso às funcionalidades incluídas na
  experiência de teste.

- Não apresentar como disponível nenhuma funcionalidade de cobrança ou
  assinatura que ainda não tenha sido implementada. A comunicação deve
  deixar claro o que é gratuito, o que está em teste e o que será
  disponibilizado futuramente.

### 3.3.5. Logo

- Reorganizar a apresentação da logo para seguir a estrutura visual
  utilizada na página de login.
- Exibir o nome em duas linhas, uma palavra abaixo da outra, com o
  ícone em tamanho ligeiramente menor.
- Preservar as proporções e a identidade da marca.

## 3.4. Página de login

- No card com a classe `auth-panel`, remover os links independentes
  **"Ler termos"** e **"Ler política"**.

- Vincular os endereços das páginas de Termos de Serviço e Política de
  Privacidade diretamente aos respectivos textos do checkbox:

  > "Li os Termos de Serviço e a Política de Privacidade."

- Remover a descrição:

  > "O cadastro é fechado. Para solicitar acesso, fale com quem
  > administra o Segundo Cérebro."

- Ajustar a tela para refletir o novo fluxo de cadastro aberto com
  período gratuito, conforme definido para a landing page.

## 3.5. Experiência geral do Segundo Cérebro

### 3.5.1. Captura rápida

- Transformar o botão **"Captura"**, atualmente fixado no cabeçalho,
  em uma ação rápida.
- Ao clicar, abrir um popup/modal de captura que permita anexar e
  registrar uma nova captura sem exigir navegação para outra página.
- Definir no planejamento os tipos de arquivo aceitos, limites,
  validações e comportamento após salvar.

### 3.5.2. Seletor rápido de tema

- Transformar o botão de tema do cabeçalho em uma ação imediata.
- O clique deverá alternar diretamente entre os temas claro e escuro.
- O ícone deverá mudar conforme o tema ativo.
- Não abrir um menu de seleção para essa ação.

### 3.5.3. Modais, popups e painéis laterais

- Revisar os popups e painéis de interação que atualmente aparecem
  como menus laterais à esquerda e ocupam praticamente toda a tela.
- Reduzir a ocupação visual, criando espaçamento adequado em relação
  às bordas laterais e superior.
- Preservar a usabilidade em telas menores e garantir comportamento
  responsivo.
- Aplicar o mesmo padrão visual aos diferentes fluxos de edição e
  configuração.

### 3.5.4. Edição da imagem inicial

- No popup de alteração da imagem inicial, remover o texto explicativo
  atual:

  > "Até 8 MiB e 24 milhões de pixels. A imagem é privada; os
  > metadados são removidos no processamento. A capa conserva
  > proporção própria."

- Manter somente a informação objetiva sobre o limite de tamanho:
  **"Limite de 8 MB."**

### 3.5.5. Lixeira e exclusão permanente

- Adicionar às tarefas na lixeira uma ação para **excluir
  permanentemente**.
- Exibir um aviso informando que os itens serão removidos
  automaticamente após 7 dias.
- Implementar efetivamente a exclusão automática após esse prazo,
  considerando a data em que cada item foi enviado à lixeira.
- Avaliar e definir o comportamento de recuperação de itens antes da
  exclusão definitiva.
- Adicionar também uma ação para excluir notas permanentemente.

### 3.5.6. Redução de textos técnicos e ruído visual

Remover mensagens técnicas ou redundantes que não agregam valor direto à
experiência do usuário, incluindo exemplos como:

- "Seus registros são salvos na sua conta."
- "Hoje: 31/10/2026. Tarefas salvas na sua conta."
- "As imagens são validadas e guardadas de forma privada na sua
  conta."
- "Escolha o fundo privado do destaque. A imagem acompanha sua conta,
  mesmo quando você oculta Tarefas."

Revisar outras mensagens semelhantes e manter somente orientações
realmente necessárias para executar uma ação ou compreender uma
funcionalidade.

## 3.6. Integração com ClickUp

Estudar a API oficial do ClickUp e planejar uma integração que permita
ao usuário visualizar e gerenciar suas tarefas diretamente no Segundo
Cérebro.

### 3.6.1. Conexão e credenciais

- Na aba de integrações, disponibilizar a conexão com o ClickUp.
- Avaliar o modelo de autenticação recomendado pela API, incluindo
  OAuth, quando aplicável, e a alternativa de token pessoal/API key
  por usuário.
- Caso seja necessário solicitar uma chave ao usuário, explicar como
  obtê-la e como será utilizada.
- Não armazenar credenciais em texto puro. Se houver necessidade de
  persistência, definir criptografia, controle de acesso,
  armazenamento seguro e processo de revogação.
- Avaliar se é possível evitar o armazenamento permanente da chave e
  quais seriam as consequências para a experiência de conexão.
- Permitir desconectar a integração e revogar ou eliminar as
  credenciais associadas.

### 3.6.2. Sincronização e seleção de tarefas

- Buscar somente tarefas em que o usuário conectado seja responsável
  (_assignee_).
- Exibir somente tarefas que ainda não estejam concluídas, respeitando
  os status definidos no ClickUp.
- Organizar as tarefas em uma visualização consistente com o restante
  do Segundo Cérebro.
- Preservar as informações relevantes de cada tarefa, como título,
  descrição, status, responsável, datas, prioridade, links e demais
  campos disponibilizados pela API.
- Investigar limites de requisição, paginação, webhooks, sincronização
  incremental e tratamento de falhas.

### 3.6.3. Subtarefas

- Buscar também as subtarefas relacionadas às tarefas principais,
  quando disponíveis e dentro do escopo de responsabilidade definido.
- Preservar a hierarquia entre tarefa principal e subtarefas.
- Apresentar visualmente as subtarefas como itens subordinados, sem
  confundi-las com tarefas independentes.
- Definir como tratar subtarefas concluídas, pendentes ou atribuídas a
  outras pessoas.

### 3.6.4. Detalhes e edição de tarefas

Ao abrir uma tarefa sincronizada, o usuário deverá conseguir, conforme
os recursos permitidos pela API:

- Consultar todas as informações relevantes da tarefa;
- Alterar o status utilizando os status disponíveis no ClickUp para
  aquela lista;
- Enviar comentários e mensagens;
- Editar a descrição;
- Consultar e preservar a relação com subtarefas.

As alterações feitas no Segundo Cérebro deverão ser refletidas no
ClickUp. O planejamento deverá especificar como tratar erros, conflitos
de edição, permissões insuficientes e divergências entre os dados locais
e remotos.

## 3.7. Navegação e funcionalidades

### 3.7.1. Remoção da área administrativa

- Remover a aba **"Admin"** da aplicação atual.
- A área administrativa será planejada e desenvolvida posteriormente
  em uma configuração separada.
- Antes da remoção, verificar dependências, rotas, permissões e
  funcionalidades que possam estar vinculadas a essa área.

### 3.7.2. Calendário: visualização

- Remover os botões e opções de visualização **"Dia"**, **"Semana"**,
  **"Mês"** e **"Lista"**.
- Manter diretamente a visualização em lista do calendário atual, sem
  controles para alternar entre esses formatos.
- Ajustar o layout para que a visualização remanescente fique completa
  e coerente sem os seletores.

### 3.7.3. Calendário: integração e permissões

- Ao conectar um calendário, permitir que o usuário escolha entre:
  - **Somente leitura:** consultar eventos, sem alterar ou criar
    eventos;
  - **Leitura e edição:** consultar, criar e editar eventos,
    respeitando as permissões concedidas.
- Estudar a API do Google Calendar para oferecer, quando tecnicamente
  possível, recursos equivalentes aos principais recursos de criação e
  edição de eventos do Google.

No modo de leitura e edição, avaliar:

- Criar eventos;
- Editar eventos existentes;
- Definir título, data, horário e duração;
- Adicionar participantes;
- Incluir descrição;
- Criar ou associar link do Google Meet;
- Consultar participantes e demais informações disponíveis;
- Tratar convites, atualizações, cancelamentos e permissões.

### 3.7.4. Informações dos eventos

- Validar se a integração permite apresentar os participantes, a
  indicação de reunião pelo Google Meet e a descrição dos eventos.
- Utilizar como referência o modelo visual do protótipo, especialmente
  a tela de calendário.

**Referência local informada:**

`file:///D:/USUÁRIOS/Kauan/TRABALHO/CÉREBRO - STARTUP (SEGUNDO CÉREBRO)/Protótipos/Protótipo - Codex/index.html#/calendario`

Esse endereço é local e pode não estar acessível ao agente. Caso o
arquivo não esteja disponível no ambiente de trabalho, solicitar o envio
do protótipo ou de capturas de tela da página de calendário.

## 3.8. Simplificação das páginas de notas e conhecimento

- Remover textos e indicadores redundantes, como:
  - "Nova nota";
  - "Nova nota · Caixa de entrada";
  - "Pronto para escrever";
  - "0 palavras · 0 conexões".
- Simplificar a experiência de criação e edição de notas, evitando
  excesso de informações e elementos visuais que não contribuam para a
  tarefa principal.

### 3.8.1. Editor de captura e conhecimento

- Simplificar a página de captura e conhecimento.
- Manter como elementos principais o **título** e o **corpo do
  conteúdo**.
- Agrupar as opções básicas de formatação em um botão que abra um menu
  de configurações do texto.
- Adicionar um ícone de configurações da nota para organizar
  informações estruturais, permitindo definir:
  - Tipo da nota;
  - Vínculo com projetos;
  - Vínculo com tarefas;
  - Outras associações disponíveis no produto.
- Manter a interface limpa por padrão, exibindo opções avançadas
  somente quando solicitadas.

## 3.9. Configurações

### 3.9.1. Remoção de cards

Remover da página de configurações o card **"Segundo Cérebro no seu
dispositivo"**, incluindo o conteúdo sobre instalação como aplicativo,
acesso pela tela inicial e funcionamento offline.

Remover também o card **"Meus dados"**, após verificar se há alguma
funcionalidade ou obrigação importante que precise ser realocada.

### 3.9.2. Redesenho da página

- Redesenhar a página de configurações utilizando a skill
  `impeccable`.
- Buscar uma composição mais equilibrada e harmoniosa, evitando uma
  página excessivamente vertical.
- Priorizar um layout com duas colunas de grupos de configurações,
  quando a largura da tela permitir.
- Em telas menores, reorganizar os grupos em uma única coluna.
- Remover informações, filtros e controles desnecessários.
- Melhorar hierarquia visual, espaçamento, agrupamento e legibilidade.
- Preservar acessibilidade, responsividade e consistência com os
  demais componentes da aplicação.

## 3.10. Ajuda, feedback e sugestões

### 3.10.1. Substituição da aba Ajuda

- Remover a aba **"Ajuda"** da navegação.
- Substituí-la por **"Enviar feedback"**.
- Criar uma tela ou formulário simples para que o usuário possa
  enviar:
  - Sugestões;
  - Reclamações;
  - Problemas encontrados;
  - Ideias de melhorias;
  - Outros comentários sobre o Segundo Cérebro.
- A visualização e administração desses pedidos ficarão para uma etapa
  futura. Nesta fase, definir como os dados serão registrados e
  armazenados.

### 3.10.2. Central de atualizações e roadmap

- Adicionar ao cabeçalho um novo acesso identificado por um símbolo de
  raio.
- Ao clicar, abrir uma página de atualizações e roadmap do Segundo
  Cérebro.
- Organizar o conteúdo em um quadro Kanban com as seguintes etapas:
  - Planejado;
  - Em análise;
  - Em andamento;
  - Em fase de testes;
  - Lançado.
- Permitir que o usuário acompanhe o andamento das melhorias e
  sugestões.
- Permitir o envio de novas sugestões a partir dessa experiência.
- Quando uma sugestão estiver associada a um usuário, permitir que ele
  acompanhe seu status e visualize o retorno sobre a solicitação.
- A gestão administrativa dessas sugestões, incluindo análise,
  movimentação entre colunas e resposta ao usuário, será implementada
  posteriormente na nova área administrativa.
- Planejar desde já a estrutura de dados e os relacionamentos
  necessários para suportar essa evolução, sem antecipar
  funcionalidades administrativas fora do escopo aprovado.

## 3.11. Página de projetos

- Revisar a apresentação dos cards da aba de projetos, pois o layout
  atual não está visualmente satisfatório.
- Utilizar o protótipo como referência para reorganizar os cards, sua
  hierarquia, espaçamento, informações e ações.
- Aplicar os princípios visuais da skill `impeccable`.
- Preservar as funcionalidades existentes, salvo quando houver uma
  decisão explícita de alteração durante o questionário.

---

# 4. Diretrizes de implementação

1.  **Preservar o que já funciona:** evitar alterações colaterais em
    funcionalidades que não fazem parte do escopo.
2.  **Analisar antes de alterar:** mapear a implementação atual e suas
    dependências antes de propor mudanças.
3.  **Segurança em primeiro lugar:** proteger tokens, credenciais, dados
    pessoais e permissões das integrações.
4.  **Documentar integrações:** utilizar documentação oficial e
    registrar escopos, limitações, configurações e variáveis de
    ambiente.
5.  **Manter consistência visual:** seguir o protótipo e aplicar os
    padrões definidos pela skill `impeccable`.
6.  **Priorizar experiência simples:** reduzir ruído visual, textos
    técnicos e ações desnecessárias.
7.  **Garantir responsividade e acessibilidade:** validar os fluxos em
    diferentes tamanhos de tela e formas de interação.
8.  **Testar os fluxos completos:** considerar não apenas a interface,
    mas também persistência, permissões, sincronização, erros e estados
    vazios.
9.  **Planejar entregas incrementais:** agrupar mudanças por dependência
    e risco, evitando concentrar integrações complexas e alterações
    visuais independentes em uma única entrega.
10. **Não presumir funcionalidades:** distinguir claramente o que já
    existe, o que será implementado nesta etapa e o que ficará para uma
    fase futura.

# 5. Entregáveis esperados do planejamento

Após concluir o questionário interativo, apresente:

1.  **Diagnóstico técnico:** situação atual do projeto e principais
    pontos de atenção.
2.  **Mapa de frentes:** agrupamento das pendências por domínio
    funcional e técnico.
3.  **Questionário respondido:** decisões tomadas e requisitos
    esclarecidos.
4.  **Plano de execução:** sequência recomendada, dependências,
    prioridades e entregas.
5.  **Plano de integrações:** ClickUp, Google Calendar, autenticação
    Google/Apple e Google Cloud Console.
6.  **Plano de dados e segurança:** alterações de banco, credenciais,
    permissões, retenção e exclusão.
7.  **Plano visual:** páginas e componentes a redesenhar, referências e
    critérios de consistência.
8.  **Plano de testes:** cenários, resultados esperados e critérios de
    aceite.
9.  **Riscos e pontos pendentes:** decisões que ainda dependam de
    validação ou de acesso a materiais externos.
10. **Divisão em etapas:** proposta de implementação incremental, com
    entregáveis verificáveis por etapa.

**Importante:** nesta fase, o objetivo é esclarecer requisitos e
produzir um planejamento técnico e funcional confiável. A implementação
deverá começar somente após a validação do plano.
