# T024 — Cofre cifrado no cliente

O Cofre aceita uma senha mestra e grava exclusivamente envelopes cifrados. A criação exige confirmar a irrecuperabilidade ao perder senha e kit, baixar duas metades em arquivos separados e reabrir esses arquivos para provar a recuperação da chave original byte a byte. Título, tipo, usuário, senha, endereço e nota do item ficam dentro de AES-256-GCM; a interface mostra somente títulos após decifrar no navegador.

## Modelo criptográfico

Uma chave de dados aleatória de 256 bits protege os itens. Argon2id deriva a chave da senha com salt aleatório de 128 bits, memória de 64 MiB, três passagens e paralelismo 1. O adapter usa hash-wasm 4.12.0 em um worker descartável: o navegador precisa oferecer WebCrypto em contexto seguro, Web Workers e WebAssembly. Os parâmetros não são reduzidos silenciosamente em aparelhos lentos. O worker termina após cada operação, erro, cancelamento ou timeout; os buffers temporários controlados pelo cliente são sobrescritos. Strings JavaScript ficam sujeitas à coleta de lixo e não oferecem uma garantia de apagamento físico.

A chave de dados tem dois envelopes: um pela chave derivada da senha e outro por uma chave aleatória de recuperação de 256 bits. Essa chave de recuperação é dividida em duas metades XOR; uma metade sozinha não a revela. Cada arquivo contém formato, dono, identificação da metade, bytes e checksum SHA-256 para detectar corrupção. A prova recompõe a chave, abre seu envelope e compara todos os bytes com a chave de dados original antes da gravação.

Na sessão, a chave é importada com `extractable:false` e usos restritos a cifrar/decifrar. Cada gravação usa IV aleatório de 96 bits, tag GCM de 128 bits e AAD `user_id:item_id:version`. Editar incrementa a versão; excluir/restaurar preserva a versão e o envelope. Trocar somente o payload entre itens, donos ou versões falha na autenticação. Um rollback de todo o registro, incluindo versão e cifra, exige uma fonte confiável de histórico para detecção; AAD sozinho não promete essa proteção.

Troca de senha e recuperação reencapsulam atomicamente a mesma chave de dados. Os itens não precisam ser recifrados, e o envelope de recuperação é imutável: o kit antigo continua válido, como a tela informa. Nunca se exporta a CryptoKey da sessão. Recuperação pode operar a partir de cabeçalho cifrado, itens e kit em um navegador sem a chave anterior.

## API, recibos e banco

`GET /api/vault` retorna `VaultSnapshot {revision,header,items}` cifrado e sem cache. O reader da feature valida dono, shape e limites; bytes ilegíveis em um item continuam visíveis para diagnóstico individual, sem esconder o registro. O POST aceita apenas `{command,input}` do tipo `VaultInput`, com `client_id` e `expected_revision`. São permitidos criar Cofre, reencapsular senha, CRUD/lixeira/restauração de itens e auditoria por enum. Não há campo livre de log. Inputs com senha, kit, título ou dono são recusados.

Autenticação, requisito de troca de senha, entitlement e conta esperada precedem o parse do POST. O canal deriva dono, sessão, instante e id de evento no servidor. O corpo tem teto de 128 KiB; o item em claro tem teto de 32 KiB no cliente, envelope cifrado de 48 KiB no servidor e até 500 itens com snapshot completo de 8 MiB. Tamanho não implica validação do conteúdo decifrado no servidor, que não possui a chave.

A migration `20261009160151_encrypted_vault.sql` cria chaves, itens e revisão com RLS ligada, nenhuma policy JWT e grants diretos revogados, inclusive ao service role. Funções RPC públicas são invoker e somente o canal de servidor pode executá-las; funções privadas revalidam ator após locks dos pais Auth e `capture_task_lock`. Snapshot, commit e receipt repetem a guarda. O CAS é global para o Cofre, replay ocorre antes de CAS e após autorização, e rate limit persistente reaproveita o limite de escrita de domínio.

SQL valida o envelope, calcula SHA-256 da intenção cifrada e grava no recibo somente digest mais resultado `{id,revision}`. Mutação, metadados de evento e recibo ficam na mesma transação. A auditoria `vault_metadata` é uma lista fechada de `id,user_id,operation,version,occurred_at`, sem estados cifrados ou campos livres. CHECKs adicionais no banco impedem copiar ciphertext ou material de chave para auditoria/recibos e preservam tipos de evento de outros módulos.

## Sessão e interface

O Cofre bloqueia após cinco minutos sem atividade, ao ocultar a aba e quando uma sessão já desbloqueada perde foco da janela. Ocultar a aba ou atingir timeout também descarta a preparação do kit e cancela Argon2id. O diálogo nativo de escolher arquivos pode desfocar a janela durante preparação/recuperação, antes de existir sessão desbloqueada; isso permite selecionar as duas metades. Bloquear remove chave, itens decifrados, editor e campos de senha/kit da interface. Respostas tardias não reabrem uma geração já bloqueada. Troca de conta, veto ou expiração da sessão também removem os dados abertos.

Copiar é uma ação explícita e agenda limpeza do clipboard em 30 segundos; a tela oferece limpeza imediata. O navegador pode negar escrita posterior sem ativação/foco: o erro é mostrado e a tela informa essa dependência. A validação em aparelhos reais continua necessária. A demonstração executa a mesma cifra, mantém somente ciphertext em um port de memória por sessão e avisa que recarregar descarta o Cofre; nenhum segredo, senha ou kit é salvo em localStorage/sessionStorage.

## Evidência e pendências

- 24 testes focados passaram em cinco arquivos: Argon2id/WebCrypto reais, não extraibilidade, AAD, prova/kit antigo, sessão limpa de chave, dados corrompidos visíveis, cipher-only commands, concorrência/idempotência, rollback do adapter, lifecycle de cinco minutos/blur/hide, clipboard de 30 segundos, gateway e HTTP com veto/isolamento/limites/sanitização. A suite completa levou cerca de 3,5 segundos no host local; isso não é um benchmark de aparelho móvel.
- Parser estático aprovou migration (39 instruções, 15 funções, 2 blocos) e `vault-catalog.sql`/`vault-behavior.sql` (com rollback). Os fixtures SQL são cifras sintéticas e verificam protocolo/atomicidade, sem pretender provar criptografia.
- Quatro jornadas E2E estão preparadas em `vault.spec.ts`: fluxo real em 390/1280px, geração/prova/CRUD/recuperação; ocultar aba; e contexto de navegador limpo com Argon2id real. O harness isolado de crypto usa bypass de CSP explícito; as jornadas da UI verificam worker/CSP do produto. Sua execução, browser/visual e os portões integrados ficam com o root.

Aplicação manual da migration, políticas/grants no Supabase real, dois usuários/sessões reais, corridas entre revogação e escrita, persistência conectada após recarregar, custos/memória de Argon2id e permissões de clipboard em celulares continuam pendentes externos. Esta frente não aplicou SQL, abriu browser/servidor, leu env ou acessou banco remoto. O modelo não promete resistência a um XSS já executando no navegador desbloqueado; CSP e disciplina de dependências continuam parte da proteção.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
