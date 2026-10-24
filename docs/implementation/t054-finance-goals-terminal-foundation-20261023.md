# Metas #79 — M1 V2 da fundação terminal

23/10/2026. Base `bafc9f654d43c2b952d0c0835e89893a6598e29e`. Complementa o [protocolo terminal](t054-finance-goals-terminal-settlement-20261023.md). Implementado em seis arquivos isolados, **sem execução dos testes, aplicação ou ativação**. Fontes originais Goals, Core/canais, migrations001–026, helpers históricos, tipos gerados, flags e operador de restore permanecem intactos.

## Decisão e diferença explícita do V1

Root aprovou a alternativa A em `root-terminal-v2-decision-20261023.md`, evidência pública de23/10. V1 foi preservado e **não aprovado no codec**: manifestSHA `0d3a5549fa20add276b2f50216e72f0dc5403eeba58e4ec53f67dbf2930a9d7e`. O diagnóstico público Root PGlite0.5.8/Node24.19 encontrou32 fases:20 aprovadas,12 recusadas por NUL22P05/surrogate22P02, inclusive usando tipo json e extração de client_id. Não é evidência PostgreSQL nativo/hosted nem teste completo M1.

V2 usa texto opaco no caminho sem recibo. **Perde a tentativa de validar no SQL a estrutura/namespace dentro do texto; não é equivalente ao V1 nem prova autônoma de canonicalização.** O novo protocolo terminal é **version2** em requisição, binding, resposta e disposição persistida. `canonicalization_version` continua1 e `GoalCommandResult.version` financeiro continua1. V1 terminal não é aceito e não existe fallback/downgrade. Nada desta decisão transforma um input não representável em JSONB num comando financeiro gravável.

## Responsabilidades e limites de confiança

1. `finance-goals-terminal-canonical.ts`, server-only: `decodeGoalCommand` recebe o original e valida/clona descritores; uma captura nominal em WeakMap conserva owner/comando/UUID/corpo. Calcula a **assinatura existente** `assinatura(input)` e SHA256 UTF-8 antes de await. Não aceita canonical_input, digest ou namespace paralelo do navegador como autoridade. A porta futura recebe cópia, sem poder mudar a captura por alias. O handler futuro continua responsável pelo actor autenticado; o helper não autentica sozinho.
2. SQL: valida somente o envelope fechado de **cinco** chaves `{version:2,canonicalization_version:1,command,client_id,canonical_input}`, sete comandos, UUID minúsculo, tipos/versões, texto não vazio, quotas de64KiB UTF-8 do texto e256KiB do envelope privado. Revalida Auth/sessão/Entitlement, lock, namespace **externo**, hash e fences. Não chama parser json/jsonb nem regex de estrutura sobre o corpo interno quando não há recibo.
3. A string transitória contém escapes de JSON.stringify preservados, duplamente escapados no transporte externo JSONB. SQL só lê o campo textual externo e calcula SHA dos bytes; não decodifica nomes/NUL/surrogates. Corpo/fingerprint/resultado financeiro não são duplicados na disposição, evento ou resposta. O digest ligado ao Usuário continua dado pessoal pseudonimizado.
4. Namespace decisório é `(actor.user_id, envelope.command, envelope.client_id)`. Qualquer disposição desse namespace impede efeito posterior, independentemente do digest/corpo apresentado. Outro digest na consulta/settle conflita; não substitui ou apaga o fence.
5. Resposta fechada `{version:2,kind,binding,...}`. Binding contém version2, user_id, comando, client_id, canonicalization_version1 e input_digest. O helper compara à captura original. `confirmed` inclui o resultado financeiro1 e usa o decoder original contra aquela intenção; `closed` inclui disposição2 com id/closed_at; `uncertain` não inclui prova terminal. Resposta perdida/adulterada não autoriza outro UUID.

**Limitação testada, sem disfarçar validação:** service_role com sessão válida pode fornecer envelopeA/textoB ou texto não JSON. SQL pode criar só fence/metadados para o namespace externoA; não prova que B era GoalCommand ou continha client_idA. Isso pode bloquear um UUID indevido por erro/abuso do servidor. Não permite efeito financeiro, mudança de owner ou reabertura de namespace fechado. O teste exige que a captura honestaA recuse a resposta com digestB e que o commit financeiroA fique bloqueado. A proteção contra browser é service-only/zero grants, construtor nominal e handler que não deixa o browser montar esse envelope. Não alegamos resistência de disponibilidade contra credencial privilegiada comprometida mais sessão válida do alvo. Hash não prova origem humana nem semântica.

## Recibo anterior continua forte

Sob fg_guard/lock, recibo e disposição simultâneos são corrupção e recusam. Antes de interpretar qualquer fingerprint, o recibo precisa ter request do tipo JSON-string e **igualdade textual exata** com a assinatura capturada. Sem JSONB::text, normalização ou equivalência de parse.

Somente nesse ramo é convertido a JSONB o **fingerprint armazenado no recibo**, seguido de `fg_command`, comparação explícita do `client_id` interno com o namespace e `fg_result`. Um recibo legítimo do executor atual já passou pelo JSONB/validadores originais. Um recibo sintético/corrompido com NUL/surrogate, client_id divergente, request não string ou resultado inválido deve falhar fechado, sem fabricar closed/confirmed nem criar disposição. O servidor ainda aplica `decodeGoalCommandResult` ao resultado vinculado. Mudança de revisão atual, arquivo da Meta, Conta/Imagem indisponível não reexecuta o negócio nem altera replay legítimo.

## Persistência, locks e compatibilidade preservados

- `01-dispositions-and-fence.sql` é **DRAFT_ONLY + ROLLBACK**, sem migration canônica. Tabela privada com RLS, zero policies/grants API, PK namespace, versão2 e digest32bytes. Insert-only; DELETE somente no cascade da identidade Auth. Sem purge temporal enquanto o namespace puder ser aceito.
- `finance_goal_attempt_status(uuid,uuid,jsonb)` é readonly: obtém locks e lê, sem marcador/evento/recibo/limite/executor. `finance_goal_attempt_settle` é escrita explícita de controle sob o mesmo lock; recibo vence, disposição idêntica é idempotente, ausência cria disposição+evento atômicos. Não exige CAS/recurso/saldo atual nem grava dinheiro.
- `fg_guard` existente preserva pais Auth/sessão→`capture-task:<owner>`→actor/Entitlement. Autenticação vem antes até de recibo antigo; não existe lock alternativo. Os dois novos wrappers são service-only; helpers privados sem grants diretos. Não há novo método no HTTP/client/controller nesta entrega.
- Cópia exata do prosrc original para `fg_terminal_previous_commit`, sem renomear o original; `CREATE OR REPLACE fg_commit` conserva seu OID. Seis wrappers públicos, seus corpos/grants e fontes originais não mudam. Replay delegado ao executor original; sem recibo, fence antes do executor/efeitos.
- Guards BEFORE de recibo/disposição impedem coexistência sob o lock, inclusive contra chamada interna ao executor copiado. Recibos dos demais módulos não mudam. O teste do executor copiado usa corpo coerente posterior ao encerramento e exige erro exato do guard+baseline; não confunde um retorno CAS stale com rollback depois de efeitos transitórios.
- Evento `finance_goal_disposition`, created/web, antes nulo e depois metadata mínima, na mesma transação; CHECK anterior de espécies preservada com somente essa adição. Sua retenção histórica não apaga o fence. OBSERVADO: finance_bump já observa eventos finance_*, podendo invalidar prévia aberta; não prometemos revisão estável nem bump exato.

Gate de fonte: oito prosrc derivados do Git (fg_commit, fg_guard, seis wrappers), SHA/propriedades/owner/ACL fechadas. Prosrc original de fg_commit: `86377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf`. Helper novo fixa o SQLV2 inteiro antes de construir SQL-in-WASM e compõe001–026→Budget→Series→Goals pelo helper026 original. Não reescreve pins dos companions; catálogo completo final continua gate separado.

## Matriz escrita, não executada

| Camada/caso | Resultado exigido no V2 |
| --- | --- |
| Sete comandos/quinze patches, permutação de chaves/null/omissão | Assinatura existente e SHA exatos; nenhuma normalização |
| Getter/alias/token forjado/canonical_input paralelo | Construtor/decoder servidor recusa; captura original preservada |
| Protocolo terminal1/3, versão string, método2 | Recusa fechada; financeiro1 não muda para2 |
| Envelope extra/missing/array/boolean, UUID inválido/uppercase, texto não string/vazio | Recusa sem alteração material |
| Texto65537bytes ou Unicode32769×é, envelope externo excessivo | Quota recusa sem truncar; fronteira65536bytes testada explicitamente |
| NUL/high/low/astral/U2028/U2029/controles/acentos | Transporte textual externo+SHA; ausência/status/closed sem parse interno |
| Duplicata top-level/patch, array ou JSON inválido **dentro do texto** | Não é mais promessa de recusa SQL: entrada raw rejeitada no construtor; chamador SQL privilegiado só pode gerar metadata/fence e captura honesta recusa seu positivo |
| EnvelopeA/textoB com client_id interno diferente | Limitação explícita acima; zero linhas financeiras alteradas e executorA bloqueado |
| Mesmo namespace/texto idêntico ou diferente | Idempotência do marcador/evento; digest diferente conflita; nunca reabre |
| Recibo legítimo antes do encerramento, depois de arquivar a Meta | Confirmação financeira1 original; status/settle/replay sem nova escrita |
| Recibo request não string, client_id internoB sob chaveA, resultado inválido | Recusa do validador original/namespace, baseline completo intacto |
| Recibo sintético não representável NUL/high/low | Erro de codec fechado; nunca inventar closed/confirmed |
| Wrapper antigo e corpo copiado depois do fence | Wrapper recusa antes de efeitos; corpo copiado atinge receipt guard e rollback integral |
| INSERT de recibo sobre fence ou disposição sobre recibo | Exclusão mútua; sem estado contraditório persistido |
| Mutação/DELETE de fence e DELETE de recibo Goal | Recusa; cascade de identidade de fixture é a única exceção |
| Evento falha após INSERT da disposição | Rollback posterior material, sem marcador órfão |
| Other owner/session, veto financeiro, sessão revogada, anon/authenticated e helper direto | Auth/grants recusam antes de qualquer resultado positivo |
| OID/corpo/ACL dos seis wrappers e OID do commit | Identidade preservada; corpo privado copiado exato |
| RLS/policies/grants/tgfoid+tgenabled | Tabela/helper fechados; apenas dois wrappers novos service-only |

As recusas e replays comparam baseline ordenado completo de disposições, Metas, reservas, liberações, destaque, ledger, todas as contas, revisões financeiras, eventos, recibos e rate limits. As decisões opacas positivas comparam também todas as linhas financeiras antes/depois, distinguindo metadata/revisão de dinheiro. Há injeção focal de falha no evento para rollback posterior. Não afirmamos concorrência nativa por usar uma conexão.

## Validação e bloqueios de ativação

Nesta autoria: apenas escopo textual, hashes e diff/reversibilidade. **Nenhum Node, parser, lint, typecheck, teste, SQL, conexão, serviço ou publicação executado.** V1 ficou preservado; testes antigos de estrutura interna mudaram de camada somente por decisão explícita Root, sem catch/skip para Unicode.

Root pode executar serialmente lint/typecheck/layers/segredos e os dois testes novos com helper026. Depois: peer independente, composição nas duas ordens com E1-A, PostgreSQL nativo com duas conexões (commit→settle, settle→commit, chamada velha aguardando lock), Auth/RLS/HTTP/client/controller/journal/UI terminais e confirmação humana/reconfirmação atual. ReconcileV1 permanece readonly e ausência de recibo não libera o journal. Limitador de abuso da futura rota não é autorização implícita destes RPCs para browser.

**Recuperação permanece bloqueadora:** preservar fence mínimo em retenção/backup/restore ou rejeitar permanentemente gerações anteriores antes de reabrir escritas. M1 não muda operador nem autoriza restauração/migration/flag/merge/deploy. #79 permanece aberta e sem ativação.

## Composição Root para validação

Os seis arquivos V2 foram transportados por hashes para o candidato sobre dab149c, sem tocar no freeze V1/V2. Root acrescentou somente a tipagem explícita das linhas de catálogo no teste SQL, preservando queries e asserts. Isso previne o mesmo tipo de TS2339 demonstrado pelo CI de imagens; não equivale a Typecheck executado.

Um teste adicional compõe E1-A e M1 nas duas ordens, exigindo o mesmo OID do executor, constraints/trigger de imagem, helpers privados, consulta incerta sem escrita e disposição/evento idempotentes sem linhas financeiras. A revisão global pode avançar pelo evento existente; depois do primeiro encerramento, consultas/replays não podem avançá-la novamente. Esse teste é descartável e serial: não prova concorrência nativa, bytes do Storage ou recuperação.

Merge e produção continuam bloqueados. A branch tem guarda de deploy própria desligada, e as26 migrations canônicas e os cinco SQL originais de Metas permanecem preservados. A seleção local de fotos é outra fatia de apresentação; não cria uma prova finalizada nem libera a intenção financeira.

Antes da publicação, Root acrescentou uma proteção finita de abuso: só a criação de uma disposição nova consome a política existente capture_task_write de30/min do próprio Usuário, depois do retorno de confirmed/closed e antes do INSERT. Status e replay não consomem nem escrevem. Não houve novo escopo ou alteração da política histórica. Outro teste descartável satura o bucket sintético, exige PT429 com rollback material integral, preserva consulta/replay e retoma a mesma intenção após envelhecer somente os hits da fixture. O helper fixa o SQL resultante; o freeze V2 original permanece preservado e o delta recebeu peer próprio.

O portão local de camadas aprovou540 módulos/2.347 dependências. O lint focal inicial dos11 TypeScript/TSX passou sem erros/avisos de regra; uma mensagem do plugin React sobre resolução foi tratada com o vínculo das dependências instaladas no worktree antes da reconferência. Nenhuma instalação nova, compilação completa ou SQL local foi executado. Os testes pesados continuam no GitHub, com resultados pertencentes ao SHA publicado.
