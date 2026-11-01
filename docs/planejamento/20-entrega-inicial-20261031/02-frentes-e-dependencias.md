# Duas frentes, autoria e sequência

## Frente A — tarefas mais simples e independentes

A01 landing/login; A02 tema/header/painéis; A03 editores; A04 captura rápida; A05 Configurações/Projetos; A06 calendário em lista. A04 depende de A02 e A03 porque usa seus contratos de diálogo/composer. A06 é tecnicamente independente de A05: executar o trecho compartilhado de Configurações em sequência combinada, sem transformar coordenação de arquivo em bloqueio de produto.

Ler o [detalhamento visual](08-detalhamento-frente-a.md), o [mapa de código](04-codigo-validacao-operacao.md), DS e Impeccable. Preservar a base funcional; só extrair componentes quando a reutilização for necessária ao fluxo entregue. O calendário não ganha nova API por ser redesenhado.

## Frente B — fluxos novos e dados mínimos

Reconciliar a base de migrations/catálogo antes de novas alterações de banco. Entregar cadastro e-mail/senha gratuito; snapshot UTM; métricas Master; feedback privado; atualizações por conteúdo versionado. B também consolida o aceite integrado após as duas frentes. A reconciliação não bloqueia design, testes isolados ou Atualizações sem tabela nova.

A [lista de issues](05-registro-de-tickets.md) é a fonte dos bloqueios reais. Ordem numérica não cria dependência implícita. Podem-se preparar contratos e testes de tickets bloqueados, mas não integrar uma solução que dependa de um bloqueador ausente.

## Contratos entre as frentes

| Superfície | Dono | Contrato |
|---|---|---|
| Landing e login existente | A | Recebe capacidade de cadastro da composição server. Desligada: Entrar → `/entrar`; ligada: Criar conta gratuita → `/criar-conta`. Nenhum booleano de query/cookie livre autoriza cadastro. |
| Cadastro e confirmação | B | Formulário separado; validação, rate limit, e-mails, provisionamento e onboarding. Ativa o CTA somente quando o fluxo completo estiver operacional. |
| Shell/tema/overlays | A | Controla JSX/CSS, foco e mobile; opções de navegação recebem disponibilidade por composição, com falso seguro por padrão. |
| Feedback/Atualizações | B | Entrega rotas `/feedback` e `/atualizacoes`, autorização e dados reais. Libera links após os destinos funcionarem. Enviar feedback substitui Ajuda na ativação, mantendo suporte acessível e Ajuda enquanto o recurso estiver indisponível. |
| Métricas | B | `/metricas` proposta no produto atual; autorização Master no servidor, sem dar acesso a conteúdo privado de usuários. A integra o ponto de navegação seguindo o contrato existente. |
| Editor e captura rápida | A | Extração única compartilhada sem imports indevidos entre features; reutiliza protocolos de draft/comando/upload atuais. |
| Dados/RPC/adapters/Auth | B | Mantém assinatura de APIs atuais de A. Alteração incompatível exige alinhamento e migração de consumidores no mesmo PR. |
| Legais | B conteúdo funcional; A apresentação | B ajusta o texto para o tratamento realmente implementado; A mantém links/checkbox acessíveis. Um único autor edita cada arquivo por vez. |

Rotas novas são propostas deste plano, não fatos da main. Preferir reutilizar uma rota equivalente se já tiver sido integrada ao começar, registrando o desvio no mapa e nos links.

## Trabalho em paralelo sem sobrescrita

1. Conferir main, status, issues/comentários e branch certa. Não resetar WIP nem reutilizar automaticamente antigas branches de integração do PR #120.
2. Cada frente abre PRs pequenos por ticket e fixa base/commit. O outro agente incorpora contratos concluídos, sem fazer cherry-pick silencioso de trabalho incompleto.
3. A é dona de shell, editor, tema, landing, login visual e preferências existentes; B de novas features, serviços e dados. Compartilhados: rotas, autorização, docs legais e pontos de composição — coordenar explicitamente.
4. Registrar implementado, validado e pendente com SHA e comandos reais. Não fechar issues históricas de aceite por esta publicação.
5. Revisão cruzada nas fronteiras antes da integração; fluxo completo e segurança no ticket B final. Merge/deploy seguem a autorização vigente e os gates operacionais, não são consequência automática de ter terminado um ticket.

## Como usar o backlog posterior

Tickets da fase 2 ficam `needs-triage`/`pos-mvp`. Antes de iniciá-los: priorização explícita, dependências externas preparadas e nova leitura da documentação oficial dos provedores. O ADM pode avançar independentemente do ClickUp e da edição Calendar; não transformar integrações em bloqueadores administrativos artificiais. O corte do Admin antigo exige substituição comprovada de todas as operações ainda usadas.
