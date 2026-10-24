# Peer do delta Root — scope versus File perdido no teste G0

**Favorável estaticamente.** Meu teste original cobrava need-file de uma fixture cujo A pertencia a outro scope. Isso contrariava o guard de scope já existente; a correção Root separa as duas pré-condições sem alterar produção ou relaxar o guard.

Fonte Root: `tests/lib/goal-image-upload-no-new-image.test.ts`, linhas175–189, 23042 bytes/SHA256 `10a83ade988e6abe8c3f9cb2ef01cc6a41793c1cda8b9cf390e5037db3aa6e5b`. Before congelado R V2:22152 bytes/SHA256 `34a4fe713a5bd24e277a949aaaa96974d7153a0439c5dc9051ea00418de5606e`. Produto `src/lib/files/goal-image-upload.ts` permanece SHA256 `d8a93ebb6b6ad5b251b1a9d0faaf47dc5cdb199551e8987345dfafa5d0c03348`, byteigual ao freeze G0 R V1/V2.

O primeiro caso usa a fixture original, com scope atual diferente do retained A, e exige reject PENDING antes de qualquer File/IO. O segundo encerra somente o handle local, abre NOVO coordinator com scope original A e currentScope original, mantendo journal/client/controller/barreira reais; com A prepared e sem File, exige o resultado completo `{kind:'need-file',selection:original.selection}`. Não rebasa A, não fabrica proof, não troca dono/epoch e não apaga estado.

Confrontei a fonte: attempt() recusa scope/state antes da identidade; resume() só alcança a saída need-file depois de attempt válido. Ambos os casos mantêm spies authorize/claim não chamados, bytes do armazenamento idênticos e todos os contadores de transporte/UUID/hash/HTTP zerados. O finally encerra o novo handle sem limpar o journal.

A inversão em RAM do novo bloco1347 caracteres pelo before457 reproduz o teste R V2 inteiro exatamente; não há outro delta no arquivo. Pacotes congelados preservados. Não executei Node, TypeScript, Vitest, SQL, browser, rede ou Git, nem alterei Root. A falha original/novo resultado executado pertencem aos originais CI do Root; este é somente peer estático do ajuste de oracle/fixture.
