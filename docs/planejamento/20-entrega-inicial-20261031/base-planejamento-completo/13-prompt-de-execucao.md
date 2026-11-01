# Prompt para a frente de implementação

Copie o bloco abaixo **após a validação deste planejamento pelo mantenedor**. Ele não autoriza iniciar código por apenas existir neste arquivo.

```text
Assuma a implementação da evolução pós-MVP do Segundo Cérebro após confirmar que o mantenedor validou este planejamento. Se essa validação ainda não consta da conversa, leia os arquivos e apresente o ponto de início; não inicie alterações do produto.

Repositório: git@github.com:kauanbarateli/Segundo-Cerebro.git
Pacote local:
D:\USUÁRIOS\Kauan\TRABALHO\CÉREBRO - STARTUP (SEGUNDO CÉREBRO)\04 - Evolução e Entrega\Planejamento pós-MVP - 2026-10-31

Comece por README.md, 02-decisoes-confirmadas.md, 05-plano-executivo.md e 16-auditoria-supabase.md. Use evidencias/supabase e anexos/auditoria-supabase para a base remota; 15-providencias-do-mantenedor.md já registra a conexão Supabase concluída. Consulte 01-diagnostico-e-cobertura.md, 06-integracoes-e-google-cloud.md, 07-dados-seguranca-e-retencao.md, 08-plano-visual-e-fluxos.md, 09-administracao-separada.md, 10-utm-metricas-e-jornada.md, 11-testes-e-criterios-de-aceite.md e 12-riscos-operacao-e-liberacao.md. Use 14-backlog.csv como divisão em frentes F01–F13 e referencias/README.md para as capturas. 03-lacunas-rodada-unica.md e insumos-*.md são históricos: as decisões atuais prevalecem.

A base analisada foi main em bd35288404c493d1b03f7a1a0208f808cc2079a2, que incorporou o PR #120. Atualize a referência remota e compare o estado atual antes de editar. Não sobrescreva trabalho de outra frente. Leia AGENTS.md, CONTEXT.md, ADRs e decisões operacionais vigentes; preserve Core independente, fronteiras entre features, RLS, eventos atômicos e idempotência. Use Impeccable seguindo a identidade existente e o plano visual, sem escolher outra paleta ou apagar estados úteis de erro/conflito.

Decisões fechadas:
- Cadastro e-mail e Google; Apple depois. Avaliação de 7 dias seguida de beta gratuito enquanto cobrança não estiver pronta. Contas antigas preservam gratuidades. Sem preço, cobrança ou checkout nesta entrega.
- Captura rápida com texto/imagens atuais. Reorganizar controles do editor, sem inventar novos tipos de Página ou suporte a PDF.
- Lixeira 7 dias para tarefas, capturas e páginas; itens antigos recebem 7 dias de transição. Preservar arquivados, referências, imagens compartilhadas e idempotência ao purgar.
- Calendário somente em lista; modo leitura ou leitura/edição. Avulsos completos primeiro, recorrências só leitura/link Google. Avisar sobre envio a convidados antes de confirmar.
- ClickUp em seção própria de Tarefas; minhas tarefas/subtarefas não concluídas, pai autorizado só contexto; status/descrição/comentários, sem Chat/DM. Atualização ao abrir, manual e em fundo com meta ~5 min sujeita a quotas.
- Feedback com categoria/texto, retorno no app, privado, retenção 12 meses após encerramento; roadmap somente autenticado e publicação editorial.
- Planejar e implementar o novo ADM como aplicação/deploy separado em adm.segundocerebroapp.com.br. Gestão de usuários, sugestões/respostas, liberação controlada de funcionalidades, métricas e ficha de aquisição. “Alunos” significa contas do produto, sem LMS.
- Desativar página/APIs Admin antigas somente depois de validar substituto e contingência, preservando saga, dados e último Master. Hostname não é autorização: cookies/sessão próprios, MFA e validação no servidor/RPC. Novas funcionalidades começam fechadas e autorização deve valer além da navegação.
- O Supabase pessoal foi auditado pelo MCP: 67 tabelas esperadas com RLS, mas só cinco registros para 27 migrations no Git. Antes de schema novo, reconcilie proveniência e ledger sem reaplicar as 22 ausentes automaticamente. A consulta de release fez 2.512 verificações e retornou uma divergência: onboarding_call corresponde ao patch operacional PT409 com CRLF; preserve a correção e atualize a expectativa formal, sem falsificar ok=true. UTM não tem coletor no código ou estrutura dedicada localizada no catálogo pesquisado. Implemente como novo domínio consentido após a reconciliação; não invente passado nem consulte conteúdo pessoal para esta preparação.
- Preserve os 36 fechamentos intencionais de RLS sem policy. Trate o aviso de senhas vazadas conforme o plano Supabase e otimize as quatro own_read Calendar sem mudar autorização. Cron de onboarding comprovado não equivale a purga da lixeira ou worker ClickUp. Auth/SMTP, Data API exposta, backup/PITR, QA e fluxos completos permanecem a validar.
- Jornada de aquisição é consentida e limitada ao funil próprio, com cinco UTMs e domínio de origem, sem fingerprint/histórico externo/captura de conteúdo. Nova leitura individual no ADM substitui o limite histórico de agregados apenas no escopo explicitado no doc 10. Ausência de consentimento/dados nunca impede cadastro e nunca deve ser preenchida com história inventada.

Execute incrementalmente conforme F01–F13, com ownership dos contratos compartilhados. F01 e ADM/contingência sustentam a abertura; mudanças visuais independentes podem avançar em paralelo. Não confunda construir uma tela com concluir integração, publicar OAuth ou executar scheduler.

Para cada frente: identificar diagnóstico atual, diff proposto, contratos/migrations, testes de risco, evidências por SHA/ambiente e pendências externas. Teste os cenários do doc 11; não copie números de CI do PR 120 como novos resultados. Meça recursos antes de suítes pesadas e use execução serial quando necessário. Capturas novas devem usar dados sintéticos e registrar tema/largura.

Aplicação de schema segue autorização específica e conferência de destino pessoal, nunca CI/build/deploy/reset/seeds. Não acessar projetos de terceiros, segredos, conteúdo do Cofre ou dados pessoais para testes. Configuração de Google/ClickUp/SMTP/DNS e release depende dos respectivos gates. Não publicar mensagens/comentários de teste em tarefas de pessoas reais.

Antes de criar issues/PRs, conferir os existentes e a autorização de publicação da execução. Os IDs Fxx do pacote são frentes locais, não issues GitHub. Mantenha PRs revisáveis por fronteira; não realizar merge, deploy, cobrança ou exclusão real apenas porque este prompt menciona a ação. Use a autorização vigente e os gates de cada operação.

Ao terminar, entregue links dos diffs/arquivos, comportamento demonstrado, testes realmente executados, configuração ainda pendente e roteiro de liberação/reversão. Se um serviço estiver inacessível, conclua a parte independente e registre a limitação factual; não invente aceite de produção.
```

Referências GitHub fixadas: [base analisada](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2), [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120), [planejamento existente](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento), [PR #127 para coordenação PWA](https://github.com/kauanbarateli/Segundo-Cerebro/pull/127). Este pacote novo ainda é local; não há links fictícios de issues ou PR para ele.
