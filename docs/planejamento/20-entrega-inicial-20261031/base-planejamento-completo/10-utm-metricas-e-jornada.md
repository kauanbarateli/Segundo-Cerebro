# 10 — UTM, métricas e jornada até o cadastro

Data: 31/10/2026. Estado: **planejamento para validação, sem coleta ou implementação**. Base: `main`, SHA `bd35288404c493d1b03f7a1a0208f808cc2079a2`.

## Objetivo e limite do pedido

Oferecer no painel [administrativo separado](09-administracao-separada.md) métricas de cadastros/atividade e, na ficha de uma conta, a cronologia **consentida** das interações de aquisição do Segundo Cérebro até seu cadastro. O pedido atual amplia a leitura administrativa de atribuição de agregados para uma jornada individual; essa mudança deve ser registrada expressamente em decisão/ADR e comunicada na experiência de consentimento.

Jornada significa chegadas com campanha e marcos do funil próprio até o cadastro. Não significa acompanhar sites externos, capturar cada clique, textos digitados, IP para identificação, fingerprint, notas, tarefas, saldos, eventos de agenda, conteúdo do Cofre ou navegação privada dentro dos módulos. Referência externa é apenas domínio de origem permitido.

## O que foi observado e o que não foi verificado

**OBSERVADO no repositório:** buscas por `utm_`, `attribution` e contratos equivalentes em `src/` e `supabase/` não localizaram a funcionalidade de aquisição implementada. O [doc 16/03](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/16-checkout-asaas-onboarding/03-atribuicao-e-privacidade.md), ADR-0010 e decisões D-038–042/D-057/D-063 descrevem planejamento, não execução. D-077 mantinha atribuição pendente da etapa comercial.

O Admin atual expõe `created_at`, `last_sign_in_at`, estado e contagem de sessões por usuário. Esses campos não são telemetria de uso diário. Não existe prova de que `last_sign_in_at` informe a última interação, nem de que uma sessão válida represente alguém online.

**VERIFICADO no catálogo hospedado:** após autenticar o MCP pessoal, foram inspecionados schemas, tabelas, colunas, rotinas, políticas e migrations. A busca documentada não encontrou estruturas dedicadas de UTM/atribuição. Nenhum conteúdo pessoal ou JSON de usuários foi consultado; a conclusão não abrange sistemas externos ou dados genéricos não identificáveis pelo catálogo. O [doc 16](16-auditoria-supabase.md) traz a evidência e a reconciliação necessária entre 27 migrations no Git e cinco no ledger. Planejar a aquisição como implementação nova, sem duplicar eventual estrutura descoberta numa reconferência futura e sem inventar eventos anteriores ao consentimento.

## Reconciliação com decisões anteriores

| Regra histórica | Novo cenário | Tratamento proposto |
|---|---|---|
| D-038: primeiro e último toque | Usuário pede sequência até cadastro | Conservar first/last como projeções e acrescentar eventos limitados, sem substituir silenciosamente o modelo. |
| D-039: cinco UTMs e domínio de referência | Continua suficiente | Não adicionar parâmetros arbitrários, URL completa, gclid/fbclid, e-mail ou ID publicitário por inferência. |
| D-040: aceite facultativo e janela de 30 dias no mesmo navegador | Entrada agora é cadastro gratuito | Preservar escolha facultativa; negar não impede cadastro/onboarding/uso. Sem rastreamento por outro armazenamento após recusa. |
| D-041: abandono de checkout por 30 dias | Não há checkout nesta entrega | Recomendar funil de cadastro com janela fixa de 30 dias, mas registrar como adaptação proposta; não declarar abandono de cobrança. |
| D-042: visita direta preserva campanha válida | Permanece aplicável | Uma chegada direta não apaga o último pacote de campanha nem estende a janela. |
| D-057:12 meses desde contratação paga | Cadastro gratuito não é contratação paga | Recomendar12 meses desde cadastro verificado para a nova jornada; é **prazo novo proposto**, a validar no plano, e não aprovação antiga já aplicável. Retirada elimina antes. |
| D-063: congelar ao confirmar checkout e primeira cobrança | Não há cobrança | Recomendar congelar na confirmação do cadastro/identidade; registrar novo marco e não simular uma cobrança para reutilizar o antigo. |
| Doc 16: Admin só lê agregados | Pedido Q15 exige ficha individual | Nova permissão restrita `acquisition.read` (nome proposto), acesso auditado e consentimento/aviso específico. Não abrir consulta individual aos operadores que só precisam de totais. |

As janelas de 30 dias, limites dos parâmetros e demais complementos históricos aceitos em D-064 podem ser reutilizados onde a finalidade permaneça igual. Os novos marcos de cadastro, detalhamento individual e retenção de eventos precisam constar da validação do planejamento atual. Nenhuma nova rodada de perguntas é necessária: são recomendações técnicas explicitadas para a revisão consolidada.

## Jornada recomendada

1. Visitante abre `/conheca`. A interface oferece escolha facultativa de atribuição com explicação curta da finalidade e de que pessoas autorizadas poderão consultar a origem na ficha da conta. Rejeitar é tão acessível quanto aceitar.
2. Antes do aceite, não criar identificador analítico persistente nem guardar uma fila oculta de eventos para enviar depois. Ao aceitar, considerar apenas parâmetros presentes na página atual; não reconstruir passagens anteriores.
3. O servidor cria identificador opaco aleatório de aquisição e registro da versão/finalidade do consentimento. O identificador não contém e-mail/ID do usuário e não autoriza consulta pública.
4. Registrar um pacote válido de campanha na chegada e marcos limitados: `landing_view`, `signup_started`, `email_confirmation_requested` e `signup_verified`, nomes propostos. São enums, não URLs ou texto livre. Não enviar `email` no evento “confirmação solicitada”.
5. Navegação interna não é novo toque de campanha. Registros duplicados por reload/retry são deduplicados por identidade limitada do evento; não sobrescrever first-touch. Toques parciais não misturam campos de campanhas antigas.
6. Quando o servidor comprovar identidade/cadastro, associar o registro de aquisição ao usuário correto uma única vez e congelar a jornada daquele cadastro. Link/cookie recebido não basta para vincular uma pessoa arbitrária. Login de conta antiga não vira novo cadastro.
7. O aceite/identificador precisa sobreviver com segurança ao redirecionamento de confirmação/OAuth, por transação de cadastro ou estado assinado/referência opaca no servidor. Não enviar UTMs ou e-mail em `state`; não presumir correlação entre aparelhos, navegadores ou webviews. Se não houver vínculo comprovado, mostrar “origem não disponível”.
8. Usuário pode retirar o aceite; isso remove a jornada individual e sua projeção first/last, inclusive cópias legíveis em eventos/recibos/cache, conforme retenção e direitos aplicáveis. A conta continua funcionando. Eventos tardios, callback/retry ou backup não ressuscitam a atribuição removida.

**RECOMENDADO:** janela fixa de 30×24h desde o primeiro aceite/toque consentido; atividade não a renova. Limite máximo proposto de 100 eventos por jornada para evitar armazenamento ilimitado; ao atingir, conservar contagem de descarte e first/last válidos, sem prometer completude. O valor100 é operacional revisável, não decisão anterior. A ficha informa início/fim, cobertura e perda conhecida, em vez de chamar a lista de “todos os passos” quando a coleta é parcial.

## Parâmetros e privacidade

Reutilizar a lista aprovada: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`; domínio externo de referência sem caminho/query/fragmento. Limites históricos:200 caracteres Unicode e512 bytes por campo, até 2.560 bytes no conjunto; campo inválido é descartado, sem impedir cadastro.

UTM é entrada não confiável: pode conter PII, script ou segredo inserido na campanha. Não renderizar HTML, gerar links executáveis ou persistir mapa arbitrário da URL. Validar limites/normalização e prevenir divulgação em logs/erros/telemetria. Nome de campanha não autoriza tratá-lo como dado anônimo. Não imprimir URL original com query em relatório operacional.

Consentimento de atribuição é separado de termos/privacidade, sessão técnica e qualquer marketing. Não usar o feedback, Google Calendar, ClickUp ou o nome do usuário como fonte de aquisição. Nenhuma mensagem de prospecção é autorizada pela coleta ou pelo abandono.

Retenção proposta para o novo funil:

| Dado | Prazo/marco | Estado da decisão |
|---|---|---|
| Identificador/eventos de visitante não convertido | Até 30 dias fixos desde aceite/início da jornada, ou retirada antes | RECOMENDADO, adaptação do limite histórico |
| Jornada individual associada ao cadastro verificado | Até 12 meses desde cadastro, ou retirada antes; sem renovação por login/atividade | RECOMENDADO, novo marco distinto da contratação paga |
| Consentimento/retirada e prova mínima de eliminação | Metadados mínimos, prazo a compatibilizar com política de privacidade e necessidade documentada | Não perpetuar UTMs sob justificativa de auditoria |
| Totais agregados de aquisição | Só após teste de não identificação; sem drill-down individual após expiração | Prazo proposto separado; não inferir anonimização apenas por tirar e-mail |
| Feedback |12 meses após encerramento | Confirmado na entrevista atual; domínio distinto |

O plano recomenda redução/supressão de grupos pequenos e combinações raras nos relatórios agregados. O limiar de publicação e retenção agregada são parâmetros operacionais revisáveis, não promessa de anonimização. Não conservar dados pessoais indefinidamente enquanto se adia essa decisão: bloquear exportação/agregado inadequado e aplicar expiração individual desde o primeiro dia.

## Métricas sem ambiguidade

**RECOMENDADO:** fuso dos relatórios `America/Fortaleza`, exibido no seletor, com persistência UTC. É o fuso de análise proposto, separado do fuso financeiro comercial histórico.

| Métrica | Definição operacional | O que não significa |
|---|---|---|
| Contas criadas | Identidades provisionadas no intervalo, excluindo fixtures identificadas/testes | Não comprova e-mail verificado ou uso |
| Cadastros verificados | Pessoas que concluíram prova de identidade/e-mail e obtiveram acesso inicial, contado uma vez | Login posterior/novo provedor não é novo cadastro |
| Contas habilitadas | Contas não excluídas/bloqueadas com condição de acesso aplicável no instante da consulta | Não significa usuários ativos |
| DAU | Usuários distintos com atividade significativa aceita pelo servidor no dia do fuso selecionado | Não contar cron, refresh de token, healthcheck, preload ou página apenas em background |
| WAU/MAU | Distintos em janela móvel de 7/30 dias encerrada no período selecionado, mesma regra do DAU | Não somar DAUs; isso duplicaria pessoas |
| Ativação inicial | Cadastro verificado com onboarding concluído ou primeira ação útil confirmada, critérios separados | Pular onboarding não é ausência de valor; exibir medidas distintas |
| Conversão consentida | Cadastros atribuíveis / jornadas consentidas elegíveis na mesma coorte | Não é taxa de conversão de todos os visitantes |
| Origem desconhecida | Cadastros sem associação válida, retirada/expirada ou sem aceite, sem inferir motivo não observado | Não atribuir todos a “direto” |

Atividade significativa: recomendação de evento mínimo diário ao carregar um módulo autenticado visível por ação da pessoa ou concluir escrita útil. Para leitura, não usar qualquer GET da API como prova: Next/prefetch/cache podem realizar requests sem visualização. Um sinal permitido do cliente é validado no servidor e deduplicado por usuário/dia, sem conteúdo/URL livre; documentar que é telemetria sujeita a perda/bloqueio e não presença online. Falha de telemetria não bloqueia trabalho do usuário.

Recomenda-se uma linha de atividade por usuário/dia, sem trilha detalhada, retenção individual operacional de 90 dias para calcular janelas30 dias e diagnóstico limitado; **90 dias é proposta nova**, não a mesma retenção dos eventos de domínio por coincidência numérica. Totais podem ser materializados separadamente com política definida. Essa medição requer transparência própria na política; não reaproveitar consentimento de campanhas como autorização genérica para perfilamento.

## Contratos de dados e integração

Estruturas **propostas**, a conferir no banco antes de criar:

- `acquisition_consents`: identificador opaco, versão/finalidades, concedido/retirado, instantes e prazo; vínculo de identidade somente após comprovação.
- `acquisition_journeys`: início, expiração, estado, usuário opcional, marco de conversão, primeira/última campanha e cobertura. Dados analíticos privados, sem leitura direta anônima.
- `acquisition_events`: jornada, enum de evento, pacote UTM validado opcional, instante autoritativo e chave de deduplicação. Sem texto de formulário, token ou URL bruta.
- `acquisition_deletions` ou equivalente mínimo: impede reanexar registros eliminados/replays tardios sem conservar campanhas excluídas.
- `account_activity_days`: usuário, dia e instante mínimo necessário; não armazenar os objetos de domínio acessados.
- Projeções de métricas e auditoria administrativa: allowlist de dimensões, contagens, intervalo, fuso, versão da definição e atualização; leitura individual de jornada auditada com operador/alvo/motivo permitido, sem duplicar a jornada na auditoria.

APIs recomendadas: registrar/retirar consentimento, aceitar evento de funil limitado, vincular cadastro no servidor, consultar estado do próprio consentimento; no Admin, consultas distintas para agregados e jornada individual autorizada. Não oferecer endpoint público para buscar pessoa por UTM, cookie ou e-mail.

Arquivos envolvidos: `src/components/features/conheca/*`, novas telas de cadastro e adapters Auth; `src/lib/auth/*` e callbacks específicos; novos domínios de aquisição/métricas em `src/core/`; adapters server-only; migrations novas e tipos gerados; app administrativo/doc 09; política de privacidade e configuração de cookies. O caminho exato dos módulos novos será definido na extração, sem escrever domínio em componentes visuais.

Variáveis propostas: configuração pública de disponibilidade/versão do aviso, limites de coleta e origem canônica; secrets de assinatura/HMAC somente no servidor, distintos de senha/token e separados por ambiente. Nunca incluir token de rastreamento/secret em `NEXT_PUBLIC_*`. A rotina de retenção deve usar mecanismo autenticado existente ou job restrito com saúde observável, sem limpeza por build/CI/deploy.

## Etapas, esforço e critérios de aceite

| Etapa | Entregável | Prioridade/esforço | Dependências |
|---|---|---|---|
| AQU-01 | Inventário hospedado autorizado e ADR reconcilia agregados→individual, compra→cadastro e consentimento | P0/M | Acesso de metadados; decisões atuais |
| AQU-02 | Consentimento, modelo/retensão e contratos pré-usuário | P0/G | AQU-01; cadastro aberto |
| AQU-03 | Funil first/last+cronologia e associação idempotente no cadastro | P1/G | AQU-02; e-mail/Google funcionando |
| AQU-04 | Métricas de cadastro/atividade com definição versionada e cobertura | P1/M-G | Sessão/ações autorizadas; política de dados |
| AQU-05 | Ficha administrativa, agregados e exclusão verificável | P1/G | ADM-02/03; AQU-03/04 |

Testes objetivos:

- Recusa/ausência de aceite não cria aquisição persistente e não impede cadastro; aceite posterior não reconstrói passos anteriores.
- Toques novos/direct/referral/internos, UTMs parciais, campos repetidos, Unicode, limite, HTML e PII acidental não quebram o fluxo nem contaminam os logs.
- Confirmação e OAuth associam somente a jornada autorizada ao cadastro correto; outra aba/conta/nonce inválido não sequestra vínculo; repetir callback não duplica conversão.
- Identidade existente ao entrar pelo Google não vira cadastro novo; troca de dispositivo sem vínculo é desconhecida, nunca atribuída por fingerprint/IP.
- Janela30 dias, retenção 12 meses proposta, retirada, job atrasado e callback tardio não prolongam ou ressuscitam atribuição. Limite de eventos mostra cobertura parcial.
- Master sem capacidade/MFA não consulta jornada; usuário comum não enumera registros; respostas/caches não misturam pessoas. Agregados não revelam grupos singulares por combinação de filtros.
- DAU/WAU/MAU testados com relógio fixo, virada de dia, deduplicação, fixtures, prefetch e jobs; última sessão/login nunca rotulada “online”.
- Nenhuma rotina de métricas lê conteúdo de notas, finanças, calendário ou Cofre. Telemetria indisponível não impede operação principal.
- Purga verificada em tabela, projeção, cache e cópias de eventos/recibos; tombstones preservam idempotência. Restore aplica exclusões antes de liberar acesso à cópia.

Riscos: correlação incorreta de pessoas, consentimento inválido/contornado, confusão de métricas, exposição de jornada para todos os Masters sem finalidade, eventos ilimitados e duplicação em logs/backups. O plano exige revisão de privacidade e segurança da nova finalidade individual; não afirma conformidade jurídica automática por implementar checkbox.

O catálogo foi inspecionado com sucesso, sem ativar coleta, criar tabelas ou calcular métricas de usuários. As verificações funcionais listadas continuam sendo critérios futuros de entrega; a auditoria estrutural está documentada separadamente no doc 16.
