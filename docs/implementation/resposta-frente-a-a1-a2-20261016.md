# Retorno de Root à Frente A — A1 incorporado, A2 liberado

Repositório: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). A entrega A1 foi revisada em checkout próprio, publicada como [PR #40](https://github.com/kauanbarateli/Segundo-Cerebro/pull/40) e incorporada. O clone da Frente A e os cinco WIPs da Main foram preservados.

## A1: SHA e resultados próprios

- Entrega recebida: HEAD `eb1fa400791158e01db0922fa838f578d1a0a1b6`, árvore `a2e6de461ad51b659c8f198f6bc1e50894244431`. Três paths, bytes e hashes anunciados conferidos.
- HEAD efetivamente revisado da PR: `783653ea6c4270548ab892b3db2b40bc185d0885`. Root só ajustou orientação documental e o título de um teste; módulo e asserts não mudaram.
- Merge efetivo: `97669692260074809bdd991fd4eac8b01988fe96`, árvore `65da0e403edc447c4feaa5f8fa961036d6f0bee1`, exatamente a árvore integrada testada. Preserva a correção de dependências repetidas de `431cc40`.
- Root: 21/21 do A1, 66/66 dos quatro módulos anteriores e 106/106 da combinação, em Node 24.19.0. ACL nativa incluída nessa combinação; lint2 e scanner aprovados. [Evidência](evidence/a1-review-merge-20261016.json). PASS local não foi promovido a aceite hospedado.

Não há pedido de correção ao módulo puro A1. Mantido o limite: ele comprova vínculo/lifetime/uso único/descarte do seu estado, mas não autentica a origem do archive nem endurece transitivamente o registry do planner.

## Decisões e integração de Root

**Ponto único de mint:** inspector, depois de `await pendingRead`, AEAD completo/footer/manifest/EOF, reconferência do ciphertext, EOF+close0 do TOC, plano e extração dos fatos completos do archive. O inspector de diagnóstico continua sem mint. Lifetime inicial explícito **90.000 ms**, máximo 180.000 ms, um processo; erros e falha de cleanup descartam, com check de validade após cleanup.

**Consumidor:** integração revisada de Root exige `snapshot`, faz check antes de claim da autorização e claim da capacidade depois. Uma cópia dedicada é zerada no finally. Prazo absoluto é conferido antes de spawn/COMMIT; `archiveAuthenticated` saiu do autorizador. Autor e Root passaram **85/85** nos quatro módulos alterados; peer independente sem bloqueador. [Implementação e limites](restore-snapshot-consumidor-20261016.md).

O autor desse recorte executou por engano o ACL do inspector inalterado: 23 PASS/1 FAIL com EPERM no cleanup da fixture. Essa falha foi registrada e não repetida; não se confunde com o ACL anterior aprovado por Root. Nenhum archive/perfil pessoal participou dessa QA.

**Extração antes do mint:** Root fará leitura limitada do TOC binário CUSTOM do mesmo database autenticado, com campos integrais e cross-check da enumeração nativa. Duas histórias serão extraídas em RAM pelo pg_restore sem conexão/psql. A tupla binária real ainda precisa ser observada; não atribuir 1.16-0/4/8 ao archive apenas porque o produtor é PG18. A2 não implementa esses adaptadores.

## A2: contrato e inventário liberados

Leia integralmente o [contrato A2 v1 aprovado](contrato-a2-inventario-restore.md). Ele contém a tabela pública das **24 classes/1.332 entradas** da quinta inspeção e o resultado distinto da oitava: **982 selecionadas, 350 preservadas, cinco segmentos**. Não existe contagem observada das 350 por classe. SQL, nomes privados, owners, IDs, valores, dados pessoais e conteúdo do archive não foram entregues.

API a implementar: `compareManagedBaseline(archive, target)`, módulo puro `scripts/operations/restore-managed-baseline.mjs`, teste correspondente e `docs/implementation/frente-a-baseline.md`. Input `BaselineInputV1`, `TocRecord`, ByteString NULL/vazio, bindings diferentes para archive/target, 15 motivos canônicos e três códigos fixos estão definidos no contrato.

A2 compara campos completos e histórias, com bijeção e vetores de dependências mapeadas conservando duplicatas/ordem. IDs, OIDs, offsets e headers não são igualdade semântica entre bancos. V1 recusa aresta fora do conjunto preservado; não deduz seu fechamento nem apaga a aresta. Sem regex para remover SQL, AST reimpresso ou exceções por count/versão. Root mantém a prova de origem por identidade e a qualificação nativa.

Comece sobre o `origin/main` atualizado que contém este retorno; registre seu SHA real. O antigo `41b30fd` não é mais a base atual. Preserve os paths exclusivos de Root da seção 6.1 do [handoff](handoff-retomada-20261013-restore-auth.md).

Entregue somente esse pacote, com manifest/base/HEAD, testes próprios Node 24, lint/scanner e limites. Uma QA pesada por vez neste computador. Não execute conexão/restore/migration, não leia perfis ou logs privados. Se o acesso permitir, PR pequena draft com `Refs #35`, sem coautoria e sem fechar a issue; alinhe com Root antes de publicar para acompanhar os gatilhos push/PR/Vercel. Se mantida a orientação de entrega local, forneça branch/commits/patches e hashes como em A1; Root publica e revisa.

**A2 está liberado para implementação offline.** Sua entrega ainda precisará de revisão de Root, integração ao extrator e validação nativa; este retorno não libera restore. 001–019 permanecem aplicadas, sem migration pendente; Drive/VOE/BlackSheep/legado fora do escopo.
