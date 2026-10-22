# Restore: preservar o contexto nominal da primeira falha

Parte das issues #35 e #41; não conclui a inspeção ou o restore da #42.

O inspector combinado já preservava o código da primeira falha de transporte. O contexto nominal, porém, pertencia ao envelope sanitizado da fase, registrado em WeakMap privado. Ao substituir esse envelope pelo erro original para dar prioridade ao código, a consulta ao mapa perdia o contexto. A correção mantém a primeira falha como autoridade do código e conserva separadamente o envelope como origem do contexto registrado internamente. Não lê mensagem, stack, SQL, dados do archive ou campos arbitrários do erro para reconstruir contexto.

## Origem e escopo

Porte de somente dois arquivos da [PR #45, SHA 93ab8549efbdc7c121715ea449c2ce04676585ed](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45), revisto contra `8b52339` e preparado sobre `0bf6c77`. Os blobs anteriores eram idênticos aos da cadeia Capturas `19e9848`; nenhum outro conteúdo da PR #45 ou das funcionalidades #91–94 entra nesta fatia.

- `scripts/operations/restore-managed-inspect.mjs`: mantém separadas a primeira falha e a origem nominal de seu contexto; o catch recebe `originalFailure() ?? error`.
- `tests/scripts/restore-combined-baseline-inspect.test.mjs`: cobre erro de callback, erro de stdin e EPIPE seguido de erro proibido, conservando o código original, contexto fechado e limpeza. O controle positivo de EPIPE continua sintético e restrito ao TOC.
- `vercel.json`: impede Preview automático da branch desta revisão. Main e exclusões anteriores permanecem preservadas.
- `AGENTS.md`: distingue o adiamento histórico em Hobby da autorização posterior do mantenedor para Pro e deploy validado, já registrada no roteiro de integração. Não amplia o escopo comercial nem as autorizações de banco/restore.

Não altera os 45 segundos absolutos da inspeção, os 15 segundos de ACL, exceções de EPIPE, aquisição/autenticação do ciphertext, snapshot, comparação A2, mint, autoridade de importação ou requisitos do destino. Não modifica migrations, tipos ou SQL Editor. Nenhum perfil privado, captura CLOSED, archive ou projeto remoto foi aberto para este porte.

## Validação preparada

Não há runtime local nesta máquina de 8 GiB. Os testes serão executados nos workflows originais do GitHub, no SHA publicado, sem rerun ou cancelamento como forma de aceite:

```text
node --test --test-concurrency=1 tests/scripts/restore-combined-baseline-inspect.test.mjs tests/scripts/restore-managed-inspect.test.mjs tests/scripts/restore-target-baseline-inspect.test.mjs tests/scripts/restore-target-inventory-inspect.test.mjs tests/scripts/restore-managed-snapshot-capability.test.mjs
npx eslint --max-warnings=0 scripts/operations/restore-managed-inspect.mjs tests/scripts/restore-combined-baseline-inspect.test.mjs
node scripts/check-secrets.mjs
```

O CI geral já inclui os testes de scripts e os gates restantes. Preservar negativos de primeira falha, ciphertext inválido, alvo não vazio, divergência integral de histórias, falha tardia, deadline, limpeza e ausência de autoridade de importação. Os resultados pertencem ao SHA efetivamente executado; este documento não declara aprovação antecipada.

## Pendências que permanecem

O porte não fornece diagnóstico do primeiro erro nativo do Source TOC e não comprova eventos ou callbacks ausentes/fora de ordem, spawn, finish, EOF, exit ou close independentes. Os fakes dos novos testes produzem os próprios terminais; não servem como prova do transporte real no Windows.

Após revisão e QA remoto, preparar protocolo novo, com pins do novo SHA e leitor independente. A próxima operação conectada continua sendo uma inspeção readonly única, com autenticação integral, snapshot consistente do alvo e comparação no mesmo processo. Não iniciar restore por testes sintéticos verdes, reutilizar preparos CLOSED, transferir perfis/archives privados para o GitHub ou usar projetos VOE/BlackSheep/legado.

Estado desta preparação: **implementação e revisão estática concluídas; QA remoto e aceite conectado pendentes**. A PR #45 e as issues #35/#41/#42 conservam seus próprios critérios e estados.
