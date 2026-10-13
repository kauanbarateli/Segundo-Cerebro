# PR #39: animação dos capítulos em janelas menores — 13/10/2026

O mantenedor informou que no Microsoft Edge as telas dos capítulos deixavam de acompanhar a rolagem, mas voltavam em tela cheia com F11. A comparação entre a primeira entrega e a revisão incorporada confirmou que a animação não foi removida: os dois gates de altura mínima de 700 px já existiam na PR original. A revisão anterior preservou layout e imagens.

## Alteração e limites

As duas media queries de desktop agora usam **600 px**, mantendo largura mínima de 1024 px. Foram preservados sticky, ponto de parada, subida de 56vh, pausa de 16vh, timeline, keyframe e limite da imagem. Abaixo de 600 px e no celular permanece o fluxo estático. Movimento reduzido conserva a ausência de animação de escala; sticky e deslocamento manual por scroll seguem o comportamento original. Nenhuma das 31 imagens foi modificada.

O piso de 600 px é **OBSERVADO**: o maior texto principal mediu 473 px em largura 1024 e 493 px em 1440, para 496 px disponíveis abaixo do ponto fixo de 104 px. Fontes alternativas ou texto ampliado podem superar esse espaço; o último fato continua alcançável após a liberação do sticky. Não foi criada uma promessa de encaixe universal.

## Revisão e validação

O agente usou a Impeccable local e o brief de produto/design. O carregador de contexto tentou executar sem download, recusou e não recebeu PASS; o contexto foi lido diretamente. Root e peer leram o diff integral; ele contém somente dois gates/comentário no produto e testes pertinentes. Todos os cenários anteriores foram preservados. O teste que dependia de Segoe UI instalada foi substituído por fallback real/WOFF bloqueado e ampliação controlada no DOM, para não depender do sistema operacional.

Root gerou o build Main em modo demo e repetiu **30/30 E2E Chromium**, incluindo todos os seis capítulos em 1024/1440 × 600/650/700/900, fluxo estático em 599 px/320 px, movimento reduzido, fallback e texto ampliado. Tipos e lint passaram; os 79 bundles públicos passaram no scanner de autenticação. O peer independente repetiu três casos focados após o ajuste de portabilidade. O agente passou a suíte completa anterior de 30 e repetiu o único caso alterado. Os testes usam demonstração local, sem dados pessoais ou conexões Supabase.

CSS integrado: 20.103 bytes/SHA-256 `2ffe0aa1df67f2bb32294eab249540bc6a8a4cb1d1e980686b27c00411dd2d27`. Spec integrado: 25.126 bytes/SHA-256 `ac9849ecc0ecee79236dde8260eff36d537b0725f5e60aa3738f2f6c06774aa3`.

O Edge real não está disponível para automação nesta sessão. O relato F11 e a regra de CSS sustentam o diagnóstico de altura; Chromium e código validam o recorte publicado, sem declarar execução em Edge ou em engine sem suporte a timelines. A conferência posterior na janela normal do Edge mantém seu canal próprio.

## Publicação e observação da página pública

O ajuste foi publicado em [65c9e3b](https://github.com/kauanbarateli/Segundo-Cerebro/commit/65c9e3b2ad661392faed3fdceb70f272dc774fbe). Os oito workflows próprios encerraram, com seis success e duas failure por metadados; as falhas de Admin navegador/Recovery não certificam nem negam a animação. O GitHub registrou Production deployment 7045183749 como success às 17:20:21 UTC de 13/10. O [checkpoint público](evidence/mvp-acceptance-readback-20261013.json) mantém os canais separados.

Na página pública canônica, o navegador do Codex mediu **1440 × 650 px efetivos**, após compensar a razão observada entre configuração e viewport. Os seis capítulos mantinham texto e tela sticky, `conheca-abrir`/`--conheca-palco`, com overflow horizontal zero. Após a âncora e PageDown, a escala do primeiro capítulo passou de 0,94 para 1. Viewport foi restaurado; não houve leitura de dados privados. Essa é uma observação real nesse navegador, sem identificação do SHA servido ou execução em Edge.
