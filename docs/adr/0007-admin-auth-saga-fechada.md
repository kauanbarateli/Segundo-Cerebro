# ADR-0007 — Admin com saga Auth protegida

Status: aceita para implementação offline de T017; aplicação e validação do projeto dedicado permanecem manuais.

O Admin precisa bloquear sessões vivas, criar contas com senha provisória e proteger o último master utilizável. Auth SDK e transações SQL não compartilham uma transação. Nenhuma resposta do aplicativo deve apresentar essa combinação como atomicidade distribuída.

Toda entrada chama `requireMaster` primeiro. A identidade e a sessão vêm do contexto autenticado do servidor; cookies, origem de escrita e `X-Expected-User-ID` protegem o canal. Cada RPC privada revalida sessão, papel e veto administrativo atuais antes de retornar inclusive um replay. O SDK administrativo permanece somente no servidor.

A reserva usa UUID de alvo gerado no banco, client_id e HMAC SHA-256 com `ADMIN_COMMAND_SECRET` exclusivo. Não armazena e-mail, senha, ciphertext, token ou corpo da requisição. O servidor gera uma claim UUID por execução; ela permanece somente na tabela privada e nos argumentos RPC. Dois envios pendentes da mesma operação não podem executar o SDK em paralelo. Uma operação pendente por alvo também impede que um novo comando interfira na saga anterior.

O banco fecha a moderação antes de qualquer efeito Auth. Criação usa UUID e marcador `sc_admin_operation` exatos, nasce banida no Auth e tem moderação bloqueada/troca obrigatória desde o trigger de provisionamento. Metadata editável jamais concede papel. Ban e desbloqueio usam `updateUserById`; a revogação apaga todas as sessões e refresh tokens do alvo em RPC guardada. `signOut` administrativo recebe JWT, portanto não recebe UUID do usuário. Referências: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) e [signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout).

O SDK deve confirmar um efeito terminal e o SQL deve confirmar o ban/estado, ausência de sessões e moderação antes da conclusão. HTTP 4xx explícito permite deixar a operação pendente com claim liberada para retry; a moderação permanece fechada. Transporte rejeitado, HTTP 0/5xx ou resultado fora do alvo/marcador não provam término: marcam `needs_reconciliation`, mantêm a claim sem TTL e exigem revisão operacional. Uma resposta antiga de unban pode mudar Auth, mas não abre dados: a moderação segue bloqueada e a unicidade da pendência impede outro comando no alvo.

O conjunto de masters tem advisory lock global; depois vêm operação pendente, pais Auth e lock por usuário compartilhado com os módulos. A contagem exclui bloqueados, banidos, deletados, anônimos, troca obrigatória e veto admin. Não se altera o próprio papel nem se bloqueia/desbloqueia/exige troca da própria conta; a senha própria usa Configurações. Papel e entitlement são transações únicas com evento, auditoria e recibo.

Usuários apresenta somente metadata de identidade/estado/sessões. A auditoria tem sete colunas fixas com IDs, ação, etapa e momento; nenhuma leitura de conteúdo pessoal ou `domain_events` geral entra no Admin. As tabelas têm RLS sem grants/policies de leitura direta e o service role acessa apenas seis RPCs guardadas. O formulário de senha não utiliza o journal comum, localStorage, sessionStorage ou IndexedDB.

Consequência: um processo interrompido ou Auth incerto pode deixar uma conta protegida aguardando intervenção. Isso é preferível a desbloquear com uma chamada ainda em voo. A claim só pode ser limpa por operação manual autorizada depois de prova de término de todas as chamadas anteriores; não existe endpoint de aplicação que ignore essa prova.
