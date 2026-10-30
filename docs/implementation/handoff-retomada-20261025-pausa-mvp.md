# Handoff de retomada — pausa do MVP e redesign — 25/10/2026

## Estado e instrução vigente

O mantenedor pediu para parar as demandas atuais, consolidar este handoff e disponibilizar os arquivos necessários no GitHub. As frentes foram interrompidas; não continuar a implementação até nova solicitação. Esta publicação preserva o trabalho em **PR #120, aberta e em rascunho**. Não houve merge, promoção ou deploy de produção.

- Repositório: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro).
- Integração: [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120), branch `codex/mvp-goals-terminal-20261023`.
- Base remota conferida nesta parada: main `336e1b7c2a2f5efba871eb0ad461b04bba065c41`.
- HEAD remoto antes desta publicação: `ce7be472aad4213e3d567a699abb7463f43cd8fe`, árvore `496e6f8b9087ce01a1d751aa4aacbc094f1f5690`. O commit que acrescenta este handoff contém o delta descrito abaixo; obter seu SHA na PR, sem reutilizar ce7 como se fosse o código novo.
- Último aplicativo integralmente qualificado: `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, árvore `7fdeb63d76d30058c260ba1579e55f94c6f1c2ca`, src `00e8450101ad2b5c9880e4e4bf233f68c56b2984`. Sua coorte encerrou22/22 runs e24/24 jobs bem-sucedidos. Isso não é resultado do novo delta.

Leia primeiro AGENTS.md, CONTEXT.md, D-077/D-078/D-079, este documento e o [estado detalhado](mvp-status-atual-20261025.md). O [handoff anterior](handoff-retomada-20261024-mvp-redesign.md) é histórico; esta parada prevalece nos pontos atualizados.

## Escopo a retomar

MVP operacional, redesign DS2.1 conforme o protótipo, onboarding facultativo de nove telas e ajustes da landing. **Checkout/cobrança Asaas, abertura de vendas e Drive permanecem fora. Restore foi transferido explicitamente para pós-lançamento**, conforme D-078 e [registro próprio](restore-pos-lancamento-20261025.md); não voltar a tratá-lo como gate do MVP nem declarar que passou.

O [doc17](../planejamento/17-evolucao-prototipo/README.md) é a referência visual mais recente onde evolui o doc15. Conferir composição, filtros, opções de visualização, agrupamentos, densidade, estados e comportamento, além de cores/Geist/tokens. O protótipo é referência de apresentação; não copiar dados fictícios, `window.App`, hash-router ou armazenamento demo como arquitetura. Preservar isolamento, Entitlements, eventos atômicos, preferências, contratos reais e acessibilidade.

## Preview disponível

- [Aplicativo](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app/).
- [Landing](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app/conheca).
- [Onboarding](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app/onboarding).

A Vercel confirmou READY no deployment `dpl_5SAkeYyRFkWYRSaStkfrQHJjL1N4`, Source3403, branch `codex/homologacao-twry-20261022`, `target:null`. A classificação de homologação decorre da branch/configuração, não de um campo target="Preview". O Preview ainda **não contém a cadência nova deste lote nem a landing de três capítulos**. Login usa a conta QA de homologação; não usar produção. A proteção Vercel continua ativa.

## Entregas preservadas nesta publicação

| Parte | Implementado | Validação própria | Pendente |
|---|---|---|---|
| Cadência do onboarding, #63/#80 | Item versão2: todos os dias, dias específicos e meta semanal1–7; seletor compartilhado na etapa e recuperação; resumo. JSON legado e protocolo externo1 preservados. | Nove sintaxes TS/TSX, lint9 sem avisos após ajuste acessível, detector Impeccable sem ocorrências, revisão Root e peer. | Executar os novos testes puros, E2E e SQL no GitHub, typecheck e aceite do novo Preview. |
| Negativos OAuth, #64 | Teste G4 V3 com SQL026 real descartável, dono/sessão/rodada/geração/veto, reservas, replay e controles positivos. | Revisão Root e lint do arquivo. V1/V2 foram recusadas por falhas de construção do teste e preservadas externamente; só V3 foi integrada. | Execução SQL no CI; não equivale a OAuth real ou a PostgreSQL hospedado. |
| Gallery da landing | Gerador das oito imagens de Calendário Lista/Kanban; supervisor existente, staging17 fora do checkout e etapa no CI geral. Contrato Projetos9 preservado. |61/61 puros seriais, seis sintaxes, lint6, contratos Projeto33/Gallery4, revisão Root/peer. | Captura real no GitHub, qualificação do artefato e inspeção dos oito pixels. Nenhuma imagem foi gerada neste lote. |
| Landing de três capítulos | Pacote externo V2 com Captura/Agenda/Projetos e seletor Projetos/Kanban, preservando identidade e animação Edge. | Apply-check e revisão estática do autor; compatibilidade EXIF corrigida no teste V2. | **Não integrado.** Depende dos17 membros Gallery. Não criar arquivos fictícios para satisfazer imports. |
| Onboarding HTTP conectado | Main V1 concreta,64 passos previstos, cookies oficiais SSR, dois atores novos descartáveis e isolamento. |87 asserts estáticos,15 puros e codec; prova Auth Admin somente leitura aceita. Uma execução real parou em HOLD_PROTECTION:1 GET401,0 Auth requests,0 chaves carregadas,0 atores criados. | Reconciliar Source/paths/configuração com o candidato final e obter canal HTTP autorizado do Preview. O teste conectado completo não foi executado. |

Código/testes/tooling integrados estão nas pastas normais do projeto; **não reaplicar os patches históricos**. [Descrição do lote](onboarding-cadence-landing-gallery-20261025.md) e [inventário local de17 paths](evidence/onboarding-gallery-local-20261025.json). Os [pacotes de retomada](resume/20261025/README.md) incluem a landing ainda externa, o executor HTTP e os arquivos de suporte, matriz de46 critérios, pareceres e recibos do CI. O inventário FILES.json permite verificar os bytes sem depender do diretório local.

## Primeiro bloqueio técnico: foco do alerta de Metas

A coorte ce7 encerrou20/22 runs com sucesso. Os dois gerais falharam na etapa25, E2E:

| Evento | Run / job | Original completo | Checkout observado |
|---|---|---|---|
| push |40252458748 /121347117373 |1.267.612 bytes; SHA256 `7bd9c5fe8fed6eff792c2a86e11e9b0930e3a6174b6ea58d09270bc02dd47b66` |ce7, linha191 |
| pull_request |40252462395 /121347127772 |1.264.500 bytes; SHA256 `6aefd9295fc5eea6f0b96a98d080f44013c09ae65d8da62c84ed96675a49bc73` |merge checkout `d0485a67d204e0429bc89afea4e57a289a211a2f`, linha203; não confundir com head da API |

Ambos falham em `tests/e2e/finance-goals-image-upload.spec.ts:137:125`, caso `failed finalize...`: `expect(getByRole('alert')).toBeFocused()` não encontrou foco no alerta, embora ele estivesse renderizado. Push:1 failed/539 passed e um caso prepare classificado flaky; PR:1 failed/540 passed. Os dois originais foram coletados uma vez, com EOF natural e exit0; os [recibos](resume/20261025/ci/) estão preservados. Não repetir downloads para diagnosticar o mesmo original.

`src/components/features/financeiro/goals/goal-editor.tsx:53` publica o erro e tenta focar usando um `requestAnimationFrame` único. A hipótese é uma disputa com o commit React; **não foi reproduzida nem confirmada como causa**. A investigação parou em leitura: não existe patch final ou correção aplicada. Ao retomar, investigar foco após montagem real do alerta, manter os guards de lifetime/sessão e os asserts existentes. Não aumentar timeout/retries, descartar o teste, substituir foco por mera visibilidade ou declarar a falha irrelevante.

Os runs automáticos provocados por esta publicação pertencem a um novo SHA. Seu estado deverá ser consultado na retomada: não foram aguardados ou aceitos durante a pausa.

## Sequência para retomar com quatro frentes

1. **CI e foco de Metas:** corrigir a falha demonstrada, revisar o delta e executar os testes apropriados no GitHub. Só depois esperar a captura Gallery, posicionada após E2E no workflow. Não coletar novamente originais já preservados e não alterar gates para esconder falhas.
2. **Onboarding:** qualificar o delta de cadência/G4 nas suites reais, conferir compatibilidade legada, falhas, retomada e conclusão idempotente. A instalação local de Vitest4.1.11 difere do lock4.1.12; não usar um PASS local dessa instalação como aceite do candidato. Não criar DDL para a frequência: o item é JSON versionado sobre o protocolo existente.
3. **Landing:** selecionar o artefato próprio `landing-gallery-<sha>-<tree>`, conferir recibo/policy/Source/hashes/17 membros e inspecionar oito imagens. Depois aplicar o pacote UI V2, seus assets e recibo; rodar os testes e comparar desktop/mobile/claro/escuro/reduced-motion com doc17. Preservar a correção de sticky do Edge, hero priority e escopo sem preço/checkout/vendas.
4. **Root / conexões e integração:** atualizar somente a homologação após os checks; reconciliar e revisar o executor Main com o Source final. Concluir HTTP/cookies/RLS/veto e os critérios restantes das #62–65/#80/#81; qualificar eventuais dados de teste e limpeza. O controle de viewport320/390 do navegador existe, mas não prova zoom nativo. O aceite explícito de zoom e o estado operacional de retenção continuam na matriz; não inventar novas rodadas de testes já aceitos.

As frentes1–3 podem produzir patches/worktrees isolados. Root revisa antes de incorporar; cada resultado pertence ao SHA executado. Não trabalhar simultaneamente nos mesmos arquivos. [Prompts completos](resume/20261025/PROMPTS.md).

## Banco, serviços e produção

- Homologação exclusiva: `twrydxsdemaykgvdlpyd`,001–027 já instaladas e conferidas anteriormente. Não reaplicar, fazer reset ou seeds. Este lote não exige migration nova.
- Produção: `rishenjoikgmfubmnfiu`. Não foi alterada ou reconferida nesta parada. Não presumir quais020–027 já foram aplicadas; obter inventário somente leitura e preparar o corte supervisionado conforme OP-009 quando autorizado. CI/build/deploy nunca aplicam schema.
- Ensaio_restore `jvwduowyavpaxssogadn` permanece reservado; restore/backup pós-lançamento não são trabalho das frentes atuais. Preservar arquivos, chaves, perfis e resultados existentes. Não reutilizar janelas antigas de quiescência.
- Supabase pessoal e conexão MCP de homologação funcionavam na última conferência. Não iniciar reautenticação sem falha atual; nunca usar BlackSheep, VOE ou legado como alternativa.
- Vercel projeto `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, equipe `team_BqlhayzOBFfZT7Rv16j4OeUK`. Preservar variáveis do Preview e Production. As duas credenciais Google de Production continuam adiadas pelo mantenedor e precisam ser recadastradas antes do corte; não copiar segredos para issues/chat.
- O cliente Google compartilhado foi autorizado pelo mantenedor e tem o callback da homologação. Preservar conexões de produção; não revogar permissões Google durante limpeza de testes.
- A sessão QA existente tem dados a preservar: quatro Metas, duas contas financeiras, um lançamento fictício e imagens ligadas. Uma rodada de onboarding continua aberta no Calendário, com duas contas Google; não resetar para repetir percurso. O executor Main prevê atores novos, não essa QA.

## GitHub e issues

Dez issues técnicas foram encerradas com critérios/evidência: #41, #72–79 e #104. Os aceites globais e humanos continuam nas #7/#71/#80/#81/#12/#44; concluir somente os critérios realmente pendentes. #63/#64/#65 preservam contratos de onboarding. #35 conserva hardening aplicável, mas restore em #35/#42 é pós-lançamento. #36 foi encerrada pelo aviso retirado; #121 é manutenção posterior.

PRs abertas conferidas nesta parada: #120 integração atual; #114 diagnóstico de restore pós-lançamento; #83 pré-Auth comercial e #84 acesso comercial, fora deste lote. Todas estavam em rascunho. Não integrar ou fechar #83/#84/#114 por causa deste handoff, nem apagar suas branches. Não houve merge ou exclusão de branch nesta parada.

Para GitHub, usar a identidade pessoal `kauanbarateli` e o SSH exclusivo do repositório. A integração genérica GitHub pode estar na conta VOE `contasvoedigital`: não escrever com ela. Não executar `gh auth switch`, alterar SSH/globalconfig ou imprimir tokens. Commits, issues e PRs sem coautoria. Conservar os cinco WIPs do checkout humano e os outros worktrees.

## Máquina e arquivos privados

Máquina de8GB. Quatro agentes significam quatro frentes de análise/edição, não quatro servidores ou suites locais. Usar Node24 explicitamente; os checks leves foram seriais com64/128MiB. Não executar npm ci, Next, Docker/PostgreSQL, PGlite, SDK/browser suites ou build pesado localmente. Enviar essas validações ao GitHub nos workflows existentes. Não encerrar processos alheios.

Checkout Root original: `C:/Users/Kauan Sousa Barateli/Documents/Codex/2026-10-07/inicie-a-constru-o-do-software-2/work/Segundo-Cerebro-mvp-goals-terminal-20261023`. Evidências originais: mesma raiz da tarefa, `work/Segundo-Cerebro/work/ci-capture-write-20261021/`. A pasta de retomada publicada elimina a dependência dos pacotes externos para o trabalho de código. `.env.local`, perfis Operations, tokens, cookies, credenciais, backups e dados pessoais não foram incluídos; qualquer agente em outra máquina precisa de acesso autorizado aos serviços por canais privados.

**Estado final desta etapa:** implementação pausada; arquivos publicados para retomada; nenhuma conclusão do MVP, merge ou produção implícitos.
