# Peer estático — inventário Sources legado, c781

24/10/2026. Favorável para composição/CI; nenhum bloqueador objetivo encontrado. Não foi executado Node, getter, coletor, teste, SQL, serviço, Git ou rede por este peer.

Pacote: EV/drive-availability-source-inventory-freeze-v1-20261024. Manifesto2937 B/SHA232b0ad20ce5c4b50cbc396de5b470f05f0174ef385ee2d436e09e5c76ae1395. Conferidos6payloads before/after e7artefatos do manifesto por tamanho/SHA256.

- Runtime tests/e2e-auth-local/drive-browser-contract.mjs, after18f5519a03b32d6808eaa7da086d5523113deea3bdc59fb93243a62731f99cce,14179 B.
- Declaration drive-browser-contract.d.mts, aftera420ca7cd6c8357a5206142654a637d726d65d1254435c9cf616f2c9a8b2f0b2,6939 B.
- Test tests/scripts/drive-browser-local-ci.test.mjs, afterd03bae8502efc115bd14133f3b41b8f504859372c913ecf0f7d0758f56a0ec4a,31039 B.
- changes.patch SHA115919379af2419da58f449a2f1fbb1e54b23b1f305975119f0693e6148b33cb.
- Derivação pública preservada SHAa02caf0b2f68c736a7ec832ac87e7c257853ff75d72947b32ea3e69e1fd2a98a. Não representa coletor/SDK/Drive executado.

Conferência independente por leitura e conjuntos do JSON: before799 contém270paths distintos; afterc781 contém272distintos;0remoções. As únicas adições são src/adapters/db/finance-goals-images-availability.ts (768 B/be1e4a534a0c20f70da098d498ea830b5e4a43b800ea3d705084c4fcecc44018) e src/adapters/db/finance-goals-availability.ts (465 B/6ed708fd40fc1e1ea8b3cce1545220e4dfc08fa8c91160cc4bed5b9c1aa86c8d). originalDerived e independentDerived são iguais; as272rows estão na mesma ordem da union. Os vínculos AST registrados são uploads/route.ts:8 → helper images; helper:3 → helper goals. O script de derivação confere bytes locais contra blobs Git exatos e não importa o SDK.

Runtime:22–28 fixa272/50 e os dois pins;:66 exige identidade, bytes e SHA de ambos sempre que Sources está presente. Recusas preliminares com inventário ausente conservam o protocolo anterior. Não aceita270|272 nem tamanho dinâmico. Declaration espelha272/50 e o novo export. Nenhum predicado de Auth, stages, ACK/unknown, migrations26/catalogue1720, limpeza ou sinal foi removido no diff; não muda runner/feature Drive.

Risco de fixture solicitado conferido: full():51 mantém270linhas sintéticas anteriores nos índices0–269 e acrescenta os pins nos índices270/271, como clones. O teste reserved:65–71 segue alterando índice0, sem sobrescrever os dois helpers. Os novos controles:53–63 verificam os edges/pins, omissão com cardinalidade272 preservada, drift de hash/bytes e Gitblob ASCII errado de cada helper. Negativos antigos:101 conservam vetos independentes migração/catálogo/quiescência/path privado.

Limite: três testes novos estão escritos e não executados; nenhuma equivalência com PASS de coletor, navegador ou aplicação hospedada foi atribuída. Root ainda precisa dos checks próprios do novo SHA. O pin dos helpers deve exigir nova revisão se seus bytes mudarem futuramente; não habilita Drive nem permissões por si.
