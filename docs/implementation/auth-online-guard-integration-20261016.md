# Barreira online nos consumidores Auth — Frente B

Os fluxos isolados de Admin e recuperação alcançavam etapas funcionais, mas recusavam o fechamento por requests sem terminal. O experimento público original observou que desligar a rede podia conservar o fetch pendente. O [novo experimento com barreira online](evidence/browser-quiescence-fence-native-1404f7d-20261016.json) observou terminais originais nos dois casos com guard retido. Isso fundamenta o candidato abaixo; não certifica os workflows Auth.

## Mudança no consumidor

Admin e Recovery conservam a rota original e o contexto online durante `stopLoading → about:blank → drain`. A barreira de efeitos/escritas permanece antes do estacionamento. O `createQuiescenceFence` já revisado atua somente durante parking, reutilizando autorização e predicado de cancelamento de GET existentes. Não autoriza POST, callback, verify, logout ou destino estrangeiro; essas condições mantêm recusa e incerteza persistentes.

Todas as promises reais dos handlers, inclusive anteriores ao parking, ficam em um Set do mesmo escopo do caso. O Set entra na pendência de IO, no gate de STOP_NEXT, no fecho dos contextos, no relatório e na permissão de cleanup. Permanece fora do `releaseBarrier`, evitando que a própria espera de um ACK de leitura faça a barreira de escrita recusar a operação que está sendo acompanhada.

O helper limita seus handlers de estacionamento a 16; requisições normais continuam pelo handler anterior e sua contagem original. Não se aplica esse limite ao total de 1.024 requests admitidos pelo contrato Auth. Nenhum novo observer, ledger ou relay foi criado.

O zero original é conferido antes de fechar páginas e sessões. Depois desse ponto, `routeSealed` e `routeVeto` preservam recusa se começar atividade tardia; um terminal ou ACK durante descarte não apaga esse veto. O guard permanece até fechar o contexto. O prazo absoluto de 15 segundos, os terminais público/CDP, os critérios de escrita incerta e a autoridade de STOP_NEXT não foram ampliados.

## Revisão e validação local

Root revisou os dois specs e um peer independente conferiu fechamento, autoridade e QAs AST. A revisão encontrou que o gate do relay ainda excluía handlers; o delta seguinte acrescentou essa pendência somente ao `readGate`, preservando o `releaseBarrier`. Os novos vetores ligam Set, handler, fecho e gate ao mesmo escopo AST e usam o relay real com eventos artificiais. ACK pendente exige `INELIGIBLE/UI_PENDING` e zero stop; remover só a parcela do gate como mutante reproduz emissão indevida.

As outras regressões cobrem ACK pendente depois de terminal HTTP, rotas anteriores ao estacionamento, mais de 16 rotas normais, Set sombreado, falta de ownership/arm/contagem e atividade após zero. ACK e descarte nunca substituem terminal original.

A união transitiva agora inclui o módulo da barreira: **Admin 353 + 60 dependências; Recovery 197 + 60**. Os contratos e testes dos coletores foram atualizados conjuntamente, mantendo comparação binária dos blobs Git. O produto e as migrations não foram alterados.

Autor e Root passaram **135/135 controles**, lint dos seis paths passou com zero avisos e TypeScript sem emissão passou em Node 24.19.0. As primeiras rodadas do autor tiveram falhas de fixtures/binders e contagens, corrigidas e reconferidas; o registro não transforma essas rodadas em PASS. A cópia para Main foi conferida por SHA-256 de cada arquivo.

O novo CI hospedado precisa de seu próprio SHA, observação original e cleanup confirmado. Não existe novo aceite de Admin, Recovery, SMTP pessoal ou produção neste documento. A matriz pública permaneceu failure por um caso inconclusivo e também não é promovida a PASS global.
