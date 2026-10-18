# Preparação do mantenedor — contratação e onboarding

Somente providências humanas para o SPEC-07. Planejamento aprovado em 18/10/2026 (D-064); esta publicação não iniciou implementação nem alterou serviços. Não é preciso desenvolver telas, escrever SQL ou aprender a API para cumprir esta lista. Os agentes construirão, testarão e apresentarão os resultados para revisão.

Marque os itens conforme concluir. **Não envie chaves, senhas, tokens, links de ativação ou documentos pessoais pelo chat, GitHub ou capturas.** Informe apenas status, domínio, identificadores públicos e caminhos de arquivos privados quando solicitados.

## 1. Preparar agora: destinos de teste e acesso

### 1.1 Asaas pessoal

- [ ] Entre na sua conta de **sandbox**, separada da produção, e confira que consegue acessar a área de integrações/API. Você já informou possuir as duas chaves; não gere outra por rotina nem substitua a atual sem necessidade.
- [ ] Confirme que a conta de produção escolhida continua sendo **pessoa física** e se o cadastro está aprovado para operar. Se houver exigência documental, resolva diretamente no painel/suporte do Asaas, sem colocar os documentos nas issues.
- [ ] Mantenha a chave sandbox e a de produção identificadas separadamente em um gerenciador privado. Não coloque a de produção na cópia de desenvolvimento ou em Preview.
- [ ] Escolha uma caixa de e-mail operacional que você acompanhará para alertas de cobrança/webhook e suporte do Asaas.

**Retorno suficiente:** “sandbox acessível; produção PF: aprovada/pendente; contato operacional definido”. Não é necessário enviar CPF, conta bancária, chave ou saldo.

Os agentes homologarão a fatura hospedada, recorrência, datas, mudança de cartão, Pix PF e boleto na T-029. Não crie assinaturas reais nem tente provocar chargeback para adiantar essa prova. A disponibilidade da chave não comprova que esses recursos atendem ao contrato. [Autenticação e ambientes oficiais](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1).

### 1.2 Banco e aplicação de homologação

- [ ] Escolha/prepare um **Supabase pessoal dedicado aos testes comerciais**, isolado do projeto principal. Um projeto novo e vazio é a opção mais simples; confira custos antes de contratar. Se houver um candidato existente, peça primeiro a inspeção de inventário, sem autorizar apagar seus dados por inferência.
- [ ] Informe apenas nome e **ref** do candidato e que ele foi reservado para homologação. Não reutilizar `rishenjoikgmfubmnfiu` como banco sandbox; não presumir reutilização de Ensaio_restore, legado, BlackSheep ou VOE.
- [ ] Disponibilize acesso pessoal autorizado aos painéis GitHub, Vercel, Supabase, Asaas e Google Cloud. Se uma conexão expirar, o agente indicará o login específico; não envie credenciais como alternativa.
- [ ] Reserve um endereço HTTPS estável para a homologação, por exemplo um subdomínio sob seu controle. Informe o nome desejado; a Frente B definirá o vínculo ao deployment e o acesso restrito ao endpoint de webhook.

**Retorno suficiente:** “Supabase de homologação: nome/ref; endereço pretendido: …; acessos pessoais disponíveis”. Não execute migrations agora. Aplicação em destino adicional exige autorização própria e revisão; OP-009 continua protegendo produção. Preview com Asaas sandbox e Supabase de produção **não** é isolamento.

## 2. Preparar agora: e-mail do aplicativo

Há prova histórica de recuperação pelo Supabase Auth. Isso não comprova envio do aplicativo antes de existir uma conta. A confirmação de e-mail **antes de cobrar** precisa de transportador próprio de servidor, sem criar Auth antecipadamente.

- [ ] Identifique o serviço pessoal já usado para SMTP/Auth. Informe somente o nome e se você administra a conta. Reutilizá-lo, se suportar envio transacional independente, evita contratar outro desnecessariamente.
- [ ] Escolha o domínio de envio, o endereço remetente, o nome “Segundo Cérebro” e uma caixa de resposta/suporte monitorada. Não usar endereço de outra operação.
- [ ] No painel do provedor, abra a verificação de domínio e copie **para o DNS do seu domínio** somente os registros que ele fornecer (SPF/DKIM e, quando orientado, DMARC). Preserve os registros existentes; não crie dois registros SPF concorrentes nem altere MX por tentativa. Aguarde o estado verificado no provedor.
- [ ] Confira se o plano permite envio de confirmação/ativação e avisos operacionais aos destinatários de teste. Separe um endereço de teste que você controla e autorize o recebimento desses ensaios, sem cadastrar clientes reais.
- [ ] Prepare acesso ao provedor e guarde a credencial em destino privado. **Espere o agente fechar o adapter e informar os nomes necessários** antes de cadastrar variáveis novas na Vercel. O SMTP no painel Supabase não precisa ser sobrescrito para isso.

**Retorno suficiente:** “provedor: …; domínio/remetente: …; DNS verificado: sim/pendente; caixa de teste disponível”. Não enviar segredo SMTP, API key, conteúdo de e-mail ou link.

O agente cria modelos, links de uso único, limites de reenvio, recuperação de falhas e coordenação dos avisos com o Asaas. A escolha aprovada é **somente e-mail**; não habilite SMS, WhatsApp ou voz para cobrir pendências. [Limites do SMTP do Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Preparar agora: oferta, atendimento e privacidade

- [ ] Defina o nome público do responsável pela oferta, contato de suporte e contato para solicitações sobre dados. Dados obrigatórios de identificação do fornecedor devem ser entregues em canal privado adequado para a publicação aprovada, não em uma issue pública por padrão.
- [ ] Informe horário/canal de atendimento e quem acompanha falha de pagamento, cobrança duplicada, correção de e-mail após pagamento e solicitações de cancelamento/reembolso.
- [ ] Providencie revisão apropriada dos termos de uso, política de privacidade e informações da oferta para operação por CPF. Inclua cobrança mensal de R$ 29,90, cancelamento, direitos do consumidor, regularização, dados compartilhados com Asaas e atribuição facultativa. Os agentes podem preparar as minutas; você aprova os textos e o atendimento antes do lançamento.
- [ ] Confirme com orientação contábil/jurídica aplicável os requisitos fiscais da operação PF e os prazos próprios de identidade, cobranças, obrigações legais e backups. **Não** usar os prazos de produto como se substituíssem essas retenções. Retorne a política revisada ou indique explicitamente o que falta.
- [ ] Reserve tempo para conferir, em canal privado, o inventário de contas atuais que permanecerão gratuitas. A T-031 apresentará o conjunto e o marco para seu aceite; não envie a lista de e-mails/UUIDs em uma issue pública nem conceda isenção por ausência de estado.

**Retorno suficiente:** contatos públicos aprovados, arquivo privado/versão das minutas e política revisada, responsável pelo atendimento e disponibilidade para conferir o inventário. Não é preciso decidir de novo as políticas D-034–D-063.

Os prazos já aprovados são: origem entre visitas e abandono até 30 dias com aceite; atribuição convertida até 12 meses ou retirada anterior; módulos até 180 dias após o fim efetivo do acesso, com aviso. A execução da limpeza e sua relação com backups ainda serão construídas e validadas. Não apagar dados para “preparar” esses critérios.

## 4. Preparar agora; concluir antes da abertura: domínio, Vercel e Google

### 4.1 Domínio e hospedagem

- [ ] Escolha/registre o domínio que deseja usar, se ainda não fez isso, e mantenha o acesso à conta do registrador/DNS. Informe domínio principal e preferência por `www` ou sem `www`.
- [ ] Para conectar, selecione o projeto Vercel **`segundo-cerebro-of`** na equipe pessoal correta, abra **Settings → Domains** e siga exatamente os registros exibidos para seu caso. Não copiar IP/CNAME de um guia antigo nem substituir registros de e-mail. Faça a troca de origem em conjunto com o agente, para preservar login, Google e links existentes.
- [ ] Programe a mudança da equipe/projeto para **Vercel Pro antes do uso comercial**, conforme D-036, revisando preço, orçamento e escopo da contratação no painel. Não migrar outra operação por engano. Comprar domínio sozinho não altera o plano.

**Retorno suficiente:** domínio escolhido, controle do DNS, HTTPS/domínio válido quando concluído e estado Pro: programado/ativo. A mudança coordenada de `APP_URL`, callbacks e links só ocorre com roteiro de execução; não trocar tudo agora por tentativa. [Adicionar domínio](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [restrição de uso do Hobby](https://vercel.com/docs/plans/hobby).

### 4.2 Google Calendar público

- [ ] Confira que tem acesso ao projeto Google Cloud pessoal da integração atual. Informe apenas o identificador público e o estado de audiência: Testing/produção/verificação pendente. As duas contas conectadas anteriormente não comprovam liberação para todos os compradores.
- [ ] Prepare um projeto OAuth de **teste separado da produção**; no teste, mantenha as duas contas autorizadas e Calendar somente leitura. Não habilitar escrita de eventos nem login social Supabase como substituto.
- [ ] Para a publicação, reúna nome/marca do aplicativo, contato de suporte, domínio que controla e endereços públicos de apresentação, privacidade e termos. Verifique a propriedade do domínio pela conta autorizada quando solicitado.
- [ ] Com o fluxo real e as páginas prontas, coordene com a Frente B os redirects exatos e a análise/verificação exigida pelo Google para os escopos usados. Prepare eventual demonstração solicitada pelo provedor. Não publique a audiência nem altere redirects de produção antes dessa conferência.

**Retorno suficiente:** projeto de teste/produção identificados, domínio sob controle e estado da verificação. A análise externa pode ter prazo próprio; não prometer data de aprovação. [Preparação oficial para produção OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## 5. Fazer depois que o agente entregar os destinos

Estas tarefas dependem de código/contratos que ainda não existem. Você não precisa adivinhar endpoints ou gerar SQL. A lista explica o que será solicitado para evitar surpresa.

| Quando | O que você faz | O que o agente precisa fornecer antes |
|---|---|---|
| Ambiente de teste definido e guardas prontos | Insere diretamente os valores sandbox no `.env.local` privado e no ambiente Vercel de teste aprovado. | Nomes, escopos por ambiente, presença/compatibilidade sem revelar valor; guia 01. Nenhum download de segredos de produção. |
| Endpoint HTTPS de homologação funcionando | Cadastra webhook **no sandbox**, com token exclusivo e eventos aprovados. | URL exata, eventos, modo de envio e roteiro de entrega; nenhum endpoint inventado neste guia. |
| Migrações novas revisadas | Autoriza/acompanha aplicação no destino exato previsto; registra resultado sanitizado. | Arquivos, ordem, diff, preflight, testes e plano de recuperação. Não reaplicar 001–019, resetar ou executar seeds. |
| Ensaios conectados preparados | Recebe e-mails e conclui links/senha/consentimento Google no navegador combinado. | Conta comum autorizada, cenário e efeito esperado; você não entrega senha ao agente. |
| Sandbox aprovado e lançamento preparado | Insere URL/chave/token de produção **somente em Production**, cadastra o webhook de produção e confirma remetentes/callbacks. | Checklist aprovado, endpoint disponível, guardas, alertas, rollback e janela combinada. |
| Aceite integrado final | Confere as telas/dados/fluxos e autoriza a abertura comercial. | Evidência por SHA, CI observado, três métodos, privacidade, suporte e pendências históricas explícitas. |

Os destinos Asaas são `ASAAS_API_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, todos exclusivos do servidor. URLs: sandbox `https://api-sandbox.asaas.com/v3`; produção `https://api.asaas.com/v3`. No exemplo versionado ficarão só os nomes. Use o [guia detalhado de chaves](01-chaves-e-ambientes.md) **quando a etapa estiver pronta**; nenhum segredo precisa passar pelo chat. Alterar variável Vercel exige novo deployment para entrar em vigor, mas não autoriza deploy, migration ou abertura por si. [Variáveis e ambientes](https://vercel.com/docs/environment-variables).

## 6. O que entregar em uma única resposta, sem segredos

Copie e preencha apenas os status disponíveis; “pendente” é um resultado válido.

```text
Asaas: sandbox acessível; produção PF aprovada/pendente; contato operacional definido.
Homologação: Supabase nome/ref reservado; domínio HTTPS pretendido; acessos pessoais disponíveis.
E-mail: provedor; domínio/remetente; DNS verificado/pendente; caixa de teste autorizada disponível.
Oferta: suporte/privacidade públicos aprovados; minutas/política de retenção revisadas ou pendentes.
Gratuidades atuais: posso conferir o inventário privado quando apresentado.
Domínio: nome escolhido; controle do DNS; conexão/HTTPS pendente ou concluído.
Vercel Pro: programado/ativo antes da abertura comercial.
Google: projetos públicos de teste/produção; audiência e verificação pendente/concluída.
Disponibilidade: posso receber e-mails, consentir OAuth e acompanhar os aceites combinados.
```

Depois dessa preparação, os agentes poderão executar as fatias autorizadas com menos interrupções. Ainda serão necessários os checkpoints humanos da seção 5 e eventuais decisões sobre capacidades não comprovadas do provedor. Nenhuma preparação substitui as validações dos tickets, nem inicia a implementação automaticamente.
