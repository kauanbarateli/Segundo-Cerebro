# Prompt — implementação paralela das issues com 8 GB de RAM

Copie o bloco abaixo para o agente responsável pela engenharia. Sua criação/publicação não inicia tickets; **quando o mantenedor enviar este prompt para execução**, a instrução autoriza a construção e a entrega em PRs dentro do escopo abaixo. A Root conserva integrações, validação conectada, incorporação e publicação do produto.

O [mapa conferido em 18/10/2026](../implementation/mapa-issues-paralelas-20261018.md) contém todos os números, bloqueadores e SHAs observados. Reconferir o GitHub no início; o mapa envelhece.

---

## Missão e divisão com a Root

Assuma a engenharia das issues aprovadas de [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro), preservando a aplicação existente e entregando fatias pequenas em PRs para a Root revisar. Coordene quatro trilhos lógicos em ondas, com **no máximo dois agentes editando código simultaneamente**. A máquina tem **8 GB de RAM**. Não abra quatro stacks, navegadores ou suítes por interpretar “quatro frentes” literalmente.

A Root está concluindo inventário de retenção/transferências, páginas legais e publicação dessa entrega. Ela também será o ponto único para conexões Supabase/Asaas/Google/Vercel, validações reais, revisão dos SHAs, integração e deploy das entregas futuras. Você constrói domínio, adapters, interface, testes sintéticos e documentação dos tickets; envia PRs e as evidências para revisão. Não aplique SQL remoto, habilite jobs, faça cobranças, restore, crie contas de teste reais, altere OAuth/DNS/segredos ou faça merge/deploy por conta própria. Um bloqueio externo deve ser registrado e comunicado; avance em outra fatia independente autorizada.

O pedido de 18/10 autoriza publicar as páginas legais e o material de preparação; substitui a restrição local de D-072 **para essa entrega da Root**. Não é autorização geral de lançamento comercial, contratação Vercel Pro, migração VPS, publicação nas lojas ou venda. A escolha de hospedagem comercial e os aceites de abertura permanecem gates. Não reintroduza Drive, IA embarcada, compartilhamento ou um aplicativo nativo por inferência do guia de lojas.

**Atualização humana em 18/10/2026, distinta do horário da conferência GitHub no mapa:** o mantenedor confirmou **Vercel Hobby** e decidiu **“Manter Hobby e adiar o deploy”**. D-074 autoriza publicação GitHub, sem autorizar contratação Pro ou deploy. A Root pretende enviar a entrega legal/documental em PR draft, sem merge ou atualização de `main`, usando `git.deploymentEnabled` em `vercel.json` com `codex/paginas-legais-e-checklist-20261018: false`, conforme a [documentação oficial](https://vercel.com/docs/project-configuration/git-configuration). A supressão é restrita a essa branch, com CI preservado; não afirmar que o serviço a aplicou sem leitura de metadados após o envio.

Antes de push de qualquer ticket comercial, leia a atualização dessa decisão e confira autodeploy de branches/PRs, inclusive draft/Preview. A regra da branch legal não cobre branches novas. Combine com a Root o canal sem deploy e sua verificação; até isso estar resolvido, entregue commits/patches locais conforme a seção 7. Não contorne o adiamento por checkout externo, outra branch ou deploy manual. Não desative CI para esconder falhas nem presuma que PR draft impede Preview.

## 1. Leitura obrigatória e precedência

Leia integralmente, antes de editar:

1. [`AGENTS.md`](../../AGENTS.md), [`CONTEXT.md`](../../CONTEXT.md), [issue-tracker](issue-tracker.md), [labels](triage-labels.md), [domínio](domain.md) e [decisões operacionais, especialmente OP-009](../implementation/decisoes-operacionais.md).
2. [ADRs](../adr/): 0001 isolamento; 0002 Núcleo; 0003 Entitlement/Preferência; 0004 evento atômico; 0007 saga Admin; 0008 Google somente leitura; 0009 escopo comercial; 0010 fronteira comercial recuperável.
3. [Registro de decisões](../planejamento/registro-de-decisoes.md), D-032/033 e D-034 em diante, incluindo atualizações posteriores ao planejamento. Políticas aprovadas não serão entrevistadas novamente por conveniência de implementação.
4. Pacote [`docs/planejamento/16-checkout-asaas-onboarding/`](../planejamento/16-checkout-asaas-onboarding/README.md), documentos 01–09 e o corpo/comentários atuais de [SPEC-07 #50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50) e de cada issue escolhida. Os 18 corpos integrais estão em [`tickets/`](../planejamento/16-checkout-asaas-onboarding/tickets/). Leia objetivo, aceites negativos, roteiro e abertos; a tabela resumida não os substitui.
5. [Pacote visual doc 15](https://github.com/kauanbarateli/Segundo-Cerebro/tree/57a2967f34a11cf985e62827d67179335474f477/docs/planejamento/15-aplicacao-layout-codex): `07-onboarding-simplificado.md`, `08-prompt-onboarding.md`, mapa de integração, execução L3O, aceite OB1–OB6, protótipo/JS/CSS, brief de onboarding e índice de capturas. Obter o HEAD atual do [PR #47](https://github.com/kauanbarateli/Segundo-Cerebro/pull/47) e revisar o delta; não trocar o contrato por uma demo ou portar `window.App`/hash routing/localStorage como arquitetura.
6. `.agents/skills/impeccable/SKILL.md` inteiro e as referências aplicáveis antes de UI; onboarding pede distill/onboard e audit/polish. Preservar DS 2.1/Geist, layout e animações da landing. Leia a skill Supabase disponível ao trabalhar nesses contratos, inclusive Auth/RLS; isso não autoriza conexão.
7. [Pesquisa Asaas no commit `12b572e`](https://github.com/kauanbarateli/Segundo-Cerebro/blob/12b572ec0c93aa004bfda7141f40bd5f0ef1b659/docs/implementation/pesquisa-asaas-assinatura-20261018.md), [PR #49](https://github.com/kauanbarateli/Segundo-Cerebro/pull/49) e fontes oficiais atuais antes de afirmar capacidades externas. A Root recebe a homologação #51. Leitura documental não prova comportamento do sandbox.
8. [Mapa atual desta preparação](../implementation/mapa-issues-paralelas-20261018.md), [PR #45](https://github.com/kauanbarateli/Segundo-Cerebro/pull/45) e seu [handoff imutável](https://github.com/kauanbarateli/Segundo-Cerebro/blob/93ab8549efbdc7c121715ea449c2ce04676585ed/docs/implementation/handoff-retomada-20261017.md) para qualquer recorte histórico. Não tentar executar preparos CLOSED ou abrir seus artefatos privados.

Se um material não estiver em `main`, obtenha o arquivo/commit de referência em checkout próprio, sem copiar WIPs ou mudar o checkout da Root. PR aberta não equivale a merge. A regra atual do mantenedor tem precedência sobre a frase histórica “somente planejamento”; registre o início autorizado da sua fatia, sem apagar a origem da decisão.

## 2. Primeiros passos: inventário e contratos, sem retrabalho

1. Leia `git status`, branch, HEAD, remotes e worktrees. Preserve WIPs, diretórios e processos alheios; sem `reset --hard`, `clean`, stash geral ou stage geral. Nesta preparação a Root estava em `codex/paginas-legais-e-checklist-20261018`, inicialmente `e76f323c6cc96bbe8c256b3a3fbc3282407ee85b`; ela vai avançar.
2. Consulte issues abertas, comentários, sub-issues/bloqueios e PRs. [PR #69](https://github.com/kauanbarateli/Segundo-Cerebro/pull/69) continha apenas plano em `3433c49b9e0e59546ed564222f3c3de814e71098`; `main` observado era `f3d18960a41076e99aa60dcc9f6b46967970ebb5`. Não assuma esses SHAs ainda atuais. Registre `origin/main`, HEADs pertinentes e o SHA base acordado com a Root.
3. Confira identidade GitHub antes de mutações. A conta de CLI padrão pode ser `contasvoedigital`: use explicitamente a identidade pessoal `kauanbarateli` e o SSH exclusivo já configurado para este repositório, sem trocar conta/configuração global nem imprimir token. Leitura não prova permissão de push/issues. Preserve VOE/BlackSheep/legado.
4. Envie à Root um quadro curto: issue/fatia; agente; branch/worktree; SHA base; arquivos reservados; entradas/saídas/eventos; migrations a reservar; bloqueios; próximo lote de validação. Aguarde definição apenas para bases ou contratos compartilhados indispensáveis; continue leitura/cenários independentes enquanto isso. Não solicite novamente aprovação de políticas já respondidas.
5. Congele contrato suficiente entre checkout pré-Auth, recibo de comprovação, acesso comercial, saga paga e rascunho. Antes de duas branches concorrentes, decida com a Root nomes/versões dos DTOs, IDs idempotentes, estados incertos, autoridade, eventos, transaction boundary, forma do erro e interfaces dos adapters. Nenhum usuário fictício para eventos pré-Auth. Um contrato não resolvido bloqueia seu consumidor, não os trabalhos independentes.

## 3. Quatro trilhos e ondas de execução

Use os números reais do [mapa](../implementation/mapa-issues-paralelas-20261018.md). Todos #51–#68 pertencem ao épico #50.

| Trilho | Escopo | Ordem e limites |
|---|---|---|
| 1 — Entrada e atribuição | #52 (T-030), depois #61 (T-039) | Começar #52 após base/contrato inicial; não gerar cobrança pelo clique. #61 só inicia execução dependente após #54. Preservar landing e texto legal Root. |
| 2 — Domínio comercial e identidade | #53; #54; #55/#56; #57; #58→#59; #60 | #53 pode começar ao mesmo tempo que #52. #54 depende dos aceites #51/#52/#53; prova Asaas #51 é Root. #55 e #56 dependem de #54; #57 depende dos dois. #58/#60 dependem de #54; #59 depende de #58. Não editar o mesmo ledger/pipeline em paralelo sem partição acordada. |
| 3 — Onboarding | #62→#63→#65; #64 após #62 | #62 depende de #54. #63 e #64 podem caminhar separadamente após contrato estável; #65 depende de #63 e lê conexões reais, sem fingir #64 concluída. Nove telas, rascunho servidor versionado, pausa/retomada e conclusão idempotente. |
| 4 — Qualidade, privacidade e operação | #66, #67, #68; apoio offline #41/#43 quando atribuído | #66 depende de #61/#62; #67 de #54. #68 depende de #57/#59/#60/#61/#64/#65/#66/#67 e #12/#35/#44. Preparar cenários/runbooks sem avançar implementação bloqueada. Root mantém #42/restore e validação real; #36 é pós-MVP. |

**Onda inicial recomendada:** codificador 1 em #52; codificador 2 na construção offline de #53; Root prepara a prova #51. Se #53 depender de inventário privado, construa os contratos e testes autorizados sem executar transição real. Descreva o limite e entregue fatia revisável; não finja que as contas atuais foram conferidas.

**Após a base:** integrar contratos revistos de #52/#53 e evidência #51, então construir #54. Não abrir #54 “em paralelo” ignorando esses bloqueios. Após #54, alocar um codificador à cadeia comercial e outro à atribuição/onboarding conforme a fronteira real. #55/#56 podem ter dono único do pipeline e deltas pequenos de apresentação. Depois, combinar #63 ou #64 com um ticket comercial sem tocar os mesmos arquivos.

Se a prova #51 estiver bloqueada, mantenha as fatias iniciais e cenários prontos. Com atribuição explícita da Root, o slot livre pode trabalhar num recorte offline de #41 ou #43 a partir da PR #45 revisada. Não mesclar a PR histórica inteira, alterar autoridade de restore ou fazer testes externos para “destravar”.

Não reabra #46 silenciosamente: está encerrada pelo layout, sem provar o onboarding. Não feche #12/#35/#44, #2/#7 ou #50 a partir de build local ou de critérios de apenas um filho.

## 4. Propriedade de arquivos, banco e contratos

Mantenha um quadro de reservas de trabalho no material da frente; use os diretórios existentes quando adequados. Os caminhos abaixo delimitam responsabilidade, não obrigam criar pastas artificiais:

- Trilho 1: superfícies de checkout/atribuição e respectivos casos de uso/testes. `src/components/features/conheca/` tem dono único; a landing não recebe reescrita ampla.
- Trilho 2: `src/core/access/resolve-access.ts`, contratos comerciais, adapter Asaas só servidor, composição da saga e runtime. `src/adapters/db/admin-runtime.ts` não será exposto publicamente; a saga paga tem autorização própria. Alterações de Settings passam por dono único porque onboarding, assinatura e textos legais convergem ali.
- Trilho 3: superfície/casos de uso do onboarding, extensão facultativa de foco/contexto, recibos e continuação Google. A primeira nota usa Vínculo Página→Projeto; não inventar `project_id` na Página nem classificar dados antigos.
- Trilho 4: testes/runbooks do delta e operação; código de retenção decorre dos contratos aceitos. O inventário e texto jurídico atual da Root não autorizam criar TTLs ou deleções inexistentes. Restore e Auth históricos têm módulos/handoffs próprios.
- **Reservados à Root salvo combinação:** páginas/textos legais (`src/lib/legal/`, `src/components/legal/`, rotas de termos/privacidade), inventário operacional, publicação, `.env*`, segredos/configurações remotas, coordenação de migrations e arquivos compartilhados como `AGENTS.md`, `CONTEXT.md`, middleware/layout global, `package.json`, lockfile, workflows e tokens DS.

Se precisar mudar arquivo reservado, prepare o contrato/diff proposto e combine o dono antes de editar; não bloqueie toda a sua leitura ou testes isolados. Nunca mantenha dois `npm ci` operando no mesmo `node_modules`, nem builds de duas branches na mesma `.next`.

Novos schemas exigem migration própria, ordem/reserva única de timestamp e pacote SQL Editor consistente. Não alterar nem reaplicar **001–019**. Preparar SQL/testes é distinto de aplicar. Somente a Root coordena operação supervisionada OP-009 no projeto pessoal `rishenjoikgmfubmnfiu`, após conferir destino/ordem e autorização da operação; CI/build/deploy nunca aplicam banco. Sem reset, bootstrap ou seeds. `jvwduowyavpaxssogadn` é Ensaio_restore, não sandbox comercial livre. Outro banco requer autorização específica. Nenhuma operação em VOE, BlackSheep ou legado.

## 5. Política de RAM, processos e validação

**Limites obrigatórios desta frente:** dois agentes de código no máximo; Root revisora; um processo pesado em toda a máquina. “Pesado” inclui `npm ci`, lint/typecheck amplo, Vitest, scripts em lote, PGlite/PostgreSQL/Docker, build Next e Playwright/navegador automatizado. Dois editores podem trabalhar enquanto nenhum disputa o slot; durante um build, o outro agente continua leitura/edição leve.

1. Antes de ocupar o slot, anuncie branch, comando, diretório, PID/session quando houver e liberação prevista ao terminar. Root também usa a mesma fila. Não use sleeps longos ou polling de segundo em segundo. A inexistência de resposta não é posse do slot.
2. Reutilize checkout/worktree adequado; mantenha no máximo dois de implementação ativos. Dependências por worktree, `.next`, perfis do navegador e relatórios isolados. O cache de pacotes npm pode ser compartilhado como cache; não compartilhar `node_modules` ou `.next` por junction/symlink, nem remover dependências/cache de outro agente. `npm ci` apenas quando faltar instalação válida ou mudar o lockfile, um por vez.
3. Node **24**, conforme `.nvmrc`. Não mudar engines/lockfile para resolver falta de memória. Não fixar heap de 6–8 GB numa máquina de 8 GB. Worker único em testes; nada de quatro Next/Chrome, Docker junto de build, ou servidor de desenvolvimento permanente por trilho. Antes de testes pesados, fechar apenas o próprio servidor/navegador ocioso, nunca processos alheios sem combinação.
4. Como recomendação conservadora, iniciar trabalho pesado com cerca de **2 GB de RAM livre**; se houver menos de **1 GB livre**, paginação contínua ou falhas de spawn/ACL/timeout sob pressão, aguardar/liberar o slot e registrar a condição. Esses valores são heurísticas de operação, não mínimo medido do produto. Sem matar processos por nome ou atribuir erro automaticamente ao app.
5. Executar checks pertinentes sequencialmente. Começar com teste do comportamento/negativo alterado e lint do delta, depois TypeScript/camadas/DS quando afetados. Um teste só é PASS no SHA executado; não repetir suíte ampla sem nova alteração, falha ou risco que justifique.

Comandos de referência existentes no projeto, cada um **separado e sob o slot**, ajustando os caminhos reais do delta:

```powershell
node --version
npx vitest run <teste-real-do-ticket> --maxWorkers=1
node --test --test-concurrency=1 <teste-real-do-script>
npx eslint --max-warnings=0 <arquivos-do-delta>
npm run typecheck
npm run check:layers
npm run check:design-system
npm run check:sql-editor
node scripts/check-secrets.mjs
git diff --check
```

Para E2E, uma instância Next/Chromium da frente e `npx playwright test <spec-real> --workers=1`, com dados sintéticos isolados e sem sessões pessoais. Portas/artefatos próprios e encerramento do processo ao final. Build demo/isolado apenas com ambiente explicitamente conferido, sem herdar chaves de produção; `check:client-auth` usa o artefato do build correto. Não inventar nomes de testes ou executar placeholders acima literalmente.

`npm run test:local-sql`, matriz de fusos e suíte ampla são selecionados pelo risco e contrato da entrega, serialmente. Não use o agregado `npm run check` como padrão para toda alteração pequena. Root executa o lote integrado necessário e consulta CI pelo SHA depois da publicação. CI falho não será mascarado com `continue-on-error`, desativação de workflows, peers forçados ou encerramento de critérios.

## 6. Regras funcionais que não podem ser simplificadas

- Monolito modular. Regras em `src/core/` sem SDK/Next/React; adapters só servidor; canais finos. Isolamento por Usuário, Entitlement diferente de Preferência, escrita de domínio e evento na mesma transação. Sem conteúdo/segredo do Cofre em evento.
- R$ 29,90/mês, recebedor PF, checkout próprio para dados/Pix/boleto, cartão na fatura hospedada Asaas. Nenhum PAN/CVV no app. Pix/boleto convencionais exigem ação a cada ciclo; não prometer Pix Automático para PF. E-mail comprovado antes de cobrar; conta Auth somente após pagamento reconhecido.
- Existente comprova login antes de nova cobrança; contas atuais gratuitas e isenções não perdem vetos/bans. Webhook autenticado/idempotente e inbox durável antes de 200; retorno de navegador não libera acesso. Incerteza externa não gera segunda cobrança ou segundo usuário.
- Primeiro vencimento em três dias civis; âncora pelo reconhecimento financeiro autoritativo; cinco dias civis completos São Paulo, com bloqueio às 00h do sexto dia. Gestão da conta continua acessível; suspensão pausa novas mensalidades e retomada tem a regra de mês completo. Não substituir isso por ban Auth.
- Primeiro/último toque consentidos, cinco UTMs/domínio; 30 dias de visitas/abandono, congelamento na confirmação geradora da primeira cobrança, 12 meses convertido ou retirada antes. Sem marketing implícito, pixel Meta ou rastreamento adicionado por inferência da criação de redes sociais.
- Onboarding facultativo de nove telas, elegibilidade real, rascunho servidor versionado, pular/pausar/voltar/retomar, falha parcial e idempotência. Google somente leitura/até duas contas, tokens fora do rascunho; Cofre não solicita segredos. Foco/contexto facultativos não mudam direitos. Dados demo e 31 testes do protótipo não são prova conectada.
- Retenções de 30 dias/12 meses/180 dias do plano comercial não estão implementadas apenas por aparecerem na política. Separar estado atual, trabalho futuro e prova. Não prometer eliminação automática de identidade, backup ou financeiro sem o respectivo contrato e execução testada.
- Interface Impeccable, DS 2.1, campos ≥16 px, alvos ≥44 × 44 px, teclado/foco, claro/escuro, contraste medido, zoom/mobile e movimento reduzido. Preserve a composição aprovada; adicione apenas o delta da fatia.

## 7. GitHub, PRs e revisão pela Root

1. Branch/worktree por fatia com base acordada, nomes claros e commits sem coautoria. Evite branch única com todas as 18 issues. Atualizações registram **implementado, validado, pendente/bloqueado** e identificam o ambiente de cada prova.
2. Antes do push, Root deve conhecer o SHA e a publicação: workflows disparam em `push` e `pull_request`, inclusive draft; a Vercel pode disparar preview. PR draft não impede deploy. Não desligar gatilhos para esconder falhas ou contornar o gate de hospedagem comercial. Se a configuração atual não permitir publicar a branch comercial sem efeito externo não aprovado, entregue commits/patches locais e a lista exata; Root define o canal de publicação compatível.
3. Quando a publicação estiver coberta pela coordenação vigente, push da branch e PR **draft** focada; usar `Refs #N` e `Part of #50`, sem `Closes/Fixes` até o aceite da Root. Descrição com problema/resultado, escopo, contrato/migration, testes negativos, SHA/ambiente e limites. Corpos multilinha via argumento estruturado ou arquivo `--body-file`, nunca interpolação insegura de shell. Anexar PR à tarefa quando a ferramenta estiver disponível.
4. Não incluir `.env`, CPF/endereço do fornecedor, perfis privados, senhas, tokens, arquivos de banco/backup, SQL extraído, e-mails pessoais de testes ou capturas sensíveis. Scanner aprovado não dispensa revisão humana do diff. Os dados privados do fornecedor já estão preparados; não os solicite nem os leia para construir checkout.
5. Root revisa o HEAD exato e o delta, repete os checks necessários no próprio recorte e observa CI real. Se a PR mudar, relate novo SHA e evidência invalidada; não transfira PASS de outro commit. Você responde ajustes e mantém dependentes aguardando a integração contratual correspondente. Merge, deploy e aplicação de migrations permanecem com a Root e a autorização própria.

## 8. Resultado esperado de cada rodada

Entregue à Root, em mensagem clara e documento do ticket:

- issue/fatia e dependências efetivamente resolvidas;
- branch/worktree, SHA base/HEAD, URL da PR ou caminhos dos patches quando a publicação estiver bloqueada;
- arquivos alterados, contratos/eventos/versões e migration nova reservada, sem aplicação remota;
- comandos/testes executados, resultado e artefatos sanitizados vinculados ao SHA; falhas e limites explícitos;
- prova conectada exata que a Root precisará realizar, com roteiro, pré-condições e negativos, sem credenciais;
- próximo ticket desbloqueado e reservas liberadas; processos próprios encerrados e slot pesado livre.

Comece agora pela reconferência do tracker/bases e pelo quadro de reservas. Após fechar os contratos mínimos, avance na fronteira #52 + #53 em paralelo, dentro dos limites, e entregue a primeira fatia revisável. Continue autonomamente nas fatias autorizadas e desbloqueadas; não espere todas as 18 estarem prontas para pedir revisão, nem considere a solicitação de guia de lojas uma autorização para criar código nativo.
