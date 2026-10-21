# Integração isolada da análise mensal — 21/10/2026

Refs #77. Part of #71. Fonte congelada: domínio `58de215931944245ca08d2e01cdbc2c2f87edcc5` e interface `90e2bd150f78d9262c578c628f64a43a5d493009`, sobre planejamento `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. A base de CI `eab708f35dfc8ef47962a904b09b602c51b2373c` combina o planejamento com as correções da PR #70. Nenhum pacote de outra feature é incluído por essa integração.

Root e dois revisores independentes examinaram os deltas congelados. Os quatro hashes do domínio e os oito da interface conferem com os manifestos, assim como o hash do manifesto de UI `aad07f161c1f7ecce51f28d8306aa4f8b9e9e368522ab64b432c8c0e4ea13afd`. A alteração no spec SQL é exatamente a substituição dos dois nomes de região; queries, valores e oráculos permanecem. Nenhum bloqueador estático concreto foi identificado. Isso não certifica renderização, contraste ou comportamento conectado.

## Portões preservados

Três arquivos alcançáveis novos entram no inventário fechado do Admin: `monthly-timeline.ts`, `finance-competence-chart.tsx` e seu CSS. Os imports existentes levam à mesma árvore de dependências já declarada. A contagem declarada da base integrada passa de 379 para 382 fontes; as 61 dependências não mudam. O teste do coletor exige individualmente os três caminhos e recusa a omissão de cada um. A coleta real no Actions ainda precisa confirmar essa contagem e os bytes do HEAD; a revisão da expansão não é execução do coletor.

Os portões de fingerprint visual existentes, as asserções econômicas, os limites internos de cenários/requisições, a observação de terminais e a autoridade de limpeza permanecem. A integração reutiliza somente os deltas revisados de orçamento global de 20 minutos (`f6d8b708`) e isolamento do relógio de um controle sintético de autoridade (`ef53061`), sem incorporar suas features ancestrais. A PR #84 aprovou esse controle em 408/408 casos puros e 17/17 checks no SHA dela; o presente HEAD continua exigindo sua própria rodada completa.

`vercel.json` desativa deploy somente na nova branch de revisão antes do primeiro push, preservando as outras entradas e o comportamento de main. O resultado no provedor precisa de conferência própria. Draft não é supressão de deploy. Não houve merge, mudança de plano ou implantação pela Root.

## Validação e pendências

Verificações locais: hashes dos blobs Git, comparação exata do spec SQL, revisão estática e diff-check. Um revisor relatou detector Impeccable sem achados nos quatro arquivos de UI; isso não é inspeção renderizada. Não foram executados Node, testes, build, navegador ou serviços locais pela Root, devido à restrição de RAM. As fontes e checkouts da Frente A permanecem preservados.

A publicação serve à execução dos workflows originais no runner, com dados sintéticos e PostgreSQL/Auth descartáveis. Não usa credenciais de produção, banco hospedado ou Asaas. Migrations 001–019 permanecem intactas; nenhum schema novo é aplicado. Nenhuma falha histórica da base ou de outra PR recebe PASS retrospectivo.

Pendentes no SHA publicado: testes puros em ambos os fusos, TypeScript/lint/camadas, coleta fechada do Admin, scanner, design system, detector, build, fronteira de Auth, E2E financeiro e SQL, além dos demais workflows. Inspeção visual em claro/escuro, 320/390/768/1280 px, zoom, contraste medido e foco real continuam gates de aceite separados. Esta fatia não fecha #77/#71/#81 nem autoriza deploy.

## Primeira rodada e reconciliação adicional

O HEAD `3dfc6edb1e80ae7034b58ff1f53a0f8c3cd04b19` concluiu 12/17 checks com sucesso, sem cancelamentos ou reruns. Recovery falhou nos controles puros dos runs [39558138165](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39558138165) e [39558131479](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39558131479): 117/118 controles, `SOURCE_REFUSED`, antes do navegador ou serviços Recovery. Os dois CIs gerais recusaram o mesmo contador Recovery e dois controles do coletor legado: 243 fontes observadas contra 242 declaradas. Essa assinatura é distinta do `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING` histórico e não prova falha de recuperação do produto.

A projeção `monthly-timeline.ts` também fica alcançável por `workspace/layout` → provider/aplicação demo → barrel financeiro. A reconciliação declara Recovery 209→210/60 e o coletor legado 242→243/50, sem novas dependências. O novo caminho é exigido individualmente; Recovery recusa identidade Git incorreta nele e o relatório legado recusa sua omissão. Nenhum seed, loader, hash pinado, limite, oracle ou prova de cleanup é flexibilizado. Os coletores reais do novo HEAD ainda devem confirmar esses conjuntos. A manutenção do coletor legado não reintroduz a entrega Drive retirada do MVP, nem ativa seu workflow manual.

Um run Admin dessa rodada ([39558138116](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39558138116)) falhou após os controles puros, com BOUND e sem relatório final nos logs; a causa continua não demonstrada. Reutiliza-se somente o diagnóstico fechado do wrapper de `9e1a6e1`, sem o contrato de checkout ancestral. Ele preserva o código de saída e não fornece autoridade de quiescência. Nenhum novo push ocorreu enquanto os 17 runs anteriores estavam ativos. Todos os resultados anteriores permanecem vinculados ao seu SHA.

**Correção posterior:** a ausência era na visualização do CLI, que truncou a linha grande. O ZIP original desse run contém relatório final `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING`, `BLOCK_LIVE_BROWSER`, fase `after-blank`, request iniciado em `actor-intact`, aborto rejeitado e nenhum terminal observado. A coleta Admin efetiva contém 382 fontes/61 dependências, mas um request permanece pendente e a limpeza não foi certificada. O documento de diagnóstico acima registra a recuperação do ZIP. Não há evidência para atribuir a recusa à interface financeira ou para relaxar a barreira.
