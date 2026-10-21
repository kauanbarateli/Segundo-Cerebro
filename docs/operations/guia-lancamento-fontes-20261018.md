# Guia de preparação e lançamento — fontes e limites

Data: 18/10/2026. Material principal: [guia HTML](guia-lancamento-e-configuracoes-20261018.html). Esta lista documenta consulta pública a fontes primárias; não representa verificação autenticada de contas, contrato, compra ou submissão.

## Verdade local e decisões humanas

- Repositório: `kauanbarateli/Segundo-Cerebro`; leitura de `AGENTS.md`, `CONTEXT.md`, `src/app/manifest.ts`, `.env.example`, `src/adapters/db/google-calendar-security.ts`, planejamento 16, checklist 08 e brief das páginas legais.
- Observado no código: aplicação web/PWA, nome/ícones/atalhos do manifest e callback Calendar `/api/calendar/oauth/callback`. A existência do manifest não comprova conformidade de um pacote com lojas.
- Relato humano: domínio adquirido e conectado; suporte enviado/recebido; instalação web em iPhone 11 e A35. Não equivale a teste de pacote Android/iOS publicado.
- Estado de planejamento: SPEC-07 / #50 e tickets #51–#68 para checkout Asaas/onboarding. Asaas web não comprova enquadramento de compras nas lojas. Drive, IA, colaboração e escrita no Google não foram reintroduzidos.
- Atualização recebida durante a preparação: mantenedor confirmou Vercel Hobby e escolheu manter o plano e adiar o deploy. O guia orienta preparação local/GitHub, sem afirmar novas páginas no domínio ou plano pago contratado.
- Resend é escolha de planejamento; seu gate de transferência internacional permanece explícito. Preparar domínio não autoriza envio real.

## Fontes Google Cloud, Calendar e domínio

| Fonte oficial | Uso no guia | Limite da conclusão |
| --- | --- | --- |
| [Configurar consentimento](https://developers.google.com/workspace/guides/configure-oauth-consent) | Branding, Audience, Data Access e test users. | Menus podem variar por conta/idioma. Não foi alterado o projeto. |
| [OAuth para servidor web](https://developers.google.com/identity/protocols/oauth2/web-server) | API/cliente web, segredo fora da árvore pública e URI exato. | O callback real também depende de `APP_URL` e da configuração da conta. |
| [Escopos Calendar](https://developers.google.com/workspace/calendar/api/auth) | Necessidade de leitura e menor acesso. | A lista final deverá ser extraída do código vigente e comparada ao Console; não se inventou permissão adicional. |
| [Verificação de escopos sensíveis](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) | Domínio, branding, justificativas, vídeo e revisão pública. | Exceção de uso pessoal/teste não foi convertida em liberação comercial; nenhum prazo garantido. |
| [Como enviar a verificação](https://support.google.com/cloud/answer/13461325?hl=pt-BR) | Pacote de apresentação e acompanhamento da Central. | Publicar branding não substitui a revisão aplicável de acesso aos dados. |
| [Expiração OAuth](https://developers.google.com/identity/protocols/oauth2#expiration) | Risco de refresh token curto no modo Testing externo. | Não é a duração universal de todas as sessões ou tokens do produto. |
| [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) | Uso limitado e transparência no tratamento dos dados Google. | A política de privacidade não substitui a conduta técnica. |
| [Verificar posse no Search Console](https://support.google.com/webmasters/answer/9008080) | Propriedade de domínio e prova DNS. | Não modificar registros de outros responsáveis nem substituir os MX. |

## Google Play

| Fonte oficial | Uso no guia | Limite da conclusão |
| --- | --- | --- |
| [Começar no Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=pt-BR) | Conta, taxa única de US$ 25 e verificações. | Confirmar valor local/tributos no pagamento; nenhuma adesão efetuada. |
| [Informações da conta](https://support.google.com/googleplay/android-developer/answer/13628312?hl=pt-BR) | Identificação, contato e exposição pública na monetização. | Conferir a informação efetivamente divulgada antes de confirmar; não se publicou endereço privado. |
| [Teste de novas contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR) | Teste fechado de 12 participantes inscritos por 14 dias contínuos para contas abrangidas. | Depois há pedido de acesso à produção e análise, sem aprovação automática. |
| [TWA: início rápido](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start) | Pacote, associação de domínio e assinatura. | É uma possibilidade a avaliar; não há AAB produzido ou novo ID reservado nesta entrega. |
| [API alvo vigente](https://developer.android.com/google/play/requirements/target-sdk) | Android 16 / API 36 para novos apps/updates comuns na data da consulta. | Reconfirmar na submissão; requisitos específicos de outras famílias e bibliotecas não são dispensados. |
| [Segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469?hl=pt-BR) | Ficha conforme coleta do serviço/pacote/SDKs. | TWA não implica ausência de coleta. O inventário real deve sustentar respostas. |
| [Exclusão de contas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=pt-BR) | Caminhos de solicitação no app e na web quando aplicáveis. | Texto de política ou contato isolado não prova que a exclusão funciona. |
| [Política de pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738?hl=pt-BR) e [explicação](https://support.google.com/googleplay/android-developer/answer/10281818?hl=pt-BR) | Compra digital, links externos e programas por país. | Não foi declarada elegibilidade específica para Asaas no Brasil; exige análise/adesão e implementação próprias. |

## Apple

| Fonte oficial | Uso no guia | Limite da conclusão |
| --- | --- | --- |
| [Apple Developer Program](https://developer.apple.com/programs/enroll/) | 2FA, identidade individual, nome de vendedor e US$ 99 por ano como referência. | Valor local é confirmado na adesão; conta PF não vira organização por nome comercial. |
| [Requisitos Xcode/macOS](https://developer.apple.com/xcode/system-requirements) | Necessidade de ambiente de build compatível. | Não se escolheu hardware, versão fixa de Xcode ou serviço pago. |
| [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | Funcionalidade mínima 4.2, compras digitais/regiões e análise do login 4.8. | Não se garantiu aprovação de WebView nem exceção regional; PWA instalada é distinta de app iOS. |
| [Criar registro do app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) | Nome, Bundle ID e SKU após preparação. | Registro não equivale a build, revisão ou publicação. |
| [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) | Declarações de dados baseadas no comportamento real. | Requer inventário de todos os componentes efetivos. |
| [Capturas](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) | Consultar dimensões vigentes e usar app real. | Não se fixaram modelos/resoluções universais ou capturas web como evidência iOS. |
| [TestFlight](https://developer.apple.com/testflight/) | Ensaio de binário e revisão beta aplicável. | Não substitui revisão pública ou teste físico; não foi criado convite. |
| [Exclusão de conta](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) | Iniciar exclusão no app para os casos abrangidos. | Desativação e exclusão são distintas; implementação precisa ser conferida. |

## Vercel, e-mail e transferência

| Fonte oficial | Uso no guia | Limite da conclusão |
| --- | --- | --- |
| [Adicionar domínio](https://vercel.com/docs/domains/working-with-domains/add-a-domain) | Settings/Domains, registros atuais e preservação do DNS de e-mail. | Acessibilidade pública não comprova valores privados/callbacks. |
| [Variáveis](https://vercel.com/docs/environment-variables) | Ambientes separados; efeito em novos deployments. | Os nomes específicos do produto vêm de `.env.example`; nenhum valor foi lido/divulgado. |
| [Promover deployment](https://vercel.com/docs/deployments/promoting-a-deployment) | Revisão antes de promoção futura. | O mantenedor adiou deploy; não houve promoção por este material. |
| [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines) e [Pro](https://vercel.com/docs/plans/pro-plan) | Hobby não comercial; domínio/checkout externo não afastam regra. | Nenhuma contratação de Pro; custos/condições devem ser vistos no painel. |
| [Resend: verificar domínio](https://resend.com/docs/add-a-domain) e [rastreamento](https://resend.com/docs/dashboard/domains/tracking) | Preparar envio sem afetar suporte; tracking desligado. | Domínio verificado não é liberação legal/operacional do envio. |
| [Resend Security, FAQ](https://resend.com/security) | Dados armazenados nos EUA; região é de envio; recusa a DPA/contratos LGPD/ANPD específicos/anexos. | Não usar DPA europeu para declarar automaticamente mecanismo brasileiro válido. |
| [LGPD, especialmente art. 33](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) | Gate de mecanismo de transferência internacional. | A análise aplicável é da operação concreta; este roteiro não emite certificação. |

## Meta: acessibilidade da documentação e roteiro orientativo

Foram consultados os destinos oficiais abaixo. Parte da documentação de criação/vinculação retornou login/bloqueio temporário ou HTTP 429. Não se usaram blogs ou tutoriais de terceiros para declarar esses menus como observados na sessão do mantenedor.

- [Segurança da conta](https://www.facebook.com/help/235353253505947): acessível; base para 2FA, alertas e recuperação.
- [Central de Contas](https://www.facebook.com/help/943858526073065): acessível; experiências conectadas não são prova de vinculação dos ativos de negócio.
- [Criar Página](https://www.facebook.com/help/104002523024878): consulta redirecionou ao login/bloqueio; confirmar a tela atual no perfil real do mantenedor.
- [Conta profissional Instagram](https://help.instagram.com/502981923235522): consulta retornou 429; roteiro de menus marcado orientativo.
- [Vincular Instagram e Página](https://www.facebook.com/business/help/502981923235522): consulta redirecionou ao login/bloqueio; confirmar ativos e permissões na própria conta.
- Pontos de entrada, não provas de configuração: [criar Página](https://www.facebook.com/pages/create/), [Instagram](https://www.instagram.com/) e [Meta Business Suite](https://business.facebook.com/).

Não se afirmou que nome de usuário está disponível, que a vinculação foi feita ou que conta de anúncios é necessária. Não houve criação/publicação. Abertura comercial, rastreamento e anúncios têm condições próprias.

## Decisões editoriais e visuais

- Calendário de 14 dias, dez roteiros de 30–60 segundos, CTA de acompanhamento e parâmetros 9:16/1080×1920/30 fps: **RECOMENDADO** para esta operação, não exigências universais das redes nem promessa de alcance.
- Conteúdo sobre funções reais só pode usar o build validado; demonstração/protótipo deve ser rotulado. Sem IA/Drive/lojas anunciadas por antecipação ou dados reais em gravações.
- Visual **Read** dentro do mundo DS 2.1. Paleta observada copiada de `design-system/tokens/tokens.json`; sem imagens, scripts ou recursos externos. Fonte do sistema é fallback para o HTML autocontido, sem nova família visual no aplicativo.
- Aplicada a Impeccable local: `SKILL.md` integral e referências `new-work`, `operate`, `craft-floor`; contexto executado uma vez para o alvo. Pedido preciso de guia operacional deriva composição editorial direta, sem alterar DESIGN.md ou tokens globais. Contexto relatou `buildPath` não definido; drift não reparado.
- O agente proprietário dos dois arquivos não executou build, testes do produto, commit ou push. A revisão visual e integração cabem à Root.
