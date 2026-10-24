# T-054 — gate nativo de imagens e encerramento de Metas

## Estado desta fatia

**Preparatório local, não executável.** Base0d933d98ca8fcd6def222d184d9b9462370d98eb/treeb6c018609cac8267f9c58def3385911f6dcd8eb2. Não há caso I1–I8, selector, entry, job ou relatório nativo aprovado nesta entrega. O workflow existente continua somente N12. Nenhum schema,propostaSQL,SourceE1,flag,env,serviço ou produção foi alterado. O próximo trabalho continua sendo o gate completo, em fatias revisáveis.

O contrato aprovado está em work/ci-capture-write-20261021/review/finance-goals-images-terminal-i1-i8-interface-proposal-20261024.md (SHA881fccb3206103c86c9bcd28a196cb1feb744dc8e5ded2373009c39887b60864); plano de promoção SHA160a95f0812d3d790d772f6551080abebfaf23349fd81c47e4f45d0b26beebdf. Esses arquivos são públicos locais de revisão, não autorização para schema ou execução hospedada.

## Implementado localmente

- Contrato preparatório novo com cenário/version1/suite próprios e oito IDs em ordem. Os checks de I5/I8 não incluem barreira fictícia. Dados são copiados por descriptors, chaves exatas, strings primitivas antes de regex, versões/runtime estáveis24.x.y e fontes/dependências ordenadas. Não modifica NReportV2.
- O contrato está deliberadamente selado: aceita somente failed/not-run e recusa PASSED, inclusive um pacote sintético preenchido. A matriz exata por operação e os oracles completos ainda precisam de autoria/peer; remover esse selo exige revisão explícita com o gate pronto. Declarações de shape não são origem nativa.
- Sete templates novos no issuer SQL existente: reserve,claim,complete,candidates,ack,material e ausência. São registros nominais na MESMA WeakMap/frame já usados pela sessão. Nenhuma função de registrar SQL ou escolher RPC foi criada; dados extras,coerção/getters e shapes copiados são recusados. Não há import do contrato novo pela SQL/sessionN12.
- Reserve/claim/complete têm targets literais públicos,UUIDs,datas canônicas,limites fixos8MiB/1GiB e nome sintético fixo. Complete produz metadata explícita100bytes/40×20/hash sintético, não arquivo/pixels/prova File ou observação remota. Cleanup usa somente file_cleanup_candidates/ack; nenhum Storage.remove/PUT é chamado.
- Novas ações reutilizam ACKs físicos existentes rpc/material/absence. O módulo SQL original12140B/SHA8a2a77b6b486dc34a75afce5da255c9b89f846dc06929b33c68cff487674eefa permanece prefixo byte-intacto. Contrato,case/sessionN12,runner,entry e workflow não foram editados.

## Validação desta fatia

Uma rodada Node24.19.0 bundled,heap128,--experimental-test-isolation=none e ambiente mínimo executou apenas dois arquivos puros:15/15PASS,0falha/skip/cancel,39,662ms. Nenhum SDK,SQL,Auth,Storage,PG,browser ou rede foi usado. Runtime92825416B/SHA3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237, versão do arquivo24.19.0. Não foi tratado como pin operacional ou prova de runner Linux.

Stdout1510B/SHA c61513221b499c8ea3509a6bcb374eadd7e6aba7379fb4db9c1e25fd6220474d; stderr0B/SHAe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. Evidência local: work/ci-capture-write-20261021/finance-goals-images-terminal-native-preparatory-20261024/.

Os controles comprovam somente recusa do selo, IDs/shape/unknown/cleanup, fonte/runtime, zero hooks, prefixo N literal, registry nominal e geração finita/captura de texto. Nenhuma instrução SQL foi executada. Lint será realizado por Root; CI/publicação/validação nativa desta fatia estão pendentes. N12 e os19originais verdes de0d têm seu recorte próprio; não validam a união E1-A+M1 ou esta alteração.

## TODOs obrigatórios antes do gate executável

1. Escrever fixtures finitas pelo caminho público real reserve→claim→complete e instalar E1-A pinado0d6ca antes de M1 pinado7fb, após base001–026/catálogo1720. Conferir também corpos pós015/020/023 de cleanup/holder e grants reais; não usar somente011.
2. Completar material integral dos dois atores e todas as espécies de holders023,além de arquivos/uploads e material financeiro já projetado. Acrescentar fixtures/grants/fault injection somente por templates novos revisados, sem SQL caller-livre. O issuer preparatório NÃO implementa IMAGE_FIXTURE,idade de cleanup,grants,rollbackfault ou material completo dos holders.
3. Fixar matriz exata de contagens por janela/operação, especialmente troca legítima de imagem/replay emI6, antes de abrir PASSED no contrato. Os contadores preparatórios têm apenas forma/limites de falha e não validam sucesso.
4. Escrever os oito grupos: I1CREATE-bind-first;I2cleanup-first;I3UPDATE-bind-first;I4cleanup-first;I5todosholders ativos/arquivados;I6commit-vence-settle+replay após troca;I7settle-vence-commit+executor histórico com batch válido;I8owner/sessão/finalidade/grants e rollback após projeção. I1–I4/I6/I7 precisam de PIDs/advisory lock observados; I5/I8 não inventam barreira.
5. Cleanup-first exige22023 pela imagem com mensagem original de Goals03; stale/genérico não serve. Bind-first pode retornar candidato remove_final=false após seleção anterior; recheck/ACK devem proteger o holder. Sessão FOR SHARE tem linearização real e não é revogada retroativamente.
6. Conservar terminais/EOFs/ACKs,códigos/sinais,quiescência,zero backends/fixtures/unknown e cleanup positivo. Nenhum novo ACK ou mudança da sessão física foi autorizado; se necessário, apresentar interface a Root antes de implementar.
7. Integrar explicitamente --execute-images-terminal-v1 e job needsN12 em tarefa posterior, com stack/namespace/relatório próprios,sem ampliar prazos/cotas. Derivar grafos/blobs/import.meta.url/allowlists do SHA real,sem prometer130/45 e sem tree-shaking de WASM. Dois jobs podem continuar19runs/21jobs; observar a cardinalidade real.
8. Peer independente,lint/camadas e CI próprio completo precedem integração. Relatório novo não aceita N12 como imagem; limitations hosted/browser/images/restore/produção permanecem false. Upload/pixels/RLS/HTTP reais são aceites conectados posteriores.

Esta fatia não recebe commit,push,dispatch,rerun,aplicação remota,merge ou deploy pelo autor.
