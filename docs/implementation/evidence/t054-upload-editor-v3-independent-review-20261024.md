# Peer estático C2b-E V3 — 24/10/2026

Parecer favorável ao delta de autoria E3: o P2 de tipagem remanescente em E2 foi corrigido sem alterar a API ou o produto. Existe, porém, um bloqueio técnico independente na imagem PNG sintética antiga usada pelo spec; Root assumiu uma correção literal após transportar E3. O freeze E3 deve continuar imutável. Não há aceite visual, de upload ou de integração neste parecer.

## Vínculo conferido

- Manifesto E3: 5.804 bytes; SHA256 `39acf7aa6d17c66667193474acf7f08305cf0706729d6460f3c2d55ec8e4a59f`.
- Conferidos 7 after, 7 previous E2, 2 before e 3 artefatos: 19 payloads sem divergência de tamanho/hash. Os 7 after coincidem com o WT do autor e os 7 previous com os after congelados E2.
- Somente três deltas: unitário, spec E2E e documento. Picker, Editor, sessão e fixture são byte-idênticos a E2. CSS não faz parte deste delta; keys, tipos do produto, guardas owner/epoch/scope, receptores nominais, transições A/B, null/omissão e efeitos financeiros permanecem como revisados anteriormente.
- Nenhum Git apply/reverse-check, Node, compilador, teste, renderer, navegador, SQL, rede ou serviço executado por mim. Root permanece responsável pelos checks de aplicação dos patches e pela união.

## Correção do P2 de tipagem

O unitário importa `createElement` de React e fornece `Picker: () => createElement("span")` em vez de `() => null`. ReactElement real cumpre o retorno JSX.Element inferido por `typeof GoalImagePicker`, sem cast ou ampliação de Capability.Picker. A inversão em RAM somente dessas duas substituições reproduziu o texto unitário E2 exatamente; os casos e oracles não foram alterados para obter a atribuição.

Hash unitário E3: `4da95e29a4c68ea12aff10942c64567352ddca07c67007b29e8b1371a8aa7fc4` (12.586 bytes). O bloco defensivo UUID e os negativos dos dois P2 funcionais anteriores continuam intactos.

## Asserções visuais novas, ainda não executadas

Os seis casos existentes (320/390/768 px × claro/escuro) agora aguardam `document.fonts.ready`, a prévia visível e `HTMLImageElement.naturalWidth > 0`, depois verificam overflow/alvos/campos e escrevem PNG no diretório isolado de testInfo. `fullPage: true` e `animations: "disabled"` são opções de captura, não uma afirmação de fidelidade ao protótipo.

O caso mantém foco explícito no Cancelar antes de Escape, exige fechamento do Dialog e depois foco no trigger exato “Nova meta com foto”. A lista de efeitos continua vazia exceto availability. Não vi redução dos asserts ou nova chamada de transporte introduzida pelo delta. A máscara e os controles h44/fonts16 não foram alterados.

Hash spec E3: `62493018a7a146b95441044855730134733727911ab075b799059d584fc150a0` (16.833 bytes). Hash doc E3: `3848fc0d88e0c5529d6aac14e2cb0d51a3a656447821f22e4595f5108fee4eed` (9.740 bytes). A documentação distingue testes escritos de PNGs efetivamente produzidas.

## Bloqueio técnico da fixture e correção Root pendente

O spec E3:14 ainda contém o mesmo literal PNG antigo de E2, decodificado para 67 bytes, SHA256 `7031dc784fbe64d6d9c488a9f46dc244beb21cad89743856130d76f5189cde6e`. Root informou prova independente de CRC inválido/IEND truncado. Não reproduzi essa prova de codec e não interpreto a falha como defeito do produto. O novo assert naturalWidth pode expor esse asset inválido antes de gerar as capturas.

A correção mínima proposta por Root é substituir exclusivamente esse literal por um PNG público de 70 bytes. Conferi em RAM o tamanho/hash do literal proposto: SHA256 `44cd598daa29e0dfe2ddb86b1af21dbec9b37b2f214d320c2af0450610e218e8`, igual ao vínculo enviado por Root. Root declarou CRC dos três chunks e inflate verificados. Isso não altera guards, queries, fixtures financeiras, limites ou autoridade R.

Até receber o delta aplicado, este parecer não certifica que o literal já foi trocado no checkout de integração. E3 e o parecer E2 permanecem preservados. Após aplicação, um adendo deve conferir a substituição literal e o hash do spec resultante; os gates próprios de Typecheck, unitários e Playwright da união continuam necessários.

## Preservação por hashes

- Picker: `6ce9d8db76c5063ec5d043de1d88b1c996c2ac4cad4a7c1d39fba3eee8c61c40`.
- Editor: `a4e6fa5d12d88941366aa96ce1ac9e1b707ebae604cfca1f72d6824566862a1a`.
- Sessão: `5a6094affb05393fa4804e6cd063723f08f31a92299fc0227e837838ea624851`.
- Fixture: `d6357c9cf2bb1a40b94f4cd842363ede3e6df5559e8a49eeb567c308d56ed120`.
- Patch completo E3: `fd378029972fe203bb612b1fc23d51fba3f20999a672af73a67764803b04b858`.
- Delta E2→E3: `c7ed0a4e167748fef2be545047aa2535bce94c512fc5f454732c800e1b5a192b`.

R2 não foi copiada ou alterada pelo pacote. Nenhuma montagem de Workspace, ativação, produção, merge ou restore é autorizada por esta revisão. Grafo real e CI próprios pertencem ao candidato completo, sem herdar PASS anterior.
