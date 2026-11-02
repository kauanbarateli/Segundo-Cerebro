# Providências do Kauan para preparar a implementação

Complemento ao planejamento pós-MVP de 31/10/2026. Este checklist separa o que depende do titular das contas e do produto do trabalho da frente de implementação. As 17 decisões já respondidas continuam valendo; não é necessário responder outro questionário.

**Supabase conectado e catálogo auditado. Os próximos preparativos são ambiente de testes, domínio/DNS, Google Cloud e envio de e-mails.** Essas providências podem avançar enquanto a equipe trabalha nas telas. Um serviço ainda não conferido não significa que precise ser contratado ou criado novamente: reaproveite o que já existe.

## Preparar agora

### 1. Acessos e ambientes

- [ ] Confirmar acesso ao repositório `kauanbarateli/Segundo-Cerebro` e ao projeto/equipe corretos na Vercel. A conta Pro já foi informada; falta apenas a conferência operacional do projeto pela frente.
- [x] Conectar o MCP ao projeto **pessoal** rishenjoikgmfubmnfiu e autorizar a leitura estrutural. Auditoria concluída no [doc 16](16-auditoria-supabase.md); nenhuma estrutura dedicada de UTM localizada no catálogo pesquisado. A reconciliação 5/27 fica com a equipe.
- [ ] Identificar a URL e o Supabase do ambiente de testes. Se ainda não existir, registrar isso para a equipe preparar um ambiente separado.
- [ ] Registrar os planos em uso e o responsável por aprovar eventuais custos de banco, e-mail e execução de jobs. A equipe dimensiona o consumo antes de sugerir contratações.
- [ ] Indicar o local protegido das credenciais necessárias. Usar convites/permissões quando disponíveis; não colocar senhas, tokens ou códigos de recuperação neste arquivo ou no chat.

**Pronto quando:** a frente identifica produção e testes e consegue inspecionar os metadados do projeto correto. Você não precisa executar SQL ou criar tabelas.

### 2. Domínio e novo ADM

- [ ] Ter acesso ao provedor DNS de `segundocerebroapp.com.br` ou identificar quem pode alterá-lo.
- [ ] Conferir qual endereço já é o principal do produto, com ou sem `www`, preservando os redirecionamentos existentes. A documentação usa `www`; a configuração efetiva precisa ser conferida.
- [ ] Deixar o responsável disponível para configurar `adm.segundocerebroapp.com.br`, endereço já escolhido.

**Pronto quando:** a equipe sabe quem administra o DNS e tem acesso à hospedagem. O destino DNS será fornecido depois de preparar o deployment administrativo. Não é preciso comprar outro domínio nem adivinhar IP/CNAME.

### 3. E-mails de cadastro e recuperação

- [ ] Identificar o serviço de envio transacional existente. Se não houver, selecionar um provedor compatível com SMTP e conferir o custo antes de contratar.
- [ ] Confirmar o remetente das mensagens e o acesso à caixa `suporte@segundocerebroapp.com.br`, já documentada no projeto.
- [ ] Deixar o responsável pelo DNS disponível para os registros de autenticação fornecidos pelo serviço de e-mail.
- [ ] Disponibilizar as credenciais SMTP pelo local protegido combinado.

**Pronto quando:** provedor, remetente e responsável estão definidos. A equipe configura o Supabase e comprova confirmação de cadastro e recuperação de senha em caixas de teste. O SMTP padrão do Supabase é limitado e não é indicado para produção; possuir uma caixa de suporte não equivale a ter envio transacional configurado. [Documentação oficial](https://supabase.com/docs/guides/auth/auth-smtp).

### 4. Google Cloud e verificação

- [ ] Identificar os projetos Google Cloud atuais, quem os administra e o status da verificação OAuth: teste, produção, em análise ou pendente.
- [ ] Garantir acesso do titular ao Google Cloud e à propriedade do domínio no Search Console; verificar o domínio se ainda estiver pendente.
- [ ] Separar os materiais existentes: nome Segundo Cérebro, logo aprovada, suporte, contato de desenvolvimento e URLs públicas da landing, Termos e Privacidade.
- [ ] Disponibilizar duas contas Google de teste controladas por você/equipe, com calendários sem compromissos pessoais reais. Cada pessoa mantém sua própria senha.
- [ ] Acompanhar as solicitações de revisão do Google quando houver submissão.

**Pronto quando:** projetos, responsáveis e materiais estão disponíveis. A equipe define a separação entre login e Calendar e configura APIs/clientes/escopos. Login e acesso à agenda são autorizações distintas. Marca e domínio fazem parte do processo de verificação. [Google OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Google no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

**Aguardar a equipe:** URLs finais, escopos efetivamente usados e fluxo demonstrável antes da submissão que exige essas evidências. Trocar o status para produção não comprova aprovação. Não substituir os clientes que já funcionam antes do inventário técnico.

### 5. ClickUp

- [ ] Confirmar uma conta de proprietário ou administrador do Workspace para criar o aplicativo OAuth. Essa exigência é do ClickUp. [Documentação oficial](https://developer.clickup.com/docs/authentication).
- [ ] Separar um Workspace ou área de testes autorizada, com tarefas fictícias e duas identidades para verificar responsabilidades e subtarefas.
- [ ] Identificar quem criará o app OAuth com a equipe e guardará as credenciais no local protegido.

**Pronto quando:** conta habilitada e área de testes estão disponíveis. A criação do app exige uma URL de retorno: aguarde a equipe confirmar o endereço por ambiente. Não é necessário distribuir seu token pessoal aos usuários do produto.

Prepare tarefas e subtarefas com responsáveis diferentes e status variados. Não é necessário contratar um plano superior do ClickUp antecipadamente; a equipe verificará os limites efetivos.

### 6. Administração e suporte

- [ ] Confirmar a identidade da conta Master que você usará no ADM, reaproveitando a atual quando adequado.
- [ ] Ter acesso ao seu aplicativo autenticador. O cadastro e a prova de recuperação do MFA serão feitos quando o novo fluxo estiver implementado.
- [ ] Reservar disponibilidade para testar entrada, gestão de contas, respostas de feedback e recuperação administrativa.
- [ ] Identificar um canal que você já acompanhe para receber alertas operacionais; a equipe configura os alertas compatíveis com o ambiente.

**Pronto quando:** existe um operador identificado e um canal de contato. A equipe prepara e ensaia a contingência antes de desativar o Admin antigo. Não é necessário criar outro operador ou compartilhar a conta Master.

### 7. Validação do plano e materiais do produto

- [ ] Validar o planejamento consolidado para iniciar a implementação. Beta gratuito, ausência de preço, e-mail/Google, ADM, feedback e lixeira já estão definidos no [registro de decisões](02-decisoes-confirmadas.md).
- [ ] Conferir com a equipe os limites técnicos propostos antes de ativar aquisição/UTM: janela de 30 dias, até 100 eventos por jornada, retenção de 12 meses após cadastro verificado e atividade individual de 90 dias. São propostas do [doc 10](10-utm-metricas-e-jornada.md), não perguntas de produto a repetir.
- [ ] Revisar Termos e Privacidade quando a equipe entregar a minuta correspondente aos recursos implementados.
- [ ] Se já houver campanhas, separar links UTM de exemplo sem dados pessoais para validar a cronologia. Não é necessário criar campanhas novas.
- [ ] Opcional: selecionar os primeiros itens publicáveis do roadmap. O quadro também pode começar com um estado vazio adequado.

**Pronto quando:** a execução tem o plano validado e um responsável pela revisão dos textos e da coleta. Preparar acessos não ativa serviços, publica alterações ou exclui dados.

## Resolver com a equipe quando a implementação estiver pronta

| Providência | Sua participação | Entrega prévia da equipe |
| --- | --- | --- |
| Domínio do ADM | Disponibilizar DNS ou aplicar registros fornecidos | Deployment, valores DNS exatos e validação HTTPS |
| OAuth Google e ClickUp | Operar o console quando necessário e guardar credenciais | Matriz de ambientes, clientes, URLs de retorno e escopos |
| Verificação Google | Revisar dados do titular, submeter e acompanhar | Fluxo demonstrável, políticas, justificativas e vídeo quando exigido |
| Cadastro público | Conferir entrada e comunicação | SMTP testado, onboarding e operação administrativa disponíveis |
| Corte do Admin antigo | Testar entrada e recuperação no novo ADM | MFA, contingência, gestão básica e corte seguro |
| Purga e UTM | Conferir os efeitos e a comunicação previstos | Testes, transição de sete dias, retenção e consentimento implementados |
| Publicação | Validar candidato e momento conforme autorização vigente | Evidências de testes, custos operacionais e roteiro de reversão |

A equipe pode executar configurações quando já tiver acesso autorizado. Sua intervenção fica nos atos que exigem titularidade, autenticação ou decisão sobre gastos. A aprovação de OAuth depende do Google.

## Ficha para encaminhar à frente

Preencha somente o que ainda não estiver documentado. Informe onde o acesso está disponível, sem copiar credenciais.

| Informação | Preencher ou confirmar |
| --- | --- |
| Projeto/equipe Vercel | A confirmar |
| Planos atuais e responsável por custos | Conferir serviços existentes |
| Supabase de produção e acesso de metadados | rishenjoikgmfubmnfiu — MCP autenticado, catálogo auditado |
| URL e Supabase de testes | A confirmar; indicar se não existe |
| Provedor DNS e responsável | A confirmar |
| Host principal do produto | Conferir com/sem `www` |
| Domínio administrativo | `adm.segundocerebroapp.com.br` — definido |
| Projetos Google e verificação | A confirmar |
| Serviço SMTP e remetente | A confirmar; reaproveitar existente |
| Suporte | `suporte@segundocerebroapp.com.br` — conferir acesso |
| Área de teste ClickUp e responsável OAuth | A confirmar |
| Identidade Master e canal de alertas | Confirmar por canal privado |
| Contas de teste | Identificar responsáveis, sem senhas |
| Local protegido das credenciais | Informar local e quem tem acesso |

## Trabalho que fica com a equipe

Implementação, migrations, inspeção técnica do UTM, callbacks, criptografia, tarefas agendadas, testes e documentação de liberação. Você não precisa gerar manualmente chaves de aplicação, escrever SQL ou configurar jobs sem o roteiro técnico.

Não há preparação de Apple, checkout, gateway de cobrança, preço ou contratação de assinatura nesta etapa. Os ajustes de layout podem avançar enquanto as integrações são preparadas; UTM indisponível não bloqueia cadastro. Não é necessário reenviar logos, protótipos e decisões já presentes no pacote.

Referências internas: [integrações](06-integracoes-e-google-cloud.md), [ADM separado](09-administracao-separada.md), [UTM e métricas](10-utm-metricas-e-jornada.md), [condições de liberação](12-riscos-operacao-e-liberacao.md). Nenhum acesso, serviço ou DNS foi alterado para produzir este checklist.

Após a conexão, falta conferir o plano/configuração de Auth do Supabase, o ambiente de QA e backups/recuperação. O advisor informa proteção contra senhas vazadas desativada; a equipe verifica disponibilidade no plano e propõe a configuração. Sua conta Vercel Pro não determina o plano Supabase. A auditoria não exige que você execute SQL ou repita a autorização já concluída.

