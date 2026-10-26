# Onboarding — cadência v2 na homologação, 26/10/2026

**OBSERVADO:** os percursos reais de dias específicos, diário e meta semanal passaram no Preview isolado de Source `5862ab6cae76d33b5d5c35a40f22a0de9536e973`, árvore `1c519ce5c46a2fd0846d83306b74c3bdc1de64a7`, deployment `dpl_9Sx5hjEJVZNyrrn7MeG2c9gNccZr`, Supabase pessoal `twrydxsdemaykgvdlpyd`. Foi usada a sessão comum e descartável de QA criada pelo mantenedor. Não houve novo login, acesso à produção, Master, migration ou SQL de escrita.

## Percurso verificado

1. Retomada da etapa Google com as duas conexões somente leitura já existentes; nenhum consentimento, seleção de calendário, sincronização ou leitura de eventos foi acionado.
2. Preparação do hábito sintético `QA cadência doc18 26-10`, frequência **Dias específicos**, segunda e sexta. Nenhum projeto, tarefa, caderno ou página novo foi escolhido.
3. Salvamento, recarga, retorno e edição: nome, frequência e os dois dias permaneceram. O resumo continha somente o hábito e a indicação das conexões já efetivadas.
4. Consulta somente leitura antes da conclusão: um perfil QA exato, um marcador no rascunho, uma frequência v2 `[1,5]` e **zero hábitos com esse nome**. Preparar o rascunho não criou o registro de domínio.
5. Um único acionamento de **Preparar meu espaço**: a tela informou uma escolha confirmada. A consulta independente encontrou exatamente um hábito, evento, recibo e intenção confirmada vinculados; os parâmetros temporários foram removidos e não restou permit de escrita.
6. Recarga da rodada concluída: o resultado permaneceu confirmado. A segunda consulta devolveu os mesmos contadores, sem duplicação. Não se usou **Configurar outra vez**, que iniciaria uma rodada distinta.

O primeiro filtro SQL empregou um nome de perfil transcrito sem o espaço antes da data e devolveu zero perfis/zero hábitos. Root interrompeu essa conferência, leu o nome exato no formulário de Configurações e só então fez a consulta correta; não houve busca aproximada, enumeração de contas ou flexibilização do filtro. Nenhum e-mail, UUID de usuário ou conteúdo de agenda integra a evidência publicada.

## Segunda rodada — diário e meta semanal

Root iniciou explicitamente uma rodada nova, vazia, e pulou nome, projeto, tarefa, notas e outros espaços. Preparou somente `QA meta semanal doc18 26-10` (três vezes por semana) e `QA diário v2 doc18 26-10` (todos os dias). O resumo mostrou esses dois itens e suas frequências. A consulta anterior ao commit encontrou duas escolhas v2 na mesma rodada e zero registros de domínio com os dois marcadores; o hábito anterior `[1,5]` continuava único.

Um único acionamento de Preparar meu espaço confirmou as duas escolhas. A espera curta do navegador por heading venceu antes do retorno; Root leu o estado real sem clicar novamente e encontrou a confirmação. Depois e após recarga, cada marcador tinha exatamente um hábito/material canônico, evento, recibo, intenção confirmada com payload apagado e rodada completa, sem permit residual. Ambos pertenciam à mesma rodada. O primeiro hábito continuou único e inalterado. Não houve nova rodada para tentar resolver uma resposta incerta.

[Contadores e hashes desta rodada](evidence/onboarding-daily-weekly-connected-20261026.json) · [Resumo antes de confirmar](evidence/onboarding-weekdays-connected-20261026/daily-weekly-summary.jpg) · [Confirmação](evidence/onboarding-weekdays-connected-20261026/daily-weekly-confirmed.jpg).

## Provas e limites

- [Contadores, origem e hashes das capturas](evidence/onboarding-weekdays-connected-20261026.json).
- [Rascunho restaurado](evidence/onboarding-weekdays-connected-20261026/resume.jpg) e [confirmação](evidence/onboarding-weekdays-connected-20261026/confirmed.jpg): pixels reais do Preview, sem imagens recriadas, contas, endereços ou tokens. São JPEGs nativos do navegador, preservados sem transformação; extensão, formato e hash conferidos.
- Contrato persistido: `schedule_kind=weekdays`, `weekdays=[1,5]`, `weekly_target=NULL`, histórico de frequência inicial V1 e fuso do perfil `America/Sao_Paulo`. A versão2 pertence ao rascunho de onboarding; não se inventa uma versão2 no histórico de Hábitos.
- O SQL usado foi somente leitura, com timeout e rollback, limitado ao nome exato do perfil QA e ao marcador sintético. Retornou somente contagens/booleanos; não escreveu, limpou ou alterou tabelas.
- Os três hábitos permanecem como fixtures identificáveis da conta descartável. Não houve exclusão definitiva, revogação Google ou limpeza de outras escolhas.

Este aceite cobre **criação e reentrada sem duplicata das três cadências v2** nesse Source/deployment/sessão. Retomada e edição do rascunho após recarga foram exercitadas especificamente em dias específicos; diário/meta semanal foram salvos no rascunho e recarregados depois da confirmação. Não cobre corrida entre abas, troca/revogação de sessão, falha parcial, rollback de rede, retenção nativa/Cron, 200% de zoom, tema escuro ou aparelho físico. O teste não substitui o pacote MainHTTP inerte nem qualifica os seus comandos/janela. Os negativos e os demais critérios das issues #62–65/#81 permanecem separados.

As alterações posteriores 5862→76d2659 foram somente scripts, CI, testes e documentação; não houve delta de `src/` ou migrations. Isso delimita o reaproveitamento deste percurso; não transforma outro deployment em homologação automaticamente. Merge e produção continuam bloqueados.
