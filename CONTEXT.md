# Segundo Cérebro

**Planejamento consolidado — 26/10/2026:** o [doc18](docs/planejamento/18-convergencia-prototipo-20261025/README.md) é a entrada atual para investigação e execução futura; confirma a referência visual do doc17 e separa correções, aceites e escopos adiados. D-080–083 registram a hierarquia visual e escolhas de Projeto, Hoje e Cofre. A autorização atual é somente documental/issues.

**Pausa de execução — 25/10/2026:** leia o [handoff publicado da PR #120](docs/implementation/handoff-retomada-20261025-pausa-mvp.md) e seus pacotes antes de retomar. Implementação, merge e produção permanecem parados até nova solicitação do mantenedor; restore foi transferido para pós-lançamento.

Plataforma pessoal de organização que reúne calendário, tarefas, hábitos, financeiro, Cofre e conhecimento, com dados isolados por pessoa. O MVP planejado também inclui contratação por assinatura e configuração inicial facultativa. Este glossário define o vocabulário; os [ADRs](docs/adr/) registram decisões de arquitetura.

## Acesso e plano

**Usuário:** pessoa com conta e unidade de isolamento. Todo dado pessoal pertence a exatamente um Usuário, que não alcança dados de outro. Evitar: tenant, workspace e organização como unidade de isolamento.

**Plano Pessoal:** política implícita de concessão das Funcionalidades, com concessões e vetos individuais para beta ou disponibilidade. É distinto de uma Assinatura comercial.

**Isenção comercial:** dispensa explícita da exigência de pagamento de Assinatura, preservada para as contas atuais ou concedida pelo Master. Não elimina vetos de Funcionalidade ou bloqueios administrativos.

**Funcionalidade:** capacidade do produto identificada por uma chave estável, cujo acesso pode ser resolvido independentemente. Evitar confundir com uma aba de navegação.

**Entitlement:** direito do Usuário a uma Funcionalidade, distinto de sua preferência de exibição e do estado de autenticação. O próprio Usuário não pode concedê-lo ou revogá-lo; deve ser verificado no servidor, inclusive em chamadas diretas.

**Preferência:** escolha editável do Usuário sobre visibilidade e ordem das Funcionalidades às quais já tem Entitlement. Esconder uma Funcionalidade não revoga o direito a ela.

**Módulo:** termo de organização de código ou navegação. Ao tratar regra de acesso, use especificamente Funcionalidade, Entitlement ou Preferência.

## Contratação e entrada

**Checkout:** jornada de contratação que reúne os dados do Pagador, a escolha do método e o acompanhamento do primeiro pagamento. Pode existir antes do cadastro de um Usuário.

**Pagador:** pessoa física ou jurídica responsável pelo pagamento de uma Cobrança. Informar o e-mail de alguém no pagamento não comprova a titularidade de seu cadastro de acesso.

**Assinatura:** contratação recorrente do Segundo Cérebro que origina Cobranças mensais. É distinta do Plano Pessoal e do cadastro de um Usuário.

**Cobrança:** solicitação de pagamento de um ciclo da Assinatura, com valor, vencimento, método e situação próprios. Evitar confundir com a Fatura de um Cartão do módulo Financeiro.

**Inadimplência:** situação de uma Cobrança vencida sem pagamento reconhecido. Uma Cobrança futura ainda não vencida não caracteriza inadimplência.

**Período de tolerância:** cinco dias corridos completos após o vencimento, no fuso `America/Sao_Paulo`, durante os quais a inadimplência ainda não provoca a suspensão comercial. Vencimento dia 10 permite acesso até o fim do dia 15; sem pagamento reconhecido, a suspensão começa às 00h do dia 16. É distinto de um período de teste grátis.

**Suspensão comercial:** restrição de leitura e escrita nos módulos motivada pela situação da contratação, sem apagar seus dados. Preserva login, regularização, segurança da conta, cancelamento e solicitações sobre os próprios dados, incluindo acesso à gestão da Assinatura em Configurações. É distinta do bloqueio administrativo da identidade.

**Cancelamento da Assinatura:** encerramento das próximas renovações. No cancelamento comum, o acesso já pago permanece até o fim do período correspondente; não significa apagar identidade/dados nem conceder perdão de dívida. É distinto de arrependimento, reembolso ou chargeback.

**Onboarding:** configuração inicial facultativa, apresentada em nove telas, para preparar nome, agenda e primeiros registros escolhidos pelo Usuário. Pular ou pausar não significa apagar seus registros ou desconectar integrações.

**Foco pessoal:** informação facultativa do perfil sobre Trabalho, Estudos, Vida pessoal ou Um pouco de tudo, escolhida no onboarding e editável em Configurações. Não é Entitlement nem altera automaticamente a navegação ou a organização dos registros.

**Atribuição de origem:** registro dos parâmetros de campanha associados à chegada e à contratação. É distinto dos dados necessários ao pagamento.

**Primeiro toque:** origem da primeira chegada registrada dentro da janela de atribuição. Não é substituída por uma campanha posterior nessa janela.

**Último toque:** origem da campanha válida mais recente antes da contratação. É distinta da origem de navegação interna entre as telas do checkout.

## Arquitetura de acesso

**Núcleo:** regras e contratos do produto, independentes do Canal, de HTTP, React, Next.js e Supabase.

**Canal:** porta de entrada de uma ação no Núcleo. O aplicativo web é um Canal; uma Plataforma externa poderá ser outro.

**Plataforma externa:** sistema que age em nome de um Usuário pela API autenticada do produto, sem credenciais nem acesso direto ao banco. A API e esse Canal pertencem ao roadmap.

**Evento de domínio:** registro de uma escrita de domínio, com dono, instante, Canal e estados anterior/posterior permitidos, persistido atomicamente com a alteração. Eventos do Cofre contêm somente metadados de uma lista permitida; nunca segredo, conteúdo cifrado, senha mestra ou material de chave. O Admin acessa agregados de uso sem conteúdo pessoal.

**Evento de calendário:** espelho de um compromisso do Google Calendar, inicialmente somente para leitura. É distinto de Evento de domínio.

## Organização e conhecimento

**Captura:** anotação feita antes de decidir sua organização ou destino. A **Caixa de entrada** é a fila de Capturas; uma integração futura de e-mail se chamará Gmail.

**Tarefa:** compromisso de execução com estado; é a unidade que pode ser marcada como feita.

**Nota / Página:** unidade de conhecimento em blocos organizada em um Caderno. No protótipo DS 2.1, uma nota local pode estar na Caixa de entrada ou em Conhecimento: organizar muda seu destino e conserva identidade e conexões. Esse comportamento demonstrado não substitui o modelo persistente e o editor previstos nos tickets.

**Caderno:** contêiner de Páginas de conhecimento.

**Vínculo:** ligação explícita entre registros, por exemplo uma Tarefa e um Evento de calendário. Wiki-links são referências entre Páginas; backlinks apresentam suas origens. Referências precisam preservar identidade ao renomear itens.

**Grafo:** leitura visual de Vínculos e wiki-links. A demonstração local possui grafo simulado; o grafo visual persistente entra na fase 2, e o global de produção, na fase 3.

**Projeto:** contexto agregador que marca contêineres e reúne itens relacionados. Excluir o Projeto não exclui os itens vinculados.

**Contexto do Projeto:** classificação facultativa Pessoal, Trabalho ou Estudos, planejada para o próprio Projeto, consultável e editável depois. É distinta do Foco pessoal e de categorias de Tarefa; não altera vínculos automaticamente nem autoriza classificar registros antigos por inferência.

**Arquivo / Pasta:** termos históricos do módulo Drive e de sua organização. A entrega dessa aba foi retirada do MVP em 12/10/2026 ([D-032](docs/planejamento/registro-de-decisoes.md#retirada-da-entrega-drive--12102026)); a nova lógica ainda não está definida. Isso não exclui registros existentes nem a infraestrutura de imagens de Capturar e Avatar.

## Vida diária e financeiro

**Hábito:** prática acompanhada segundo uma cadência.

**Cadência vigente:** frequência de um Hábito aplicável a um período. Alterá-la inicia uma nova vigência; não redefine o que era esperado antes da alteração.

**Marcação:** registro de cumprimento de um Hábito em um dia; existe somente no dia cumprido.

**Pausa:** suspensão de um Hábito ou do acompanhamento geral por um período, considerada no cálculo da sequência.

**Lançamento:** registro financeiro com valor em centavos e regras de competência, pagamento, estado e exclusão lógica do modelo fundido (D-006).

**Série financeira:** conjunto finito de Lançamentos com identidade de grupo. A extensão de T-053 acrescenta definição e mapa explícitos, sem converter grupos legados por inferência. É distinta da Assinatura comercial do aplicativo.

**Ocorrência da Série:** posição identificada da Série financeira, ligada a um Lançamento real. Pausa, exclusão manual e encerramento têm motivos separados; retomar não recria identidades ou pagamentos.

**Parcelamento:** divisão de um total original por um número finito de posições, conservando o resto na última. A primeira posição registrada não comprova pagamento das anteriores.

**Recorrência financeira:** repetição finita de valores segundo uma frequência. Novas ocorrências são preparadas por ação explícita, com horizonte limitado; não existe geração infinita automática nem vínculo com a cobrança Asaas.

**Conta:** contexto financeiro de saldo e movimentações. Não usar este termo como substituto de Usuário nas regras de isolamento.

**Cartão:** modalidade de Conta com ciclo de fatura; uma compra estabelece dívida, sem representar saída imediata de caixa.

**Fatura:** leitura derivada dos Lançamentos de um Cartão para um ciclo; não é entidade persistida independente. Pode ter pagamento parcial.

**Meta financeira:** conquista para a qual o Usuário estabelece um valor desejado e, opcionalmente, um prazo e uma imagem. Seu progresso representa as Reservas destinadas a ela.

**Reserva para meta:** parcela do dinheiro de uma Conta separada virtualmente para uma Meta financeira. Continua na Conta e no patrimônio, reduzindo o disponível para uso; não é despesa, receita ou transferência.

**Aporte à meta:** ação de acrescentar uma Reserva para meta a partir de uma Conta. Não movimenta dinheiro para fora dela e é distinto do pagamento de uma Fatura.

**Disponível para uso:** parcela do saldo da Conta que ainda não está reservada. Quando uma tela também desconta faturas, esse recorte adicional precisa estar identificado.

**Cofre:** armazenamento de segredos cifrados no cliente. O servidor armazena conteúdo cifrado e não consegue lê-lo. Senha mestra e kit de recuperação permanecem sob controle do Usuário.

## Origem e decisões

Adaptado de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`, com D-019, as extensões do [doc 05 §4](docs/planejamento/05-arquitetura-de-produto.md) e a distinção entre demonstração e produção do [doc 14](docs/planejamento/14-prototipo-interacoes.md). Nenhum verbete atesta implementação ou validação de uma Funcionalidade.
