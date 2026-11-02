# Decisões confirmadas — 31/10/2026

Estado: **entrevista concluída — 17 respostas recebidas**. Este registro documenta decisões de escopo; o planejamento consolidado será apresentado para validação. Não autoriza implementar, migrar banco, publicar ou alterar serviços.

| ID | Pergunta | Resposta do mantenedor | Consequência para o planejamento |
| --- | --- | --- | --- |
| DEC-01 | O que ocorre após os 7 dias enquanto a cobrança não estiver pronta? | Manter acesso gratuito durante o beta. | Não bloquear módulos nem criar cobrança automática ao fim do teste. Diferenciar período de avaliação e continuidade gratuita do beta. A futura conversão paga exige comunicação e consentimento próprios. |
| DEC-02 | Como ficam as contas existentes? | Preservar as gratuidades existentes. | Não iniciar novo prazo restritivo nem converter contas antigas em assinaturas. Preservar vetos de segurança e moderação já existentes. |
| DEC-03 | Quais provedores entram no primeiro cadastro aberto? | E-mail e Google primeiro; Apple depois. | Planejar o cadastro aberto e o login Google nesta entrega. Apple recebe estudo de viabilidade e pré-requisitos, sem bloquear o lançamento. |
| DEC-04 | Mostrar R$ 29,90 enquanto não existe cobrança? | Não mostrar preço por enquanto. | Landing sem preço, checkout ou contratação; comunicar teste de 7 dias e continuidade gratuita no beta. A proposta Asaas anterior permanece histórica/futura. |
| DEC-05 | Como retirar Admin? | Desativar página e APIs após preparar contingência operacional. | Retirar navegação e negar acesso aos canais antigos no host do produto, inclusive URL direta. Preservar mecanismos de domínio, dados e reconciliação; executar corte somente depois de validar acesso administrativo substituto e contingência. |
| DEC-06 | Formatos de captura rápida? | Texto e imagens atuais. | Reutilizar pipeline e limites existentes; PDF, documentos, áudio e reativação de Drive ficam fora. |
| DEC-07 | Novos tipos em Conhecimento? | Reorganizar controles existentes. | Não criar novo tipo unificado nem mudar os modelos Captura/Página por causa do layout. |
| DEC-08 | Alcance da lixeira 7 dias? | Tarefas, capturas e páginas na lixeira. | Arquivados não expiram; restauração antes do limite interrompe purga; nova exclusão inicia novo prazo. Exclusão de subárvore e referências têm contrato próprio no plano. |
| DEC-09 | Itens antigos na ativação? | Conceder 7 dias de transição. | Preservar data original; calcular elegibilidade considerando marco de ativação. Nenhuma purga retroativa imediata. |
| DEC-10 | Edição Calendar inicial? | Avulsos completos primeiro. | Criar/editar/cancelar avulsos, incluindo dia inteiro, participantes, descrição e Meet. Séries/ocorrências recorrentes ficam em leitura com link Google. Aviso explícito antes de enviar mudanças aos convidados. |
| DEC-11 | ClickUp na experiência? | Seção própria em Tarefas e comentários. | Espelho identificado e separado de tarefas nativas; editar status/descrição e comentar; Chat/DM não entra. |
| DEC-12 | Subtarefa minha sob pai de terceiro? | Pai como contexto; só meus itens acionáveis. | Mostrar contexto apenas se autorizado pela API. Não carregar subtarefas de terceiros como tarefas próprias. |
| DEC-13 | Cadência ClickUp? | Ao abrir, manual e fundo em aproximadamente 5 minutos. | Meta sujeita a quotas/volume; mostrar atualização real, agendar trabalho e reconciliar perda de responsabilidade/conclusão. Webhooks não são requisito do primeiro lote. |
| DEC-14 | Visibilidade roadmap/feedback? | Roadmap autenticado; feedback privado. | Pedidos/respostas visíveis ao autor e operador autorizado; cards selecionados sem dados pessoais acessíveis aos usuários conectados. |
| DEC-15 | Operação administrativa? | Planejar ADM separado em adm.segundocerebroapp.com.br. | Amplia o escopo original: contas/usuários, sugestões/respostas, liberação de módulos, métricas de uso/cadastro e ficha com cronologia de aquisição. Verificar UTM existente e planejar implementação se ausente. |
| DEC-16 | Feedback inicial? | Categoria, texto e retorno no app. | Sem anexos, mensagens externas automáticas ou notificações por e-mail nesta frente. |
| DEC-17 | Retenção feedback encerrado? | 12 meses após encerramento. | Tratar exclusão da conta separadamente; roadmap sanitizado pode continuar. Pedidos em tratamento não expiram por uma regra de encerramento. |

Respostas recebidas no questionário desta conversa em 31/10/2026. A única rodada consolidada foi respondida integralmente. O documento 03 é histórico da entrevista, não uma lista de pendências atuais.

## Ampliação explícita em DEC-15

O pedido mais recente substitui o adiamento integral da nova administração que constava no escopo original. Planejar uma aplicação separada para administração, vinculada ao produto pelos contratos autorizados, sem expor seu conteúdo pessoal. “Alunos” é tratado neste pacote como **Usuários/contas da plataforma**, porque o código e o pedido não definem cursos, matrículas ou uma área educacional. Não criar um domínio de ensino por inferência.

A cronologia individual de UTM também amplia o planejamento anterior, que previa primeiro/último toque e relatórios administrativos agregados. A nova ficha não autoriza rastrear outros sites, recuperar navegação anterior ao consentimento nem tratar parâmetros UTM como prova de identidade. A extensão, seus limites e sua retenção proposta estão no documento 10.

## Forma de trabalho confirmada

- Entregar os arquivos na pasta de documentação indicada pelo mantenedor.
- A rodada única foi concluída; não abrir novo questionário para decisões técnicas rotineiras. Recomendações técnicas são marcadas nos documentos e poderão ser revisadas na validação do plano.
- Não implementar mudanças do aplicativo nesta fase.
- Apresentar o planejamento consolidado para validação após as respostas essenciais.

## Precedência

O escopo anexado e estas respostas descrevem a evolução desejada. O código da `main` registra a implementação observada, e os ADRs anteriores continuam sendo referências históricas a reconciliar. A documentação local consolidada em 16/10/2026 não deve ser usada como prova de ausência de funcionalidades adicionadas pelo PR #120.
