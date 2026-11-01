# Registro de tickets e dependências

25 tickets: **6 Frente A**, **7 Frente B** (incluindo preparação e aceite integrado), **12 posteriores**. IDs T-062–T-086 continuam a sequência observada no GitHub. Issues históricas preservadas, sem fechamento automático.

Fase 1: `ready-for-agent`; iniciar pelas dependências satisfeitas. Fase 2: `needs-triage` e `pos-mvp`; exige priorização posterior. Atribuição de frente é de trabalho, não um assignee GitHub inventado.

| Chave | Issue | Entrega | Frente/fase | Bloqueios técnicos | Esforço |
|---|---|---|---|---|---|
| A01 / T-062 | [#128](https://github.com/kauanbarateli/Segundo-Cerebro/issues/128) | [Simplificar landing e login com acesso gratuito coerente](tickets/T-062-A01.md) | A / 1 | Nenhum | S–M |
| A02 / T-063 | [#129](https://github.com/kauanbarateli/Segundo-Cerebro/issues/129) | [Tornar tema imediato e padronizar cabeçalho e painéis](tickets/T-063-A02.md) | A / 1 | Nenhum | M |
| A03 / T-064 | [#130](https://github.com/kauanbarateli/Segundo-Cerebro/issues/130) | [Simplificar os editores preservando rascunhos e formatação](tickets/T-064-A03.md) | A / 1 | Nenhum | M |
| A04 / T-065 | [#131](https://github.com/kauanbarateli/Segundo-Cerebro/issues/131) | [Capturar uma nota sem sair da página atual](tickets/T-065-A04.md) | A / 1 | [#129](https://github.com/kauanbarateli/Segundo-Cerebro/issues/129), [#130](https://github.com/kauanbarateli/Segundo-Cerebro/issues/130) | M |
| A05 / T-066 | [#132](https://github.com/kauanbarateli/Segundo-Cerebro/issues/132) | [Reorganizar Configurações e cards de Projetos](tickets/T-066-A05.md) | A / 1 | Nenhum | S–M |
| A06 / T-067 | [#133](https://github.com/kauanbarateli/Segundo-Cerebro/issues/133) | [Tornar a lista a única visualização do calendário](tickets/T-067-A06.md) | A / 1 | Nenhum | S–M |
| B00 / T-068 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | [Reconciliar o catálogo Supabase antes das novas migrations](tickets/T-068-B00.md) | B / 1 | Nenhum | M |
| B01 / T-069 | [#135](https://github.com/kauanbarateli/Segundo-Cerebro/issues/135) | [Criar conta por e-mail e senha e entrar gratuitamente](tickets/T-069-B01.md) | B / 1 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | L |
| B02 / T-070 | [#136](https://github.com/kauanbarateli/Segundo-Cerebro/issues/136) | [Guardar somente a origem UTM do cadastro](tickets/T-070-B02.md) | B / 1 | [#135](https://github.com/kauanbarateli/Segundo-Cerebro/issues/135) | M |
| B03 / T-071 | [#137](https://github.com/kauanbarateli/Segundo-Cerebro/issues/137) | [Consultar cadastros e origens em métricas exclusivas do Master](tickets/T-071-B03.md) | B / 1 | [#136](https://github.com/kauanbarateli/Segundo-Cerebro/issues/136) | M |
| B04 / T-072 | [#138](https://github.com/kauanbarateli/Segundo-Cerebro/issues/138) | [Enviar feedback e acompanhar o próprio histórico](tickets/T-072-B04.md) | B / 1 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | M |
| B05 / T-073 | [#139](https://github.com/kauanbarateli/Segundo-Cerebro/issues/139) | [Mostrar atualizações em quadro autenticado e versionado](tickets/T-073-B05.md) | B / 1 | Nenhum | S–M |
| B06 / T-074 | [#140](https://github.com/kauanbarateli/Segundo-Cerebro/issues/140) | [Validar a entrega inicial integrada das duas frentes](tickets/T-074-B06.md) | B / 1 | [#128](https://github.com/kauanbarateli/Segundo-Cerebro/issues/128), [#129](https://github.com/kauanbarateli/Segundo-Cerebro/issues/129), [#130](https://github.com/kauanbarateli/Segundo-Cerebro/issues/130), [#131](https://github.com/kauanbarateli/Segundo-Cerebro/issues/131), [#132](https://github.com/kauanbarateli/Segundo-Cerebro/issues/132), [#133](https://github.com/kauanbarateli/Segundo-Cerebro/issues/133), [#135](https://github.com/kauanbarateli/Segundo-Cerebro/issues/135), [#136](https://github.com/kauanbarateli/Segundo-Cerebro/issues/136), [#137](https://github.com/kauanbarateli/Segundo-Cerebro/issues/137), [#138](https://github.com/kauanbarateli/Segundo-Cerebro/issues/138), [#139](https://github.com/kauanbarateli/Segundo-Cerebro/issues/139) | M |
| P2-01 / T-075 | [#141](https://github.com/kauanbarateli/Segundo-Cerebro/issues/141) | [Entrar e criar conta com Google preservando o cadastro gratuito](tickets/T-075-P2-01.md) | posterior / 2 | [#135](https://github.com/kauanbarateli/Segundo-Cerebro/issues/135) | M–L |
| P2-02 / T-076 | [#142](https://github.com/kauanbarateli/Segundo-Cerebro/issues/142) | [Exibir detalhes e permissões reais dos eventos Google](tickets/T-076-P2-02.md) | posterior / 2 | [#133](https://github.com/kauanbarateli/Segundo-Cerebro/issues/133) | M–L |
| P2-03 / T-077 | [#143](https://github.com/kauanbarateli/Segundo-Cerebro/issues/143) | [Criar, editar e cancelar eventos Google avulsos](tickets/T-077-P2-03.md) | posterior / 2 | [#142](https://github.com/kauanbarateli/Segundo-Cerebro/issues/142) | L |
| P2-04 / T-078 | [#144](https://github.com/kauanbarateli/Segundo-Cerebro/issues/144) | [Consultar minhas tarefas ClickUp no Segundo Cérebro](tickets/T-078-P2-04.md) | posterior / 2 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | M–L |
| P2-05 / T-079 | [#145](https://github.com/kauanbarateli/Segundo-Cerebro/issues/145) | [Atualizar tarefas ClickUp e conversar nos comentários](tickets/T-079-P2-05.md) | posterior / 2 | [#144](https://github.com/kauanbarateli/Segundo-Cerebro/issues/144) | M–L |
| P2-06 / T-080 | [#146](https://github.com/kauanbarateli/Segundo-Cerebro/issues/146) | [Manter tarefas ClickUp atualizadas com a página fechada](tickets/T-080-P2-06.md) | posterior / 2 | [#144](https://github.com/kauanbarateli/Segundo-Cerebro/issues/144) | M–L |
| P2-07 / T-081 | [#147](https://github.com/kauanbarateli/Segundo-Cerebro/issues/147) | [Acessar o ADM separado com MFA e consultar contas](tickets/T-081-P2-07.md) | posterior / 2 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | M–L |
| P2-08 / T-082 | [#148](https://github.com/kauanbarateli/Segundo-Cerebro/issues/148) | [Transferir a operação administrativa e cortar os canais antigos](tickets/T-082-P2-08.md) | posterior / 2 | [#147](https://github.com/kauanbarateli/Segundo-Cerebro/issues/147), [#137](https://github.com/kauanbarateli/Segundo-Cerebro/issues/137) | L |
| P2-09 / T-083 | [#149](https://github.com/kauanbarateli/Segundo-Cerebro/issues/149) | [Responder feedbacks em privado e publicar o roadmap](tickets/T-083-P2-09.md) | posterior / 2 | [#147](https://github.com/kauanbarateli/Segundo-Cerebro/issues/147), [#138](https://github.com/kauanbarateli/Segundo-Cerebro/issues/138), [#139](https://github.com/kauanbarateli/Segundo-Cerebro/issues/139) | M–L |
| P2-10 / T-084 | [#150](https://github.com/kauanbarateli/Segundo-Cerebro/issues/150) | [Controlar liberação de funcionalidades pelo ADM](tickets/T-084-P2-10.md) | posterior / 2 | [#147](https://github.com/kauanbarateli/Segundo-Cerebro/issues/147) | M–L |
| P2-11 / T-085 | [#151](https://github.com/kauanbarateli/Segundo-Cerebro/issues/151) | [Excluir definitivamente itens da lixeira sem quebrar referências](tickets/T-085-P2-11.md) | posterior / 2 | [#134](https://github.com/kauanbarateli/Segundo-Cerebro/issues/134) | L |
| P2-12 / T-086 | [#152](https://github.com/kauanbarateli/Segundo-Cerebro/issues/152) | [Aplicar retenção automática de sete dias na lixeira](tickets/T-086-P2-12.md) | posterior / 2 | [#151](https://github.com/kauanbarateli/Segundo-Cerebro/issues/151) | M–L |

## Sequência prática

- A: A01/A02/A03/A05/A06 podem começar; A04 usa A02+A03. Coordenar A05/A06 no formulário de Configurações sem bloqueio nativo artificial.
- B: B00 prepara a linha de base; B01/B04 precisam dela para integrar banco; B02 depende de B01; B03 depende de B02 pelas dimensões UTM. B05 não precisa de migration nem de cadastro novo.
- B06 integra após A01–A06 e B01–B05. É evidência de aceite conjunto, não ticket para deixar testes de cada feature para depois.
- Posterior: Calendar leitura/capacidades antes de escrita; ClickUp leitura antes de comandos/worker (estes paralelos); ADM sessão antes de operação/corte, resposta/roadmap e releases; exclusão manual antes de automática.

Bloqueios são registrados no corpo e nas relações nativas do GitHub. Reconciliar ambos se o escopo mudar. Aresta não equivale a autorização para operar produção. Tamanho S/M/L é relativo, sem promessa de prazo.

## Verificação de duplicidade

Consultadas todas as issues (abertas/fechadas), PRs abertos e corpos/comentários de #80/#122/#125. #74 está fechada. Main inclui PR #120, enquanto certos corpos/comentários ainda descrevem pausa anterior ao merge. Novas issues delimitam as diferenças desta solicitação, conforme [mapa](04-codigo-validacao-operacao.md#relação-com-issues-e-prs-existentes). Não retomam automaticamente #52/#53 ou o PR #127.

[PR documental](https://github.com/kauanbarateli/Segundo-Cerebro/pull/153).
