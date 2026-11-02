# Minutas de decisões arquiteturais

Estado: **propostas para incorporar ao repositório após validação**. Não reservar números novos de ADR neste pacote: a frente deve verificar a sequência atual de `docs/adr/`. As decisões de escopo do mantenedor já estão no doc 02; as minutas registram consequências técnicas e alternativas.

## Cadastro gratuito independente de cobrança

O novo acesso começa por cadastro verificado, com avaliação e continuidade gratuita no beta, preservando gratuidades antigas. Substitui a exigência histórica de pagamento antes de criar identidade para este canal gratuito; a contratação Asaas futura continua separada. Manter condição de acesso explícita, sem usar ausência de cobrança como prova de isenção e sem confundir preferências com entitlement.

## Administração em canal e deployment separados

O ADM em subdomínio próprio reutiliza domínio e saga, com sessão/cookies próprios, MFA e autorização a cada operação. A alternativa de apenas esconder a aba foi rejeitada pelo mantenedor. Desativar canais antigos após substituto/contingência preserva suporte e últimoMaster; compartilhar cookie de domínio ou confiar noHost não separa privilégios.

## Disponibilidade de lançamento separada de preferência

Uma capacidade implementada pode permanecer fechada ou em piloto antes do lançamento; entitlement e moderação continuam decidindo o acesso individual. Novas capacidades nascem fechadas; existentes são migradas explicitamente. Isso amplia o PlanoPessoal implícito sem transformar esconder/mostrar uma aba em permissão.

## Jornada individual consentida até o cadastro

Q15 autoriza planejar a leitura administrativa individual de aquisição, além dos agregados históricos. O plano mantém coleta facultativa, cincoUTMs e domínio externo, acrescentando marcos limitados do funil próprio e congelamento no cadastro verificado. Não há rastreamento de navegação fora do produto nem reconstrução anterior ao aceite. Retenção e parâmetros novos do doc 10 são recomendações a validar, não migração automática de regras de contratação paga.

## Espelho ClickUp separado de tarefas nativas

A tarefa remota permanece propriedade do ClickUp; espelhamento separado evita duplicar métricas, converter status e permitir que a lixeira local exclua o objeto externo. Edições deliberadas passam por adapter/intenções e conciliam resultado remoto; comentários incertos não são reenviados às cegas. O custo é manter dois conjuntos de capacidades claramente identificados na tela deTarefas.
