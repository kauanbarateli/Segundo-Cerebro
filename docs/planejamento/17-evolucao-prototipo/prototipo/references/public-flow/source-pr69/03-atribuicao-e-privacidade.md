# Atribuição de origem e privacidade

Estado em 18/10/2026: **consolidado aprovado**, conforme D-064, após D-034–D-063. Os comportamentos marcados PROPOSTO foram aceitos como direção do planejamento; nomenclatura definitiva e provas explicitamente pendentes serão tratadas nos tickets. O aceite autoriza publicação de issues, sem iniciar implementação, aplicar migrations ou configurar serviços.

## 1. O que já foi aprovado

| Registro | Decisão aprovada | Limite da aprovação |
|---|---|---|
| D-034 | Checkout e onboarding ampliam o MVP atual. | Não equivale ao aceite da implementação comercial. |
| D-037 | Checkout próprio; captura do cartão na fatura hospedada do Asaas. | A atribuição não torna necessários os dados completos do cartão, nem a URL da fatura nos relatórios. |
| D-038 | Primeiro e último toque. | Campanha inicial preservada; novos UTMs válidos atualizam o último toque. A regra de expiração precisa ser especificada. |
| D-039 | Cinco UTMs e somente domínio de origem. | `utm_source`, `utm_medium`, `utm_term`, `utm_campaign`, `utm_content`; referrer sem caminho, parâmetros ou URL completa. |
| D-040 | Lembrar a origem por até 30 dias entre visitas no mesmo navegador, mediante aceite específico e facultativo. | Recusar não impede contratar. Não contornar a recusa com outro armazenamento. A janela fixa desde aceite/primeiro toque é complemento proposto para o aceite consolidado, não decisão humana já recebida. |
| D-041 | Medir checkouts abandonados por até 30 dias, com aceite, sem marketing. | Guardar UTMs e última etapa para o funil; eliminar a atribuição individual após o prazo. Cobranças têm retenção operacional apartada. O prazo fixo desde criação do checkout é complemento proposto para o aceite consolidado. |
| D-042 | Visita direta preserva a última campanha válida. | Voltar sem UTMs não apaga a campanha dentro da janela. Nova campanha válida continua atualizando o último toque. |
| D-043 / D-045 | Contas atuais preservadas gratuitas; novas isenções podem ser concedidas explicitamente pelo Master. | Não inferir gratuidade pela falta de assinatura, origem Admin ou papel. Conferência do conjunto atual e contratos das isenções dependem da execução. |
| D-044 / D-054 | E-mail existente exige login antes de cobrar; endereço novo deve ser confirmado por link antes da primeira cobrança. | A prova do endereço novo não cria Usuário Auth antes do pagamento. Simplesmente conhecer um e-mail não autoriza consultar ou alterar a sua atribuição. |
| D-055 | Avisos do MVP somente por e-mail. | Mensagens operacionais não autorizam marketing, SMS, WhatsApp ou voz. Remetentes, agenda e entrega precisam de configuração e homologação futuras. |
| D-056 | Dados dos módulos de contas pagas preservados por 180 dias após o fim efetivo do acesso ou a suspensão sem retorno, com aviso prévio e canal para solicitar os próprios dados. | O pedido de cancelamento não inicia o prazo enquanto houver período pago; reativação válida impede limpeza indevida. Não é a retenção de identidade, cobranças ou atribuição; não expira conta gratuita/isenta ativa. |
| D-057 | Primeiro e último toque vinculados ao Usuário por 12 meses após a contratação paga, respeitando retirada anterior do consentimento. | Depois, remover atribuição individual e conservar somente estatísticas não identificantes cuja agregação tenha sido validada. Visitas, renovações e cancelamento não prorrogam esse prazo. |
| D-062 | Isenção de convidado/teste revogada exige aviso por e-mail e sete dias para contratar antes da restrição aos controles da conta. | Não gera adesão, cobrança ou atribuição automaticamente; preserva a gratuidade das contas atuais D-043 e exige contratação explícita de quem sair da isenção D-045. |
| D-063 | Congelar primeiro e último toque ao confirmar o checkout e gerar a primeira cobrança. | A simples abertura não congela. Campanhas válidas podem atualizar o último toque antes da confirmação; depois, visitas, retorno, retry e webhook atrasado não reescrevem a contratação. Retirada e expiração continuam removendo atribuição sem impedir pagamento/provisionamento. |

Fontes de autoridade: [registro de decisões](../registro-de-decisoes.md), [ADR-0009](../../adr/0009-cobranca-asaas-e-onboarding-no-mvp.md) e [glossário](../../../CONTEXT.md). Decisões humanas registradas prevalecem; a direção técnica deste documento foi aceita no consolidado em D-064.

Q8/D-042 decidiu preservar o último toque na visita direta. Q22/D-057 definiu a retenção individual após contratação paga em 12 meses. A seção 9 reúne os complementos técnicos para aprovação consolidada; não é uma nova rodada de perguntas nem muda o que já foi decidido.

## 2. Finalidade e separação de dados

**APROVADO:** a atribuição serve para analisar descoberta, conversão e abandono da contratação. Não autoriza mensagens de marketing a quem abandonou, anúncios personalizados, compartilhamento com plataformas de publicidade ou perfilamento de navegação fora do Segundo Cérebro.

**PROPOSTO para aprovação consolidada:** manter três finalidades explicitamente separadas:

| Finalidade | Exemplos de informação | Relação com a escolha de atribuição |
|---|---|---|
| Operar e proteger a contratação | Identificador de checkout, etapa técnica, proteção contra abuso, referência da cobrança e estado do pagamento. | A compra precisa funcionar mesmo com atribuição recusada. Exigências operacionais não justificam reter campanhas para análise. |
| Atribuir origem e medir o funil | Cinco UTMs, domínio de origem, instantes dos toques, última etapa alcançada. | Depende do aceite facultativo aprovado para esta finalidade. |
| Ativar e manter a conta | Identidade, situação comercial, Entitlements e passagem ao onboarding. | Pagamento e comprovação de identidade seguem seus próprios contratos; não dependem de aceitar atribuição. |

O mesmo registro operacional não deve funcionar como uma segunda base de marketing. Depois da retirada do aceite ou do término da retenção, deixar UTMs em outra tabela, evento, log, exportação ou cópia legível mantém a atribuição individual e não cumpre a eliminação planejada.

**APROVADO — D-055:** confirmação de endereço, ativação e avisos financeiros ou de exclusão são operacionais e enviados somente por e-mail no MVP. Não usar o aceite de atribuição ou o abandono como autorização para prospecção. A política de atribuição não determina o prazo dos dados dos módulos nem da identidade ou das cobranças.

**PROPOSTO:** a eliminação distingue bases ativas de cópias históricas de backup. Não prometer apagamento imediato de backups imutáveis; definir expiração, acesso restrito e reaplicação de exclusões antes de disponibilizar qualquer restore, conforme a seção 6.

## 3. Campos e modelo conceitual proposto

Esta seção é **PROPOSTA para revisão consolidada**, não schema aprovado. Os nomes são conceituais; nenhuma tabela ou migration é criada aqui. Os requisitos já aprovados são identificados explicitamente.

### 3.1 Toque de origem

Cada toque contém um pacote coerente da visita:

- `utm_source`, `utm_medium`, `utm_term`, `utm_campaign`, `utm_content`: todos opcionais; ausente não significa inventar um valor.
- Domínio de origem externo, quando disponível. Ausência por restrição do navegador não é erro nem motivo para reconstruir a navegação.
- Instante de captura, versão das regras de normalização e origem da captura (`conheca` ou checkout).

**PROPOSTO:** não guardar a URL de chegada completa, referrer bruto, caminho anterior, fragmento, identificadores de anúncio, impressão digital de dispositivo ou histórico de páginas. A extração do domínio ocorre antes de qualquer persistência ou observabilidade. Reduzir a um domínio não transforma automaticamente o conjunto vinculado a uma pessoa em dado anônimo.

O domínio interno não representa uma nova aquisição. Navegar da `/conheca` ao checkout ou voltar uma etapa não deve produzir uma campanha artificial. Domínio de origem e campanha são dimensões distintas: um referrer não deve preencher silenciosamente `utm_source`.

**PROPOSTO — significado de domínio:** guardar o hostname DNS externo canônico, incluindo seus subdomínios, sem porta, caminho, query, fragmento ou credenciais. Aceitar apenas hostname de domínio completo válido, com representação internacional normalizada; ignorar IP literal, `localhost`, nomes sem domínio, nomes especiais/locais e domínios internos do app. Não resolver DNS ou acessar o destino para validar referrer. Um hostname pode conter informação pessoal: a ausência de caminho não dispensa minimização e validação da agregação.

### 3.2 Atribuição antes do Usuário

**APROVADO:** no checkout pago, o novo Usuário só é criado após o primeiro pagamento reconhecido. A origem precisa existir antes dele, quando houver aceite. Isso não impede contas atuais gratuitas (D-043) nem a criação administrativa autorizada com isenção explícita (D-045); essas exceções não abrem cadastro público gratuito.

**APROVADO — D-054:** antes de gerar a primeira cobrança, confirmar o endereço novo por link sem criar Usuário Auth. Se o endereço estiver cadastrado, D-044 exige login antes da cobrança. A prova de endereço e o aceite de atribuição são comandos diferentes: um não concede o outro nem libera leitura de campanhas ou checkouts de terceiros.

**PROPOSTO:** usar um identificador aleatório e opaco de atribuição, distinto do identificador da cobrança e das credenciais de retomada do checkout. A associação ao checkout é feita somente no servidor. Não incluir e-mail, documento ou dados do pagador no identificador ou no cookie de atribuição.

O registro conceitual de atribuição reúne:

- Primeiro toque e último toque como pacotes independentes.
- Consentimento relacionado à finalidade, versão do texto, instante de concessão e eventual retirada.
- Limites da janela fixa entre visitas proposta na seção 4.
- Vínculo interno ao checkout quando houver contratação iniciada.
- Última etapa do funil e referência temporal necessária à retenção do abandono.

**PROPOSTO:** começar a atribuição persistente somente após a escolha positiva. No instante do aceite, analisar apenas os parâmetros presentes na página atual e iniciar a janela com o mesmo timestamp do servidor para aceite e primeiro toque consentido. Não reconstruir chegadas anteriores nem guardar previamente um identificador de rastreamento. Na ausência de campanha válida, registrar somente a origem direta ou referral externo propostos na seção 4; o parâmetro de origem não é obrigatório para contratar.

O modelo atual de eventos/recibos exige Usuário Auth. O [índice](README.md) já identifica essa lacuna: **não criar Usuário fictício, não atribuir dados de visitante ao Master e não expor anonimamente a saga administrativa**. A entrada pré-Usuário exige um contrato de ator e recibo próprio, a definir na especificação de arquitetura.

### 3.3 Passagem ao Usuário

**APROVADO — D-063:** congelar primeiro e último toque na confirmação do checkout que gera a primeira cobrança, depois da prova de endereço/login exigida em D-054/D-044. Criar ou abrir o checkout mantém a atribuição provisória; antes da confirmação, novos UTMs válidos ainda podem atualizar o último toque com aceite vigente. Depois dessa confirmação, novos toques de navegador não sobrescrevem a atribuição daquela contratação. O congelamento não reinicia as janelas de retenção.

**PROPOSTO — atomicidade:** capturar uma única vez o snapshot autorizado e a sua versão na mesma transação local da reserva idempotente do comando de geração da primeira cobrança, antes de chamar o Asaas. Essa reserva é a fronteira técnica proposta para executar D-063, não uma confirmação fornecida pelo navegador nem antecipação do congelamento para a abertura do checkout. Timeout ou resultado externo incerto mantêm a mesma operação e snapshot: consultar/conciliar e repetir somente conforme o contrato idempotente, sem congelar de novo ou gerar outra cobrança porque surgiram novos UTMs.

**PROPOSTO:** quando o primeiro pagamento for reconhecido e a identidade estiver apta ao provisionamento, vincular ao Usuário somente o snapshot ainda existente e autorizado, de maneira idempotente. O callback de navegação ou os UTMs enviados pelo cliente não provam pagamento, titularidade ou associação a uma conta existente.

**PROPOSTO:** depois da confirmação D-063, retomada do mesmo checkout, troca de etapa e nova tentativa permitida de pagamento reutilizam o snapshot congelado e a capacidade operacional de retomada; não representam nova coleta de campanha para aquela contratação nem reiniciam retenção. Antes da confirmação, a retomada pode receber novos UTMs válidos do mesmo navegador com aceite vigente, sem reiniciar a janela. Se a atribuição analítica daquele checkout já foi eliminada por prazo ou retirada, reconhecer o pagamento e criar/liberar a conta continua permitido, mas **sem ressuscitar a atribuição**, mesmo se um webhook atrasado ou o browser ainda contiverem uma cópia antiga. Um novo checkout só recebe atribuição mediante ingresso e consentimento válidos, ainda provisória até a sua confirmação; não altera retroativamente o checkout anterior nem reaproveita campanhas eliminadas.

A transferência não deve:

- Criar dois registros de atribuição por repetição de webhook, conciliação ou retomada.
- Misturar o primeiro toque de uma pessoa com o checkout de outra.
- Ressuscitar uma atribuição já retirada ou eliminada.
- Reiniciar a retenção de 12 meses por atraso no provisionamento, nova visita, renovação, cancelamento ou repetição de um evento. O marco aprovado é a contratação paga (D-057), não a última escrita na atribuição.
- Enviar UTMs, referrer ou identificadores de atribuição em `externalReference` ou descrição pública da cobrança. **PROPOSTO:** o provedor recebe apenas a referência opaca necessária ao pagamento.

**APROVADO:** contas atuais permanecem gratuitas (D-043), e e-mail já cadastrado exige login antes de nova cobrança (D-044); endereço novo é comprovado por link antes da cobrança, sem novo Usuário Auth (D-054). **PROPOSTO:** coordenar envio, vínculo, expiração, consumo e retomada da comprovação pelos [contratos técnicos](04-contratos-tecnicos-propostos.md), sem enumeração pública ou substituição da atribuição histórica por uma compra cujo e-mail apenas coincide com o cadastro. A simples digitação de e-mail ou documento não autoriza vincular ou sobrescrever a origem de outro Usuário. A validação futura deve provar essas condições.

**APROVADO — D-062:** o prazo de sete dias para contratar após revogar uma isenção não é consentimento de atribuição, novo pagamento ou contratação automática. **PROPOSTO:** não preencher origem a partir do cadastro Admin, do papel do Usuário, do foco pessoal D-060 ou do contexto de Projeto D-061. Quem contratar após essa transição segue o mesmo fluxo explícito e a mesma proteção de origem do checkout pago.

## 4. Navegação, primeiro toque e último toque

**APROVADO — D-038/D-063:** preservar primeiro toque e atualizar o último quando chegarem novos UTMs válidos antes da confirmação que gera a primeira cobrança; depois da confirmação, o snapshot daquela contratação não muda. **PROPOSTO:** sincronizar a atribuição provisória do checkout apenas a partir de toques autorizados do mesmo navegador durante a janela vigente, sem coletar origem de outro aparelho ou expor estado pelo e-mail público. O registro de navegador pode receber novos toques válidos, sem reescrever um checkout já confirmado.

**PROPOSTO:** tratar os UTMs de uma visita como um pacote. Não combinar `utm_source` da visita atual com `utm_campaign` de uma visita anterior só porque um campo faltou. Uma tela interna do checkout não é novo toque; a navegação carrega o vínculo já autorizado, e não fabrica visitas com referrer interno.

**APROVADO — Q8/D-042:** volta direta, sem UTMs, preserva a última campanha válida dentro da janela. Registrar visitas diretas como eventos analíticos adicionais não foi autorizado por essa escolha; a alteração aprovada é não apagar a campanha anterior.

**PROPOSTO — janela fixa de navegador:** `consented_at = first_touch_at`, ambos gerados pelo servidor; expiração em `consented_at + 30 × 24 horas`. Atualizar último toque, recarregar, entrar no app, reabrir checkout ou ler relatório não renova o prazo. No instante de expiração, parar novas capturas e eliminar a atribuição dessa janela do navegador/base de visitas. Nova coleta exige novo aceite explícito e inicia outra janela, sem restaurar a anterior. O cookie técnico de retomada de pagamento tem contrato próprio e não prolonga a janela analítica.

**PROPOSTO — toques parciais e referral:** depois da validação independente de cada campo, pelo menos um UTM não vazio e válido caracteriza nova campanha. Substituir o pacote do último toque pelos campos válidos da visita e marcar os ausentes/inválidos como ausentes; nunca completá-los com dados antigos. Se não houver UTM válido e não existir primeiro toque, registrar no primeiro toque apenas o hostname externo válido (referral) ou origem direta sem domínio. Se já existir campanha válida, um referrer externo sem UTM não a derruba. Na ausência de campanha anterior, preservar o referral inicial em vez de inventar sucessivos toques analíticos. Não criar clickstream ou eventos extras de visitas diretas por essa regra; D-042 autoriza preservar a campanha, não uma trilha de navegação.

**PROPOSTO — exemplo de relógios separados, respeitando D-063:** aceite e primeiro toque no instante A; expiração das novas capturas em A + 30 dias. Checkout criado em A + 20 dias, ainda com atribuição provisória. Uma campanha válida em A + 21 dias pode atualizar o último toque. Confirmação que gera a primeira cobrança em A + 22 dias congela esse conjunto, sem reiniciar o prazo de abandono: sua atribuição pode ser retida até A + 50 dias, e não A + 52 dias. Campanha posterior não altera o snapshot; não coletar novos toques após A + 30 dias sem novo aceite. Se houver contratação paga antes de eliminar o snapshot, a retenção individual vinculada ao Usuário passa a seguir D-057. Se o pagamento só for reconhecido depois da eliminação, o vínculo comercial prossegue sem atribuição. Retirada do consentimento antecipa a remoção nos dois conjuntos.

**PROPOSTO:** não unir navegadores ou dispositivos por e-mail, IP ou impressão digital antes da comprovação de identidade. A decisão D-040 fala no mesmo navegador; não promete atribuição entre aparelhos.

## 5. Aceite, recusa e retirada

**APROVADO:** o aceite de atribuição é específico e facultativo, separado da contratação e dos cookies técnicos. A recusa não impede compra, ativação, onboarding ou uso do produto.

**PROPOSTO:** uma explicação curta da finalidade e dos prazos de cada conjunto, com ações acessíveis para aceitar ou recusar com clareza equivalente. Sem opção pré-marcada, aceite por continuar navegando ou inclusão disfarçada no aceite dos termos da assinatura. Guardar a versão do texto que foi apresentada; a versão de termos comerciais é outro registro.

| Situação | Comportamento proposto |
|---|---|
| Sem escolha | Não iniciar persistência de atribuição. Operação técnica do checkout continua. |
| Aceitou | Ativar somente campos e finalidade aprovados. Proposta: janela de navegador fixa desde o aceite/primeiro toque e abandono fixo desde a criação do checkout; após contratação paga, D-057 limita a vinculação individual a 12 meses. |
| Recusou | Comprar normalmente, sem atribuição persistente entre visitas. Se existia escolha positiva anterior, tratar como retirada e limpar a atribuição individual correspondente. Não reproduzir UTMs em cookie técnico, outra base ou novo checkout para contornar a recusa. |
| Retirou o aceite | Parar novas capturas e invalidar o vínculo no navegador; remover a atribuição individual, inclusive antes dos 12 meses após contratação paga, sem interferir no pagamento. Só conservar estatísticas se comprovadamente não identificantes. |
| Aceitou novamente | Proposta: novo instante de aceite/primeiro toque e nova janela fixa de 30 dias, sem recuperar registros eliminados, alterar o snapshot já congelado de checkout ou autorizar retroativamente a coleta. |

**PROPOSTO:** manter um mecanismo próprio e simples de revisão da escolha, disponível nas superfícies públicas relevantes e no produto. Retirada e eventual pedido de eliminação alcançam as cópias individuais de atribuição; não basta apagar o cookie. A prova mínima de consentimento/retirada tem finalidade e retenção próprias, a preencher na tabela operacional antes do lançamento, sem campanhas no registro de prova por conveniência.

Cookie de sessão, `sessionStorage`, `localStorage`, parâmetro de URL e armazenamento no servidor não são autorizações legais por si. Trocar a tecnologia não altera a finalidade de atribuição. **PROPOSTO:** manter cookies técnicos com seu escopo de checkout/autenticação e um mecanismo separado para lembrar a escolha de privacidade, sem convertê-los em rastreadores de campanha. Após a expiração do aceite proposto, manter somente a capacidade operacional que ainda for válida; não continuar a coleta analítica por essa capacidade.

## 6. Retenção: conjuntos e prazos distintos

| Conjunto | Decisão vigente | Complemento técnico proposto para aprovação |
|---|---|---|
| Origem lembrada entre visitas no mesmo navegador | D-040: até 30 dias, com aceite. | Janela fixa de 30 × 24 horas desde aceite/primeiro toque, mesmo timestamp do servidor. Não renovar por atividade; nova coleta depois da expiração exige novo aceite. |
| Atribuição individual de checkout abandonado | D-041: até 30 dias, com aceite; eliminar ao fim; sem marketing. | Janela fixa de 30 × 24 horas desde `checkout_created_at` do servidor. Retomadas, tentativas, última etapa ou novas visitas não prorrogam. Remover antes se houver retirada. |
| Atribuição vinculada ao Usuário após contratação paga | **D-057: 12 meses a partir da contratação paga**, com remoção anterior se retirar o consentimento. Ao fim, só estatísticas que não identifiquem pessoas. | Usar marco autoritativo da primeira contratação paga, distinto de chegada do webhook/provisionamento; calcular 12 meses de calendário em São Paulo, limitando dia ao último válido quando necessário, e persistir o instante de expiração. Nunca reconstituir snapshot já eliminado. |
| Dados dos módulos de conta paga após fim efetivo do acesso ou suspensão sem retorno | **D-056: 180 dias**, com aviso antes da exclusão e canal para solicitar os próprios dados. | Persistir marco de fim efetivo do acesso e conferir reativação antes da limpeza; seguir protocolo de aviso/solicitação dos contratos técnicos. Não aplicar à identidade, cobranças ou atribuição; não expirar contas gratuitas/isentas ativas. |

**PROPOSTO:** a rotina privilegiada localiza e elimina a atribuição vencida nas bases ativas e demais cópias operacionais inventariadas, com verificação repetível e evento/recibo sem o conteúdo eliminado. O direito de usar a atribuição vence no prazo, mesmo se a rotina física executar depois: consultas, associação e agregação negam registros vencidos por relógio do servidor. Não renovar o abandono por retorno real, leitura de relatório ou conciliação. Retomar o pagamento do checkout não autoriza novo tracking nem outro prazo. Um webhook tardio não recupera atribuição eliminada.

**PROPOSTO — última etapa de abandono:** guardar somente uma etapa atual de enum fechado, alinhado ao fluxo do checkout, e seu timestamp. Atualizar durante uma interação permitida do checkout, com aceite vigente e antes do menor prazo entre a validade da coleta do navegador e o fim da janela de abandono. Não persistir sequência de cliques, páginas, IP, device fingerprint ou texto livre para essa análise. Evento/recibo de atualização leva somente operação e etapa permitidas, sem campanhas copiadas; não autoriza comunicação de marketing.

**APROVADO — D-057:** o prazo de 12 meses é da atribuição individual ligada à contratação paga; não é uma janela móvel de atividade. Não conservar campanhas pessoais indefinidamente sob justificativa de auditoria. A remoção da atribuição não elimina a identidade, o vínculo comercial nem as cobranças operacionais.

**APROVADO — D-056:** o prazo de 180 dias dos módulos só começa após o encerramento efetivo do acesso ou a suspensão sem retorno. Cancelar enquanto ainda há período pago não antecipa o marco. Antes da limpeza, verificar reativação e elegibilidade; uma conta gratuita/isenta ativa não entra nessa expiração. Aviso prévio e canal de solicitação dos próprios dados devem continuar acessíveis na gestão da conta. Não se presume um exportador automático já existente.

**PROPOSTO — backups e restore:** inventariar cópias históricas, restringir o acesso e preencher seu ciclo de expiração antes do lançamento. Manter um registro mínimo de exclusões/retiradas (tombstones) separado das campanhas e do conteúdo dos módulos, com retenção e acesso próprios na tabela operacional. Antes de liberar um restore para uso, reaplicar essas exclusões e as expirações vencidas, verificando que os dados removidos não reapareçam em bases, eventos ou relatórios. A execução precisa de teste; o protocolo documental não atesta exclusão imediata de backups ou anonimização.

Cobranças emitidas, disputas, proteção contra fraude e comprovação contratual podem exigir registros operacionais separados. **PROPOSTO — gate antes do lançamento:** o responsável pela operação revisa e aprova uma tabela de retenção por conjunto, com campos mínimos, finalidade/base legal, marco, prazo, acesso, procedimento de eliminação e comprovação. Não inventar prazo fiscal universal, como cinco anos, sem identificar a obrigação aplicável à operação PF. A conservação operacional não autoriza conservar UTMs além do prazo de atribuição.

| Conjunto da tabela operacional | Conteúdo mínimo a revisar | Condição de liberação proposta |
|---|---|---|
| Prova de e-mail e capacidade de retomada | Digest/identificador, validade, consumo e proteção contra abuso; sem campanhas ou segredo em logs. | Lifetimes e descarte reconciliados com os contratos técnicos, sem criar Auth antes do pagamento. |
| Prova de consentimento e retirada | Finalidade, versão do texto, escolha e instantes mínimos para comprovação. | Prazo e direitos aprovados pelo responsável; sem reter UTMs brutos como prova. |
| Identidade e segurança | Identidade, controles da conta, dados estritamente necessários a segurança e solicitações. | Política separada de D-056/D-057, documentada e validada no fluxo de solicitações. |
| Cobranças, contrato e disputas | Identificadores opacos, valores, vencimentos, situação e evidências mínimas aplicáveis. | Obrigação/finalidade e prazo identificados; sem copiar campanhas ou cartões completos. |
| Tombstones, backups e recibos de exclusão | Identificadores mínimos e estado de exclusão necessários a impedir ressurreição. | Inventário, retenção e teste de reaplicação no restore aprovados antes do lançamento. |
| Estatísticas agregadas | Apenas dimensões/conjuntos permitidos sem ligação individual recuperável. | Não identificação e grupos pequenos avaliados; sem essa prova, suprimir o dado em vez de prolongar a atribuição individual. |

Essa revisão operacional é uma condição de lançamento a executar nos tickets, não uma nova pergunta de produto para prosseguir com o consolidado nem licença para inventar prazos nesta documentação.

**APROVADO — D-057:** depois dos 12 meses, conservar somente estatísticas que não identifiquem pessoas, mediante validação da agregação. **PROPOSTO:** só chamar de anônimo um agregado que não permita voltar à pessoa por identificador, combinações raras ou cruzamentos disponíveis. Simplesmente remover o e-mail, aplicar hash ou trocar o UUID não prova anonimização. Aplicar a condição de liberação dos agregados acima; sem prova, não conservar a atribuição individual como se fosse anônima.

## 7. Leitura, escrita, isolamento e eventos

**REQUISITOS DO PEDIDO E DOS ADRs:** Usuário não edita origem; na análise de atribuição, Admin lê agregados, sem registros individuais dos compradores ou visitantes. Isso não altera os metadados de identidade já autorizados no Admin atual. Isolamento por Usuário e [evento atômico em toda escrita de domínio](../../adr/0004-toda-escrita-emite-evento-de-dominio.md) permanecem.

**PROPOSTO para os contratos de execução:**

- Visitante não lista atribuições, checkouts ou cobranças. Um token de retomada não concede acesso aos registros de outras pessoas.
- O browser não envia `user_id`, estado de pagamento ou permissão de acesso para serem confiados pelo servidor.
- Após a associação, a origem individual pertence ao Usuário correspondente. Bloquear edição direta e impor RLS, privilégios e controles do servidor; não depender de esconder campos na interface.
- Distinguir imutabilidade da atribuição para análise dos direitos de acesso, correção de inexatidões e eliminação do titular, que exigem procedimento próprio. “Usuário não edita” não significa negar esses direitos.
- Os endpoints de atribuição do Admin recebem contagens agregadas por dimensões permitidas, sem documento, e-mail, UUID de Usuário/checkout, referrer completo ou navegação individual. Não incluir acesso aos registros individuais por filtro, drill-down ou exportação. O gate de não identificação inclui grupos pequenos e combinação de filtros. Isso preserva os metadados de identidade autorizados no Admin existente.
- Associar origem, concluir transferência e retirar/eliminar atribuição com os respectivos eventos/recibos na mesma transação de cada escrita local. Chamadas ao Asaas não cabem em uma transação local única; a saga e a conciliação precisam de idempotência.
- Eventos de atribuição devem registrar operação e metadados mínimos permitidos, **sem copiar os UTMs brutos ou os dados do pagador**. Repetir o conteúdo em auditoria append-only tornaria incoerente a eliminação de abandono em até 30 dias.
- Não colocar UTMs, identificadores pessoais, tokens de checkout ou payloads do pagador em mensagens de erro, métricas, query strings de links compartilháveis ou logs. Conferir também logs de acesso da infraestrutura; a aplicação sozinha não controla todas as cópias.

**PROPOSTO:** seguir o ator/recibo pré-Usuário dos [contratos técnicos](04-contratos-tecnicos-propostos.md), usando lista fechada de operações de aceite, retirada, vínculo, atualização de etapa e eliminação; permitir somente referência opaca, operação, etapa quando cabível e instantes mínimos. Sem conteúdo bruto dos toques em eventos. Não reutilizar `domain_events.user_id` com identidade fictícia para resolver a ausência de Usuário antes do pagamento. A nomenclatura final deve ser reconciliada na implementação, sem alargar o payload permitido.

## 8. Normalização e limites propostos

Tudo nesta seção é **PROPOSTO para aprovação consolidada**, não decisão já recebida do mantenedor. Validar no servidor mesmo quando o browser já validou.

| Entrada | Proposta inicial | Comportamento de falha proposto |
|---|---|---|
| Nomes de parâmetros | Lista fechada dos cinco UTMs; ignorar outros para atribuição. | Não persistir mapa arbitrário da URL. |
| Valores de UTMs | Limite de 200 caracteres Unicode e 512 bytes UTF-8 por campo; conjunto total de valores limitado a 2.560 bytes. | Descartar campo inválido, sem truncamento silencioso e sem impedir a compra. Um UTM não vazio e válido basta para o toque parcial proposto na seção 4. |
| Texto | Normalizar Unicode NFC, remover espaços externos; aceitar letras, marcas, números, espaço e separadores simples `_`, `-`, `.`. | Rejeitar controles, quebras de linha, marcação e formatos de segredo reconhecidos; não exibir a entrada descartada no erro. Essa política continua proposta para aceite final, sem reclassificar campanhas antigas silenciosamente. |
| Parâmetro duplicado | Não escolher silenciosamente entre dois valores do mesmo nome. | Tratar o campo como inválido; não permitir que browser e servidor interpretem campanhas diferentes. |
| Codificação | Usar um único caminho de análise da URL; não decodificar repetidamente valores já interpretados. | Percent-encoding malformado não quebra checkout nem vira HTML. |
| Domínio de origem | Hostname DNS externo completo, incluindo subdomínios, de URL HTTP(S) válida; normalizar caixa, representação internacional e ponto final de DNS; até 253 bytes no hostname canônico. | Descartar IP literal, nomes sem domínio/especiais/locais, origem interna, malformada ou indisponível; nunca guardar URL bruta como fallback. Não resolver DNS. |
| Instantes e validade | Instantes do servidor, sem confiar no relógio do cliente para prolongar retenção. | Campo de expiração enviado pelo browser não altera prazo. |

**PROPOSTO:** contar caracteres após NFC/trim por pontos de código Unicode, não por unidades UTF-16; medir bytes UTF-8 no mesmo valor normalizado. Renderizar valores como texto, usar queries parametrizadas e tratar campanha/referrer como entrada não confiável. Limites não provam ausência de dado pessoal: não inserir e-mail, documento, nomes de pessoas ou segredos nas campanhas. Relatórios não refletem automaticamente qualquer texto recebido sem a validação de agregação.

## 9. Complementos técnicos propostos para aceite final

As respostas D-034–D-063 permanecem aprovadas no seu alcance. **Os complementos abaixo foram aceitos como direção técnica do consolidado em D-064; sua implementação e prova continuam futuras.** D-063 já aprovou a fronteira de congelamento na confirmação que gera a primeira cobrança; a reserva transacional abaixo é o mecanismo técnico proposto.

| Complemento | Proposta consolidada | Evidência futura necessária |
|---|---|---|
| Janela de navegador | Fixa de 30 × 24 horas desde aceite/primeiro toque consentido, sem renovação por atividade; depois, novo aceite para nova coleta. | Relógio do servidor e testes de fronteira, nova campanha, recarga, expiração e retirada. |
| Abandono e congelamento | Abandono fixo de 30 × 24 horas desde criação do checkout. D-063 congela só na confirmação que gera a primeira cobrança; propor snapshot atômico com reserva idempotente antes do Asaas, sem reiniciar prazo. Retomada depois da confirmação não reabre coleta da contratação. | Atualização antes da confirmação, imutabilidade depois, resultado externo incerto, limpeza/associação concorrentes e pagamento tardio sem restaurar atribuição eliminada. |
| Toques e referrer | Pacote parcial com ao menos um UTM válido; sem misturar campos antigos. Hostname DNS externo canônico; referral sem UTMs não derruba campanha existente nem cria clickstream. | Unicode, bytes, limites, duplicatas, hostnames, IP, visita direta e referrer interno. |
| Pós-contratação | Cumprir os 12 meses D-057 pelo marco autoritativo da contratação paga, sem prorrogação automática; retirada remove antes. | Fronteiras de calendário, provisionamento tardio, renovação, cancelamento e não ressurreição. |
| Identidade e vínculo | Usar contratos técnicos pré-Usuário, prova por link D-054 e login D-044; idempotência e nenhuma atribuição automática por isenção, foco ou cadastro Admin. | Tentativas de associação alheia, enumeração, links trocados/repetidos e transição D-062. |
| Admin | Endpoints de atribuição apenas agregados, sem consulta/exportação individual. Preservar metadados de identidade já autorizados no Admin existente. | RLS, filtros, combinações raras e validação da não identificação. Sem prova, suprimir o agregado. |
| Operação e direitos | Tabela de retenção operacional revisada pelo responsável antes do lançamento; prazos próprios para provas, identidade, cobrança e backups. | Tabela aprovada com fundamentos/campos/marcos/prazos/acesso e ensaio das solicitações, avisos e exclusões. |
| Restore | Tombstones mínimos, expirações e exclusões reaplicadas antes de liberar a cópia restaurada. | Ensaio sem dados pessoais expostos e prova de que atribuição eliminada não retorna. |

Nenhum novo prazo financeiro/legal foi inventado. Os defaults de 30 dias fixos, hostname e limites de campos foram aceitos no consolidado (D-064), sem comprovar implementação ou eficácia. Validações de segurança, não identificação e retenção operacional são gates dos tickets e do lançamento, não atividades concluídas por escrever o plano.

## 10. Validação proposta para os tickets

Esta matriz é um **plano de validação futura**. Nenhum teste listado foi executado para atribuição. A implementação deverá informar comandos reais, fixtures sintéticas e roteiro de sandbox em seus tickets.

| Cenário | Resultado esperado para validar |
|---|---|
| Chegada com cinco UTMs e domínio externo; escolha positiva | Preservar pacote autorizado entre `/conheca` e checkout; criar atribuição sem Usuário fictício. |
| Sem escolha, recusa e navegação completa | Checkout e pagamento continuam; nenhuma atribuição persistente ou cópia alternativa para análise. |
| Abrir/criar checkout e receber nova campanha antes de confirmar | Não congelar na abertura. Com aceite vigente, preservar primeiro toque e atualizar último provisório como pacote antes da confirmação D-063, sem misturar visitas ou renovar prazo. |
| Nova campanha após confirmação que gera a primeira cobrança | Não reescrever o snapshot da contratação. O último toque do navegador pode atualizar dentro da sua janela, sem prorrogar retenção ou alterar aquela cobrança/atribuição. |
| Confirmação concorrente e resultado Asaas incerto | Proposta: snapshot e reserva idempotente atômicos; timeout/retry/retorno/webhook usam a mesma escolha. Novos UTMs não geram outro congelamento ou outra cobrança. |
| Navegação interna e recarga | Não criar novo toque por referrer interno, nem duplicar última etapa. |
| Visita direta | Preservar a última campanha válida dentro da janela aprovada; não alterar o primeiro toque nem criar nova campanha. |
| Referral externo sem UTM válido | Proposta: preencher primeiro toque só se ainda não existir; preservar campanha existente, sem criar eventos extras de visita ou preencher UTM silenciosamente. |
| Hostname externo com subdomínio, IP literal e host local | Proposta: conservar somente hostname DNS externo canônico válido; rejeitar IP/host local e não resolver DNS nem persistir URL/porta/caminho/parâmetros. |
| Limites, duplicatas, encoding, controles, HTML e texto parecido com segredo | Rejeição/descartes conforme contrato; sem execução, SQL indevido, erro com dado bruto ou bloqueio da compra. |
| Referrer ausente, interno ou malformado | Checkout normal; nenhuma URL completa armazenada como recuperação. |
| Expiração e relógio do browser adulterado | Proposta: servidor aplica `consented_at + 30 × 24 horas`; novo toque, recarga e relógio do cliente não prorrogam. Depois da expiração, não coletar antes de novo aceite. |
| Recusa após aceite e novo aceite posterior | Proposta: recusa limpa atribuição/cookie correspondentes sem usar cookie técnico como fallback; novo aceite inicia outra janela sem recuperar registros anteriores ou consentir retroativamente. |
| Abandono, retomada e rotina de limpeza | Proposta: `checkout_created_at + 30 × 24 horas` fixos; última etapa e nova tentativa não renovam. Eliminar atribuição nas bases ativas/cópias operacionais previstas, sem campanhas duplicadas em eventos; rotina repetida não recria dados. |
| Snapshot eliminado antes do pagamento reconhecido | Reconhecer pagamento e provisionar conforme os contratos comerciais, sem atribuição; não copiar campanhas do browser, webhook ou backup antigo para ressuscitar o snapshot. |
| Última etapa após expiração/retirada | Não atualizar dado analítico ou criar histórico de cliques. Continuação técnica do pagamento permanece separada e não inicia outro prazo. |
| Retirada antes ou depois do pagamento | Parar captura e remover atribuição individual, mesmo antes dos 12 meses; pagamento/ativação não falham por esse motivo; nenhuma recuperação por webhook atrasado. |
| Contratação paga e limite de 12 meses | Aplicar D-057 desde o marco da contratação; remover primeiro/último toque individuais no prazo e conservar apenas estatísticas cuja não identificação tenha sido validada. |
| Expiração lógica com limpeza física atrasada | Proposta: consultas, agregação e associação já recusam atribuição vencida pelo timestamp do servidor; atraso da rotina não libera uso adicional do dado. |
| Nova visita, renovação, cancelamento ou provisionamento tardio | Não prorrogar os 12 meses nem reiniciar a atribuição histórica. |
| Prova de endereço novo e login de cadastro existente | Exigir D-054/D-044 antes de cobrar, sem criar Usuário Auth antecipado, revelar existência de cadastro ou associar campanhas à pessoa errada. Verificação não concede consentimento de atribuição. |
| Link de e-mail expirado, repetido, trocado ou aberto por scanner | Negar vínculo/cobrança indevidos; contrato técnico de consumo/retomada precisa de teste sem enumeração ou criação colateral de conta. |
| Aviso financeiro, ativação e aviso pré-exclusão | Enviar só pelo e-mail previsto e sem mensagem de marketing; coordenar responsáveis para evitar duplicidade. |
| Fim efetivo do acesso e 180 dias dos módulos | Aplicar D-056 somente às contas pagas elegíveis; pedido de cancelamento ainda no período pago não antecipa marco, e reativação válida impede limpeza. Identidade, cobranças e atribuição seguem políticas próprias. |
| Conta gratuita/isenta ativa | Não expirar dados dos módulos pelo prazo comercial de 180 dias nem presumir que toda conta Admin está isenta. |
| Revogação de isenção e contratação após sete dias | D-062 exige aviso/transição e contratação explícita, sem cobrar ou preencher atribuição por papel, Admin, foco pessoal ou contexto de Projeto. A comprovação e o consentimento de origem continuam próprios. |
| Aviso e solicitação dos próprios dados antes da exclusão | Comprovar aviso prévio por e-mail e canal acessível durante a suspensão; não declarar exportador automático inexistente. |
| Webhook repetido, fora de ordem ou concorrente com limpeza | No máximo uma associação autorizada; não restaurar atribuição expirada/retirada; operação e evento local atômicos. |
| Tentativa de ler ou vincular checkout alheio | Negar acesso/associação; não revelar existência nem dados da outra pessoa. |
| Edição direta de origem pelo Usuário | Negar em API/RLS; o procedimento de direitos do titular permanece disponível. |
| Endpoints de atribuição do Admin | Apenas agregados autorizados; negar consulta individual/drill-down/exportação que revelem pessoas. Preservar os metadados de identidade já autorizados no Admin existente. Combinações raras precisam de validação, não apenas remoção de UUID. |
| Logs, telemetria, backups e exportações | Inventário de cópias e política de retenção verificados; ausência em um log não é prova de eliminação integral nem de apagamento imediato de backups históricos. |
| Restore de cópia anterior à retirada/exclusão | Reaplicar tombstones mínimos e expirações antes de liberar o destino; não ressuscitar atribuição individual nem módulos já eliminados. Testar sem expor conteúdo pessoal. |
| Teclado, foco, temas, 320/390 px e movimento reduzido | Escolher/recusar/rever privacidade é acessível, sem interferir na conclusão do checkout. |

## 11. Fontes primárias e limites desta análise

Conferidas em 18/10/2026:

- [ANPD — Guia orientativo Cookies e proteção de dados pessoais, versão 1.0, outubro de 2022](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/@@display-file/file), especialmente pp. 11–12, 14–20 e 24–25: retenção proporcional à finalidade, escolha/retirada e avaliação contextual da hipótese legal. O guia alcança tecnologias similares; não fixa prazo universal de 30 ou 90 dias nem exige consentimento para todo cookie.
- [LGPD — texto oficial, arts. 6º–10 e 15–18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm): princípios, hipóteses legais, informação, consentimento e direitos do titular. Dados para executar a contratação e atribuição facultativa exigem análise das suas próprias finalidades; o aceite comercial não é autorização genérica para campanhas.

Os prazos de 30 dias (D-040/D-041), 12 meses (D-057) e 180 dias dos módulos (D-056) são decisões de produto com finalidades distintas, não prazos legais padronizados. Os marcos fixos e os protocolos de consentimento, exclusão, restore e agregação são propostas documentadas para o aceite consolidado; ainda não foram implementados ou validados. Política de privacidade, identificação/contato do controlador, fornecedores, atendimento de direitos e a tabela de retenção operacional formam condições de lançamento a entregar nos tickets, sem presumir prazo financeiro/legal universal.
