# Restore — EOF restrito à listagem autenticada da origem

**IMPLEMENTADO no lote após fe04:** seis paths reconciliam a correção de transporte da #114 com o candidato atual. A base histórica são os commits `6784b9e8f5b27abb664ec0b4f17b96bbffe31b1d` e `9532a7f2570dfaaea772e0683542b982e42bb24d`; a versão corretiva V2 acrescenta uma guarda de estado fechado e regressões. A autorização do mantenedor para a correção restrita de EOF, com testes, já existia. Não é autorização de acesso privado ou restore.

O inspector pode reconhecer o código literal EOF somente na listagem TOC da **origem**, após autenticar integralmente o arquivo, reconferir o ciphertext e validar o PGDMP vinculado. Exige callback e evento de entrada originais, cada um uma vez com EOF, sem `finish`; spawn natural único, stdout/stderr EOF únicos e exit/close naturais zero, sem sinal. Spawn antecede as observações e close exige exit e ambos EOFs já observados. O código não renomeia EOF para EPIPE nem muda o ramo EPIPE histórico. Target e ACL conservam a recusa padrão; não há flag externa para ativar a exceção.

## Defeito encontrado e corrigido na revisão

A primeira seleção, V1, podia aceitar o par de entrada quando chegava **depois de close, mas antes da continuação de await**, no mesmo turno de JavaScript. `successful` ainda estava falso. O peer apresentou o contraexemplo e o autor o reproduziu nas duas ordens, executando os corpos reais da função com lifecycle sintético. A V1 permanece preservada em HOLD e não foi aplicada ao Root.

A V2 recusa qualquer nova observação EOF quando `closeCount > 0`, além da guarda `successful`. Os mesmos dois negativos falham contra V1 e passam contra V2. Quatro dos seis after são exatos à seleção histórica; os outros dois são overlays corretivos identificados, sem alegar que são blobs históricos.

## Validação do lote

Autor: seis verificações de sintaxe aprovadas; reprodução real das duas ordens recusada na V2; dois negativos da V2 contra V1 falharam como esperado; quatro novos grupos da V2 passaram. Peer: seis before/after, patches, guardas e recibos conferidos, sem blocker estático remanescente.

Root: patch V2 e seis hashes conferidos, aplicação sem conflitos, quatro grupos sobre o checkout aplicado e **29 controles puros da projeção SourceTOC** aprovados, stderr vazio. Node24.19.0/heap128 serial, imports diretos, sem workers. Não somar as execuções do autor e Root como oito testes distintos. As suites que exercitam ACL/processos ficam para o CI próprio do novo commit; nenhum resultado fe04 é transferido a ele.

Manifesto V2 `c29c9df6f4de930d7613ce389d63c56322dd0dfa6c6b2945d21978cb82ad343e`; patch `6dc41cc951016fe989fb0d958345b9d477632d75a9f923572818d09c45ffcf56`; peer `06d500c312b9a57d40b4cbbae6459ab237ea956946711cf079a7d7aa0c9c803d`; recibo do autor `6f5f5beb271b0ef676592d84fd0104c3bc9243a5d80b412945504e80f371e0c0`; stdout Root quatro grupos `56d109b78447015f0a519545ffed2ade44d22919e3f3582b9db22622ed87055e`; stdout Root projeção `56a110d235f101c1a16670d01147c3022d9d4612700c63e0a845c4c914249cb0`.

## Fronteiras preservadas

Autenticação integral, limites, primeiro erro e cleanup continuam exigidos. Não muda COPY, SQL/DATA, planner/A2, seleção, privilégios, capabilities, lifetime, reader operacional ou política do alvo. A projeção aceita EOF somente como metadado passivo de erro, nunca como código de recusa externa ou prova de terminal.

A #114 continua aberta para reconciliar os demais deltas documentados, sem mesclar seu head antigo. A #35 mantém baseline recusado e os [bindings pendentes](restore-baseline-next-contract-20261024.md). Nenhum arquivo privado, perfil, backup, nova janela, operação de alvo, schema ou restore foi acessado/executado para esta entrega. Merge e produção continuam bloqueados.
