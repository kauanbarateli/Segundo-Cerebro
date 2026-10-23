# E3 / T049 — Lista e participantes do Calendário

Refs #74. Base de autoria `53b8e5e6a7da293f6729c96eaa6f8dc1aea62a7b`; árvore depois incorporada em `0b004ebe7536476dda9a6b6be4c97f2bd0f9fc99`. Este documento descreve código preparado, não prova CI, SQL aplicado, OAuth ou aceite visual.

## Resultado preparado

- Lista da data civil selecionada até o fim do mês, cinco identidades por página. Evento em andamento aparece uma vez, com indicação textual; fins exclusivos permanecem exclusivos. Hoje, mês completo, fontes, links profundos e notas continuam nas fronteiras existentes.
- Duas ocorrências anteriores à data selecionada no contexto lateral, derivadas somente das fontes visíveis. Recente significa evento já terminado antes do início dessa data, no horário de São Paulo; não uma nova consulta ao Google.
- Stack com duas ou mais pessoas, até quatro iniciais e `+N`, excluindo salas/recursos. Detalhe nominal com e-mail, resposta e rótulos de participação; salas têm grupo próprio. Nenhum retrato remoto, People API, hash de e-mail ou serviço de avatar.
- Lista incluída na preferência inicial, em Configurações. Mudar somente a visão da URL não grava preferências. Padrão `week` e valores atuais permanecem; salvamento usa `settings.preferences.update` original.

## Contrato e limites

`CalendarParticipant` contém exatamente `name`, `email`, `response_status`, `self`, `organizer`, `optional`, `resource`. Nome/e-mail são opcionais normalizados para `null`, com limites 255/254 caracteres; estados `needsAction`, `declined`, `tentative`, `accepted` e `unknown`. Flags omitidas no Google viram `false`. A projeção elimina IDs, comentários, fotos e demais campos. E-mails iguais, ignorando caixa, são deduplicados dentro da mesma classe pessoa/recurso; nomes iguais não comprovam identidade.

Dois campos acompanham cada evento: `attendees` e `attendees_omitted`.

| Estado | Significado | Apresentação |
| --- | --- | --- |
| Ambos ausentes ou ambos `null` | Cache legado sem esse schema | Elenco ainda não informado; oferecer sincronização existente |
| Array vazio e `false` | Google retornou ausência de convidados | Sem convidados informados |
| Array e `false` | Elenco informado pelo Google | Pessoas e recursos recebidos |
| Array, inclusive vazio, e `true` | O próprio Google informou omissão | Lista parcial, sem inventar quantidade total |

**RECOMENDADO:** teto de aplicação de 200 entradas por evento, com recusa contida acima dele; não truncar silenciosamente nem fabricar `attendeesOmitted=true`. O provider solicita `maxAttendees=200`, mantendo a indicação de omissão real. Este teto não é uma garantia do Google sobre o total de convidados. A paginação de eventos continua integral, limitada pelos controles existentes: até oito páginas/20.000 itens e cursor final obrigatório antes de `commitEvents`.

Fontes primárias consultadas: [Events:list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) para projeção/paginação/`maxAttendees` e [recurso Event](https://developers.google.com/workspace/calendar/api/v3/reference/events) para flags, respostas e `attendeesOmitted`. Nenhum novo escopo OAuth; leitura somente e limite de duas contas preservados.

## SQL proposto e integração Root

`drafts/calendar-participants.sql` é proposta inerte, fora do loader, com guard que lança `DRAFT_NOT_AUTHORIZED_FOR_APPLICATION`. Não possui ID oficial e não deve ser aplicado. Root reservou em UTC o ID `20261022042432_spec08_calendar_participants.sql`, promoveu o corpo revisado para a migration023 e manteve o draft protegido. A reserva foi feita por edição de fonte, sem CLI/runtime local, conforme a restrição humana. Catálogo, tipos oficiais e SQL Editor ainda exigem seus próprios artefatos e conferência; a preparação não aplica SQL. Não alterar/reaplicar 001–022 nem usar a reserva antiga `20261021050931`.

O corpo proposto acrescenta `public.calendar_events.attendees jsonb` e `attendees_omitted boolean`, ambos nullable para o legado; CHECK delega a uma função pura e imutável com ACL fechada. `calendar_snapshot` projeta somente os campos aprovados; `google_calendar_call` conserva dono/sessão/claim/revisão, limites e evento na transação original. O payload de auditoria continua restrito a identificadores operacionais/contagens, sem elenco. A preferência `list` é adicionada ao CHECK original e à validação de `settings_commit`, sem trocar padrões ou permissões.

`app_private.google_calendar_cursors.attendees_version` começa em 0, sem atualizar registros de domínio em massa. A projeção privada devolve token `null` para versão 0; o próximo **Sincronizar período ou cron** faz consulta completa e limitada. A janela pública original continua preservada: cobertura de eventos não equivale à completude do elenco. Versão 1 registra somente observação do schema no commit final; `attendeesOmitted=true` continua parcial. Não basta encontrar linhas preenchidas no cache para declarar versão 1. RPCs antigos sem os campos permanecem aceitos como desconhecidos e não promovem lotes ativos para versão 1. Zero eventos é uma resposta vazia do lote, não prova de elenco completo de eventos anteriores.

Refill/full sync recompõe o cache mantendo `google_event_links`; a nota volta a ser projetada na mesma identidade determinística. Cancelamento remove evento e vínculo; 410, reconexão, desconexão, quota, direitos e ausência de cursor final seguem os caminhos originais. Falha do segundo item reverte reset, primeiro item, cursor, revisão e evento na transação.

**Ordem de corte é responsabilidade Root:** o servidor antigo recusa atributos adicionais no batch/snapshot e não conhece preferência `list`. Não aplicar SQL/deploy isoladamente nem interpretar compatibilidade de cache legado como autorização de rollout sem cerca. Generated types, catálogo/release/restore, SQL Editor, allowlists e contagens de fontes precisam ser reconciliados por observação hospedada, nunca por soma estimada.

## Interface e evidência

**OBSERVADO:** composição e hierarquia das capturas `calendario-390-light.png`/`calendario-1440-dark.png` do pacote17. **RECOMENDADO:** adaptar cartões e paginação aos componentes existentes, conservar o trilho lateral atual e usar iniciais, pois não há retratos autorizados. Geist/tokens DS2.1 e as demais visões são preservados. Nenhum token novo.

Campos usam o controle de 16px existente; ações têm mínimo 44px. Paginação anuncia o intervalo e transfere foco ao título após render; mudança de data/fonte zera somente a página, preservando o owner do campo de data. Movimento reduzido remove transição. Cache cuja janela ainda não cobre o período tem aviso de cache parcial, sem afirmar vazio confirmado. Esse aviso é distinto de um elenco desconhecido em janela já coberta.

## Validação preparada, ainda não executada

- Core: projeção mínima, flags/respostas, legado/vazio/omitido, recursos, duplicatas, nomes longos e teto200; descarte de canários de ID/comentário/foto. Provider: parâmetros/fields e omissão mantida, sem chamadas extra. DTO: dono/campos/limites e `list`.
- Sync original: duas páginas antes do único commit; ausência de cursor/erro de segunda página não publica parcial; controles existentes de 410, cancelamento, entitlement e desconexão continuam. Projeções: fim exclusivo, multi-day uma vez, virada de mês/ano, fuso de São Paulo e recentes.
- `calendar-participants-sql.test.ts`: na integração Root, usa somente o loader da cadeia canônica em RAM e asserções separadas de `supabase/tests/calendar-participants.sql`, sem reaplicar o draft. Executa RPCs originais sob `service_role`; testa erro intermediário/atomicidade, legado→refill, notas, omissão, cancelamento, preferência e ausência de elenco em eventos. A existência do teste não demonstra sua execução.
- Browser original com transporte sintético: 320/claro, 390/escuro e 1440 nos dois temas; cinco/seis registros, teclado/foco, detalhe nominal, troca de fonte/data e ausência de fotos. Guardas medem overflow, alvos, campos e contraste real mínimo4,5:1. Capturas só serão evidência após CI. Os mocks HTTP não provam Google/Supabase reais.
- Comandos remotos pertinentes: suíte Vitest desses arquivos + `calendar-projections`, `calendar-connected`, `calendar-runtime`, `calendar-security-provider`, `calendar-oauth-sql`, Settings; E2E `calendar-layout`, `calendar-timeline`, `calendar-workspace-browser`, `calendar-google`; lint/typecheck/dependency gate e catálogos/negativos originais. Root coordena os workflows existentes.

Nenhum Node/npm, teste, compilação, browser ou SQL foi executado localmente nesta autoria, conforme limitação de 8GB. Nenhuma migration aplicada, chamada Google real, segredo lido, push ou deploy. Pendem peer, CI próprio, tipos/catálogo canônicos, aplicação supervisionada e aceite humano conectado antes de fechar #74.

## Inventário de privacidade para consolidação Root

Nova coleta mínima: nome/e-mail de convidados e recursos, status de resposta e flags. Origem: evento Google já autorizado, pelos mesmos escopos de leitura. Destino: adapter no servidor e cache isolado do Usuário no Supabase; exibição somente no Calendário desse dono. As informações não criam novas contas nem concedem permissões e não entram no journal de comandos, Admin, telemetria ou payload de eventos de domínio.

Não foi criado prazo de retenção novo. O elenco acompanha a retenção efetiva do cache de eventos: substituição pela sincronização completa, cancelamento e remoção da conta/identidade usam os mecanismos existentes; a janela limitada não deve ser anunciada como TTL. Notas são conteúdo separado e preservado no resync conforme vínculo. Backups do banco seguem o procedimento/retencão operacional existentes, incluindo as novas colunas após integração canônica. Root deve reconciliar inventário de retenção e transferências/operadores (Google→servidor→Supabase) e os textos legais antes do deploy, sem afirmar região, prazo adicional ou foto que não tenham sido conferidos. As páginas legais não foram editadas nesta frente.

## Revisão de integração Root

O peer estático E3 foi concluído após alinhar o limite Unicode por codepoints no parser/DTO com o SQL, preservando os casos255/256 e recursos. Manifesto da autoria31:680e44bd904eeae272bec425323000b92267be66ed3b2e773461b449ae862076. A cópia foi conferida por hash; os deltas de integração posteriores (loader e documentação) não são atribuídos ao freeze original. CI, renderização, tipos/catálogo e aceite conectado continuam pendentes.
