# Segundo Cérebro

Plataforma pessoal de organização que reúne calendário, tarefas, hábitos, financeiro, Cofre e conhecimento. Uso pessoal e de pessoas próximas, com contas isoladas e sem cobrança no MVP. Este glossário define o vocabulário; os [ADRs](docs/adr/) registram decisões de arquitetura.

## Acesso e plano

**Usuário:** pessoa com conta e unidade de isolamento. Todo dado pessoal pertence a exatamente um Usuário, que não alcança dados de outro. Evitar: tenant, workspace e organização como unidade de isolamento.

**Plano Pessoal:** política implícita que concede as Funcionalidades do produto por padrão. Concessões e vetos individuais podem controlar beta ou disponibilidade; não há assinatura, cobrança ou tabela comercial de planos no MVP. É a conciliação D-019 do antigo conceito comercial de Plano.

**Funcionalidade:** capacidade do produto identificada por uma chave estável, cujo acesso pode ser resolvido independentemente. Evitar confundir com uma aba de navegação.

**Entitlement:** direito do Usuário a uma Funcionalidade, resolvido pelo Plano Pessoal e eventuais concessões/vetos. O Usuário não pode editá-lo. Deve ser verificado no servidor, inclusive em chamadas diretas.

**Preferência:** escolha editável do Usuário sobre visibilidade e ordem das Funcionalidades às quais já tem Entitlement. Esconder uma Funcionalidade não revoga o direito a ela.

**Módulo:** termo de organização de código ou navegação. Ao tratar regra de acesso, use especificamente Funcionalidade, Entitlement ou Preferência.

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

**Arquivo / Pasta:** documento armazenado no Drive e seu contêiner, respectivamente; possuem organização e ciclo de lixeira próprios.

## Vida diária e financeiro

**Hábito:** prática acompanhada segundo uma cadência.

**Marcação:** registro de cumprimento de um Hábito em um dia; existe somente no dia cumprido.

**Pausa:** suspensão de um Hábito ou do acompanhamento geral por um período, considerada no cálculo da sequência.

**Lançamento:** registro financeiro com valor em centavos e regras de competência, pagamento, estado e exclusão lógica do modelo fundido (D-006).

**Conta:** contexto financeiro de saldo e movimentações. Não usar este termo como substituto de Usuário nas regras de isolamento.

**Cartão:** modalidade de Conta com ciclo de fatura; uma compra estabelece dívida, sem representar saída imediata de caixa.

**Fatura:** leitura derivada dos Lançamentos de um Cartão para um ciclo; não é entidade persistida independente. Pode ter pagamento parcial.

**Cofre:** armazenamento de segredos cifrados no cliente. O servidor armazena conteúdo cifrado e não consegue lê-lo. Senha mestra e kit de recuperação permanecem sob controle do Usuário.

## Origem e decisões

Adaptado de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`, com D-019, as extensões do [doc 05 §4](docs/planejamento/05-arquitetura-de-produto.md) e a distinção entre demonstração e produção do [doc 14](docs/planejamento/14-prototipo-interacoes.md). Nenhum verbete atesta implementação ou validação de uma Funcionalidade.
