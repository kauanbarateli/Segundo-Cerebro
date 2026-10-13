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

## Navegação conectada até abril de 2027

Na mesma conta do aplicativo, já com duas conexões Google, a raiz navegou por novembro e dezembro de 2026 e janeiro, fevereiro, março e abril de 2027. Em março, ambas as fontes exibiram `Sincronizada` em 12/10/2026 às 18:18 e a interface mostrou `Agenda atualizada.`. Em abril, a URL tinha `date=2027-04-01&view=month`; as duas fontes mostraram sincronização às 18:24 e a mesma mensagem de conclusão. O botão `Conectar Google` permaneceu desabilitado pelo limite de duas conexões. Nenhuma recusa visível foi observada nesse percurso.

A [janela padrão do Núcleo](../../src/core/calendario/service.ts) vai de hoje −45 a hoje +180 dias. Para 12/10/2026, seu limite superior é 10/04/2027: o mês 01–30/04 inclui datas posteriores a ele. O mês civil de março cabe nesse intervalo; a [grade mensal de 42 dias](../../src/components/features/calendario/calendar-projections.ts) também pode atravessá-lo. O percurso apoia a expansão/sincronização conectada, mas os intervalos HTTP efetivamente solicitados e os limites do snapshot anterior/posterior não foram capturados. Também não foi medida independentemente a ausência de reload do documento. Não declarar o aceite conjunto “sem reload” concluído por este recorte.

Ao terminar, a raiz voltou a `Hoje` e `Semana`. A URL ficou `/calendario?date=2026-10-12&view=week`, com Semana selecionada, Mês desmarcado e as duas fontes ainda às 18:24. O controle de UI foi restaurado; nenhuma preferência persistida foi alterada. Não foram inferidas contagens de eventos por regex, revogação, término de sessão/provider ou novo cron automático.

## Ainda necessário para os aceites

- Recusa de uma terceira conexão no servidor, revogação real e reconciliação de resultado incerto.
- O aceite literal de três dias admite fixture e possui prova nos testes originais de Core, projeções e UI estática, conforme a [divisão vigente](handoff-duas-frentes-mvp-20261012.md#a-01--calendário-montado-e-expansão-de-janela-32). A Frente A amplia essa cobertura para interação montada; não exigir evento Google real como novo gate desse literal. A navegação conectada até abril e a sincronização de ambas as fontes foram observadas no recorte acima. O aceite conjunto de expansão sem reload permanece parcial: ausência de reload do documento e intervalos HTTP efetivos não foram medidos. Paginação/410 e vínculo de nota conservam os controles do escopo e suas provas próprias. Disparo e retirada de um aviso real foram observados; outros horários/preferências e atualizações sem estado de carregamento não foram ensaiados.
- Observar o primeiro disparo automático diário. O cron autenticado e seu registro no Admin já foram comprovados pela execução supervisionada acima; essa observação operacional não reabre esse critério literal.

As outras frentes mantêm os próprios critérios, sem acrescentá-los à #32:

- **#21:** [entrega e recuperação por e-mail comprovadas com conta comum](smtp-producao-20261012.md); os demais critérios Auth conservam suas provas e pendências próprias.
- **#35:** perfis/chave de backup, versões dos servidores, janela sem escritores e restore em outro projeto pessoal novo e vazio, incluindo o aceite do Cofre.

Foi criada uma raiz operacional privada fora do Git/OneDrive, com subpastas de perfis, arquivos cifrados, temporários e relatórios, e ACL restrita ao usuário, SYSTEM e administradores. Uma consulta `READ ONLY`/`ROLLBACK` no painel pessoal confirmou PostgreSQL 17.11 na origem. A instalação 18.4 existente foi preservada. O ZIP oficial 17.11 foi baixado e seu hash conferido, mas o Windows bloqueou a execução de `pg_dump.exe` pelo Controle de Aplicativos. Não houve bypass da política. Nenhum backup, restore, agendamento de backup, migration ou perfil com credencial foi executado nesta preparação.

Referências: [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32), [runbook Google](../operations/google-calendar-release-verification.md), [configuração das três frentes](../operations/configuracoes-pendentes-passo-a-passo.md). A issue permanece aberta pelos critérios não demonstrados.

## Observação posterior até maio de 2027

A [projeção fechada da UI](evidence/google-window-ui-20261013.json) registra a sessão válida com duas contas e sete ações mensais, de novembro de 2026 a maio de 2027. Em maio, a interface exibiu `Agenda atualizada.`, ambas as contas com sincronização em 12/10 às 21:55, 42 células de grade e 195 botões de evento. Não houve clique manual em sincronizar, mudança das seleções ou de permissões Google. As contagens descrevem elementos renderizados, sem comprovar a correção individual dos eventos.

A raiz voltou a `Hoje` e `Semana`, confirmando a data `2026-10-12` e o período “12 – 18 de outubro de 2026”. A captura visual permanece privada fora do repositório; nomes, e-mails e imagem não entram na evidência pública. O commit servido, o intervalo anterior do cache e a ausência de reload continuam sem medição. Essa observação apoia a navegação e sincronização automática, sem concluir o aceite conjunto da expansão sem reload ou acrescentar um gate de evento Google real ao literal de três dias.
