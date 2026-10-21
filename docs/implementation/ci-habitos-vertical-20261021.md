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

### Rodada9a8b89b — SQL Editor incorporado e tipos oficiais

O gate SQL Editor passou. O CI geral39631808335 parou em `LOCAL_COLUMNS_DIFFER`: o baseline de tipos ainda era20. Fundação push39631808187 e PR39631817030 aplicou21 migrations em PostgreSQL17 descartável, confirmou no-op0 e catálogo1353; exportou tipos oficiais idênticos nos dois eventos e recusou o baseline com `TYPES_REFUSED/SNAPSHOT_DIFFER`. Cleanup confirmado, zero processos/escritas incertas. A procedência integral está em `t013-local-types-021-20261021.md`; nada disso equivale ao PASS da rodada seguinte ou ao aceite hospedado.

Consulta Vercel após a publicação: produção READY continua em `dpl_2HTfZ1ePMb759Uw2onhFqi76buX5`, SHA legalb67. Os últimos deployments listados não incluem a branch de Hábitos. Nenhum deploy ou SQL remoto foi executado nesta integração.

Rodada9a8 encerrada:18/18 terminais,13success/5failure. Auth, Recovery, Admin backend, Avatar e Captura Storage passaram em push e PR; Admin navegador push passou. Além dos dois CI gerais e duas Fundações bloqueados pelo baseline de tipos, o Admin navegador PR39631817119 recusou `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING` no merge86b3353: oito etapas até actor-intact passaram, mas havia uma requisição pendente após blank, abort-ack observado sem terminal público confirmado; escrita incerta=true e limpeza não confirmada. O resultado continua failure, sem rerun ou alegação de aceite. Nenhum controle de quiescência/timeout/allowlist foi alterado para ocultá-lo.

As exportações oficiais de tipos foram conferidas por hash e diff funcional antes da incorporação. O próximo SHA deve executar novamente os gates originais, inclusive Admin navegador, e obter seu próprio SNAPSHOT_MATCH; aprovação de outro evento não transfere o resultado.

### Rodada1d9c97b — Fundação aprovada; apresentação com tipagem pendente

Fundação push39633063833, source1d9c97b, e PR39633073346, merge717a8044b162e49daaae73c2f6dbc7cad5b10d1e, passaram:21 migrations/no-op0,1353 checks, SNAPSHOT_MATCH,5 controles de drift,6 workers/5 aceites/1 recusa, backends distintos aguardando a barreira, janela temporal e cleanup confirmados, zero processos/escritas incertas e infraestrutura removida.

Os CI gerais39633063900/39633073407 passaram SQL Editor e SQL descartável, depois recusaram TS2345 em `habits-workspace.tsx:37`: a função de rótulo exigia o array editável do Hábito ao receber vigência histórica readonly. Ajuste preparado usa o contrato `Cadencia` já exportado pelo Core; continua lendo e ordenando uma cópia dos dias, sem cast ou remoção do readonly. Lint/unidades/scripts/camadas/DS/build/E2E ainda precisam do próximo candidato.

Rodada1d encerrada:18/18 terminais,16success/2failure (somente os CI gerais em Typecheck). Admin navegador passou em push39633063780 e PR39633073654; isso não altera a falha de quiescência preservada do merge86b3353.

### Rodada13f8db8 — lint e recusas nativas

18/18 runs terminais,14success/4failure. CI push39634227340 e PR39634234782 passaram Typecheck e recusaram um único aviso de lint: `longDate` sem uso. Preparada a remoção desse código morto, mantendo warning budget0.

Recovery PR39634234416, merge71c8578cd47536aa832bfa9bab491ca2c8cc3b85, recusou `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING` depois de credentials-changed: abort-ack, comando Fetch abort rejeitado e terminal ausente; pending1/uncertain=true. Admin backend push39634226808 passou BLOCK_OLD_JWT com21/1353 e cleanup, mas recusou a segunda case antes de iniciar seu stack: porta54320/listen/EADDRINUSE (`PORT_REFUSED`), uncertain=false; CREATE_FORCED não executou. Não foram classificados como PASS nem ocultados por rerun, mudança de guardas ou limites.

Para antecipar diagnósticos sem esperar cada gate geral, o workflow **adicional** conserva gerador/SQL focal e publica o artefato antes de quatro etapas independentes com `always()`: comandos originais de unidades nos dois fusos, scripts, camadas e tokens/contraste. Cada falha continua falhando o job. Os17 workflows originais, seus prazos, controles e etapas permanecem intactos; os diagnósticos não substituem os aceites originais. Revisão estática independente confirmou a ausência de mudança na topologia dos coletores.

### Rodadae1324a8 — diagnósticos completos de contratos

18/18 terminais,15success/3failure (os dois CI gerais e o diagnóstico adicional em unidades). Todos os runs nativos desta rodada concluíram success. CI passou lint; unidades UTC2110pass/3fail. São Paulo não executou porque o wrapper original para no primeiro fuso com falha.

O workflow adicional39635685050 preservou a falha de unidades e executou os demais diagnósticos:1753 contratos de scripts passaram,0falhas/cancelados/skips; camadas e tokens/contraste passaram. Os três leitores revisaram separadamente os testes recusados antes dos ajustes:

- Port visual ainda exigia20 migrations. Atualização para21 preserva pins001–020 e confere bytes/hash da021; negativos de19/20/22, duplicata/substituição em21, ordem e adulteração das cópias continuam ativos, agora incluindo021.
- Novo teste confundia resposta de outra conta com corrupção de dados. O contrato preexistente `SESSION_CHANGED` encerra a sessão e limpa todos os stores. Teste separado agora exige idle/null, session-changed e veto de nova escrita sem novo fetch; o produto e suas guardas não mudaram.
- Expectativa antiga do Início misturava práticas com semanas completas. Na quarta da fixture, LeituraC3/E3 +AcademiaC2/E3 +MeditaçãoC1/E2 =C6/E8/75%; marcar Academia produzC7/E8/88%. Teste explicita cada parcela; E2E conserva marcar/desmarcar e expectativas75→88→75. Não houve mudança no Core ou nos dados para acomodar asserções.

O diagnóstico adicional passa a separar UTC e São Paulo em etapas independentes, com os mesmos testes/comportamento de TZ, para que uma falha em UTC não impeça observar o segundo fuso. O wrapper e os gates originais permanecem intactos.

### Rodada82f8836 — build aprovado; reconciliação dos percursos E2E

36/36 runs terminais:32success/2failure/2cancelled. A API registrou dois grupos no mesmo SHA, branch, evento e tentativa1; a causa da duplicação não foi inferida. Os CI anteriores39637140580/39637150705 ficaram cancelados sob a configuração de concorrência já existente. Root não cancelou nem reenviou execuções; cancelado não recebeu PASS.

CI push39637141153 e PR39637151970 passaram sintaxe/SQL Editor/SQL descartável, Typecheck, lint,2113 unidades em cada fuso,1753 contratos de scripts, camadas, DS/contraste, Impeccable, build e fronteira de Auth no cliente. E2E em ambos:321pass/4fail/4não executados. A matriz gráfica ainda não executou; não há aceite visual atribuído a esses artefatos.

Todos os runs nativos desta rodada terminaram success. Root leu os relatórios Fundação push39637140634/source82f8836 e PR39637151843/merge9a68f84d27a925c30809cdde164f5b10b32816bc:21 migrations/no-op0,1353 checks, SNAPSHOT_MATCH,5 controles de drift,6 workers/5 aceites/1 recusa, backends distintos aguardando, janela e cleanup confirmados, zero processos/escritas incertas e infraestrutura removida. Isso não certifica Supabase hospedado.

Dois revisores independentes conferiram as causas E2E antes do ajuste:

- A fixture SQL exigia `data-display.css` apesar de não haver mais import de ProgressBar no produto. Removido somente esse path do inventário finito; a igualdade exata dos imports continua ativa. O painel usa progress nativo estilizado pelo próprio CSS de Hábitos, sem import artificial.
- O percurso da casca passa a abrir Histórico e pausas antes de Registrar dia. A checagem antiga do progressbar global foi substituída pelos resultados explícitos do painel semanal:75%/6de8 antes,63%/5de8 após remover a marca e71%/5de7 após a pausa. O teste confere também Meditar0/2, motivo e veto de marcar Academia. A recuperação mantém erro real/retry/remoção do alerta e espera o título atual Desempenho.

Nenhum código do produto, timeout, retry, allowlist ou controle de autoridade mudou nesta correção. A leitura da cascata completa confirmou o posicionamento absoluto dos ticks no final de habits.css; não houve alteração do eixo por hipótese. O próximo SHA precisa executar seus próprios gates e produzir as capturas ainda ausentes.

O pin LF da migration de Hábitos após a correção é `90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e`. O hash autoral anterior continua registrado no pacote de origem; não certifica o delta da Root.

Derivação estática dos checks:1319 PGlite/1322 PostgreSQL17 da base +28 pelas sete funções privadas +3 novos guards =1350/1353. Os inventários candidatos são405 AdminBrowser,222 Recovery,256 Drive,60 NativeAdmin,57 Avatar e42 Fundação; dependências e núcleo Capture não mudam por inferência. **Todos devem ser conferidos com os derivadores originais e execução no runner.**

O workflow adicional de candidatos preserva os17 workflows originais. Ele gera SQL Editor pelo gerador existente e os inventários pelas funções originais, sem conexão hospedada ou certificação automática. Na primeira publicação, SQL Editor e tipos oficiais ainda precisam ser exportados/importados e reconciliados; falhas dos gates originais ficam registradas. Depois de todos os runs terminais, Root incorpora somente os artefatos conferidos, publica o próximo SHA e exige os gates originais novamente.

`vercel.json` mantém explicitamente desativado o deploy automático da branch `codex/ci-habits-vertical-20261021`. Produção continua no candidato legal b67 enquanto esta entrega não for aprovada.

## Aplicação e rollback

Esta migration exige implantação coordenada: ela recusa criação de Hábito enviada pelo código807 sem histórico/imagem nula. Não é uma expansão passiva equivalente à020. Nenhuma aplicação supervisionada será feita mantendo leitores/writers incompatíveis. Depois dos novos payloads, rollback da aplicação precisa conservar histórico, imagem, métricas e leitores compatíveis; apagar campos ou registros para acomodar um leitor antigo não é permitido.

## Ainda pendente

Concluir os E2E originais e inspecionar as capturas de temas/larguras do SHA aprovado; preservar o SNAPSHOT_MATCH e os demais resultados próprios em cada novo candidato. Decidir a inclusão anterior da Calendar ou seu adiamento com reagendamento antes de incorporar um arquivo ainda não aplicado — não há dependência funcional demonstrada de Hábitos para Calendar, mas a cadeia precisa ser explícita e homologada. Antes de qualquer SQL remoto, coordenar schema/código e selecionar rollback compatível:807 já não é writer válido após aplicar a migration de Hábitos, mesmo antes de novos payloads; b67 não é reader compatível com novos campos de imagens. Provar persistência/isolamento e Storage reais com contas autorizadas. A reutilização pelo onboarding depende de#63 e não foi simulada como entregue. #76/#71/#81/#44 permanecem abertas pelos respectivos critérios. Não há aceite comercial.
