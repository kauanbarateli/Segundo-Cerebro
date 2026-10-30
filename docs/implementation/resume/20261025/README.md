# Pacotes congelados para a retomada

Entrada principal: [handoff da pausa](../../handoff-retomada-20261025-pausa-mvp.md). Este diretório preserva arquivos públicos de autoria/validação; **não é uma autorização para executar testes conectados durante a pausa**.

| Pasta | Uso |
|---|---|
| `landing-ui-v2/` | Patch ainda não integrado, manifesto, dependência de assets, inventário de imports retirados e delta V1→V2. **HOLD_ASSETS:** só aplicar depois de obter e qualificar os17 membros Gallery reais. A base é3403; conferir cada before no checkout da retomada. |
| `http-main-v1/` | Executor Main concreto, Runtime, codec, testes offline, matriz, pins, configuração **desabilitada** e comando-modelo. Source3403; precisa revisão/rebinding antes de qualquer execução futura. |
| `http-main-v1/supports/` | Donor público das funções de transporte, prova de leitura Auth Admin sem usuários criados, resultado dos puros Root e HOLD401 real. Nenhuma chave/token/cookie. |
| `integrated/` | Manifestos/patches históricos da cadência, G4 V3 e Gallery já integrados às pastas normais do projeto neste commit. Não reaplicar. A cadência recebeu depois um delta acessível Root de dois paths, registrado no inventário local do projeto. |
| `gap-map/` | Matriz de46 critérios e adendo de escopo. É um snapshot: reconciliar com as entregas deste handoff, sem tratar trabalho concluído como pendente ou restore como bloqueio. |
| `reviews/` | Pareceres estáticos de cadência e Gallery. Não substituem execução ou aceite visual. |
| `ci/` | Metadados terminais dos11 runs antes pendentes e recibos dos dois originais E2E ce7. Os11 anteriormente encerrados já tinham sucesso: total20/22. Logs completos continuam nas Actions e no diretório local de evidências. |

## Portabilidade e integridade

`FILES.json` inventaria os arquivos deste pacote, exceto ele próprio. `.gitattributes` preserva os bytes de todo este diretório; não converter quebras de linha dos arquivos congelados, pois isso invalida os hashes. A exceção de whitespace se restringe a este arquivo histórico de pacotes: CRLF e linhas de contexto dos patches são conservados literalmente. Os arquivos normais de código mantêm a política LF e os checks habituais. Os manifestos dos autores foram preservados literalmente: campos como `published:false` ou `testsExecuted:false` descrevem a autoria daquele pacote; o handoff e os resultados Root registram o que ocorreu depois.

Alguns roteiros antigos contêm caminhos absolutos desta máquina. Eles são referências históricas públicas, não segredos. Não executar como estão nem criar artificialmente a árvore antiga. Numa **cópia externa nova**, reconciliar esses caminhos com o checkout atual e revalidar os hashes/dependências; não editar os originais congelados para ocultar drift.

Para Main V1, mapear `authDonorPath` ao donor em `supports/`; os quatro arquivos `probeEvidence` estão em `supports/absence-proof/`. Atualizar os paths e o Source/árvore/deployment/configuração somente após revisão do candidato real; manter gates fechados até essa revisão. As fontes de cadência mudaram desde3403, portanto os pins antigos não passam por herança. Não reutilizar o run consumido `2ac93cc3-eec8-4568-82a6-8f04d7e72e33` nem janelas antigas. O canal HTTP protegido continuava indisponível: o login humano da Vercel no browser não é cookie de um cliente HTTP. Não introduzir bypass persistente, usar cookies humanos ou carregar chaves antes da preflight permitida.

O donor é suporte para extração revisada de funções; **não executar seu fluxo antigo inteiro**. Configurações, manifests e hashes não são evidência de execução. Segredos e arquivos de operações privados ficam fora do Git; nunca preencher placeholders neste diretório e commitar valores.

[Prompts por frente](PROMPTS.md).
