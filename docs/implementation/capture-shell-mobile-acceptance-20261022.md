# Capturar com WorkspaceShell — fatia de aceite sintético

Refs #75, #81 e #44. Base autoral `3d86cd8f7e1e97e89990513237a8d4ef792b3249`, árvore `7566fe2ee28c2199ad07252a758072aa239ea247`. Branch `codex/mobile-acceptance-20261022`. A Root seleciona/publica o candidato depois de revisão. A guarda de deploy da branch pertence à Root; esta autoria não altera produto, migrations, workflows, dependências ou fixtures históricas.

## Escopo implementado

O novo `capture-shell-sql.spec.ts` mantém o `WorkspaceShell`, `WorkspacePage`, `CaptureView`, editor TipTap, providers, cliente conectado e journal originais montados juntos. `capture-shell-browser.tsx` é uma composição de teste. `helpers/capture-shell-sql.ts` deriva o seam SQL/HTTP da suíte issue22 preservada, com outro namespace de UUID/origem e uma lista fechada dos CSS realmente importados. O backend usa o loader canônico descartável; não aplica SQL em conta hospedada.

Identidade, política, Next navigation/link e HTTP são seams explícitos. Os vetos reais de Conhecimento, Projetos e Calendário excluem promoção, enriquecimento e lembretes deste recorte; não fabricam respostas vazias para esconder consultas. Os demais controles/rotas visíveis do shell conservam sua geometria. A navegação só permite `/capturar` e sua query `capture`; qualquer request estranho é recusado e registrado. O teste não segue os links de outros módulos. Os RPCs de Captura usam Core/Gateway/Store e o SQL original com dono/sessão vinculados.

### Matriz finita

| Viewport CSS | Temas | Movimento | Seleção |
|---|---|---|---|
| 320 × 720 | Claro, Escuro | Reduzido | 0 e 3 caracteres |
| 390 × 844 | Claro, Escuro | Reduzido | 0 e 3 caracteres |
| 768 × 900 | Claro, Escuro | Preferência normal | 0 e 3 caracteres |

São 12 casos independentes, cada um com banco/contexto próprios encerrados em finally: uma falha não cancela os seguintes por uma suíte serial. Sem retries desta suíte e sem aumentar timeouts ou alterar o orçamento dos gates existentes. A preferência de tema é preparada no armazenamento sintético; não se afirma gravação do tema no servidor. O contexto usa Chromium com largura responsiva e teclado/mouse reais do navegador, não um aparelho físico nem teclado virtual.

Cada caso prepara dois destinos por comandos canônicos e percorre:

1. Shell real e uma única `main`; menu mobile modal, fundo inerte, Tab contido, Escape e retorno ao abridor onde aplicável.
2. Clique/tipagem no título, Tab até Vincular nota, abertura por Enter, foco no campo do modal, candidato por Tab e retorno ao abridor por Escape.
3. Editor com Ctrl/Cmd+K local, campo de URL e Escape de volta ao editor; nenhum diálogo de busca global é permitido.
4. Texto `Antes depois`, seleção real observada após cada tecla (0 ou 3 caracteres), caret/range dentro da viewport e fora da moldura. Não usa comandos privados do SDK nem troca `Range`/seleção via JavaScript.
5. Dois vínculos consecutivos sem reposicionar a seleção; IDs e árvore inline exatos conferidos no SQL.
6. Tab nativo até Salvar, sem correção de scroll/foco depois: um controle encoberto falha. Dado, evento e recibo reais são conferidos, e uma recarga preserva o ledger integral sem novo envio.

O deslocamento intencional até um controle usa somente roda do mouse com número limitado de ações; exige rolagem real observada. Não chama `focus()`, `scrollIntoView`, CSS zoom ou alteração de layout para resgatar um alvo. `bringToFront()` estabelece a janela de interação do próprio navegador, seguido de observação do foco real. O fechamento/retorno de foco continua sendo responsabilidade do produto.

As medições conferem retângulos, viewport visual, interseção com topbar/barra inferior, hit-test central, alvo mínimo de44px e campo de16px nos controles principais. Tab exige foco real e indicação visual. Um overlay temporário, exclusivamente negativo de detector, precisa impedir o hit-test; ele é removido antes de continuar ou capturar evidência. O teste não mascara a moldura, não reduz a barra inferior e não apaga conteúdo para caber.

## Evidências esperadas do CI

O artefato normal `browser-evidence` deve conter, por caso, `capture-shell-report.json` e PNGs **da viewport** `modal-keyboard.png`, `editor-selection.png` e `save-keyboard.png`. Há também `shell-menu.png` nos quatro casos mobile de seleção0. Os nomes de diretório do Playwright identificam largura/tema/seleção; cada relatório inclui esses valores, fonte `GITHUB_SHA`, navegador, movimento, medições, seleção e bytes/SHA-256 de cada PNG. Não se usa screenshot de elemento/fullPage para deduzir oclusão de viewport.

Os relatórios registram `acceptance:false`: são evidências sintéticas para revisão, não autorização de release. A Root deve conferir origem/checkout do SHA, logs completos, ausência de flaky, inventário/hashes do artefato e a rodada gráfica conjunta. As asserções de tamanho/foco não substituem inspeção gráfica, leitor de tela ou medição de contraste da composição.

Roteiro preparado para o GitHub, sem execução nesta máquina: gates normais de tipos/lint/camadas/DS/SQL/build e `npm run test:e2e -- tests/e2e/capture-shell-sql.spec.ts`, seguidos dos originais completos do candidato selecionado. Nenhum workflow foi criado ou alterado por esta autoria. O conjunto histórico B/P/C e todos os oráculos anteriores de CAS/replay/recibos ficam byte-preservados.

## Pendente e fora deste aceite

### Rodada própria de 22/10 e correção do preparo

Os dois CIs gerais de `420a6331018f237ba984a3b025b1b30b978ca5a8` terminaram com361 testes anteriores aprovados e12 novos casos reprovados, sem flaky ou skipped. Os12 casos chegaram ao oráculo `trace.pageErrors=[]` e falharam pelo acesso do script de tema ao `localStorage` do documento inicial `about:blank`; a verificação final de overflow/campos ainda não havia sido executada. Essa rodada não fornece aceite mobile nem gráfico.

A correção restringe o `addInitScript` à origem exata já exportada pela fixture. A gravação nessa origem continua sem catch; nenhum erro do aplicativo é apagado ou filtrado. `trace.pageErrors=[]`, SQL, produto, CSS, geometria, retries e timeouts permanecem intactos. Os resultados novos pertencem somente ao SHA que executar essa correção.

Foram preservados os18 originais de420 e seus resultados, incluindo os dois CIs falhos. No momento da publicação corretiva,17 estavam encerrados e somente o Admin backend PR ainda preparava seu cliente PostgreSQL. O workflow preexistente desse último usa `cancel-in-progress:false`; publicar o novo SHA não cancela esse original. Essa exceção à congelagem interna permite executar a correção em paralelo, mantendo a revisão do original antigo até seu encerramento, sem fechar antecipadamente a barreira420 ou herdar seu aceite. Merge e deploy continuam bloqueados.

- Execução do novo código/teste em CI, descoberta de imports CSS, revisão gráfica e eventuais defeitos observados. Não há PASS antecipado de tipagem, SQL ou navegador.
- 1024/1440, zoom200 real, Sistema/reação ao SO e ambos os movimentos em toda a matriz; esta fatia não substitui as demais suítes existentes.
- Promoção/Conhecimento, Auth/Next handlers/GoTrue/PostgREST hospedados, Storage privado, URL assinada/revogação e duas contas reais. A interface candidata não é disponibilizada pela simples aplicação das migrations.
- Teclado virtual, safe areas reais, touch, VoiceOver/TalkBack, standalone/update/offline no iPhone11/A35 e aceite humano final. A largura de viewport não comprova esses aparelhos.
- #78/#79, cobrança/onboarding e Drive não são ativados. #75/#81/#44 não são encerradas por esta fatia ou pelos resultados de outro SHA.

Somente leitura/edição de fontes e verificação textual nativa foram autorizadas. Impeccable local, audit/polish e referências de produto foram consultadas; seu launcher, Node/npm, testes, build, navegador, serviços e SQL não foram executados na máquina de8GB. Sem credenciais, operação externa, stage, commit, push, merge ou deploy.
