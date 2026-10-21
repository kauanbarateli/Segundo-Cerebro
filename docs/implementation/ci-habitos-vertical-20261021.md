# Integração de Hábitos SPEC08 — 21/10/2026

Estado: candidato de revisão; sem aceite conectado, aplicação remota ou deploy.

## Origem conferida

Base807: `807fbe837211df91d4df1dff30e206a26a3c88e0`, PR91 de imagens privadas, ainda em rascunho. Os18 runs originais dessa base foram reconferidos pela Root como completed/success, incluindo os dois eventos do CI geral e Fundação. A aprovação pertence à base, não a esta entrega.

Entrega autoral: `a8bb436a44045d811dc04c72702ed7add6354a91`, branch local `codex/spec08-habit-vertical-20261021`,47 paths. Root conferiu os47 blobs Git e os47 arquivos do clone contra o manifesto. Dos hashes brutos do Git,46 coincidem; apenas `habits.css` difere por uma quebra de linha CRLF normalizada, com conteúdo LF idêntico. Manifesto canônico conferido fica no diretório de trabalho ignorado da Root. O clone autoral foi preservado.

O mantenedor autorizou concentrar a implementação em um bloco e reduzir passagens intermediárias. Root recebeu o único slot de integração, com três revisores somente em leitura: Core/métricas, SQL/autoridade e catálogos/CI. Runtime, navegador, compilação e banco continuam exclusivamente nos runners descartáveis do GitHub por causa da máquina de8GiB.

## Ajustes de integração

- Corrigido o setter de imagem de Hábito: reconferência transacional de `read.habits` depois de payload/evento/recibo. Recusa de snapshot desfaz vínculo, evento, recibo e revisão; replay autorizado permanece anterior.
- Preparados negativos em10.000 registros e8.388.607 bytes, com arquivo finalizado do mesmo usuário/finalidade, link/unlink, igualdade do ledger e replay sem escrita. Esses casos ainda precisam executar.
- Atualizado apenas o `after` de criação RPC do teste comportamental antigo, com baseline `created_frequency` e imagem nula; input público continua excluindo os campos geridos pelo servidor. Seeds legados diretos permanecem legados.
- Acrescentado `habit_image` ao teste existente de finalização incerta, preservando cinco falhas de Storage e zero processamento/publicação/complete.
- Removidas alturas mínimas que desenhavam registros inexistentes no gráfico. O E2E preparado confere altura zero nas barras sem registros em toda a matriz existente.
- Catálogo de release acrescenta coluna de imagem anulável, FK composta e cinco helpers de frequência; guards de execução continuam fechados. Os dois wrappers anteriores permanecem helpers privados, sem novos endpoints. CTE espelhado integralmente no validador do restore.

## Cadeia e artefatos

Este candidato contém **21 migrations**:001–020 preservadas e `20261021144650_spec08_habit_frequency_history.sql`. A Calendar reservada `20261021050931_spec08_calendar_list_participants.sql` está ausente. Não declarar22, não aplicar Hábitos remotamente antes de decidir a ordem conjunta e não inserir depois uma migration anterior como se já estivesse conciliada.

### Rodada9cd542e — candidatos gerados

PR92 em rascunho, empilhada sobre PR91. Run adicional39630196999/1 concluído com sucesso:5 testes SQL,5 pass,0 fail, incluindo os negativos reais de contagem/bytes e histórico. Catálogo descartável observado1350, ok=true, sem desvios. Os derivadores originais observaram exatamente60/405/222/256/42/57 fontes, respectivamente NativeAdmin/AdminBrowser/Recovery/Drive/Fundação/Avatar. Isso confirma os números deste candidato, não certifica as execuções nativas.

Artefato12358662686, SHA256 `6b2b8d60121abe805f7b7188b9efe936758be4acac23175fe8b83a225698fdf9`, source9cd542e. Os23 arquivos gerados foram conferidos por caminho, tamanho e hash antes da importação; as21 cópias SQL coincidem byte a byte com as fontes. O pacote ainda precisa de novo check no SHA que o incorpora. CI geral39630196865/39630267626 recusou corretamente SQL Editor antes dessa importação; não houve relaxamento do gate. Tipos oficiais de21 migrations ainda pendentes.

Rodada9cd encerrada:18/18 runs terminais,16 failures e2 successes (candidatos e qualificação Chromium). O último agregado39630196821 só encerrou depois de seu job; Root aguardou sem rerun/cancelamento. As etapas posteriores aos bloqueios de SQL Editor/fontes não receberam PASS por inferência.

O pin LF da migration de Hábitos após a correção é `90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e`. O hash autoral anterior continua registrado no pacote de origem; não certifica o delta da Root.

Derivação estática dos checks:1319 PGlite/1322 PostgreSQL17 da base +28 pelas sete funções privadas +3 novos guards =1350/1353. Os inventários candidatos são405 AdminBrowser,222 Recovery,256 Drive,60 NativeAdmin,57 Avatar e42 Fundação; dependências e núcleo Capture não mudam por inferência. **Todos devem ser conferidos com os derivadores originais e execução no runner.**

O workflow adicional de candidatos preserva os17 workflows originais. Ele gera SQL Editor pelo gerador existente e os inventários pelas funções originais, sem conexão hospedada ou certificação automática. Na primeira publicação, SQL Editor e tipos oficiais ainda precisam ser exportados/importados e reconciliados; falhas dos gates originais ficam registradas. Depois de todos os runs terminais, Root incorpora somente os artefatos conferidos, publica o próximo SHA e exige os gates originais novamente.

`vercel.json` mantém explicitamente desativado o deploy automático da branch `codex/ci-habits-vertical-20261021`. Produção continua no candidato legal b67 enquanto esta entrega não for aprovada.

## Aplicação e rollback

Esta migration exige implantação coordenada: ela recusa criação de Hábito enviada pelo código807 sem histórico/imagem nula. Não é uma expansão passiva equivalente à020. Nenhuma aplicação supervisionada será feita mantendo leitores/writers incompatíveis. Depois dos novos payloads, rollback da aplicação precisa conservar histórico, imagem, métricas e leitores compatíveis; apagar campos ou registros para acomodar um leitor antigo não é permitido.

## Ainda pendente

Executar testes originais, conferir artefatos SQL Editor/tipos e obter SNAPSHOT_MATCH; inspecionar as capturas de temas/larguras do SHA aprovado; reconciliar Calendar e o candidato conjunto antes de qualquer SQL remoto; provar persistência/isolamento e Storage reais com contas autorizadas. A reutilização pelo onboarding depende de#63 e não foi simulada como entregue. #76/#71/#81/#44 permanecem abertas pelos respectivos critérios. Não há aceite comercial.
