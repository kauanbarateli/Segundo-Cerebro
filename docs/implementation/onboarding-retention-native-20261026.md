# Retenção do onboarding — protocolo nativo Foundation

Referências: #62/O1, [doc18](../planejamento/18-convergencia-prototipo-20261025/README.md), [backend](onboarding-backend-20261023.md) e SQL026 canônica. A proposta original foi preparada sobre69ed5e7afb4249c26c730bec23018357bda0498b e incorporada em0310. **Estado observado em be07:** os sete casos nativos passaram no Foundation de push40350794023, com Source/log/83blobs conferidos por Root; a [prova sanitizada](evidence/onboarding-retention-native-be07-20261026.json) conserva esse vínculo e seus limites. Isso não certifica agendamento autônomo, banco hospedado ou produção. Merge/produção continuam bloqueados.

## Escopo

Os sete casos R01–R07 ampliam o harness Foundation existente. O único entrypoint continua `scripts/verification/foundation-local-ci.mjs --execute`, exclusivamente no runner Linux do workflow Foundation. Import/help não inicia infraestrutura. Não há novo executor, SDK, endpoint, argumento de SQL, caminho de fixture externo ou conexão remota. O carregamento CURRENT27/ledger/catálogo2512/tipos/seis workers e seus checks permanecem obrigatórios.

O envelope cria uma stack local efêmera qualificada por Source, identidade Docker/PG17, systemIdentifier e marcador. Duas contas comuns e duas sessões são geradas pelo Auth dessa stack, com marker de fixture. Não se usa QA, Supabase hospedado, Vercel, navegador, SMTP, Google ou arquivo privado. As credenciais locais não são carregadas do usuário, exportadas ou impressas. Não há reset, seed ou nova migration; CURRENT27 é instalado somente na infraestrutura própria descartável do ensaio, como já faz Foundation.

## Casos finitos

| Caso | Evidência exigida |
| --- | --- |
| R01 | Coordenador real inicia/salva draft;720h exatas, snapshot, pausa e replay do mesmo save conservam o deadline. |
| R02 | B segura Auth SHARE+advisory exato; A fica bloqueado, provado por pg_blocking_pids/pg_locks. B espera relógioPG atingir deadline e confirma sweep. A deve terminar naturalmente com40001, sem mutação de perfil/recibo/evento; backend/grupo ausentes.55P03/timeout não passa. |
| R03 | A confirma perfil antes do deadline com ACK COMMIT; sweep posterior remove payload e conserva exatamente perfil/recibo/evento confirmado e material deB. |
| R04 | Advisory global produz BUSY e não altera health/lastCompletedAt; liberação permite páginas finitas. BUSY nunca é convertido em sucesso de limpeza. |
| R05 |Somente o atorA local é marcado bloqueado por ticket vinculado e prova SQL;100 rodadas antigas com locks deA não impedem2 deB. Cursor visita/pula100, limpa2, reseta após página vazia e limpa100, inclusive sem login/permissão do titular.306 versões inativas/unknown perdem o payload. |
| R06 | Backlog controlado121s é observado como violação antes da limpeza; no máximo3 ticks declarados neste caso. A limpeza posterior não apaga a violação observada e não comprova SLO de agendador. |
| R07 | Sweep invoker e ACL reais recusam acesso a anon/authenticated/service_role; nenhum grant é acrescentado para facilitar o ensaio. |

R01–R03 usam a intenção mínima de Perfil pelo coordenador existente. A fixture de versões possui102 rodadas históricas `complete`, evitando inventar102 rodadas abertas para dois usuários. Não se fabricam permits nem recibos confirmados. IDs/bindings/hashes de material ficam em RAM. A prova de outros módulos continua nos contratos/MainHTTP próprios; não alegar que esse ensaio cria todas as entidades.

R04–R06 esperam exatamente dois eventos legítimos de expiração deB, ligados aos UUIDs101/102 derivados do namespace, com dois IDs distintos e o formato canônico completo `onboarding_round/updated/web`, before nulo e after expired/summary/revision1/counts blocked1. Somente esses eventos têm contadores próprios; todos os demais eventos, perfil e recibos deB continuam no hash invariável. Evento faltante/duplicado/malformado ou alteração alheia impede PASS. Esta distinção corrige um achado da revisão independente, sem excluir genericamente os eventos deB.

### R02 e rollback real

O transporte preserva `psql ON_ERROR_STOP=1`. O SQLSTATE40001 original termina o cliente com exit3/close3 e EOF natural dos dois streams. A conexão é encerrada e sua transação revertida pelo PostgreSQL; a ausência do backend, do grupo e de mutações confirma o resultado. Não se exige nem se inventa um ACK ROLLBACK posterior de um processo que já terminou. B conserva o ACK COMMIT real. Essa adaptação explícita foi aprovada pela Root; não desliga ON_ERROR_STOP e não substitui a prova por recusa genérica.

## Transporte e limites

`foundation-retention-contract.mjs` emite tickets por WeakMap nominal. Cópia de shape, stringSQL ou ticket de outro contexto não autoriza instrução. Os builders aceitam somente os dados sintéticos fechados de cada ação. O framing liga nonce, sequência, write callback original e ACK. O adapter `foundation-retention-session.mjs` não importa contratos financeiros nem amplia suas allowlists.

Dois psql por caso, PIDs distintos, loopback54322, postgres, UTC, ambiente fechado e application_name por namespace/ator.60s por caso,15s por instrução, lock5s/idle30s; somente A/R02 usa lock12s para atravessar deadline10s. As observações do relógioPG são finitas. Não há retries automáticos ou `pg_sleep` usado como evidência de bloqueio.

O orçamento de60s revoga a admissão de novo trabalho e aborta Auth/clientes persistentes pelo signal do caso. A quiescência de I/O já em voo continua submetida aos seus próprios terminais/deadlines; não se promete preempção física no milissegundo. Expiração do orçamento impede PASS e cleanup novo até a reconciliação apropriada.

EOF, exit e close são contados individualmente. Missing/duplicado, sinal, frame extra, nonce incorreto, callback perdido, grupo não confirmado ou ACK de COMMIT/ROLLBACK perdido preservam falha/unknown. Uma resposta posterior não cura a primeira falha. Nenhum resultado desconhecido autoriza nova intenção ou cleanup cego.

## Source e limpeza

O collector deriva os imports e os arquivos explícitos, compara bytes com os blobs Git e mantém pins CURRENT27/binários/dependências. O manifesto do pacote de autoria registra o delta de paths antes/depois; não ajustar contador por tolerância, intervalo ou tentativa. A Source de execução futura será o commit real aprovado, não a Source histórica da proposta de retenção02310 nem desta autoria69ed por herança.

Antes de cada caso exige-se ausência de fixtures. Depois de sessões terminadas e I/O quieto: conferir os mesmos IDs/marker, revogar sessões, excluir somente os dois atores locais próprios e confirmar cascatas/zero rounds/intents/commands/permits/OAuth. Um sweep vazio real reinicia o cursor para o caso seguinte. Não alterar diretamente health/cursor. Se transporte/escrita permanecer incerto, preservar a falha, quiescer e recusar a limpeza; o envelope não declara sucesso.

O ACK vazio HTTP200 de hard-delete é admitido conforme o contrato nativo existente do Admin; ele não prova ausência. Exige-se antes a leitura do mesmo ID/marker, depois GET404 do Auth e a prova SQL de ausência/cascatas. Um ACK com usuário divergente é recusado.

A prova SQL fecha21 contadores: Auth users/sessions/refresh_tokens/identities, identidade/preferências/módulos/papéis/moderação/entitlements, eventos/recibos/rate-limits vinculados, foco e todas as tabelas de rodada/intenção/comando/OAuth. Nenhuma cascata é inferida apenas do DELETE ou do desaparecimento de auth.users. A linha operacional de health/cursor é preservada e observada separadamente.

O relatório Foundation versão2 conserva os campos anteriores e acrescenta o recorte de retenção. PASS global exige sete casos próprios, isolamento, ACK/terminais e cleanup comprovado. Nenhum artefato publica SQL/rawframes, usuário/e-mail/UUIDs de atores, tokens/senhas, conteúdo ou hashes vinculáveis a pessoas. Os relatórios marcam `autonomousRetentionAccepted=false`, `hostedValidated=false`, `productionValidated=false`.

## Validação e limites atuais

Comandos após revisão, no GitHub:

```text
node --test tests/scripts/foundation-retention.test.mjs tests/scripts/foundation-local-ci.test.mjs
node scripts/verification/foundation-local-ci.mjs --execute
```

O segundo comando exige o ambiente finito montado pelo workflow existente, não deve ser executado no notebook ou com credenciais externas. Contratos puros usam streams/processos sintéticos declarados e não qualificam PostgreSQL. No pacote histórico de autoria a execução nativa estava NOT_RUN; o resultado posterior de be07 está vinculado à prova no início deste documento, sem reescrever aquele pacote ou herdar aceite para novos candidatos.

**Pendentes:** revisão Root/peer, aplicação do patch em candidata qualificada, lint/typecheck/collector/gates e execução dos sete casos no GitHub. Nenhum PG17 nativo, Auth local, SQL ou serviço foi executado pela autoria. MainHTTP protegido, frequênciav2 conectada, zoom200%, aceite humano #44 e O1-Cron continuam aceites próprios. O ensaio não instala/ativa Cron e não fecha a retenção autônoma por associação.
