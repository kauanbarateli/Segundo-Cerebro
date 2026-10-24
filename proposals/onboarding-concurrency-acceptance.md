# Gate remoto V2 — roteiro para o executor autorizado

Este arquivo não executa SQL, não cria contas e não autoriza produção. Aplicável somente depois do peer/pins e promoção supervisionada de026 na homologação `twrydxsdemaykgvdlpyd`. Usar contas descartáveis já autorizadas e SDK/runner seguro do projeto; não pôr credenciais em issues, argumentos ou logs. Um worker pesado de cada vez. Não realizar seeds/reset. Cada recibo real e fixture precisa ser limpo pelo procedimento vigente, sem apagar dados de outra conta.

## Preparação observável

1. Registrar SHA consolidado, hashes da026 promovida e das cinco definições históricas **antes** e depois da injeção. Preservar funções025, grants e ACLs. Pins vazios ou divergentes precisam abortar a transação sem DDL residual.
2. Regenerar tipos oficiais depois da instalação, sem editar o snapshot v1. Conferir RLS/grants/catálogo da proposta `onboarding-catalog-assertions.sql` revisada, sem usar sua guarda DRAFT como aceite.
3. Criar a rodada pelo comando real, salvar escolhas com nomes de fixture não pessoais e confirmar. Ler `peek_intent`/bind pelos adapters reais. Observar IDs e fingerprints fechados em memória do runner; relatório recebe somente contagens/códigos e não corpos ou IDs pessoais.
4. Cron permanece inativo durante as corridas. A rotina de teste deve sempre desfazer locks/transações pendentes em finally; timeout com conexão morta não é prova de rollback do outro processo. Reconsultar recibos/entidades e aguardar conclusão positiva de ambos os lados.

## Matriz em duas sessões PostgreSQL

As sessões A/B usam usuários/sessões reais da mesma fixture, papéis esperados e isolamento padrão READ COMMITTED. Não modificar as definições para inserir delays. O runner controla entrada/espera pelos locks conhecidos e usa o wrapper RPC real; uma transação externa pode manter o advisory ou a rodada somente para colocar o outro lado em espera. Revalidar a situação após soltar o lock.

| Caso | Ordem/intercalação | Prova exigida |
| --- | --- | --- |
| Commit vence emenda | A faz module_commit e mantém transação; B tenta amend; A commit | B reconhece recibo real; entidade=1, evento/recibo coordenador confirmado, nenhuma nova versão executável. |
| Emenda vence commit antigo | A mantém antigo PendingIntent fora do DB; B amend confirma; A envia o commit antigo | A negado por geração/versão; versão antiga not_committed sem payload; apenas novo ID admite efeito explícito. |
| Commit cruza deadline durante execução | A entra no wrapper antes do deadline; limite vence antes do retorno | Checagem final aborta a transação; entidade/evento/recibo ausentes, permit zero. Não chamar só uma negativa de timer de aceite. |
| Expiração vence commit | A mantém PendingIntent antigo; B expira/sweep após deadline; A envia commit | Nenhum novo módulo; payload de todas as versões ausente; recibos anteriores e entidades confirmadas preservados. |
| Commit vence sweep | A grava dentro do prazo; B espera mesmo advisory; A commit e prazo vence | Sweep reconcilia/protege recibo confirmado, elimina conteúdo; não cria novo ID nem perde entidade. |
| Dois advance | A/B pegam o mesmo intent/version/body e competem | Exatamente1 entidade e recibo por client_id; resposta de replay compatível. |
| Dois amend mesmo clientId/corpo | Concorrência e perda deliberada da primeira resposta no transporte controlado | Uma nova versão por slot, replay antes do CAS; segunda chamada não gera v3. |
| Mesmo clientId, outro corpo | Depois de primeiro amend tentar novo valor/relação/dependentes | Conflito; versão/recibo/corpo anterior preservados. |
| Pai e dependentes | Projeto → Tarefa e Página → Link; pai falha, dependentes ainda não confirmados | Fecho transitivo exato no readmodel; omissão sem lista exata recusa; com aceite explícito só omitted nos slots escolhidos. |
| Dependente confirmado | Usar estado real compatível do fluxo, sem editar tabelas para fabricar receipt | O pai não é apagado/omitido/substituído; confirme realidade pelo recibo. Não promover fixture impossível em estado permitido. |
| Escolha independente | Falha em um ramo, outro ramo válido | Outro ramo pode confirmar; falha não vira barreira global no peek/advance. |
| Namespace direto | Rotas ordinárias e RPCs históricas com onb:, sem permit; repetir um ID já confirmado | Negado antes de replay/escrita; não só antes de criação nova. IDs ordinários continuam funcionando. |
| SET CONSTRAINTS original | Core real → module_commit de Hábito e Projeto, incluindo o SET CONSTRAINTS ALL IMMEDIATE legado | Permit consumido antes do corpo; original confirma integridade, entidade/evento/recibo1 e zero residual. Nenhum modo de constraint foi afrouxado. |
| Guarda em segunda entrada | Tentar reutilizar a mesma autorização dentro da transação | Segunda entrada negada; um permit não autoriza duas execuções. |
| Permit falso/residual | Outro PID/xact/generation/version/digest; provocar erro no wrapper depois de permit | Nenhum bypass; transação aborta e count final=0. Papel da aplicação não consegue ler/escrever permits. |

Não executar uma função privada isolada ignorando sua pré-condição de locks e chamar isso de teste de API. O teste de ataque por RPC usa as superfícies e grants reais; o teste interno de permit exige papel operacional controlado, encerrado antes dos aceites de aplicação.

## OAuth com provedor controlado e banco real isolado

O stub do provedor devolve somente tokens sintéticos para a fixture e nunca fala com Google. A aplicação mantém o mesmo `finishCalendarConnection` e o repo SQL real. Confirmar classificação direta/onboarding no DB.

- Cookie ausente/tampered/owner/session/generation expirados: nenhum exchange/finish/connect para fluxo ligado; não cair no caminho direto.
- Segurar a Promise de exchange/profile/calendars após `oauth_take`; em outra sessão emendar ou expirar. Soltar o provedor: `oauth_connect` recusa atomicamente; zero nova conta/credencial/source/evento.
- Resposta perdida depois do connect: consultar o mesmo flow/account e repetir somente o mesmo corpo onde o contrato permite; conexão única/flow complete, fingerprint compatível, sem nova autorização automática.
- Fluxo direto continua com o repo original. Contas conectadas antes do onboarding não são desconectadas por expiração. canConnect=false com duas contas ou contas+reservas não reconnect ativas≥2.

## Retenção independente do usuário

1. Contas ativas e bloqueadas, com/sem sessão, rodadas active/paused/partial/complete e versões antigas: usar o relógio de fixture permitido pelo runner/DB de teste, sem mudar produção. Datas reais de teste podem ser vencidas pela fixture supervisionada; não alterar funções de relógio no schema público.
2. Executar sweep como papel operacional; application/service_role/anon não podem chamá-lo. Confirmar dado+evento+tombstone atômicos, **zero conteúdo** em draft/input/bound_input/choice/extras/bindings de todas as versões vencidas, entidades/recibos prévios intactos e zero permits.
3. Travar a primeira página e manter usuários seguintes livres: observar cursor percorrer outras páginas, retornar depois aos skips e não ficar preso eternamente nos primeiros100. Medir100/101/N e combinações de locks; liberar tudo em finally.
4. Registrar somente o job inativo via APIs oficiais. Conferir nome/owner/comando/schedule e não alterar outro job. Em transação de teste, colisão ou pin inválido precisa preservar tudo.
5. Root ativa supervisionadamente o ID conferido. Esperar execução nativa real e medir backlog/deadline mais antigo/duração/permits. Estado sem lastCompletedAt ou job inativo/parado é pendente, mesmo que uma execução manual tenha passado.
6. Homologar alvo≤120s sob a carga acordada. Backlog>100, espera contínua ou timeout podem exigir múltiplos ciclos; se exceder, health precisa mostrar atraso e o aceite não passa até definir capacidade/frequência adequadas. Sem promessa de apagamento instantâneo.

Relatar separadamente: implementado, testes puros/sintéticos no SHA, catálogo, concorrência real, Cron ativo/SLO e UI real. Uma linha de PASS não substitui outra superfície.
