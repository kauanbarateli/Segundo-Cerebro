/** Public reading copy. No secrets or private supplier documents belong here. */
export type LegalSection = { id: string; title: string; paragraphs: readonly string[]; items?: readonly string[]; links?: readonly { href: string; label: string }[] };
export type LegalDocument = { slug: string; title: string; summary: string; version: string; updatedAt: string; notice?: string; sections: readonly LegalSection[] };

export const LEGAL_SUPPORT_EMAIL = "suporte@segundocerebroapp.com.br";

export const LEGAL_DOCUMENTS = {
  "privacidade": {
    "slug": "privacidade",
    "title": "Política de privacidade",
    "summary": "Como usamos e protegemos suas informações, quais escolhas você tem e como exercer seus direitos.",
    "version": "0.1 · revisão",
    "updatedAt": "2026-10-18",
    "notice": "Versão em revisão. Ainda estamos completando a identificação complementar do responsável e as informações operacionais de retenção e processamento internacional. A contratação por assinatura não está aberta.",
    "sections": [
      {
        "id": "responsavel",
        "title": "Quem é responsável",
        "paragraphs": [
          "O Segundo Cérebro é um aplicativo de organização pessoal. Kauan Sousa Barateli, pessoa física, é o responsável pelo serviço e pelas decisões sobre o tratamento de dados pessoais descrito nesta política. O endereço público é segundocerebroapp.com.br.",
          "O canal para suporte e solicitações sobre dados é suporte@segundocerebroapp.com.br. Você pode pedir esclarecimentos sem enviar senha, documento completo, token ou conteúdo do Cofre. A identificação complementar do responsável integra a revisão indicada no início desta página."
        ]
      },
      {
        "id": "dados",
        "title": "Quais dados podem ser tratados",
        "paragraphs": [
          "Conforme as funções que você usa, tratamos dados de cadastro e autenticação, nome e preferências, conteúdo que você registra nos módulos, imagens que envia em funções disponíveis, vínculos entre seus registros e dados técnicos necessários à operação e à segurança. Conteúdos podem incluir tarefas, hábitos, projetos, notas, capturas, lançamentos e informações financeiras inseridas por você.",
          "A integração facultativa com Google Calendar acrescenta os dados descritos na seção Google Calendar. O Cofre tem o tratamento específico da seção Cofre. Mensagens enviadas ao suporte podem conter seu e-mail, descrição da solicitação e dados mínimos para resolvê-la; evite encaminhar senhas, tokens, documentos ou conteúdo de terceiros sem necessidade."
        ]
      },
      {
        "id": "finalidades",
        "title": "Por que usamos dados e com que fundamento",
        "paragraphs": [
          "Usamos os dados necessários para criar e proteger a conta, apresentar os registros e executar as funções e integrações que você solicita. Essas operações se relacionam à prestação do serviço e aos procedimentos pedidos por você. Também tratamos dados mínimos para responder a solicitações, cumprir obrigações legais aplicáveis e exercer direitos.",
          "Cada operação precisa de finalidade e fundamento próprios. A prevenção de abuso e a segurança são limitadas ao necessário e devem observar a hipótese legal aplicável; dados sensíveis recebem avaliação específica. Aceitar os termos ou ler esta política não significa consentir com qualquer uso dos seus dados.",
          "Quando uma atividade depender de consentimento, haverá uma escolha específica, informada e separada. O planejamento de atribuição de campanhas não autoriza rastreamento antecipado ou uso de publicidade como condição para contratar."
        ]
      },
      {
        "id": "conteudo-pessoal",
        "title": "Conteúdos pessoais, sensíveis e de terceiros",
        "paragraphs": [
          "Notas, imagens, hábitos e compromissos podem revelar informações pessoais sensíveis ou de terceiros. O produto não exige dados de saúde, religião ou outros dados sensíveis para prestar aconselhamento clínico ou profissional. Evite inserir conteúdo excessivo ou de terceiros sem fundamento adequado, inclusive dados de crianças e adolescentes.",
          "Essa orientação não transfere a você os deveres legais de quem oferece o serviço. O alcance e as salvaguardas do tratamento de dados sensíveis fazem parte da revisão antes de ampliar finalidades. Nunca envie ao suporte a senha mestra, o kit de recuperação ou credenciais de outras contas."
        ]
      },
      {
        "id": "google-calendar",
        "title": "Conexão com o Google Calendar",
        "paragraphs": [
          "Você escolhe conectar até duas contas Google. A autorização solicita identidade/e-mail, leitura da lista de calendários e leitura de eventos; a integração não cria, altera ou exclui eventos no Google. Os dados lidos e sincronizados incluem identificadores, nomes de calendários, títulos de eventos, datas e horários, localização, links e lembretes, na medida necessária à exibição da agenda e aos vínculos escolhidos por você.",
          "Credenciais de autorização são guardadas cifradas no servidor para permitir sincronizações autorizadas. Você pode pedir a desconexão no aplicativo e revogar o acesso nas permissões da sua Conta Google. Revogar a autorização impede novos acessos, mas não deve ser confundido com eliminação instantânea de toda cópia já sincronizada; pedidos de exclusão precisam ser atendidos conforme o procedimento e as retenções aplicáveis.",
          "O uso e a transferência de informações recebidas das APIs Google observam a Google API Services User Data Policy, incluindo seus requisitos de Limited Use. Os dados se destinam às funções de agenda solicitadas: não são vendidos, usados para anúncios personalizados, perfil de crédito ou treinamento de modelos gerais de IA. Acesso humano deve se limitar às hipóteses permitidas pela política, como autorização afirmativa específica, segurança ou obrigação legal. Conectar Calendar não autoriza acesso a Gmail ou Drive."
        ],
        "links": [
          {
            "label": "permissões da sua Conta Google",
            "href": "https://myaccount.google.com/connections"
          },
          {
            "label": "Google API Services User Data Policy",
            "href": "https://developers.google.com/terms/api-services-user-data-policy"
          }
        ]
      },
      {
        "id": "cofre",
        "title": "Proteção específica do Cofre",
        "paragraphs": [
          "O conteúdo dos itens do Cofre é cifrado no seu dispositivo antes de ser enviado para armazenamento. O servidor recebe conteúdo cifrado e metadados de funcionamento. A senha mestra e o kit de recuperação ficam sob seu controle; não devem ser enviados ao suporte.",
          "Esse mecanismo é específico do Cofre. Não significa que notas, tarefas, calendário e todos os demais dados tenham a mesma proteção de conteúdo no cliente, nem elimina riscos no dispositivo, no navegador ou na custódia do kit. O suporte não dispõe da sua senha mestra para recuperar conteúdo sem os meios previstos no Cofre."
        ]
      },
      {
        "id": "cookies",
        "title": "Cookies e armazenamento no dispositivo",
        "paragraphs": [
          "O aplicativo utiliza cookies de sessão e segurança para login, recuperação de acesso e retorno de autorização Google. Há também preferências e informações de recuperação de trabalho guardadas no seu navegador. São recursos distintos de cookies de publicidade. Bloquear os recursos necessários pode impedir a operação solicitada.",
          "Cookies de login seguem a configuração do provedor de autenticação, com limite técnico de persistência de até 400 dias, sujeito a expiração antecipada e verificação de sessão no servidor. Esse limite não garante acesso por esse período. Os controles próprios de recuperação têm prazos de uma hora, dez ou quinze minutos conforme a etapa; o retorno de autorização Google usa dez minutos. São removidos ou substituídos nos respectivos fluxos.",
          "Tema e estado da navegação podem permanecer no dispositivo até alteração ou limpeza. Rascunhos de Capturar e envios pendentes também podem guardar conteúdo pessoal localmente, sem um prazo automático e sem cifragem própria desse armazenamento. A confirmação do envio e a saída da conta acionam as limpezas previstas, sujeitas ao funcionamento do navegador. Use cuidado em dispositivos compartilhados; limpar dados do site pode apagar trabalho ainda não sincronizado.",
          "O modo de demonstração usa dados e preferências locais de exemplo. A instalação guarda recursos públicos para a tela offline e a interface; o cache previsto não inclui páginas pessoais ou respostas de API. As chaves de sessão abertas do Cofre ficam em memória, com as proteções de bloqueio próprias do módulo.",
          "A atribuição comercial de origem ainda não está ativa por esta entrega. Quando disponibilizada, os cinco parâmetros de campanha e o domínio de origem dependerão de escolha facultativa, com opção de recusar e retirar o consentimento sem impedir a compra. Não usaremos outro armazenamento para contornar essa escolha."
        ]
      },
      {
        "id": "compartilhamento",
        "title": "Quem pode receber dados",
        "paragraphs": [
          "A operação atual utiliza Vercel para hospedagem e Supabase para autenticação, banco de dados e armazenamento. Google participa quando você conecta Calendar. A caixa de suporte usa o provedor de e-mail configurado para o domínio. Resend foi escolhido para os futuros e-mails automáticos, mas sua ativação e o envio pelo aplicativo ainda não foram realizados nesta entrega. Monitoramento pode envolver prestadores específicos conforme a configuração ativada, a conferir no inventário de tratamento.",
          "O acesso de prestadores deve ficar limitado às finalidades informadas, aos contratos e às obrigações aplicáveis. Informações podem ser fornecidas a autoridades diante de uma exigência legítima, nos limites da lei. Não há licença para venda de suas notas ou de dados de agenda.",
          "Uma futura contratação pelo Asaas terá informação específica antes de enviar dados de pagador. A menção ao projeto de cobrança não significa que o checkout ou a coleta financeira estejam disponíveis agora."
        ]
      },
      {
        "id": "transferencias",
        "title": "Processamento fora do Brasil",
        "paragraphs": [
          "Serviços de nuvem, integrações e seus subprocessadores podem envolver tratamento no exterior. Os países efetivos, destinatários, duração, finalidade e mecanismos aplicáveis precisam ser conferidos nos contratos e na configuração de cada fornecedor e informados de forma acessível. Não afirmamos nesta minuta que todos os dados ficam no Brasil nem que um mecanismo contratual já foi adotado sem conferência.",
          "O responsável deve fornecer informação sobre os fluxos efetivos e os instrumentos aplicáveis, mediante solicitação e observadas as regras de transparência. Uma autorização genérica de navegação não substitui o mecanismo exigido para uma transferência internacional."
        ]
      },
      {
        "id": "retencao",
        "title": "Por quanto tempo os dados ficam guardados",
        "paragraphs": [
          "Os dados são mantidos pelo período necessário às finalidades informadas e às obrigações aplicáveis. Pedido de encerrar acesso, exclusão de um registro e eliminação de todas as cópias de segurança são operações diferentes. Dados cuja conservação seja legalmente necessária recebem tratamento restrito e justificado.",
          "Você pode pedir informação sobre os prazos aplicáveis à sua situação e solicitar correção ou eliminação pelo canal de contato. Eventual necessidade de conservar uma categoria de dados deve ser explicada com sua finalidade e fundamento. A política operacional de retenção, incluindo identidade, segurança e backups, está entre as informações em revisão desta versão.",
          "As regras comerciais planejadas não criam uma rotina de exclusão já disponível nem autorizam apagar contas gratuitas ativas. Prazos específicos da futura assinatura serão informados antes da contratação. Recuperar uma cópia de segurança não deve desfazer indevidamente uma solicitação de exclusão ou retirada de consentimento."
        ]
      },
      {
        "id": "direitos",
        "title": "Seus direitos e como solicitar",
        "paragraphs": [
          "Você pode solicitar confirmação e acesso; correção; informações sobre compartilhamento; anonimização, bloqueio ou eliminação de dados excessivos, desnecessários ou tratados irregularmente; portabilidade nos termos aplicáveis; e eliminação de dados tratados com consentimento, ressalvadas as hipóteses legais de conservação.",
          "Também pode obter informação sobre a possibilidade de negar consentimento e suas consequências, retirar o consentimento e solicitar revisão de decisão exclusivamente automatizada que afete seus interesses, quando aplicável.",
          "Envie a solicitação para suporte@segundocerebroapp.com.br. O atendimento desses direitos é gratuito. Podemos confirmar sua identidade de forma proporcional para evitar entregar informações à pessoa errada, sem pedir sua senha ou exigir dados excessivos. A ausência de um botão automático não impede seu pedido.",
          "Confirmação e acesso seguem as formas e os prazos previstos na LGPD: resposta simplificada imediata ou declaração completa em até quinze dias, observadas as regras aplicáveis. As demais solicitações têm seu tratamento próprio; um impedimento legítimo deve ser explicado. Você também pode recorrer à ANPD e aos órgãos de defesa do consumidor."
        ]
      },
      {
        "id": "seguranca",
        "title": "Segurança e incidentes",
        "paragraphs": [
          "O aplicativo adota controles de acesso e separação de dados por usuário, além das proteções específicas do Cofre e das credenciais de integração. Nenhuma medida elimina todos os riscos. Informações sobre vulnerabilidades ou acesso indevido devem ser encaminhadas pelo canal de contato sem incluir segredos.",
          "Incidentes precisam ser avaliados e tratados; quando puderem causar risco ou dano relevante, deverão ser comunicados à ANPD e às pessoas afetadas conforme as regras e prazos aplicáveis. Esta política não afirma certificação, invulnerabilidade ou que todo erro operacional representa um vazamento."
        ]
      },
      {
        "id": "publico",
        "title": "Público adulto e dados de menores",
        "paragraphs": [
          "O público inicial do Segundo Cérebro é de pessoas com 18 anos ou mais. O serviço não está oferecendo cadastro voltado a crianças ou adolescentes. Se houver informação de uso incompatível com esse público ou de dados de menores inseridos indevidamente, procure o contato de suporte para análise e providências proporcionais.",
          "O direcionamento 18+ não dispensa a análise do acesso provável por menores nem das proteções que sejam legalmente exigíveis. O uso de recursos de estudo por adultos não autoriza presumir consentimento de responsáveis ou ampliar silenciosamente o público do produto."
        ]
      },
      {
        "id": "atualizacoes",
        "title": "Alterações e consulta",
        "paragraphs": [
          "Esta página identifica a versão e pode ser consultada sem login, inclusive a partir das Configurações. Alterações relevantes serão informadas de forma adequada. Uma nova finalidade que dependa de consentimento exige informação e escolha próprias antes de começar; mudar o texto não produz autorização retroativa.",
          "As referências abaixo permitem consultar a legislação e as orientações usadas na elaboração. A indicação dessas fontes não representa certificação ou aprovação por um órgão público."
        ],
        "links": [
          {
            "label": "Lei Geral de Proteção de Dados Pessoais — LGPD",
            "href": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
          },
          {
            "label": "ANPD — orientações sobre cookies e proteção de dados",
            "href": "https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf"
          }
        ]
      }
    ]
  },
  "termos": {
    "slug": "termos-de-servico",
    "title": "Termos de serviço",
    "summary": "As condições de uso do Segundo Cérebro, os cuidados com sua conta e os direitos que permanecem garantidos.",
    "version": "0.1 · revisão",
    "updatedAt": "2026-10-18",
    "notice": "Versão em revisão. As informações complementares do fornecedor e da operação serão concluídas antes da abertura comercial. Esta página não abre uma assinatura ou autoriza cobrança.",
    "sections": [
      {
        "id": "servico",
        "title": "Serviço e responsável",
        "paragraphs": [
          "O Segundo Cérebro reúne funções de organização pessoal conforme a disponibilidade da conta: calendário, tarefas, hábitos, projetos, conhecimento, capturas, financeiro e Cofre. O responsável é Kauan Sousa Barateli, pessoa física; o domínio público é segundocerebroapp.com.br e o contato é suporte@segundocerebroapp.com.br.",
          "Estes termos descrevem o uso do aplicativo e devem ser lidos junto da Política de Privacidade. As telas demonstrativas não contêm dados reais de usuários e não comprovam recursos ainda planejados. A aba Drive não integra a entrega atual. A identificação complementar e as informações da futura oferta comercial passam pela revisão indicada nesta página."
        ]
      },
      {
        "id": "conta",
        "title": "Quem pode usar e como cuidar da conta",
        "paragraphs": [
          "O público inicial é de pessoas com 18 anos ou mais. Use dados de cadastro corretos e somente contas e integrações que você esteja autorizado a acessar. Preserve suas credenciais e informe suspeitas de acesso indevido. Não compartilhe senha, link de recuperação ou kit do Cofre com o suporte ou com terceiros.",
          "A permissão de uma função e a preferência por mostrá-la na interface são coisas distintas. A disponibilidade pode depender da concessão válida para sua conta; ocultar uma função não altera a autorização. Não é permitido tentar contornar autenticação, isolamento ou controles de acesso."
        ]
      },
      {
        "id": "uso",
        "title": "Uso permitido e conteúdo",
        "paragraphs": [
          "Você pode registrar e organizar informações pessoais às quais tenha acesso legítimo. Não use o serviço para fraude, violação de direitos, divulgação não autorizada de dados, conteúdo ilícito ou ataques à infraestrutura. Evite dados excessivos, sensíveis ou de terceiros sem fundamento adequado.",
          "Essas regras não transferem ao usuário a responsabilidade por falhas do serviço ou pelas obrigações legais do fornecedor. Medidas sobre uma conta precisam ser proporcionais e fundadas; sempre que possível e compatível com segurança e lei, a pessoa deve receber informação sobre o motivo e meios de contato para revisão."
        ]
      },
      {
        "id": "seus-registros",
        "title": "Seus registros e propriedade intelectual",
        "paragraphs": [
          "Você conserva os direitos sobre o conteúdo que registra. O funcionamento do produto exige autorização limitada para armazenar, organizar, processar e apresentar esse conteúdo em seu benefício e conforme as finalidades informadas. Isso não concede licença irrestrita para explorar publicamente suas notas, vender seus dados ou usar o conteúdo para qualquer propósito.",
          "A marca, o código e a apresentação do produto têm direitos próprios e licenças aplicáveis. O uso da conta não transfere a propriedade desses elementos. Vínculos internos e organização dos registros não tornam seu conteúdo público nem autorizam compartilhamento entre usuários que não esteja disponível e consentido."
        ]
      },
      {
        "id": "integracoes",
        "title": "Agenda Google e serviços externos",
        "paragraphs": [
          "Conectar a agenda é facultativo e usa as permissões explicadas na Política de Privacidade. A integração é de leitura, com até duas contas Google; não cria ou altera compromissos no Google. Você pode desconectar ou revogar o acesso; falhas, limites ou mudanças do provedor podem exigir nova autorização ou impedir atualização temporariamente.",
          "A participação de um fornecedor externo não elimina as responsabilidades legais do Segundo Cérebro. O aplicativo não precisa da sua senha Google; a autorização ocorre na interface do próprio provedor. Outros serviços podem ter termos próprios, que não substituem seus direitos perante quem presta este serviço."
        ]
      },
      {
        "id": "financeiro-e-cofre",
        "title": "Limites do financeiro e do Cofre",
        "paragraphs": [
          "O módulo Financeiro organiza os registros que você informa; não é conta bancária, serviço de pagamento, consultoria de investimentos ou garantia de resultado. Verifique informações relevantes antes de agir. As demais funções de organização também não substituem orientação médica, psicológica, contábil ou jurídica.",
          "No Cofre, a senha mestra e o kit de recuperação ficam sob seu controle. Sem os meios de recuperação previstos, a perda desses elementos pode impedir o acesso ao conteúdo cifrado. Essa característica precisa ser compreendida antes de guardar dados importantes e não exonera o fornecedor por seus próprios deveres de segurança ou defeitos do serviço."
        ]
      },
      {
        "id": "assinaturas",
        "title": "Contratação por assinatura: entrega futura",
        "paragraphs": [
          "A contratação automática pelo aplicativo ainda está em planejamento. A presença desta página não abre checkout, não gera assinatura nem autoriza cobrança. As condições de contas existentes continuam sujeitas às concessões válidas já conferidas, sem converter automaticamente cadastro atual em assinatura paga.",
          "Antes de uma futura compra, deverão ser apresentados preço, recorrência, métodos, momento de ativação, vencimentos, tolerância, suspensão, formas de regularizar e cancelar, fornecedor completo e contrato que possa ser guardado. As regras operacionais planejadas não podem ser usadas para cobrar ou restringir automaticamente pessoas antes de sua implementação, validação e oferta adequada."
        ]
      },
      {
        "id": "cancelamento",
        "title": "Cancelamento, arrependimento e restituições",
        "paragraphs": [
          "Encerrar próximas renovações, exercer o direito de arrependimento e pedir restituição por defeito ou cobrança indevida são situações diferentes. O uso do aplicativo não importa renúncia a direitos legais.",
          "Na futura contratação eletrônica, serão assegurados os meios previstos no Código de Defesa do Consumidor e na regulamentação aplicável. Quando cabível o direito de arrependimento, ele poderá ser exercido em sete dias nos termos do art. 49 do CDC, com restituição dos valores devidos. Uma política de cancelamento comum não substitui esse direito.",
          "O planejamento prevê que o cancelamento comum interrompa futuras renovações e preserve o período pago. Essa regra não é um fluxo de cobrança já implantado e não limita restituições legalmente devidas. Pedidos sobre esses direitos podem ser encaminhados ao canal de contato; na abertura comercial, a própria ferramenta de contratação deverá oferecer os meios exigidos."
        ]
      },
      {
        "id": "dados-e-encerramento",
        "title": "Dados, encerramento e preservação",
        "paragraphs": [
          "O tratamento dos seus dados é descrito na Política de Privacidade. Você pode pedir esclarecimentos ou exercer seus direitos pelo canal de contato, mesmo quando não houver um botão automático para a operação. Confirmaremos a identidade de forma proporcional e segura.",
          "Encerramento de acesso não equivale a apagar imediatamente todos os registros ou cópias de segurança. Eventuais retenções necessárias precisam de fundamento e informação apropriados. A publicação destes termos não executa exclusão nem altera automaticamente as condições de contas atuais."
        ]
      },
      {
        "id": "atendimento",
        "title": "Atendimento",
        "paragraphs": [
          "Fale com suporte@segundocerebroapp.com.br para suporte, privacidade, pedidos relativos a dados, cancelamento e reembolso. Descreva o problema com os dados mínimos necessários. Não envie senha, token, cartão completo, senha mestra ou conteúdo do Cofre.",
          "O e-mail recebe solicitações a qualquer hora. O atendimento humano ocorre de segunda a sexta-feira, das 9h às 18h, no horário de Brasília, exceto feriados nacionais. Os pedidos são tratados conforme os prazos legais aplicáveis; um horário de atendimento não reduz direitos de consumo ou de proteção de dados.",
          "Para as demandas de consumo abrangidas pela regulamentação de comércio eletrônico, o atendimento deve confirmar o recebimento imediatamente e apresentar manifestação em até cinco dias. Esse prazo não substitui os prazos próprios de acesso e confirmação de dados pessoais."
        ]
      },
      {
        "id": "responsabilidade",
        "title": "Disponibilidade e responsabilidade",
        "paragraphs": [
          "Manutenção, falhas e limitações técnicas podem afetar a disponibilidade. Isso não equivale a uma garantia de funcionamento ininterrupto, nem afasta o dever de prestar serviço adequado, informar situações relevantes e corrigir falhas. O usuário deve poder solicitar análise de problemas e reparação nos casos previstos em lei.",
          "Estes termos não excluem responsabilidade por defeitos, não transferem integralmente riscos a fornecedores externos e não limitam direitos indisponíveis do consumidor. Eventuais restrições por segurança precisam ser proporcionais, com comunicação e revisão compatíveis com o caso."
        ]
      },
      {
        "id": "alteracoes",
        "title": "Mudanças e versões",
        "paragraphs": [
          "A versão é identificada nesta página, disponível sem login e com acesso pelas Configurações. Mudanças relevantes serão informadas de forma adequada. Não há autorização para modificar preço ou obrigações de forma unilateral abusiva, nem considerar aceitas condições comerciais novas apenas porque você visitou uma página."
        ]
      },
      {
        "id": "legislacao",
        "title": "Lei aplicável e solução de dúvidas",
        "paragraphs": [
          "Aplicam-se as leis brasileiras e os direitos de proteção de dados e do consumidor que incidam na relação. Procure o canal de suporte para esclarecimentos ou solução de divergências, sem prejuízo de recorrer à ANPD, aos órgãos de defesa do consumidor ou ao Poder Judiciário.",
          "Não se impõe arbitragem obrigatória nem eleição de foro que prejudique o direito do consumidor ao foro competente, inclusive o de seu domicílio quando assegurado pela legislação."
        ],
        "links": [
          {
            "label": "Código de Defesa do Consumidor",
            "href": "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
          },
          {
            "label": "Decreto 7.962/2013 — contratação no comércio eletrônico",
            "href": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm"
          },
          {
            "label": "Consultar a Política de Privacidade do aplicativo",
            "href": "/privacidade"
          }
        ]
      }
    ]
  }
} as const satisfies { privacidade: LegalDocument; termos: LegalDocument };
