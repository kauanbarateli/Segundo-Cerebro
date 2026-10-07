# T-014 / T-015 — decisões propostas para a fronteira de servidor

**Nota histórica de preparação, em 07/10/2026.** As propostas T-014 evoluíram para implementação local descrita no [runbook Auth](t014-auth-backend.md) e no [relatório de integração](t014-integracao.md), ainda sem validação dos fluxos reais. T-015 permanece proposta para o próximo recorte. A preparação original ocorreu sem conexão ou aplicação de SQL; posteriormente o acesso ao projeto pessoal foi confirmado e a execução supervisionada foi autorizada pela [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada), sem que esta nota ateste aplicação. A proposta segue `AGENTS.md`, `CONTEXT.md`, ADR-0001 a ADR-0004, docs 06/09 e tickets T-014/T-015 do doc 13.

## 1. Transações do Núcleo — decisão necessária em T-015

O contrato atual `src/core/contracts/unit-of-work.ts` exige que o callback de uma transação preserve isolamento serializável e confirme ou reverta alterações, Eventos de domínio e recibos juntos. **Um callback `UnitOfWork` não equivale a uma transação PostgREST:** chamadas HTTP separadas têm transações separadas. Agrupar `.from()` ou `.rpc()` em `Promise.all` não resolve essa diferença. [Referência PostgREST](https://postgrest.org/en/stable/references/transactions.html).

**Proposta preferida para revisão:** executar os casos de uso TypeScript no servidor, registrar suas alterações em estágio e enviar uma única RPC de commit. O protocolo usaria uma revisão monotônica por Usuário e comparação da revisão esperada antes da escrita — *compare-and-swap* (CAS):

1. Obter a revisão inicial e executar o caso de uso, lendo apenas os registros necessários e mantendo as alterações em estágio.
2. A RPC trava a revisão do Usuário e confirma sessão, moderação e Entitlements atuais. Um recibo existente com o mesmo conteúdo devolve o resultado anterior; conteúdo diferente para o mesmo `client_id` gera conflito.
3. Sem recibo, a revisão deve continuar igual à inicial. A RPC verifica dono, referências, campos imutáveis e correspondência entre alterações e eventos; confirma alterações, eventos, recibo e incremento da revisão na mesma transação.
4. Revisão divergente descarta o estágio e repete o caso de uso sobre dados novos, com tentativas limitadas. Resposta perdida é recuperada pelo recibo, sem duplicar a escrita.

A revisão precisa cobrir **todas** as escritas do recorte, incluindo inserções concorrentes. Isso protege o rename quando outra captura com `[[Título antigo]]` é criada depois da leitura inicial. Conversão e rename devem confirmar integralmente ou não produzir alteração. Escritas futuras de admin/cron também precisam participar do protocolo.

O lote seria exclusivamente interno ao servidor. Uma RPC genérica de commit executável por `authenticated` permitiria contornar os casos de uso; a proposta requer execução privilegiada restrita, sem endpoint público que aceite estados/eventos arbitrários. Como a credencial privilegiada ignora RLS, a RPC deve conferir explicitamente ator, sessão, dono e permissões. Leituras comuns continuam sob a sessão e RLS do Usuário. Essa escolha e seus grants precisam de revisão conjunta com T-013 antes de criar o schema T-015.

**Alternativa:** adapter PostgreSQL com conexão única e transação serializável, usando role de aplicação sem bypass e contexto local à transação. Preserva diretamente o callback, mas exige driver/credencial próprios e conciliação explícita com a conversão “como RPC” exigida no ticket. Não está escolhida. Duplicar a orquestração de negócio em SQL também exigiria rever a autoridade única do Núcleo prevista no ADR-0002.

## 2. Auth, sessão e acesso — proposta T-014

Clientes Supabase e adapters de banco ficariam restritos ao servidor e à requisição atual. O navegador receberia dados e resultados, nunca JWT, refresh token ou chave privilegiada. Cookies de sessão e refresh compartilhariam atributos `httpOnly`, `secure` em produção HTTPS, `sameSite=lax` e `path=/`, incluindo renovação, fragmentação e remoção. Redirects devem preservar `Set-Cookie`.

Cada operação autenticaria com `getUser()`, verificaria moderação e Entitlement persistidos e só então chamaria o Núcleo. Identidade e Canal seriam definidos no servidor. Preferência controla visibilidade e consultas opcionais; não autoriza nem revoga operações. A guarda de master deve existir em cada operação administrativa, além da rota, sem conceder leitura de conteúdo pessoal.

Revogação imediata exige confirmar que `session_id` pertence ao Usuário e continua presente, além do estado de moderação: logout ou ban isolado não elimina a validade criptográfica de JWT já emitido. [Sessões Supabase](https://supabase.com/docs/guides/auth/sessions).

Login e recuperação precisam de respostas sem enumeração, destinos de retorno restritos e rate-limit persistente. O requisito definido é bloquear a sexta tentativa de login em um minuto; demais limites ainda precisam de decisão. A proposta T-013 de RPC atômica com janela deslizante substitui o contador em memória do legado. Indisponibilidade do limitador deve impedir a operação, sem liberar tentativas.

Respostas pessoais e de refresh seriam `private, no-store`, sem ISR ou cliente com sessão compartilhado entre requisições. Logout deve ocorrer por POST e limpar dados locais do Usuário. A PWA continua sem cache de HTML pessoal, RSC, API ou URLs assinadas. [Cuidados de SSR e cache](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## 3. CSP e tema — proposta T-014

Aplicar `Content-Security-Policy` em bloqueio, com nonce aleatório por requisição e hash dos bytes atuais de `THEME_INIT_SCRIPT`. O hash legado não corresponde ao script atual. Middleware deve fornecer a política ao renderizador e à resposta, inclusive em redirects; testes recalculariam o hash e verificariam tema, hidratação e ausência de violações.

Nonce exige renderização dinâmica das páginas que o utilizam. Não reutilizar HTML com nonce em cache. `/offline` e `sw.js` precisam conservar políticas compatíveis com seus recursos públicos estáticos. A política de scripts de produção não deve liberar `unsafe-inline` ou `unsafe-eval`; a necessidade atual de estilos inline deve ser tratada separadamente. Hosts de upload e leitura seriam específicos, sem wildcard de todos os projetos Supabase. [CSP no Next.js 15](https://nextjs.org/docs/15/app/guides/content-security-policy).

## 4. Imagens — proposta T-015

Usar reserva de upload por Usuário, caminho aleatório e estágio privado. Após o envio por URL assinada, a finalização no servidor mediria os bytes reais, validaria PNG/JPEG, limitaria dimensões e reencodaria a imagem para remover metadados. Só o objeto saneado poderia ser vinculado à captura, com finalização idempotente.

A documentação informa validade de duas horas para a URL assinada; não promete consumo único. Essa garantia depende da reserva e do estado de finalização da aplicação. Storage e Postgres também não compartilham uma transação: falhas precisam deixar objetos temporários rastreáveis para limpeza, sem publicar anexos parciais. Cotas, retenção, limite de pixels e leitura privada ainda precisam ser definidos. [URL assinada de upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).

## 5. Bloqueios e evidência necessária

A [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada) registra a conexão pessoal verificada e autoriza aplicação supervisionada das migrations e asserções com rollback. A preparação independente sem conexão da OP-008 permanece evidência histórica. Acesso não comprova configuração da aplicação nem as validações reais abaixo.

- **Protocolo:** escolher RPC com revisão/CAS ou conexão transacional; alinhar recibos JSONB/fingerprint, grants e política de repetição com T-013. Nenhuma tabela de revisão deve nascer antes desse acordo.
- **Compatibilidade:** a suíte atual usa IDs de teste não UUID e preserva a grafia de timestamps com offset. O harness real precisa de atores/IDs parametrizados e uma representação canônica acordada para retorno, leitura e evento. Triggers não podem alterar silenciosamente os valores de `after` fornecidos pelo Núcleo.
- **Referências:** veto a Projetos não deve parecer projeto excluído durante conversão. Validar dono/existência internamente, sem enriquecer DTOs ou consultar blocos ocultos. A coleção mock de capturas organizadas não redefine o modelo persistente de Páginas/Cadernos; a promoção para Conhecimento precisa ser conciliada com T-021.
- **Ambiente:** o projeto pessoal `rishenjoikgmfubmnfiu` foi acessado via MCP; a inspeção anterior à aplicação encontrou PostgreSQL 17.11, Auth sem contas e nenhuma relação de identidade da aplicação. Credenciais exclusivas da aplicação, configuração Auth/SMTP, URLs de callback e envio de e-mail continuam pendentes de configuração e validação. É proibido usar organizações, projetos ou credenciais da BlackSheep e do Sistema VOE; suas configurações devem permanecer preservadas.
- **Aplicação supervisionada:** OP-009 substitui a restrição anterior da OP-002 no projeto pessoal autorizado. Registrar aplicação e asserções separadamente; reset/seeds e aplicação automática por CI/build/deploy continuam proibidos. Testes reais dependem de ambiente preparado e evidência de execução; a conexão isoladamente não encerra critérios.

A validação futura deve demonstrar isolamento com dois Usuários, bloqueio de sessão ainda portando JWT válido, sexta tentativa de login recusada, conversão concorrente sem duplicação, rename concorrente sem referências perdidas, rollback de dados/eventos/recibo, upload interrompido e erro de RLS visível na UI. Preparar esses testes não equivale a executá-los ou cumprir os critérios de aceite.
