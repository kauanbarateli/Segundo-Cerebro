# Preparo V3 — fonte autenticada7002, inspeção somente leitura

**PREPARADO / NÃO EXECUTADO / NÃO AUTORIZA RESTORE.** Pacote novo e ignored para revisão de Root. V1/V2, seus workflows e seus resultados permanecem preservados. Refs #35/#41/#42, PR #107. Nenhum arquivo rastreado foi alterado por este preparo.

## Fonte e fechamento público

- Fonte operacional fixa: `7002bf2d47931bbec8b9be8a4051b802969840e1`, árvore `209900e0ef1af0f87e8872484c29c2266012355a`.
- A reconferência usou os arquivos públicos de `Segundo-Cerebro-restore-toc-eof-20261023`, em HEAD7002 e árvore209900. Todos os21 pins foram comparados a bytes/hash SHA-256 e ao blob Git exato. A closure é20 módulos JavaScript mais o launcher PowerShell,47 arestas relativas, somente imports locais e built-ins Node, sem import dinâmico. Não houve import/execução dos módulos.
- O futuro checkout operacional é `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-restore-eof-source-7002bf2`. **Não foi criado nem certificado por este pacote.** Root deverá criá-lo DETACHED e conferir HEAD/tree/pins/estado antes de qualquer decisão operacional.
- Originais de CI7002:16 checks elegíveis concluídos com sucesso e1 job Windows excluído pela condição da branch.14 envelopes nativos sem violação de cleanup/resultado incerto; os dois envelopes Auth não têm manifesto granular de fontes. O CI público não é observação deste archive/destino nem aceite de restore. As duas falhas originais do SHA9532 continuam preservadas.

Em relação à lista V2, os pins alterados são inspector e adapters nativos; entram ainda `restore-managed-validation-019-sql.mjs` e `restore-release-pack-019.mjs`. Os demais17 pins foram efetivamente reconferidos. Os arquivos019 são apenas dependências públicas vinculadas por hash: este pacote não executa SQL nem acrescenta caminho de mutação. `source-pins-verification.json` registra o inventário e cada aresta.

## Delta permitido

O preparo muda somente identidade SHA/tree, checkout operacional futuro, SelfPath exclusivo,21 pins atuais e comentário de união. A QA muda o caminho/hash/bytes do novo preparo e os guards públicos SHA/tree/união21. Os26 corpos puros originais de parsing são byte-idênticos à V2. Nenhum enum, gramática, projeção, parser, teto, operação, COPY/history/SQL ou semântica de qualificação foi ampliado.

O EOF restrito pertence ao inspector revisado7002: somente o SourceTOC após autenticação integral do archive, `await pendingRead`, reconferência de ciphertext/lease e bytes/digest PGDMP. O pareamento de input EOF exige os terminais naturais e a ordem exata; EOF após child-close continua recusa. O alvo conserva o comportamento anterior. Isso não transforma EOF em EPIPE, nem permite inferir EOF/exit/cleanup ausentes em uma observação real.

## Gates e metadados herdados

Defaults continuam `GateExecute=false`, `ReviewedCommit=null`, `ArchiveBinding=null` e `SelfSha256=''`. O gate falso precede todo I/O operativo. Nem o preparo com gate falso nem a QA foram executados nesta frente. Somente leitura pública, hashes e parse AST estático foram feitos.

O binding permitido continua exclusivamente o archive histórico de17/10 da V2. Nada foi escolhido por data mais recente. Pins e caminhos de perfil DPAPI, certificado, Node, PowerShell e PostgreSQL foram herdados como texto, byte-preservados; **nenhum desses arquivos foi aberto, hashado, desserializado ou executado por este preparo**. Nenhum conteúdo de archive, segredo, token ou conexão de banco foi lido.

Preservados: leases FileShare.Read; identidade/path/reparse; ambiente selecionado sem tokens/PG herdados; PS7 NoProfile/NonInteractive; operação fixa `restore-inspect-baseline`; UTF-8 estrito, JSON único sem propriedades duplicadas, stdout≤64KiB, stderr drenado/descartado; teto externo90s e escopo original do inspector45s com ACL15s interna. Primeira recusa, ausência de autoridade, limpeza e veto a sucesso tardio permanecem originais. Kill/ACK não provam término ou limpeza.

Origem pessoal `rishenjoikgmfubmnfiu`; destino reservado `jvwduowyavpaxssogadn`. Nada de BlackSheep/VOE/legado, produção como alvo, reset, migrations, seed, backup novo, importação ou mint de capacidade. Mesmo um envelope de inspeção bem-sucedida permanece `inspectionOnly=true`, `baselineQualified=false`, `remoteMutation=false`, `restoreAccepted=false`.

## Proposta de QA público — ainda não publicada

Após revisão, Root pode copiar os dois `.ps1` e este README, byte-exatos, para **nova** pasta `tests/fixtures/restore-readonly-eof-v3/`, preservando `tests/fixtures/restore-readonly-eof/` e os fixturesV1. A QA lê somente o preparo público irmão, confere seu pin e extrai os26 corpos puros via AST; não executa dispatcher, corpo operativo, processos nativos, filesystem privado, serviços ou SQL.

`restore-readonly-eof-v3-public-qa.yml.proposed` propõe workflow novo em `.github/workflows/restore-readonly-eof-v3-public-qa.yml`, com permissões somente leitura, Ubuntu/PS7 e cinco minutos. Nenhum workflow foi editado ou iniciado. O commit de publicação dos fixtures poderá diferir de7002; a fonte operacional fixa continua7002. Verificar os triggers antes de publicar e preservar os runs originais próprios desse novo commit.

Ordem restante: revisão de Root e peer; publicação das cópias públicas; QA própria remota com logs/source/pins concluídos; criação/reconferência do checkout operacional fixo; decisão explícita separada sobre uma única observação somente leitura. Este pacote não fornece `ReviewedCommit`, `ArchiveBinding` ou `SelfSha256` de execução e não inicia qualquer observação.
