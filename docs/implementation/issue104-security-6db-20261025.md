# Issue104 — Source6db, captura ainda bloqueada

A issue104 deve permanecer aberta. A coorte atual terminou com19/20 runs e21/22 jobs SUCCESS; o geral push falhou somente no passo26 de captura. O resultado geral continua FAIL. Nenhum PASS da coorte078 foi promovido a esta candidata.

Source `6db9510538c4458cfaa9778466671312ef71f435`, tree `6d8ace16c298513086aabc97c1ee2f0dd5bcd827`. Os12 originais nativos próprios passaram na revisão de envelopes, cenários e cleanup. Seis push fizeram checkout6db; seis PR fizeram checkout `c01271d67bf99061a3de18a8d285f03364991cc5`. Prova própria do Root associa esse merge à tree6d8 e aos pais Main336e+6db, sem merge real de Main.

No original único do geral push40158827350/job121065846252, hash5340a817aa25bb1d073a464c1fb7a01d5785ba1aba66d034498b74b19eb25e1e: npmci e auditfull encontraram zero vulnerabilidades; typecheck/lint/SQL/camadas/design/build passaram; Next15.5.28;3618 unidades em cada fuso;2172 scripts,2172 pass,0 fail/cancelled/skipped/todo;533 E2E passaram. Os contadores vieram dos passos próprios dessa execução, sem novo GET ou runtime local. O geral PR tem metadados SUCCESS; seu original não foi baixado por este revisor.

A captura atual tem Source/gerador/policy pinados, primeiro diagnóstico CAPTURE_REQUEST_FAILED / CAPTURE_PHASE_READINESS / CAPTURE_RESOURCE_FETCH, outputs0 e reciboNULL. Os dois processos foram encerrados e a porta foi liberada. Não há diagnóstico PAGE_ERROR neste primeiro relatório, nem URL/causa de fetch exposta. A causa permanece desconhecida: não aceitar cancelamentos, ignorar a falha ou relaxar guards com base nesse código.

Os inventários novos também foram vinculados:571 membros Source no total,570 blobs Git6db conferidos individualmente por SHA256/bytes e um sentinel vazio conhecido de server-only, explicitamente fora de Git. Authschema4 continua sem inventários; Storage não ganha dependencyHashes fictícios. Os quatro inventários de dependências reportados coincidem com os originais078 qualificados e package/lock têm os mesmos blobs. A auditoria neutral full/prod do Root pertence a esses mesmos bytes078, ambos0, e não é rotulada como nova execução6db; a instalação/auditfull atual foi observada independentemente no geral6db.

Falta diagnosticar a falha de request e qualificar uma captura atual completa com seus bindings e recibo. Não há lote de nove arquivos aceito neste run. A mudança de service worker é restrita ao harness de captura, com app/dependências/workflows preservados; a reprodução local anterior do mecanismo não é prova de causa exclusiva nem de identidade do chunkCI.

A revisão usou somente arquivos locais, Git e PowerShell. Não executou Node, browser, SDK, SQL, banco, novo GET ou mutação do checkout. Não concede aceite hospedado, produção, RLS de dois atores, OAuth real ou dispositivo físico. Os fatos públicos,12 run/job IDs, checks, hashes, detalhes nativos e limites estão no [recibo estruturado](evidence/issue104-security-6db-20261025.json).
