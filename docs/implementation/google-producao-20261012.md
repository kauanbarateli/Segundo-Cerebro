# Google Calendar: primeira validação de produção — 12/10/2026

Ensaios supervisionados no aplicativo `https://segundo-cerebro-of.vercel.app` em 12/10/2026, com execuções manuais registradas a partir de 11:21 em Fortaleza. O responsável entrou com sua conta existente e concluiu os consentimentos Google. Essa conta não foi criada, alterada ou usada como fixture de Auth/Admin.

## Comprovado nesta rodada

- `/calendario` exige sessão e abriu após o login humano; o caminho usa `calendario`, sem acento.
- Duas contas Google ficaram conectadas. O início da segunda conexão abriu o seletor de contas do Google; foi necessário escolher outra identidade. Com duas conexões, o botão para uma terceira fica desabilitado.
- A sincronização manual terminou com `Agenda atualizada.` e ambas as contas exibiram horário de sincronização. A semana apresentou 34 botões de eventos; a visão diária abriu e o mês apresentou a lista adequada à largura móvel do navegador.
- Todos os calendários foram desmarcados por controles normais do aplicativo. O Calendário ficou sem eventos, e a agenda do Início apresentou zero itens e estado vazio, sem erro. As cinco seleções foram restauradas exatamente ao estado anterior; as duas contas e os eventos voltaram.
- Um aviso real de reunião apareceu com as seleções restauradas. Ao desmarcar somente sua fonte, os eventos dessa fonte e o aviso já emitido desapareceram; os dois eventos das outras fontes permaneceram. A seleção foi restaurada em seguida. Esse recorte valida também a retirada do lembrete no fluxo normal de atualização.
- O Admin apresentou quatro execuções manuais concluídas, com 1/1/3/3 calendários e 0/2/29/167 eventos recebidos, às 11:21/11:23/11:31/11:36. Essas contagens de lotes não representam quantidades de eventos únicos atualmente visíveis.
- O [executor de produção pessoal](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38267560938), iniciado uma única vez por `workflow_dispatch` no SHA `b8bf4ced273c6507c04385db706b06c49d01f53c`, terminou com `HTTP 200`, `outcome=complete`, `code=OK`, `complete=2` e `failed=0`. O Admin mostrou duas execuções `Agendada · Concluída` às 12:04, com 1/2 calendários e 0/894 eventos recebidos. O disparo do workflow foi manual; a aplicação registrou a origem agendada da rota cron.
- Depois desse resultado e da conferência no Admin, a variável de repositório `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` foi definida e reconferida como `true`. A rotina está habilitada para 05:17 UTC, 02:17 em Fortaleza. O primeiro disparo automático diário ainda não foi observado; horário não é SLA.

Não foram registrados endereços Google, títulos, locais, identificadores de eventos, códigos OAuth ou tokens neste documento. Nenhum compromisso foi criado, editado ou removido no Google. Nenhuma conexão foi revogada.

## Recusa anterior e limites

A mensagem `A operação foi recusada. Confira o período, as permissões e o limite de duas contas.` apareceu antes da conclusão dos ensaios. O adapter reúne SQLSTATE `22023` e `23514` nessa mensagem; ela não identifica a operação ou a causa. A conexão de duas contas e as sincronizações subsequentes passaram, sem patch, reset ou liberação de claims. Não foi comprovada a causa daquela recusa nem uma limitação de uma conta.

A tentativa de consultar somente metadados pelas tabelas públicas com a chave de servidor retornou `403/42501`, coerente com o acesso restrito às RPCs da aplicação. Nenhum grant foi ampliado. O Supabase MCP continuou sem permissão no projeto pessoal, e a Vercel recusou o escopo pessoal; configuração local não foi tratada como conferência das variáveis de produção.

## Ainda necessário para os aceites

- Recusa de uma terceira conexão no servidor, revogação real e reconciliação de resultado incerto.
- O aceite literal de três dias admite fixture e possui prova nos testes originais de Core, projeções e UI estática, conforme a [divisão vigente](handoff-duas-frentes-mvp-20261012.md#a-01--calendário-montado-e-expansão-de-janela-32). A Frente A amplia essa cobertura para interação montada; não exigir evento Google real como novo gate desse literal. Expansão da janela conectada ao navegar sem recarregar permanece pendente; os limites anterior/posterior não foram capturados. Paginação/410 e vínculo de nota conservam os controles do escopo e suas provas próprias. Disparo e retirada de um aviso real foram observados; outros horários/preferências e atualizações sem estado de carregamento não foram ensaiados.
- Observar o primeiro disparo automático diário. O cron autenticado e seu registro no Admin já foram comprovados pela execução supervisionada acima; essa observação operacional não reabre esse critério literal.

As outras frentes mantêm os próprios critérios, sem acrescentá-los à #32:

- **#21:** [entrega e recuperação por e-mail comprovadas com conta comum](smtp-producao-20261012.md); os demais critérios Auth conservam suas provas e pendências próprias.
- **#35:** perfis/chave de backup, versões dos servidores, janela sem escritores e restore em outro projeto pessoal novo e vazio, incluindo o aceite do Cofre.

Foi criada uma raiz operacional privada fora do Git/OneDrive, com subpastas de perfis, arquivos cifrados, temporários e relatórios, e ACL restrita ao usuário, SYSTEM e administradores. Uma consulta `READ ONLY`/`ROLLBACK` no painel pessoal confirmou PostgreSQL 17.11 na origem. A instalação 18.4 existente foi preservada. O ZIP oficial 17.11 foi baixado e seu hash conferido, mas o Windows bloqueou a execução de `pg_dump.exe` pelo Controle de Aplicativos. Não houve bypass da política. Nenhum backup, restore, agendamento de backup, migration ou perfil com credencial foi executado nesta preparação.

Referências: [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32), [runbook Google](../operations/google-calendar-release-verification.md), [configuração das três frentes](../operations/configuracoes-pendentes-passo-a-passo.md). A issue permanece aberta pelos critérios não demonstrados.
