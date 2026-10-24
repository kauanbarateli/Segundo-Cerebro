# Próximos passos para o lançamento pago (18/10/2026)

**Estado:** consolidado de planejamento. Não é decisão aprovada. Reúne o que falta, fora o código do checkout e do onboarding, para abrir o produto a qualquer pessoa e começar a cobrar: Google Calendar sem lista de testadores, lojas de aplicativo e Meta (Facebook e Instagram).

**Como foi coletado:** documentos do repositório e buscas nas páginas oficiais de Google, Apple, Google Play e Meta. Regras de loja e de verificação mudam com frequência; confira cada item na fonte antes de agir.

**Legenda:**
- **[oficial]** página do próprio fornecedor.
- **[terceiro]** blog, imprensa ou fórum.
- **[verificar]** não confirmado ou com fontes divergentes.

Complementa a [pesquisa do Asaas](pesquisa-asaas-assinatura-20261018.md).

---

## 1. Resumo e ordem recomendada

O lançamento pago **não depende das lojas**. O produto já é uma PWA instalável no Android e no iOS ([doc 07](../planejamento/07-estrategia-web-app.md)), então dá para vender na web primeiro e levar o app às lojas depois. O Google Calendar também não precisa travar o lançamento: enquanto a verificação do Google corre, a Funcionalidade pode ficar fechada por Entitlement e abrir quando aprovada.

| Fase | O que entra | Destrava |
|---|---|---|
| **0. Fundamentos** | Nome final, domínio próprio, CNPJ, páginas legais, e-mail no domínio, plano pago da Vercel | Tudo o que vem depois |
| **1. Lançamento web pago** | Checkout Asaas, onboarding e verificação do Google em paralelo | Receita |
| **2. Google Play** | App Android com a mesma PWA (TWA), sem venda dentro do app | Presença na Play Store |
| **3. App Store** | App iOS com Capacitor, recursos nativos e decisão sobre pagamento no iOS | Presença na App Store |
| **4. Meta** | Pixel e Conversions API para anúncios. Login social e Instagram só com caso de uso definido. | Medição de campanhas |

## 2. Fundamentos — bloqueiam Google, lojas, Meta e cobrança

### 2.1 Nome definitivo antes de tudo
- A tela de consentimento do Google mostra o nome e o logo do app, e a verificação avalia exatamente essa marca. Trocar o nome depois força uma nova verificação. [oficial: sensitive scope verification]
- Lojas, domínio, e-mail remetente e perfis da Meta carregam o nome. Decidir antes evita refazer tudo.
- O `PRODUCT.md` registra o compromisso com o nome atual e a marca "2"; a troca exige decisão registrada.

### 2.2 Domínio próprio
- O Google exige que os domínios autorizados sejam verificados no Google Search Console e que a política de privacidade fique no mesmo domínio da página inicial. [oficial]
- O runbook do projeto já alerta para não declarar propriedade de `vercel.app` ([configurações pendentes](../operations/configuracoes-pendentes-passo-a-passo.md)).
- O mesmo domínio serve para o e-mail transacional (SMTP, já documentado), os arquivos de verificação das lojas e a verificação de domínio na Meta.

### 2.3 Pessoa jurídica (CNPJ)
- **Asaas:** Pix Automático só para PJ com CNPJ ativo há 6 meses; emissão de NFS-e.
- **Apple:** conta de organização exige entidade legal e número D-U-N-S. Empresário individual entra como pessoa física, e o nome pessoal aparece como vendedor. [terceiro, consistente com a Apple]
- **Google Play:** conta de organização (também com D-U-N-S) fica fora da exigência de teste fechado com 12 testadores. [terceiro]
- **Meta:** a verificação de empresa exige documentos da pessoa jurídica. [oficial]
- Confirmar com um contador o tipo de empresa e o CNAE. Atividade de software pode não caber no MEI. [verificar]

### 2.4 Páginas legais e de conta
- **Termos de uso** e **política de privacidade** (LGPD, contato do encarregado, retenção, direitos do titular), públicos no domínio.
- **Uso de dados do Google** na política: quais dados do Calendar são lidos, para quê, que não são compartilhados nem usados para outro fim, e como revogar. Seguir a Google API Services User Data Policy. [oficial: verificação]
- **Exclusão de conta** dentro do app e uma URL pública com o procedimento: a Play Store pede a URL e a Apple exige a exclusão no app quando há criação de conta. [verificar diretriz 5.1.1(v)]
- **Página de suporte** e e-mail de contato.
- Revisão jurídica recomendada antes do lançamento pago.

### 2.5 Hospedagem
- O plano Hobby da Vercel é para uso não comercial. Mudar para um plano pago junto com a cobrança, como o [roadmap](../planejamento/12-roadmap.md) já previa. [verificar preço atual]

## 3. Google Calendar para qualquer pessoa

### Situação atual
- Cliente OAuth em **External / Testing**, com as duas contas do mantenedor como test users ([configurações pendentes](../operations/configuracoes-pendentes-passo-a-passo.md), [validação de produção](google-producao-20261012.md)).
- Em Testing: no máximo **100 test users**; cada autorização **expira 7 dias** após o consentimento, inclusive o refresh token. [oficial: Manage App Audience]
- Escopos usados ([ADR-0008](../adr/0008-google-calendar-readonly.md)): `openid`, `email`, `calendarlist.readonly` e `events.readonly`. Os de Calendar são **sensíveis, não restritos**: pedem verificação de escopo sensível, mas não a auditoria de segurança anual (CASA) dos escopos restritos. [oficial + terceiro]

### Passos
1. **Branding final** em Google Auth Platform: nome, logo, e-mail de suporte, página inicial, política de privacidade e termos, tudo no domínio próprio.
2. **Verificar o domínio** no Search Console e cadastrá-lo como domínio autorizado.
3. **Página inicial pública** (a `/conheca` no domínio) que explique a conexão com o Google Calendar e leve à política de privacidade.
4. **Justificativa de cada escopo:** por que leitura de eventos e da lista de calendários; o app não cria, altera nem apaga compromissos.
5. **Vídeo de demonstração** (YouTube não listado): o fluxo completo, a tela de consentimento com o mesmo nome e marca enviados e os dados do Calendar em uso no app. [oficial] Idioma exigido: [verificar].
6. **Redirect URIs** apenas do domínio de produção. Revisar `GOOGLE_OAUTH_*` na Vercel.
7. **Mudar para In production e enviar para verificação.** O Google fala em semanas de antecedência; guias citam cerca de 10 dias depois da submissão completa. Responder rápido aos e-mails da equipe de revisão. [oficial + terceiro]
8. **Enquanto a verificação não sai:** em produção sem verificação aparece o aviso "o Google não verificou este app", com limite de usuários novos [verificar regra exata]. Para o lançamento pago, preferir manter a conexão Google fechada por Entitlement até a aprovação.
9. **Depois de aprovado:** acompanhar cotas da Calendar API no console e o cron diário já habilitado.

### Facebook e outros calendários
- **O Facebook não oferece API de calendário pessoal**; não existe essa integração.
- Para quem não usa Google, as alternativas são Microsoft Outlook (Microsoft Graph, com verificação de publisher) e Apple iCloud (CalDAV, sem OAuth). Ambas estão no roadmap como "CalDAV/outras agendas", fora do MVP e fora do ADR-0008. [verificar requisitos da Microsoft]

## 4. Google Play (Android)

### Conta
- Taxa única de registro de US$ 25. [verificar valor]
- **Conta pessoal criada após 13/11/2023:** teste fechado com pelo menos **12 testadores** inscritos por **14 dias seguidos** antes de pedir acesso à produção. Depois disso, o pedido é revisado. [terceiro, consistente entre fontes]
- **Conta de organização** (com D-U-N-S) fica fora dessa regra. [terceiro]

### Empacotamento
- **Trusted Web Activity (TWA)** gerada com Bubblewrap ou PWABuilder, a partir da PWA atual. [oficial: Chrome/web.dev]
- Publicar `/.well-known/assetlinks.json` com a impressão SHA-256 da **chave de assinatura do Play** (Play App Signing), não só a da chave de upload. Sem isso, o app abre com a barra do navegador. [oficial]
- **Ajuste técnico:** hoje o `src/middleware.ts` passa por sessão em todos os caminhos fora da lista pública. `/.well-known/` precisa ser servido sem sessão nem redirecionamento.

### Ficha e revisão
- Ícones, capturas, descrição, classificação etária, formulário de Segurança dos dados, URL da política de privacidade, URL de exclusão de conta e conta de teste para o revisor.

### Pagamento no Android
- **App só de uso é permitido:** a pessoa entra com a conta e usa a assinatura comprada fora. Dentro do app não pode haver compra nem botão ou link que leve à compra externa; links administrativos (conta, privacidade, ajuda) são permitidos se não levarem a pagamento. [oficial: Payments policy]
- O Brasil está na lista de países com faturamento alternativo ao do Google Play, mas isso implica adesão ao programa e taxas. [oficial]
- **Recomendado:** primeira versão só de uso, com a venda acontecendo no site.

## 5. App Store (iOS)

### Conta e ferramentas
- Apple Developer Program: US$ 99 por ano. Organização exige entidade legal e D-U-N-S; empresário individual entra como pessoa física. [terceiro, consistente com a Apple]
- Build iOS exige Xcode, num Mac ou em serviço de build na nuvem com macOS. [verificar opção]

### Formato do app
- **Diretriz 4.2 (funcionalidade mínima):** um site empacotado costuma ser rejeitado. O app precisa entregar valor nativo, como notificações push, widgets, extensão de compartilhamento, uso offline ou biometria para o Cofre. [terceiro]
- Isso coincide com o gatilho do roadmap para o **wrapper Capacitor** sobre a mesma PWA.

### Pagamento no iOS — decisão necessária
- A regra geral (3.1.1) exige compra dentro do app (IAP) para assinatura digital.
- A exceção de app companheiro gratuito (3.1.3(f)) cita só VoIP, armazenamento em nuvem, e-mail e hospedagem; há relato de revisor tratando a lista como fechada. Um app de organização pessoal **não está claramente coberto**. [oficial + fórum]
- **Brasil:** acordo da Apple com o CADE (dez/2025, em vigor desde meados de 2026) permite link para pagamento externo e meios de pagamento alternativos dentro do app, com aviso neutro. A imprensa relata taxa de cerca de 15% quando há link clicável para pagamento externo e comissão de 10% ou 25% no IAP. [terceiro; verificar termos atuais da Apple para o Brasil]
- **Opções:**
  - (a) Oferecer IAP da Apple ao lado do checkout web.
  - (b) Link do app para o checkout Asaas, nos termos brasileiros, pagando a taxa da Apple.
  - (c) App sem venda, com risco de rejeição.
- Diretriz de login (4.8): se um dia houver login com Google ou Facebook no app iOS, a Apple exige uma opção equivalente focada em privacidade, como Sign in with Apple. Hoje o login é por e-mail e senha. [verificar]
- Também entram: rótulos de privacidade, TestFlight, conta de teste para o revisor e exclusão de conta no app.

## 6. Instagram e Facebook

Depende do que "vincular" quer dizer. Três casos:

1. **Marketing e anúncios** (o mais ligado ao funil e aos UTMs):
   - Portfólio empresarial na Meta, verificação do domínio e Pixel na `/conheca` e no checkout.
   - **Conversions API** no servidor, enviando eventos como Lead, InitiateCheckout e Purchase. O Purchase pode partir do webhook do Asaas.
   - Exige banner de consentimento de cookies (LGPD) e ajuste da CSP com nonce, que hoje bloqueia scripts externos. Preferir eventos do servidor reduz script de terceiros no navegador.
   - Não exige App Review.
2. **Login com Facebook:**
   - Precisa de app Meta em modo Live, política de privacidade e callback ou URL de exclusão de dados. Permissões além das básicas exigem App Review e verificação de empresa. [oficial]
   - Muda a decisão de cadastro fechado (ADR-0007) e, no iOS, puxa a exigência de Sign in with Apple.
   - **Recomendado:** fora do MVP.
3. **Ler dados do Instagram ou do Facebook:**
   - A Instagram Basic Display API foi encerrada em 04/12/2024. A API atual atende contas profissionais (Business/Creator) e exige App Review e verificação de empresa. [terceiro, consistente]
   - Sem caso de uso no produto hoje; fora do MVP.

## 7. Checklist consolidado

| # | Passo | Quem faz | Depende de |
|---|---|---|---|
| 1 | Decidir o nome final e registrar a decisão | Mantenedor | — |
| 2 | Pesquisar marca no INPI (classes 9 e 42), comprar domínio, apontar na Vercel | Mantenedor (agente orienta) | 1 |
| 3 | Definir CNPJ, tipo de empresa e CNAE | Mantenedor + contador | — |
| 4 | Pedir o D-U-N-S (via consulta da Apple) | Mantenedor | 3 |
| 5 | Mudar a Vercel para plano comercial | Mantenedor | — |
| 6 | E-mail transacional no domínio (runbook SMTP) | Mantenedor + agente | 2 |
| 7 | Termos, privacidade (com seção Google), exclusão de conta, suporte | Agente redige, mantenedor revisa (ideal: advogado) | 1, 2 |
| 8 | Checkout Asaas, UTMs e onboarding (tickets em planejamento) | Agente | 7 |
| 9 | Verificação do Google: branding, domínio, justificativas, vídeo, submissão | Mantenedor submete, agente prepara textos e roteiro | 1, 2, 7 |
| 10 | Lançamento web pago (PWA), com Google fechado por Entitlement até aprovar | Ambos | 5, 8 |
| 11 | Meta: portfólio, domínio, Pixel e Conversions API, consentimento | Ambos | 2, 7, 8 |
| 12 | Google Play: conta, TWA, `assetlinks.json`, ficha, teste fechado | Ambos | 2, 3 ou 12 testadores |
| 13 | App Store: Capacitor com recursos nativos, decisão de pagamento iOS, revisão | Ambos | 3, 4, 12 |

## 8. Decisões pendentes do mantenedor
- Nome final e domínio.
- CNPJ e tipo de empresa; contas de loja como pessoa física ou organização.
- Lançar com o Google Calendar fechado até a verificação, ou esperar a aprovação.
- Estratégia de pagamento no iOS: IAP, link externo nos termos brasileiros ou app sem venda.
- O que "vincular Instagram e Facebook" significa para o produto: anúncios, login ou dados.

---

## Fontes

### Google OAuth e Calendar
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) [oficial]
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes) [oficial]
- [Manage App Audience (limites do Testing)](https://support.google.com/cloud/answer/15549945?hl=en) [oficial]
- [Nylas — OAuth para Google Calendar](https://developer.nylas.com/docs/cookbook/calendar/google-calendar-oauth/) [terceiro]
- [Unipile — limite de 100 usuários](https://www.unipile.com/google-oauth-100-user-limit/) e [refresh token de 7 dias](https://www.unipile.com/google-oauth-refresh-token/) [terceiro]

### Google Play
- [Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en) [oficial]
- [Faturamento alternativo — países](https://support.google.com/googleplay/answer/11174377?hl=pt-BR) e [programa de escolha de faturamento](https://developer.android.com/google/play/billing/billingchoice) [oficial]
- [Mudanças de taxas de 2026](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html) [oficial]
- [TWA — guia rápido](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start?hl=es) e [PWA em app Android](https://web.dev/using-a-pwa-in-your-android-app) [oficial]
- [Exigência de 12 testadores por 14 dias](https://12-testers-for-14-days.github.io/guides/google-play-production-access-requirements/) e [redução de 20 para 12](https://primetestlab.com/blog/google-play-changed-20-to-12-testers) [terceiro]

### Apple
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) [oficial]
- [Fórum: alcance da 3.1.3(f)](https://developer.apple.com/forums/thread/781935) [fórum]
- [9to5Mac — acordo com o CADE](https://9to5mac.com/2025/12/23/apple-settles-brazilian-antitrust-case-with-app-store-policy-overhaul/), [MacRumors — taxas no Brasil](https://www.macrumors.com/2025/12/24/new-app-store-fee-structure-in-brazil/) e [Olhar Digital](https://olhardigital.com.br/2025/12/24/pro/app-store-da-apple-tera-concorrencia-no-brasil-entenda-o-que-muda-no-seu-iphone/) [terceiro]
- [Capgo — revisão da App Store em 2026](https://capgo.app/blog/how-to-pass-app-store-review-2026/) [terceiro]
- [Inscrição de organização e D-U-N-S](https://help.fuego.io/en/articles/7133204-how-to-create-an-apple-developer-account-as-a-company-organization) [terceiro]

### Meta
- [Permissions Reference](https://developers.facebook.com/docs/permissions) e [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business) [oficial]
- [Fim da Instagram Basic Display API](https://www.getphyllo.com/post/instagram-basic-display-api-deprecation-what-it-is-for-developers-and-businesses) e [Instagram API em 2026](https://divipeople.com/instagram-api-2026/) [terceiro]

### Repositório
- [ADR-0008](../adr/0008-google-calendar-readonly.md), [validação de produção do Google](google-producao-20261012.md), [configurações pendentes](../operations/configuracoes-pendentes-passo-a-passo.md), [doc 07 — estratégia web app](../planejamento/07-estrategia-web-app.md), [roadmap](../planejamento/12-roadmap.md), [pesquisa do Asaas](pesquisa-asaas-assinatura-20261018.md)
