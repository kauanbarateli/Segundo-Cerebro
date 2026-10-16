# Snapshot no consumidor de restore — 16/10/2026

O consumidor agora exige a capacidade original do A1 incorporado pela [PR #40](https://github.com/kauanbarateli/Segundo-Cerebro/pull/40). Uma fonte arbitrária de bytes e o antigo boolean `archiveAuthenticated` não concedem entrada. Este recorte não habilita importação, não implementa o extrator do baseline e não declara restore aceito.

## Comportamento revisado

Dependências, alvo e timeout são validados antes dos claims. `checkManagedSnapshot(plan, snapshot)` precede `claimManagedRestore`; só então o consumidor chama `claimManagedSnapshot`. Um veto no check não consome a autorização. Uma expiração entre os claims recusa antes de materializar listas ou criar processos.

O consumidor copia a vista do A1 antes do próximo pull que a apaga. Usa um único `ArrayBuffer` dedicado, sem pool ou concatenação de cópias; reconfere o digest antes de cada segmento e zera sua memória no `finally`, junto com o descarte do snapshot. Os cinco segmentos conservam SQL original, EOF/close0, tratamento restrito de EPIPE, validação na mesma conexão e reconhecimento do COMMIT original.

O prazo monotônico absoluto começa antes dos claims e não é renovado. É conferido depois da materialização de listas, antes de cada spawn e depois do validator, antes de enviar COMMIT. Um callback síncrono ocupado não pode contornar o prazo apenas impedindo o timer de rodar.

O autorizador removeu `archiveAuthenticated` do descriptor fechado e recusa esse campo como extra. Os fatos de baseline, ator, vazio, owners/ACLs, permissões, histórias de migrations e operações delegadas continuam exigidos. A1 não foi importado no planner; não foi criado ciclo.

## Revisão e testes

Seis paths alterados, partindo da árvore de `9766969`; o módulo puro A1 conserva SHA-256 `3e077ac851173deb2a4999390e485b694a5ef9bab5de85b47702a3f2c75c90d5`. Root revisou o diff e um peer independente conferiu os seis hashes e os caminhos de claim, wipe e deadline.

Autor e Root passaram, em execuções próprias sequenciais com Node 24.19.0, **85/85**: plano 27, stream 19, adaptadores 18 e capacidade 21. Lint dos seis arquivos e diff-check passaram. Os novos cenários cobrem veto antes do claim, expiração entre claims, cópia zerada em cinco resultados e callback ocupado antes de spawn/COMMIT. Os clocks controlados existem somente em subprocessos Node de fixtures sintéticas.

Separadamente, o autor executou por engano o controle nativo de ACL do inspector inalterado ao usar um filtro que não o excluiu: **23 PASS/1 FAIL**, `EPERM` no `rmdir` de cleanup da fixture. Não foi repetido nem atribuído a defeito do helper; o estado final da pasta não foi inspecionado. Nenhum archive, perfil pessoal ou banco participou. O PASS anterior de Root no ACL original pertence à árvore da PR #40; não apaga essa falha operacional.

## Próxima ligação de Root

O inspector continua somente de diagnóstico e devolve plano, sem mint. Antes de retornar a futura entrada privada `{ plan, snapshot, archiveEvidence }`, precisa extrair os fatos completos do mesmo database autenticado, antes que seus bytes sejam apagados. O ponto único de mint será posterior a `await pendingRead`, footer/manifest/EOF, reconferência do ciphertext, TOC nativo completo e plano.

Lifetime inicial decidido: **90 s**, teto A1 de 180 s, um processo. O ramo de falha e o ramo de erro de cleanup precisam descartar a capacidade; depois do cleanup, conferir que ela ainda está viva antes de devolvê-la. Não cunhar uma capacidade no CLI que apenas projeta contagens.

A qualificação do baseline depende do contrato A2 e dos adaptadores reais de Root. As oito inspeções anteriores continuam de listagem: a oitava aprovou 982 selecionados/350 preservados/cinco segmentos, sem consultar o destino. **Não houve sétima importação nem nova migration.**
