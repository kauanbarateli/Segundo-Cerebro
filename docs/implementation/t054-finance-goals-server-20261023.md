# T054 / #79 — persistência de Metas, proposta de servidor

**Implementado localmente; SQL inerte, sem rollout e sem encerramento da issue.** Base `0d9d92f2f19cc528b1f7947a2f1f850fbca65b2f`, com Core V2 byteconferido (manifesto `930ba6c1…`). Monolito modular; nenhum SDK entra no Núcleo, nenhuma rota/UI/env/flag foi acrescentada.

## Contrato

Sete comandos existentes, sem alteração de DTO ou port. O gateway é vinculado a actor/sessão/operação e só usa seis RPCs: `finance_goals_snapshot`, `finance_goals_page`, `finance_goal_detail`, `finance_goal_reservations_page`, `finance_goal_releases_page`, `finance_goals_commit`. Dono/sessão vêm exclusivamente do servidor autenticado. O runtime usa somente a origem hospedada já validada pela política de destino existente, sem redirect/cache, timeout15s, corpo limitado e erros públicos fechados. Não lê arquivos de ambiente nem registra credenciais, payloads ou diagnósticos SQL.

Snapshot é uma intenção exata: no máximo uma Meta, reserva original, destaque, Conta, prova de imagem e agregado de cada espécie. Reserva é o original imutável; snapshot não carrega todas as liberações. Consulta de aporte recebe somas completas de Meta/Conta. Liberação recebe somente original próprio e total completo liberado; não depende de Meta/Conta/imagem disponíveis atualmente.

Auth, sessão viva, Entitlement e lock financeiro comum antecedem qualquer retorno de RPC, inclusive recibo ou null. Um recibo próprio de mesmo comando/clientId/fingerprint retorna o resultado original e todas as coleções vazias, antes de verificar a revisão ou referências atuais. Replay não depende de clock, imagem ou Conta atuais. Nenhum callback ou escrita é repetido automaticamente. Desfecho incerto admite uma leitura da MESMA intenção; sem recibo confirmado, permanece incerto.

O snapshot não segura uma transação remota durante awaits do Core. O store copia o agregado, fixa a revisão, bufferiza efeitos/eventos/recibo e fecha os ports quando o callback termina. O commit readquire o mesmo lock existente (`capture-task:<owner>` via finance_guard), reconfirma Auth e consulta recibo primeiro; depois aplica CAS global e específico e verifica oracle independente. Um vencedor concorrente pode retornar seus UUIDs originais, nunca os IDs propostos pelo perdedor.

Limites: intenção de leitura64KiB, resposta512KiB, commit1MiB, máximo2 efeitos/eventos. Coleções de apresentação têm limite1–50 e keyset (UUID no catálogo; created_at+UUID no histórico), com revisão explícita. Exceder limite recusa; não trunca agregados ou um payload obrigatório.

## Banco e invariantes

Cinco arquivos em `proposals/finance-goals/`, cada um aborta imediatamente com DRAFT_ONLY e termina com rollback. Não são migrations. O helper de teste só remove essas barreiras após conferir os cinco hashes exatos, em banco SQL-in-WASM descartável; nunca contém conexão/credencial ou fallback HTTP.

Tabelas privadas com RLS e zero grants diretos para anon/authenticated/service_role: Metas, aportes, liberações e destaque singleton. Helpers privados também têm zero grants. Somente os seis wrappers públicos fechados recebem EXECUTE service_role; cada chamada revalida Auth real do actor/sessão antes de devolver conteúdo.

Reservas e liberações são insert-only. Metadados não movem dinheiro. Saldo real replica saldosFinanceiros/fin_account_balances: somente confirmed/reconciled sem deleted_at, paid_cents em conta comum e valor de face no cartão. Reserva virtual deriva de todos os aportes menos liberações, incluindo Metas arquivadas, sem gerar ledger ou reduzir patrimônio. Todas as somas usam numeric e recusam resultado fora do inteiro seguro; nenhuma soma usa páginas de histórico.

Oracle SQL deriva independentemente o conjunto exato de efeitos e o resultado dos sete comandos, usando a intenção, estado próprio atual e clock de servidor limitado. BEFORE deve ser o registro atual exato. IDs/dono/criação são imutáveis. Não aceita efeito adicional, omitido, duplicado, doador de outra Meta, conta trocada, aporte acima do disponível, liberação acima do remanescente, atualização de original ou imagem inventada. Cada efeito exige um único evento com estado exato; nenhum evento pode existir sem efeito. Efeitos/eventos/recibo são uma transação; no-op grava só recibo.

Arquivar Meta limpa seu destaque na mesma transação e preserva todos os valores. Restaurar não escolhe destaque. A guarda aditiva de Conta, ordenada DEPOIS do finance_project, impede somente uma nova transição archived_at null→nonnull com reserva ativa. No repositório esse é o comando finance.account.close/arquivarContaFinanceira. Não cria estado distinto de encerramento; contas legadas já arquivadas não são modificadas, e suas reservas continuam liberáveis. Após liberação integral, o encerramento torna-se permitido.

O filtro v1/B2 NÃO é substituído. Arquivo05 exige o prosrc consolidado pós-B2 `3bc2076d42fcfe1d140cf24783de5acd679c52d5ddd47db68ba550a96300f3fb`, postgres, security-definer e search_path vazio. O pin foi derivado do blob canônico original `855cff…` com a única substituição B2 de espécies; divergência aborta e requer composição explícita. Nenhuma guarda histórica de ledger é reescrita.

## Limite de mídia aprovado

O schema existente só possui drive/capture_image/avatar; não oferece prova finance_goal_image. O lookup novo devolve null por definição, de modo que imagem nova não nula é recusada. Imagem null funciona, e atualizar outro metadata preservando referência antiga não exige uma nova prova. Este comportamento fail-closed é uma pendência explícita, não implementação da pipeline de imagem. Bytes, storage paths, URLs e dados de arquivo não entram nos ports de Metas.

## Validação e pendências

**Validado localmente, sem banco:** AST128 de11 arquivos TS sem erros sintáticos; ESLint192 de10 arquivos TS com exit0/max-warnings0 (fixture declarativa é ignorada pela configuração existente), repetidos após os deltas de teste/cursor. Isso não é typecheck nem execução de teste. A máquina recusou a junction de dependências; o lint usou configuração/dependências existentes por caminhos absolutos, sem instalação.

**Escrito, ainda não executado nesta entrega:** testes sintéticos do store/gateway/runtime; sequência dos sete comandos; recibo/replay/unknown; DTOs e totais owner/revisão; conta/Meta estrangeiras; mídia fail-closed; callback/ports expirados; no-op. Suíte canônica usa Core→store/gateway→SQL real em WASM, com baseline preservado após oito ataques mais troca por Meta doadora, grants/RLS, histórico insert-only, close antes/depois de liberar, archive sem liberar, e Auth antes de receipt.

O helper herdado B2 fixa a fronteira canônica001–025. Root reconciliará026 explicitamente antes de publicar a cadeia consolidada; este pacote não amplia o loader nem toca migrations.

**Gates ainda obrigatórios:** revisão independente; compiler/lint/layers/secrets e suítes no SHA consolidado do GitHub; catálogo SQL canônico; Auth/RLS hospedados; corrida nativa com duas conexões (aportes, liberações, real spend/close) sob o mesmo lock; rollback por evento/recibo/falha posterior; mídia real; retenção/export/backup/restore; UI, mascaramento, acessibilidade e aceites J9/J11. Alvo futuro supervisionado é exclusivamente `twrydxsdemaykgvdlpyd`; produção/Main permanecem fora desta execução.

PR90 helper é complemento independente: reconciliar somente os quatro paths do commit c74fc57 após peer. Não substitui totais SQL completos nem justifica somar páginas. #79 continua aberta.

Paths desse complemento: `docs/implementation/t054-goal-reserves-contract-spec08.md`, `src/core/financeiro/goal-reserves.ts`, o export aditivo em `src/core/financeiro/index.ts` e `tests/core/finance-goal-reserves.test.ts`. Não foram copiados nesta fatia.

Referências externas consultadas para a proposta: [Database Functions](https://supabase.com/docs/guides/database/functions) e [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). A tentativa de abrir o índice markdown de changelog retornou formato não suportado pela ferramenta; nenhuma mudança recente de plataforma foi presumida ou incorporada por memória.
