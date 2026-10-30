# #104 — Source fa4, 16 nativos qualificados e captura ainda bloqueada

**OBSERVADO:** a coorte de `fa4dc9e5bc1b254725952c3b67dd3391c61996f8` encerrou 20 runs e 22 jobs: **19/20 runs e 21/22 jobs SUCCESS**, todos na tentativa original. O [geral da PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40162766451) terminou SUCCESS. O único FAIL é o [geral push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40162764472), na captura. A #104 permanece aberta; merge e deploy de produção continuam bloqueados.

Source `fa4dc9e5bc1b254725952c3b67dd3391c61996f8`, tree `2d52bfdd5ef30b1089989ec7c9c9cfbbcd2a55c7`, na [PR #120 draft](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120). Os oito logs de push mostram checkout fa4; os oito logs da PR mostram checkout real `718256ef820dfe8abf579f6e782a86b8a35774df`. Depois dessa identificação nos originais, um único Git commit GET do Root comprovou a mesma tree e os pais ordenados main `336e1b7c2a2f5efba871eb0ad461b04bba065c41` + fa4. Não houve merge real em main. A igualdade de app src `760392b7d9ad33b2e3b5ea840800d52a302bd709` não foi usada como prova de checkout nem para herdar PASS anterior.

Os **16 originais nativos próprios** passaram na revisão de shape fechado, step, checks, contadores, Sources e cleanup. São oito perfis, cada um nos eventos push e pull_request:

| Perfil | Versão real do relatório | Casos por job | Sources | Dependências |
| --- | --- | ---: | ---: | ---: |
| Auth | schemaVersion 4 | 3 | ausentes por contrato | ausentes por contrato |
| Admin Browser | schemaVersion 1 | 2 | 542 | 61 |
| Admin Backend | schemaVersion 1 | 3 | 101 | 45 |
| Recovery | schemaVersion 1 | 1 | 268 | 60 |
| Avatar | schemaVersion 1 | 1 | 96 | 45 |
| CaptureStorage | schemaVersion 2 | 1 | 105 | ausentes por contrato |
| N12 | version 2 | 12 | 172 | 45 |
| I8 | version 1, suite images-terminal-v1 | 8 | 172 | 45 |

O inventário consolidado contém **620 caminhos únicos**, compartilhados entre os relatórios: **619 blobs Git** conferidos por tamanho e SHA256, mais **um sentinela vazio** `node_modules/server-only/empty.js`, de zero bytes e SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, explicitamente fora do Git. Não são 619 arquivos exclusivos de cada gate. Os inventários próprios push/PR presentes coincidem, incluindo seis pares de dependências. Não houve download do registry ou aceite de instalação local. Auth4 não recebeu inventário fictício, e CaptureStorage não recebeu dependencyHashes.

N12 comprova os 12 confrontos de CREATE/CONTRIBUTE/RELEASE × COMMIT_FIRST/SETTLE_FIRST/OLD_EXECUTOR/TWO_SETTLES, com os checks e contadores do contrato atual. `sameIntentReplay` cobre status e settle da **mesma intenção original**, com o mesmo comando/token/envelope e outra sessão válida do mesmo dono no segundo settle. Isso não aceita reaproveitar client_id com payload/intenção diferente, nem amplia o aceite para replay de UI ou hospedado.

I8 possui oito grupos próprios, stack/namespace/relatório separados e nenhum recibo herdado de N12. Seus checks materiais cobrem binding/cleanup de create/update, oito holders, commit/rebind/replay, settle/fence e negativos/rollback. I5 exige holders 8/cleanupAcks 8; I6 exige duas receipts, dois efeitos financeiros e duas referências no seu recorte. O aceite é de **binding e ciclo terminal de metadados em PostgreSQL**, sem transferência de bytes Storage, navegação/browser ou aceite conectado/hospedado. Os contratos usam os campos reais version 2/version 1; não há campo literal validatorVersion acrescentado.

Nos quatro jobs N12/I8, os originais registram Node 24.21.0, CLI 2.120.0 e PostgreSQL 170011; pending commands/http/backends zero, cleanup groups/backends/stack/temp true e writeOutcomeUncertain false. hostedAccepted/browserAccepted/imagesAccepted/restoreAccepted/productionEnabled permanecem false. Esses resultados não concedem aceite hospedado, RLS conectado de duas contas, restore ou produção.

A falha de Captura permanece fatal. O original do push run `40162764472`, job `121077588130`, SHA256 `1512cd3035bcb7ca06887c9a945f15e964574a08de6a84377756f886e2a35f70`, registra supervisor `CAPTURE_CLI_EXIT` e primeiro diagnóstico `CAPTURE_REQUEST_FAILED / CAPTURE_PHASE_READINESS / CAPTURE_RESOURCE_FETCH`. O detalhe fechado observado foi:

- transport `ABORTED`; scope `ALLOWED_GET`; target `OTHER_ALLOWED`;
- rsc `YES`; routerPrefetch `YES`; purposePrefetch `NO`.

**A causa e o iniciador não estão comprovados.** Esses enums não identificam URL nem autorizam atribuir a falha ao RSC, ao prefetch, ao cliente ou a um componente. Os processos próprios foram encerrados e a porta liberada. Não há captura completa aceita; nenhum asset foi promovido. A ausência de PAGE_ERROR no primeiro diagnóstico não prova sua ausência global, e zero assets aceitos não prova ausência física de parciais. Erros, GET/origem/path permitidos, bloqueios de API/SW/sockets, readiness, prazo e cleanup conservam seus gates.

Implementado: coleta finita pelo Root e revisão externa dos originais. Validado: estes 16 relatórios e seus vínculos próprios; o CI geral conserva FAIL. Pendente: diagnosticar Captura e obter uma captura atual completa com Source/policy/recibo próprios. O próximo lote necessário de código precisa de revisão, controles e CI do seu próprio SHA; esta evidência fa4 permanece vinculada a fa4.

A revisão nativa usou somente PowerShell/texto e Git local, sem Node, SDK, browser, banco, GET novo ou nova coleta pelo revisor. Os IDs, hashes, checks e limites estão no [recibo estruturado](evidence/issue104-security-fa4-20261025.json). A evidência foi consolidada junto ao lote de código de captura; sua execução futura continua exigindo resultado próprio.

## Delta de captura preparado após fa4

O harness registra um initializer somente em `--only projeto`, antes dos scripts da página, que remove a exposição de `IntersectionObserver` no contexto isolado. O [Next 15.5.28](https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/next/src/client/components/links.ts) usa essa capacidade para observar a visibilidade dos Links e antecipar a navegação. A consulta booleana é reconferida antes de readiness e pixels. Isso previne essa via automática; não demonstra a causa exclusiva da falha fa4 nem elimina prefetch manual ou por intenção.

A remoção exige origem loopback exata, preflight limitada a oito objetos e descritores configuráveis; não lê getters. Falha, reintrodução ou presença remanescente recusam a captura. Os modos all/og, Service Worker, aplicativo, PWA, quatro campos Source do recibo e política de rede permanecem preservados. Não há resposta sintética nem exceção para requestfailed/ABORTED.

**Validado localmente por Root:** 75 grupos puros (62 anteriores + 13 novos), 33 controles do supervisor, sintaxe de três arquivos e lint desses três sem avisos. Node 24.19.0, heap64 para puros/sintaxe e128 para lint, um processo por vez; sem Next, SDK, navegador ou banco. A revisão independente conferiu os três paths e os suportes preservados. O autor conservou separadamente uma invocação incorreta `--qa`, recusada antes de iniciar processos; o modo puro correto `--check-contract` passou.

**Pendente:** CI completo do novo HEAD e quatro screenshots próprias de Projeto, com proveniência, geometria, readiness, limpeza e revisão visual. Dependências podem usar IntersectionObserver; os testes puros não substituem a conferência do resultado real. Merge e produção permanecem bloqueados.
