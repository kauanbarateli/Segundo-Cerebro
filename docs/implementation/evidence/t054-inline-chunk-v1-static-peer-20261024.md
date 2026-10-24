# Peer estático — inline browser chunk V1

24/10/2026. Um P2 de formato encontrado no helper; restante do delta sem outro bloqueador objetivo. Não executei Node, bundle, renderer, SDK, SQL, teste ou rede.

Pacote EV/inline-browser-chunk-self-metadata-freeze-v1-20261024, manifesto SHA ccab8dd0e427e61f6ad9ee3ae1dff6eca8f1121dccbecf925c002e62205e75aa. Conferidos quatro after e um before por bytes/SHA; patch SHA f59fc54cbc532b0835bd2d4915b4a1012c4840aeea2b27ecf5e0d1fdb2567f30.

## P2 — array esparso aceita um slot sem selfref

tests/e2e/helpers/inline-browser-chunk.mjs:12–13 permite length<=1 e usa every. Para dynamicImports=Array(1), Array.isArray é true e length1; every não visita o slot ausente, retornando true. Com o IIFE válido do controle, a metadata não representa nem [] nem uma selfref exata, mas passa. É uma lacuna concreta no contrato de formato do harness; não prova saída Rolldown esparsa ou falha do produto.

Correção mínima sugerida: ramo explícito length0 ou length1 com índice0 próprio e igual ao fileName; manter a validação AST. Acrescentar negativo de array esparso/slot ausente, preservando o clone anterior para provar ausência de mutação. Não precisa alterar protocolo, limites, CSS ou bundler.

## Preservação e negativos conferidos

O diff do spec adiciona somente o import do helper e substitui a igualdade dinâmica vazia pela chamada. Permanecem format:iife, codeSplitting:false, output.length1, chunk.type, imports[], regex original contra import-call, fechamento CSS, build.close e todo o restante do harness. Nenhum campo metadata é reescrito.

O AST recusa parseDiagnostics não vazio, ImportDeclaration/ImportEqualsDeclaration, export com moduleSpecifier, chamada de ImportKeyword e MetaProperty import. Os testes escritos cobrem []/self com não mutação; nonself/./self/duplicata/misto/undefined/número/null/objeto; imports literais/computados/separados por comentário ou newline com [] e self; import.meta; imports estáticos/exportfrom e saída malformada. Nenhuma dessas recusas foi afrouxada pelo delta.

A declaração .d.mts recebe somente fileName/code strings e dynamicImports readonly string[], retorno void. É estruturalmente compatível com os campos já presentes no chunk; a checagem imports[] e demais garantias permanece no callsite. A declaração não promete normalização nem mutação.

Hashes after: spec16febe14d77f237b4758738b1d46bd760e8378b8febf9c53357e541683718dcd; declaration4f7909c22755716349c8fac19a5db2c8f74096c5983a908ecab7bd8754549c42; helper1367f6be3fc47ce55c79c702eab0252cb2d47d39bf110d8620784dba68b75a06; testesf686b183fbfa1044b0d8dcfafe658a8dd28ae717209aa48ad4e13741bba87f83. O P2 acima requer delta antes de tratar o contrato como fechado; este peer não atribui PASS de bundle ou CI novo.
