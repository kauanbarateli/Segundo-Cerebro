# Riscos, pré-requisitos operacionais e liberação

As escolhas de produto da rodada única estão resolvidas. Permanecem conferências técnicas e externas; não são novo questionário nem autorização para implementar.

## Registro de riscos

| ID | Risco / evidência | Tratamento e condição de liberação | Responsável na execução |
| --- | --- | --- | --- |
| R01 | Catálogo inspecionado, mas histórico registra cinco das 27 migrations; patch PT409 fora da cadeia original | Reconciliar proveniência/ledger e expectativa de release antes de schema novo; não reaplicar as 22 sem registro | Dados/operação |
| R02 | Código e instruções históricas contêm estados anteriores ao merge | Fixar SHA de trabalho e reconciliar diff/ADRs; preservar evidências antigas como históricas | Integrador |
| R03 | Cadastro aberto sem suporte, confirmação ou controle de abuso | F01/F02, SMTPQA, moderação e ADM/contingência operantes antes da abertura | Auth+operação |
| R04 | Mudança de acesso libera feature em API enquanto UI a esconde | Matriz servidor/RLS/entitlement/disponibilidade; defaults restritos para novas, migração explícita das antigas | Core+Dados |
| R05 | Desligar Admin abandona operações incertas ou únicoMaster | Inventariar saga, validar nova sessãoMFA e contingência, depois cortar canais antigos | ADM |
| R06 | Subdomínio tratado como fronteira suficiente | Dois deployments, cookies próprios, origem/CSRF, autorização por ator/sessão no servidor/RPC | Segurança+ADM |
| R07 | Purga apaga dados ativos/referenciados ou permite replay | InventárioFK, corrida, tombstones, carência e provaSQL/Storage; flag off até aceite | Dados |
| R08 | Cobrança futura ou7 dias comunicados como bloqueio real | Copy de beta explícita; sem preço/checkout; teste de expiração sem perda de acesso | Produto+Auth |
| R09 | Publicação Google não remove alertas sem verificação correta | Conferir branding/scopes/domínio e resultado real do console; nenhuma promessa de prazo | OperaçãoGoogle |
| R10 | Revogação Calendar afeta login no mesmo projetoGoogle | Separação recomendada de projetos/usos ou contrato explícito de reconsentimento; teste de desconexão | Integrações |
| R11 | Edição externa duplicada ou conflito silencioso | Intenções/idempotência, etagGoogle, reconciliação ClickUp; retry de comentário nunca cego | Integrações |
| R12 | “~5 min” supera quotas/volume ou job não roda | Fila, backoff, orçamento, atraso visível e prova de execução; meta não é SLA | Integrações+operação |
| R13 | Jornada individual ultrapassa finalidade histórica | Registrar ampliaçãoQ15 e aviso/consentimento; cincoUTMs+marcos próprios, limites, retirada e retenção proposta | Produto+Dados |
| R14 | Métricas contam jobs, login ou sessão como uso | Definição versionada e fixtures; separar cadastros, verificados e ativos; não rotular online | Métricas |
| R15 | Reuso de primitives quebra Cofre/editor/Financeiro | Testar foco/rascunho/CAS/reveal/overlay e regressões por consumidores, sem alterar domínio | Frontend |
| R16 | Feedback publicado expõe reclamações/identidade | DTOs privados, publicação editorial explícita e teste de acesso cruzado | Feedback+ADM |
| R17 | Novas funcionalidades colidem com trabalhoPWA do PR #127 | Coordenar fronteiras; retirar card de instalação não remove runtime PWA/offline | Integrador |

## Checklist de ambiente — sem valores secretos

| Item | Informação a registrar | Estado desta análise |
| --- | --- | --- |
| Main/candidato | SHA, diff, branches de outras frentes e destino de release | Base `bd35288` reconferida; candidato futuro |
| Banco de produção/QA | Ref correto, catálogo, migrations e permissões de leitura/aplicação | Produção auditada em leitura; 67 tabelas, reconciliação 5/27 pendente. QA não consultado |
| Domínio do produto | Host canônico com/semwww, redirectsHTTPS, políticas públicas | Documentado no repo; alcance público não confirmado pelo leitorweb |
| Domínio ADM | DNS, TLS, deployment, origin/callback e acesso Master/MFA | Apenas proposto; não criado |
| SMTP | Fornecedor/remetente verificado, limites e confirmação/recovery | Não conferido no serviço; caixa de suporte não provaSMTP |
| Google | Projetos poruso/ambiente,API,OAuthclients,redirects,scopes,verificação,quotas | Código/documentação lidos; console não alterado |
| ClickUp | AppOAuth e dono autorizado,workspaceQA,limites e credenciais emvault | Nova integração planejada |
| Schedulers | Cadastro, frequência, autenticação, saúde, falha, budgets e operador | Cron onboarding */15 confirmado, 96/96 sucessos em 24h; novos jobs e executores externos não comprovados |
| Políticas | Texto versionado correspondente a cadastro, integrações, feedback, aquisição e exclusão | Revisão exigida antes de ativar finalidades novas |
| Retenção/backups | Prazos reais do fornecedor e mecanismo de não ressurreição | Não verificado; não inferir da regra7 dias |

## Parâmetros técnicos propostos para validação do plano

Os docs07/10 propõem início da avaliação na primeira sessão verificada, job de purga horário, limites de texto de feedback, coleta de aquisição30 dias/até 100 eventos, retenção de jornada12 meses desde cadastro e atividade individual90 dias. São recomendações para esta nova entrega, claramente distintas das respostas humanas. Rever os números se a medição real de volume/infraestrutura exigir; alterações de finalidade, retenção ou escopo devem ser documentadas antes da ativação.

Ciência legal, prova mínima de retirada e retenção de agregados precisam de tabela de dados operacional coerente com finalidades e fornecedores. Sem essa definição, não conservar campanhas/dados pessoais indefinidamente: cumprir os limites individuais e bloquear exportação/agregado que não tenha sido qualificado. A revisão jurídica da nova finalidade não é substituída por este plano técnico.

## Gates por liberação

1. **G0 — Plano:** mantenedor valida escopo, propostas técnicas e divisão. O documento atual não implementa nada.
2. **G1 — Código:** revisão de diffs/camadas, testes de risco e documentação atualizada; scanner sem segredos.
3. **G2 — Schema:** conferência de destino e catálogo, migrations aditivas revisadas e aplicação supervisionada em QA. Não usar CI/build/deploy como executor de schema.
4. **G3 — Integração:** efeitos reais em QA e callback/consentimento/verificação corretos; prova de dois usuários e acesso administrativo separado.
5. **G4 — Corte:** domínioADM/contingência comprovados, canais antigos desativados, inventário de flags, compatibilidade de dados e rollback.
6. **G5 — Produção:** reconferir autorização vigente, destino e candidato; aplicar schema quando especificamente autorizado e registrar evidência. Preview/contaVercelPro não dispensa checks nem aprova toda operação de dados.

Não existe dependência de cobrança para abrir beta. UTM indisponível ou recusado nunca bloqueia cadastro; se uma liberação parcial ocorrer antes da coleta, a ficha apresenta ausência e não reconstrói o passado. Feedback só promete acompanhamento quando seu canal de gestão já funciona.

## Reversão por frente

- **Visual:** reverter componentes/styles do candidato sem desfazer contratos ou dados produzidos posteriormente.
- **Cadastro:** desligar novos cadastros por flag/servidor, manter login/recovery e contas criadas. Não apagar identidades para “voltar ao estado anterior”.
- **ADM:** manter contingência e negar canais antigos. ReabrirAdmin no host do produto exige decisão explícita; não fazer rollback automático que ressuscite endpoints antigos.
- **Disponibilidade:** suspender feature sem apagar dados, preservar jobs de limpeza/reconciliação necessários e avisar estado. Não converter preferência em autorização.
- **Calendar/ClickUp:** impedir novas escritas/sync por flag, preservar recibos e operações incertas para conciliação. Revogar tokens/desconectar é ação própria, não consequência silenciosa de rollbackde UI.
- **Purga:** pausar executor e investigar; dados já definitivamente removidos não são restaurados automaticamente. Preservar prova mínima e tombstones.
- **Feedback/UTM:** pausar nova coleta/escrita quando necessário, cumprir retenção/retirada e impedir exposição; não apagar logs de operação que comprovam incidente sem procedimento próprio.

## Entrega e coordenação

Separar PRs por fronteira no [backlog](14-backlog.csv). Os IDsFxx deste pacote não são números de issues GitHub. Antes de abrir issue nova, pesquisar duplicatas e relacionar o planejamento existente; não fechar tickets anteriores por herança de um plano. Publicação em GitHub não foi solicitada nesta rodada local e não foi executada.

Registrar alterações de decisões em docs de planejamento/ADRs e atualizar `PRODUCT.md`, `DESIGN.md`,CONTEXT e briefs que ainda descrevem acesso fechado,Calendar readonly ouAdmin no produto. Evitar trocar a história antiga por afirmações de implementação; ligar as versões e estados novos.

Auditoria 1.2: a pendência de conectar o Supabase foi concluída. Permanecem Auth completo/SMTP/backup/QA e configuração efetiva de schemas expostos. Planejar correção das quatro policies Calendar e da proteção de senhas quando disponível no plano Supabase, preservando os fechamentos intencionais. O [doc 16](16-auditoria-supabase.md) é a referência de estado e limites.

