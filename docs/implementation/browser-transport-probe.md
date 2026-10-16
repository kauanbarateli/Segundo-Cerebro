# Ensaio isolado do transporte HTTP no Chromium

Este é um experimento novo, separado dos testes de autenticação. Ele usa um servidor HTTP efêmero em loopback, respostas sintéticas e o produtor Playwright já fixado no projeto. Não usa Next.js, Supabase, Vercel, contas, banco, e-mails ou credenciais. Seu resultado nunca concede aceite ao aplicativo ou substitui um teste real de autenticação.

O objetivo é verificar se a sequência de interrupção usada nos testes consegue deixar uma requisição original sem terminal público, mesmo depois do fechamento observado do servidor e dos sockets do próprio ensaio. Um resultado negativo apenas significa que o caso sintético não reproduziu o problema; não identifica a causa de outra execução.

## Contrato e estado de execução

Arquivos novos:

- `scripts/verification/browser-transport-probe.mjs`: entrada inerte, motor de casos, adaptador nativo privado e relatório fechado.
- `tests/scripts/browser-transport-probe.test.mjs`: fixtures de relógio, agendamento e leases apenas em RAM. Elas não criam servidor ou navegador.
- Este documento: condições do ensaio e limites das conclusões.

Na preparação de 16/10/2026, a validação própria executou sequencialmente **20/20 testes RAM** com Node 24.19.0 (`--test-concurrency=1`, 387 ms) e lint dos dois módulos, ambos com código 0. Root também passou 20/20 próprios (337 ms) e lint2; um terceiro agente revisou módulo, QA e workflow sem bloqueador. Nenhum browser, servidor HTTP real ou workflow foi executado nessa QA. Não interpretar os cenários das fixtures como observações do Chromium.

Root preparou `.github/workflows/browser-transport-probe.yml`, somente `workflow_dispatch`: Linux x64, Node 24.19.0, instalação reproduzível do produtor e ambiente `env -i`, sem tokens, Next ou Supabase. O primeiro ensaio nativo ainda está pendente. Publicar esse arquivo não o dispara automaticamente; os oito workflows existentes conservam seus gatilhos e critérios.

A primeira rodada teve 18/19 testes aprovados: uma fixture expôs que uma limpeza resolvida exatamente no limite de cinco segundos podia vencer a ordem de microtasks de `Promise.race`, apesar do timer já vencido. O código passou a manter o veto de limpeza e conferir o relógio monotônico após o `await`. A nova regressão também cobre trabalho síncrono que excede o prazo antes de o timer executar; o orçamento de produção permaneceu inalterado.

Importar o módulo e executar `--help` não lê configurações, não abre HTTP e não importa Playwright nem o observer. A única entrada nativa é `--execute`, depois do preflight. A função exportada `runBrowserTransportProbe(ports, { variants })` aceita portas sintéticas para QA e identifica sempre esse resultado como `mode: synthetic`, mesmo que a fixture forneça um SHA. A marca de execução nativa é privada ao módulo.

## Vínculos do produtor

O preflight exige Linux x64, Node **24.19.0**, `CI=true`, `GITHUB_ACTIONS=true`, `SC_BROWSER_TRANSPORT_PROBE_RUN=1` e `GITHUB_SHA` completo em hexadecimal minúsculo. A revisão e o workflow devem vincular esse SHA ao checkout efetivo; a variável sozinha não atesta a árvore inteira.

| Item | Vínculo fixado |
| --- | --- |
| `playwright-core` | 1.63.0 |
| Chromium/headless shell | 153.0.8010.12, revisão 1243 |
| `node_modules/playwright-core/package.json` | 876 bytes; SHA-256 `f061c58427e47e843e26d201f0a57076c734e57c734ecbbd87d4a23b7a20db9b` |
| `node_modules/playwright-core/browsers.json` | 1.137 bytes; SHA-256 `545d52f8382c391e605562c330e9c1c534a16045898203037a49bb8bd769a946` |
| `node_modules/playwright-core/lib/coreBundle.js` | 3.477.183 bytes; SHA-256 `549070af3acabb3efcc4f55bfe6210f9f7c2fcf633cf7eaa59bfe60719969171` |
| `tests/e2e-auth-local/admin-browser-support.mjs` | 68.394 bytes; SHA-256 `794d5c5fe5e16e431a3506b36c0893cad82dd8bf0f03d5876da0a9947884e436` |

Os quatro arquivos devem ser regulares, sem symlink, ter caminho canônico, tamanho e hash exatos. O browser confirma sua versão em runtime. Alterar qualquer vínculo exige nova revisão explícita; o ensaio não atualiza versões automaticamente.

O código não abre `.env`. O preflight lista somente os nomes na raiz e recusa `.env` e `.env.*`, exceto o exemplo público `.env.example`, que também não é lido. O ambiente admite somente os quatro nomes de gate acima, `PATH`, `HOME`, `TMPDIR`, `LANG`, `LC_ALL` e `TZ`; qualquer outro nome recusa a execução, incluindo credenciais, configurações de provedores, proxies e opções que alterem o runtime. O processo filho do Chromium recebe somente esses seis últimos nomes, com `TZ=UTC`.

## Casos e sequência limitada

Cada caso possui servidor, browser, contexto, página e sessões próprios. O listener usa `127.0.0.1` e porta escolhida pelo sistema. As únicas requisições permitidas são GET para a origem exata desse caso, sem query, fragmento ou credenciais, nos caminhos públicos fixos `/probe.html`, `/favicon.ico`, `/probe-fetch` e `/probe-script-1.js` até `/probe-script-4.js`, conforme o caso. Solicitações fora desse conjunto encerram a observação com recusa. Service workers e downloads ficam bloqueados; popup ou download observado também recusa o caso.

| Ordem | Caso | Respostas e intervenção |
| --- | --- | --- |
| 1 | `control` | Um fetch e quatro scripts. O servidor termina naturalmente as cinco respostas; o ensaio exige os terminais públicos e CDP originais. |
| 2 | `held-fetch` | Um fetch com resposta retida. Executa offline, `Page.stopLoading`, navegação para `about:blank`, `unrouteAll({ behavior: wait })` e fecha o servidor/sockets próprios. |
| 3 | `held-scripts` | Quatro scripts com respostas retidas; mesma sequência de intervenção. |

Antes de intervir, todos os alvos precisam ter sido vistos como requisições originais, recebido ACK do `route.continue`, chegado ao servidor HTTP e ter identidade exata no observer, sem terminal CDP, com `managerEntry: same-request` e sessão registrada. A contagem pública de pendências só diminui nos listeners originais `requestfinished`/`requestfailed`. ACK, ausência no manager, fechamento do servidor e fechamento do contexto não sintetizam terminais.

Os casos 2 e 3 só começam depois de controle e limpeza qualificados. Limpeza não confirmada de um caso impede o seguinte. Uma recusa em um caso retido não é repetida automaticamente.

Com `--variants`, até duas variantes podem executar, uma vez cada, somente depois de pelo menos um caso base resultar em `REPRODUCED` e de todos os casos executados terem limpeza confirmada. Usa-se o primeiro recurso que reproduziu, sem escolher novamente pelo resultado:

1. `variant-online`: omite somente `setOffline(true)`.
2. `variant-observer-off`: mantém a intervenção, mas omite somente a observação de comandos Fetch (`fetchCommands: false`). O observer de eventos permanece ativo.

Sem reprodução base, as variantes ficam `NOT_RUN`. Não há ampliação automática da matriz, retry para procurar PASS ou mudança das políticas dos testes Auth.

## Prazos, propriedade e limpeza

Cada caso tem **15 segundos absolutos**, iniciados antes da construção do lease, do bind HTTP e do lançamento do browser. Cada operação e cada polling consultam esse mesmo prazo monotônico. Startup, comandos CDP e fechamento da fonte não renovam o orçamento. Um timer vencido ou primeira recusa interrompe a decisão; uma falha posterior não substitui a primeira recusa.

O lease existe antes do primeiro `await` de startup. Ele continua dono dos recursos que venham a ser criados depois de um timeout. A limpeza aguarda a promessa original de bind para fechar um listener tardio; browser, contexto ou sessão que retornam após abort são fechados pelo mesmo lease. Não são usados tabs, contextos ou servidores de outro teste.

Depois de congelar as contagens e o instante de decisão, há até **5 segundos separados** apenas para limpar os próprios recursos. Isso não permite produzir terminais retroativamente ou melhorar o resultado do caso. A limpeza explicita `absent`, `close_observed` ou `unconfirmed` para servidor, contexto, browser e sessão. `absent` significa que aquele handle não foi criado, e não equivale a um close recebido. `startupSettled` também precisa ser verdadeiro; nenhum handle tardio pode ser ignorado para liberar o caso seguinte.

O servidor só declara a fonte fechada após seu evento/callback original de fechamento e os eventos `close` de todos os sockets admitidos. O fechamento explícito da sessão precede o do contexto e o do browser. Uma rejeição de close permanece não confirmada, mesmo que outra operação pareça ter fechado o recurso implicitamente.

Limites fixos: 16 requisições alvo e 16 sockets admitidos por caso, no máximo cinco casos, polling limitado e relatório de até 16 KiB. Conexões excedentes são destruídas e recusam a observação; não recebem autoridade para fechar qualquer recurso externo.

## Interpretação do relatório

O stdout recebe apenas um JSON validado, com enums, booleanos, contagens e milissegundos relativos. Não há URL, porta, identificador CDP, header, cookie, corpo, e-mail, stack ou texto arbitrário de exceção. Não são produzidos trace, screenshot, exportação DOM, download ou arquivo de log bruto.

- `CONTROL_PASSED`: cinco respostas naturais e cinco terminais públicos/CDP originais, sem pendência. `controlQualified` exige também limpeza confirmada.
- `REPRODUCED` / `PENDING_AFTER_SOURCE_CLOSE`: o prazo absoluto venceu com pendência pública original, depois do fechamento observado da fonte antes do prazo, zero socket próprio vivo e respostas retidas não terminadas. O resultado descreve esse caso sintético, sem atribuir causa ao aplicativo.
- `NOT_REPRODUCED` / `NATURAL_TERMINALS`: os terminais públicos originais chegaram dentro do orçamento do caso retido. Não é um PASS dos testes Auth.
- `INCONCLUSIVE`: controle ou observação incompletos, prazo vencido sem fonte qualificada, ou limpeza que não se confirmou depois de uma decisão natural.
- `REFUSED`: uma condição fechada de segurança, integridade, clock, transporte ou limite impediu a observação.
- `NOT_RUN`: uma precondição de controle ou limpeza impediu o início. Não houve tentativa daquele caso.

As contagens distinguem HTTP recebido/resposta terminada, sockets criados/fechados/vivos, terminais públicos e CDP, ausência de terminal CDP, identidade atual do manager, sessão registrada/removida e protocolo indisponível. Um snapshot recusado não é evidência de ausência de requisições; conserva o código de recusa e os contadores vazios. A projeção de decisão é anterior à limpeza, e nenhum número posterior é usado para resolver pendências antigas.

`diagnosticOnly` é sempre verdadeiro e `applicationAccepted` é sempre falso, inclusive para modo nativo. Exit code 0 significa somente que o experimento foi qualificado e terminou sua limpeza; um `REPRODUCED` limpo também pode retornar 0. Não usar esse código como gate de aprovação do produto.

## Fonte pública que orienta o ensaio

O observer existente é importado nominalmente e permanece intacto. Ele observa apenas as sessões do manager presentes em `observePage`, faz a ponte pela identidade do objeto servidor e mantém a participação atual no manager como observação, sem finalizar a requisição. Isso permite distinguir terminal ausente de identidade indisponível, mas não transforma sua cobertura em prova universal de todas as sessões futuras.

No produtor Playwright fixado, `setOffline` envia a condição de rede; o cumprimento de `RouteImpl.continue` confirma o comando Fetch, sem fornecer um terminal de requisição. Os handlers originais `Network.loadingFinished` e `Network.loadingFailed` removem a entrada do manager e encaminham os terminais. `unrouteAll` espera handlers e desativa a interceptação; sua resolução não equivale ao recebimento de um terminal público. Esses são fatos do código público fixado, não uma causa comprovada de qualquer falha anterior.

Da mesma forma, uma Promise do processo Next observada como `true` depois do término do worker não demonstra que esse processo já estava encerrado no instante da primeira falha do worker. O ensaio elimina Next da equação; ele não altera o protocolo de autoridade ou a política estática do relay.

## Sequência de revisão e execução pela Frente B

1. Revisar os três arquivos, os hashes de produtor/observer e a configuração do futuro workflow manual. Não alterar os testes Auth como consequência da preparação.
2. Com o semáforo de RAM liberado, executar sequencialmente o novo teste Node 24, sintaxe e lint apenas dos novos paths. O teste usa relógio/agendamento sintéticos e proíbe portas nativas durante import/help.
3. Criar um workflow **manual** separado, com checkout do SHA revisado, Node 24.19.0, dependências do lockfile e somente Chromium fixado. Não usar secrets, serviços pessoais, dotenv, artefatos brutos ou um workflow de autenticação real.
4. Invocar o script em ambiente esvaziado, passando explicitamente os poucos nomes permitidos. Exemplo da forma da chamada, a adaptar no workflow revisado:

   ```bash
   env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 TZ=UTC \
     CI=true GITHUB_ACTIONS=true GITHUB_SHA="$GITHUB_SHA" \
     SC_BROWSER_TRANSPORT_PROBE_RUN=1 \
     node scripts/verification/browser-transport-probe.mjs --execute
   ```

   `GITHUB_SHA` precisa ser passado após o checkout correto. O exemplo não autoriza instalar versões novas, copiar perfis, ler credenciais ou executar serviços reais. A instalação do browser e a conferência de sua revisão devem ocorrer antes dessa chamada, conforme o workflow manual aprovado.

5. Decidir na revisão se a única chamada usará `--variants`. Nessa modalidade, o próprio motor só inicia as duas variantes após reprodução base e limpeza confirmada na mesma execução. Examinar o único relatório fechado. Se o controle falhar, encerrar o ensaio; não repetir a base para procurar um resultado favorável.
6. Vincular as conclusões ao SHA e ao produtor exatos. Uma correção do produto, se houver fundamento, exige mudança separada, revisão e execução original dos critérios Auth, preservando first failure, EOF, deadlines e limpeza.

O experimento, por si só, não encerra issues do MVP, não valida deploy e não confirma ausência de dados ou usuários em serviços externos.
