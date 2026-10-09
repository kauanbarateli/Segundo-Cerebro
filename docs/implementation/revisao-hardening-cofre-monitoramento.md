# Revisão independente de Cofre e monitoramento — 09/10/2026

A revisão leu Núcleo criptográfico, worker Argon2id, ciclo de vida da UI, port/journal, gateway/HTTP, migration e asserções de Cofre, além de Sentry e verificadores de credenciais. Os achados abaixo foram enviados ao root; após autorização expressa, os quatro ajustes foram implementados neste recorte. Sentry, Google, facade compartilhada e migrations ficaram fora dessas alterações.

## Achados acionáveis

1. **P1 — Cofre não encerra sincronamente no começo do logout.** `src/components/features/cofre/vault-workspace.tsx` conecta bloqueio a unmount/blur/aba oculta/inatividade, mas não ao `DEMO_LOGOUT_EVENT`. O provider dispara esse evento antes de aguardar a limpeza do journal e submeter logout. Uma limpeza pendente pode conservar a CryptoKey, linhas decifradas e editor até a navegação. Acrescentar listener do evento que invoque `lock()` imediatamente, com cleanup; verificar logout enquanto o journal permanece pendente e confirmar chave, campos, kit e editor descartados antes de qualquer resposta.

2. **P2 — Cópia pendente pode terminar depois do bloqueio sem limpeza imediata.** `vault-lifecycle.ts` agenda os 30 segundos somente após `await clipboard.writeText`; `dispose()` só chama `clear()` se já há timer. Ensaio com `writeText` controlado: `copy → dispose → resolver escrita` resultou em uma escrita de cópia, nenhum clear e timer novo de 30 segundos. Capturar epoch antes da escrita, invalidá-lo em `dispose/clear` mesmo sem timer e limpar imediatamente uma conclusão tardia. Exercitar também duas cópias e clear concorrentes, preservando aviso caso o navegador negue limpeza.

3. **P2 — Recuperação inválida conserva buffers temporários.** `core/cofre/crypto.ts` inicializa `left` e `right` antes de entrar no `try/finally` de `recoveryKey`. Se a segunda metade falha, a primeira não recebe `fill(0)`; `parsePart` também precisa apagar seu buffer quando checksum/length falha. Um ensaio instrumentando a alocação, sem imprimir bytes, encontrou um buffer de 32 bytes ainda não zerado após A válida/B inválida. Declarar buffers opcionais antes do `try`, executar ambos os parses dentro dele e zerar cada buffer no `finally`; no parse, zerar antes de relançar erro. Isto é uma falha da garantia de descarte controlado, sem exfiltração constatada. A limitação de apagamento físico de strings JavaScript continua explícita.

4. **P2 — Verificadores de credenciais têm duas lacunas de assinatura.** O regex `server-environment` de `scripts/check-client-auth.mjs` não inclui `CRON_SECRET`, usado pela limpeza de Drive. O negative lookahead de `check-secrets.mjs` isenta qualquer chave com prefixo `fake/test/example/canary/placeholder`, em vez de somente fixtures explícitas. Teste puro confirmou zero findings para o nome de ambiente de limpeza e para um `sb_secret_` de formato válido com prefixo `test` e 32 caracteres adicionais; a chave comum foi detectada. Incluir o nome de ambiente e restringir a isenção a fixtures exatas/curtas. Não imprimir matches: os outputs atuais retornam somente nome de regra/arquivo.

Scanners de assinatura não detectam qualquer HMAC, segredo aleatório sem prefixo ou chave ofuscada. O gate declara essa limitação e complementa `server-only`, fronteiras de import e inspeção de bundle; seu resultado não é uma prova geral de ausência de segredos. Nenhuma credencial real foi usada nos ensaios.

## Ajustes implementados e provas de regressão

Os quatro achados foram corrigidos. `VaultWorkspace` assina `DEMO_LOGOUT_EVENT` por dono e chama o mesmo `lock()` sincronamente, antes de limpeza de journal/navegação; a assinatura é removida no cleanup. Um teste mantém a limpeza do journal pendente, despacha logout de outro dono e do dono atual e confirma bloqueio imediato somente para a conta correta.

Clipboard agora invalida a geração antes de escrever e ordena cópia/limpeza numa fila. Bloquear invalida inclusive cópias em andamento; uma conclusão tardia é apagada antes de terminar, sem rearmar timer. Cópias que ainda não começaram e foram invalidadas nem escrevem. Os testes reproduzem escrita deferred seguida de dispose, nova cópia posterior ao dispose e o intervalo completo de 30 segundos, sem um clear antigo apagar a cópia nova. Uma instância que nunca copiou conserva clipboard externo. A UI confere sua geração após copiar e auditar, evitando mensagem ou auditoria de cópia tardia após bloqueio. Negação de limpeza continua explícita.

Ambos os parses do kit estão dentro do `try/finally` de recuperação. Cada metade já adquirida e a chave recomposta são zeradas em qualquer saída; o parse zera seu próprio buffer antes de relançar erro de checksum/tamanho. Três testes instrumentam as alocações para A válida/B com JSON inválido, checksum inválido e tamanho inválido, verificando todos os bytes controlados em zero sem imprimi-los.

O gate de bundle inclui `CRON_SECRET`. O scanner de assinatura isenta apenas um conjunto de literais exatos de fixtures, sem wildcard por prefixo; credenciais de formato válido iniciadas por `fake`, `example`, `test`, `canary` ou `placeholder`, e uma extensão longa da fixture exata, passam a produzir a regra `supabase-secret`. Resultados continuam somente com nomes de regras, nunca os matches.

A rodada após os ajustes passou **37 testes Vitest** em seis arquivos e **13 testes Node** de scripts. A rodada anterior de SQL do Cofre continua válida, pois nenhuma migration/adapter HTTP foi alterada neste recorte. Verificação de TypeScript/lint integra o checkpoint entregue ao root; browser/logout conectado/clipboard em dispositivos reais continuam nas pendências externas.

## Evidência que passou

Trinta testes Vitest passaram em seis arquivos: os cinco testes de Cofre e `security-monitoring.test.ts`. Argon2id/WebCrypto foram reais nos testes de domínio; o transporte de Sentry recebeu envelopes construídos pelo SDK real e foi substituído por um spy local. Doze testes Node dos scripts de Auth, bundle e segredos passaram com fixtures. O primeiro lançamento Vitest encontrou EPERM na pasta temporária do sandbox, antes de importar os testes; a execução repetida com TEMP/TMP dentro de `work` passou.

`vault-catalog.sql` e `vault-behavior.sql` passaram no PGlite descartável, com as migrations até Cofre e Auth/Storage explicitamente simulados. Nenhuma fixture persistiu. Esses checks confirmam RLS/grants fechados, guarda de usuário/sessão/veto antes de snapshot/recibo/commit, replay antes de CAS, limites de envelope/itens, preservação do recovery na troca de senha, atomicidade e auditoria/recibo somente com metadados/digest. Não comprovam duas transações simultâneas do serviço hospedado.

O fluxo normal usa chave aleatória de 256 bits, sessão não extraível, Argon2id fixo 64 MiB/3/1 sem redução silenciosa, AES-GCM com IV aleatório de 96 bits e AAD de dono/item/versão. Preparação prova os dois arquivos de recuperação contra a chave original; rewrap mantém o kit antigo. A UI usa geração para impedir reabertura por unlock tardio, cancela workers e preserva diagnóstico individual de cifras ilegíveis. Os achados de ciclo de vida acima precisam complementar essa proteção.

## Privacidade do monitoramento

Não foi constatado envio de payload bruto no caminho revisado. `safeMonitoringEvent` e `safeMonitoringTransaction` reconstroem objetos fechados: removem usuário, request, URL, query, stack, breadcrumbs, conteúdo, valores financeiros e spans. Nomes de transação e exceção são literais fixos; áreas são enum. Coleta automática, logs, perfil e amostragem estão desligados. O transporte final filtra novamente e descarta anexos/sessões/logs e sampling headers. Os testes plantaram canaries em eventos, transações, headers e envelope final; nenhum chegou ao spy de envio.

`POST /api/monitoring` aceita até 256 bytes e apenas `{area}` do enum, exige Origin/sessão ativa/ausência de troca obrigatória e limite por conta. O browser nunca envia o objeto Error. SDK/DSN ficam no adapter de servidor. A revisão não carregou DSN real nem iniciou o transporte de produção.

Permanecem externos: aplicar migrations manualmente, testar sessões/usuários reais e corridas de revogação, medir Argon2id em dispositivos móveis, confirmar permissões de clipboard e jornadas conectadas com reload. Nenhum build, browser, servidor, Git, `.env`, SQL remoto ou SDK de produção foi executado nesta revisão.

## Complemento transversal: encerramento de sessão

A revisão posterior encontrou que o provider desativava a máscara ao iniciar logout, enquanto Busca/Relacionados conservavam títulos financeiros em estado local. O recorte autorizado corrigiu `demo-provider`, `command-palette` e `related-panel`: modo conectado mantém privacidade em `true`, marca `closing`, desmonta a árvore de conteúdo e recusa setters de privacidade tardios. O reset de demonstração usa uma nova chave da árvore e só redefine sua preferência depois da desmontagem anterior. Queries compartilhadas não carregam durante `closing`.

Busca e Relacionados escutam logout do dono, limpam memória local (texto, resultados, destinos, seleção, intenções e erros), abortam seus próprios transports e invalidam a geração. Respostas cujo `json()` termina depois do logout são ignoradas, mesmo se um transport simulado desconsidera o abort. Eventos antigos de escolha/escrita não iniciam novo fetch/comando. Nenhum título financeiro reaparece em texto, option ou aria-label após o encerramento. A revisão cruzada encontrou ainda que desmontar o Shell remove seu formulário de logout; após a limpeza, o provider agora cria um formulário nativo oculto, sem campos, conecta-o ao DOM e envia ao endpoint cookie-only, em vez de submeter o nó removido.

Seis testes novos exercitam as surfaces e callbacks reais com hooks/DOM controlados e renderer estático, sem browser: leitura tardia, chooser tardio, busca tardia, ausência de queries em closing, setter antigo de privacidade e submissão de formulário conectado após remover o original. Com as regressões existentes de ConnectedApplication/Busca, passaram **57 testes**. Esses doubles confirmam a geração, aborts, limpeza e HTML reconstruído; a jornada de logout no navegador real segue sob validação integrada do root.
