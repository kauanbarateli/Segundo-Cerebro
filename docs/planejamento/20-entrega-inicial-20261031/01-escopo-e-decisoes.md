# Escopo vigente e decisões de faseamento

## Precedência

Pedido mais recente do mantenedor → este documento e contratos dos docs 02–04 → tickets desta publicação → base v1.2 e referências históricas. A base fixa a evidência; não sobrepõe o recorte atual. Instruções de execução da base são históricas, inclusive o prompt único e a condição de aguardar outra rodada de perguntas. A publicação foi expressamente solicitada; não repetimos o questionário.

## Primeira etapa: duas frentes simultâneas

| Frente | Entrega | Limite |
|---|---|---|
| A — interfaces e fluxos existentes | Landing/login, tema/header/painéis, editores, captura rápida, Configurações/Projetos, calendário apenas em lista | APIs, modelos e permissões existentes; sem novas integrações |
| B — acesso e dados mínimos | Cadastro e-mail/senha, beta gratuito, cinco UTM por cadastro, métricas Master, feedback privado, atualizações autenticadas, aceite integrado | Sem cobrança, login social, ADM novo, clickstream ou telemetria de uso |

As melhorias A podem ser entregues antes de B: o CTA permanece Entrar quando a criação ainda não estiver disponível. Ao habilitar B, a integração valida landing → cadastro → confirmação → onboarding → produto. Não existe tela de checkout nesta etapa.

## Decisões substituídas ou delimitadas

| Tema | Regra vigente |
|---|---|
| Cadastro | Somente e-mail e senha, confirmação segura, reenvio e recuperação. Nome no onboarding. Google/Apple não aparecem no cadastro inicial. |
| Acesso | Gratuito durante o beta, sem preço, cartão, cobrança, prazo de bloqueio ou promessa vitalícia. Não construir contador de sete dias sem efeito nesta etapa; preservar datas/condições históricas das contas existentes. |
| Legados | Não reclassificar usuários, reiniciar gratuidades ou remover vetos. Free beta não significa ignorar bloqueios, exclusão, revogação ou Master. |
| UTM | Uma origem de cadastro por conta, com source/medium/campaign/term/content. Sem cronologia, identidade anônima persistente, primeiro/último toque ou eventos de navegação. |
| Métricas | Total e novos cadastros por período, confirmados e distribuição de origem registrada; restritas ao Master, com definições e ausência de dados honestas. Não chamar cadastro de usuário ativo/DAU. |
| Feedback | Envio e consulta privada pelo próprio usuário, recibo real e status inicial Recebido. A interface não promete prazo nem resposta automática. Respostas e triagem do novo ADM ficam para a segunda etapa; suporte existente continua acessível. |
| Atualizações | Quadro autenticado com conteúdo editorial versionado e cinco estados; sem backend administrativo nesta etapa. Pode começar vazio. Não importar feedback bruto nem marcar planejamento como lançado. |
| Admin | Preservar operação atual. Página e APIs antigas serão desativadas apenas no ticket posterior de corte, com contingência comprovada. |
| Lixeira | Manter os comportamentos atuais, sem anunciar purga em sete dias. Exclusão permanente consistente e purga automática são posteriores, com carência de sete dias para legado. |
| Calendar | Lista única é visual e entra agora. Conexão somente leitura existente permanece; login Google e permissão de editar eventos são coisas diferentes. |
| PWA/distribuição | Retirar o card de instalação das Configurações não remove PWA/runtime nem cancela o plano do PR #127. Não executar mudanças offline/distribuição por este pacote. |

As escolhas de implementação mínima para métricas Master, conteúdo versionado de Atualizações e recibo de feedback foram explicitadas para reduzir dependências. São limites da entrega inicial, não evidência de funcionalidades já existentes.

## Segunda etapa, após priorização

Login Google; leitura de capacidades e edição de eventos avulsos Calendar; ClickUp com leitura/hierarquia, comandos/comentários e sincronização; ADM em `adm.segundocerebroapp.com.br` com sessão própria, gestão de usuários, liberação de módulos, feedback/roadmap; exclusão permanente e purga em sete dias. Preservar planos completos de segurança e integração da base, mas usar o snapshot simples de UTM também no futuro ADM.

**Fora de ambas as etapas por enquanto:** Apple, checkout/Asaas, cobrança de R$ 29,90, editor de recorrências Google, ClickUp Chat/DM, Drive reaberto, analytics de navegação e jornada UTM detalhada. A eventual retomada desses temas exige escopo próprio; não será ativada por terminar a fila.

## O que permanece

Reservas financeiras são virtuais por conta; aportes não viram despesas. Cadência de hábitos preserva histórico por vigência. Imagens são privadas, controladas por dono e pipeline atual. Captura/Página são entidades diferentes; compartilhamento do editor não as funde. Entitlement e Preferência continuam separados. Não recriar os motores já entregues no PR #120.
