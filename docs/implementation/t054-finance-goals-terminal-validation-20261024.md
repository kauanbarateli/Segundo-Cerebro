# T-054 — validação dos candidatos de recuperação terminal

As evidências abaixo pertencem aos SHAs indicados. Merge, produção, aplicação de schema e ativação permanecem bloqueados. Este documento não substitui o resultado próprio de um candidato posterior.

## Candidato 01ae6a7

O primeiro original da PR #120 encerrou 16 runs: 14 PASS e dois Typecheck FAIL pelo TS2339 em `goal-image-picker-model.test.ts`. Os gerais pararam antes de unidades, build e E2E. Os 14 envelopes nativos encerraram sem violações, com 504 blobs próprios sem drift, 63 dependências observadas e catálogo 26/1.720. Auth mantém a ressalva de não fornecer manifesto por arquivo.

A correção capturou `candidate` depois do guard discriminado, antes do callback que tenta mutá-lo. O objeto, a tentativa de mutação e a asserção de erro foram preservados. Nenhum cast ou relaxamento de teste.

## Candidato a560bd1

União de M2-S, M2-B, M2-U, correção de Typecheck e onze casos de tela. Os dois gerais passaram Typecheck e executaram o primeiro fuso de unidades: 210 arquivos/3.356 testes aprovados, dois arquivos/quatro testes falhos. A falha comum é `syntax error at end of input` durante os casos de instalação/composição terminal. Segundo fuso, scripts, build, E2E e capturas não foram alcançados nesses gerais.

Os logs não informam posição, query ou fase pública suficiente para identificar isoladamente uma linha. Portanto, não atribuir a instalação completa a um PASS de catálogo de outro gate nem declarar a causa reproduzida localmente.

## Correção restrita de sintaxe para novo candidato

A verificação inicial da proposta SQL contém duas expressões CASE sem agrupamento dentro de IF. A leitura da [gramática PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/pl/plpgsql/src/pl_gram.y#L2558-L2575) e da [gramática PostgreSQL 18](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/pl/plpgsql/src/pl_gram.y#L2630-L2647) mostra que a condição termina em THEN no nível zero de parênteses. O THEN interno do CASE não agrupado é compatível com o corte observado. A correção acrescenta apenas quatro caracteres, agrupando os dois CASE; mantém comparações, branches, valores, hashes de pré-requisitos e critérios de recusa.

Uma reversão textual desses quatro caracteres reproduz integralmente o SHA anterior `d1bcb2213d69ad4135fb6cce171868b5a70f6447027b5548511c5cf26c7b5f1b`. A proposta corrigida tem SHA `7fb8c48baf6a308e46ae5c7eef537670d6008009668a7b90e0a57cfc11d3843c`; o helper recebe somente esse novo pin dos bytes públicos revisados. Não é um pin derivado de banco nem remoção de guarda.

O lint focal e o diff check passaram. Os quatro testes e suas asserções permanecem; serão a regressão efetiva do novo candidato no GitHub. A inspeção de fonte não equivale a testes SQL aprovados. Nenhuma migration histórica, banco ou configuração foi alterada por esta correção.

## Continuação independente

A escolha de foto ainda precisa de upload durável e vínculo financeiro. A prova de concorrência nativa commit/settle e a preservação do fence na recuperação continuam entregas próprias. Essas frentes seguem em worktrees separados enquanto o CI é diagnosticado; não promovem a interface nem alteram o projeto hospedado.

## Candidato 7e5bad2 — checks próprios concluídos

O commit `7e5bad2f046d347044bd5b5d888119708c9f74b6`, árvore `143dd3876fc1075800536c3c1b70750d417bca7d`, encerrou os 16 runs originais com sucesso, sem rerun, cancelamento ou skip. Os dois gerais passaram Typecheck, lint, 212 arquivos/3.360 unidades em cada um dos dois fusos, 1.963 testes de scripts, 478 E2E, build, PWA e auditoria sem vulnerabilidades. Os quatro testes SQL antes falhos passaram nesta árvore; os resultados falhos anteriores permanecem registrados.

Os 14 envelopes nativos encerraram sem violações. A conferência das fontes vinculou 504 blobs Git próprios, sem drift, e 63 dependências observadas. Os gates de catálogo registraram 26 migrations/1.720 verificações. Os dois envelopes de Auth não oferecem manifesto por arquivo; seu vínculo é ao checkout e à mesma árvore, sem ampliar essa evidência.

As origens gerais são o run de PR `40051308256`, job `120744380872`, e o run de push `40051304175`, job `120744367892`, ambos attempt 1. A árvore do checkout sintético da PR foi conferida contra a árvore acima. A inspeção visual usará somente o artefato dessa origem de PR; sucesso do E2E não significa que as capturas já foram vistas.

O resultado qualifica os checks dessa árvore, não a concorrência terminal ainda em construção, upload de fotos, integração hospedada, restore ou ativação. Nenhum schema foi aplicado e merge/produção continuam bloqueados. Os Sources extraídos e demais WIPs posteriores precisam de CI próprio; não herdam os resultados de `7e5bad2`.

## Revisão das capturas próprias

O artefato `12544171441` da origem de PR acima teve seu ZIP de45.637.709 bytes conferido contra o digest `b851a2d92897e9e16915588b57fb93122ae3ac23afdbf12f54355c3941c919da`. Foram extraídas36 PNGs públicas, com assinatura, dimensões, limites e hashes conferidos; Root viu dez imagens, incluindo as quatro confirmações terminais mobile e amostras de editor, detalhe e cards.

**OBSERVADO:** as confirmações preservam textos e ações nos dois temas. Os títulos e o resumo compacto refletem o ajuste anterior. Em320px, a toolbar com valores ocultos comprime os rótulos dos botões ao lado do filtro. O novo delta acrescenta uma classe somente nessa toolbar e, abaixo de350px, reserva uma linha para o Field. Confirmações, handlers, ordem do DOM e alvos mínimos permanecem intactos. Há peer estático da aritmética; a próxima rodada deverá produzir a prova renderizada da correção. Não chamar esse novo delta de visualmente validado antes disso.

## Retomada de24/10 — união C2aV2 e NV2 preparada

O mantenedor retomou a PR120 a partir do handoff documental fd7909c, mantendo merge e produção bloqueados. Root transportou somente20 payloads congelados:9 C2a e11 N. Os dez Sources/construtores atuais e os26 pins canônicos foram reconferidos e preservados; não houve SQL, configuração Auth, novo serviço local ou destino hospedado nessa composição.

**C2aV2:** manifesto e6dd0dda63c24838381d284df406d073a58fb69ddbcca3ac7e174295dcd28973; peer independente585ed0d7ca82da9434f0dbbd5a9c02f9d6966bf74d43f6f0ab213cb93c60bf7b. Guardas com AbortSignal obrigatório precedem lease tardia, efeitos e sender, conservando as fases e os prazos. Quatro cenários escritos drenam a fila depois do deadline e exigem zero envio/A preservada; o caso de finalize já enviado continua incerto, sem alegar rollback. Essas unidades C2a ainda dependem do CI próprio; o Vitest local diverge do lock e não foi usado. Retirement, vínculo/editor e montagem no Workspace continuam pendentes.

**NV2:** manifesto e563f8ba83d21eb94c90cb3e88a79a6e17643deb949ca83240d5a29c37c2d059; peer independente803477939205650cefedd92c1ce5cdf0c0d9cafe5b087da2a5b54ad0599abf71. A seleção major24 de .nvmrc é validada separadamente da versão completa observada; relatório fechado version2/nodeVersion e adição exclusiva do contrato puro ao grafo, preservando realpath/hash e os demais gates. Case/session/SQL/workflow do pacote N não foram alterados por V2. Os doze confrontos ainda não foram executados: somente o GitHub poderá qualificar essa operação na stack própria descartável do job.

**Checks locais serializados da Root sobre os bytes transportados:**29/29 controles puros Node aprovados, zero falhas/skip; lint focal17 arquivos sem avisos; dependências551 módulos/2.402 relações sem violações; scanner2.347 arquivos. São verificações anteriores à publicação, não uma execução nativa nem o CI da união. Typecheck, unidades completas/C2a em dois fusos, scripts completos, build, PWA, navegador e nativos exigem originais próprios do próximo SHA. Nenhum resultado de70c foi atribuído aos novos payloads.

**Visual70c:** uma única transferência do artefato12545540334 do runPR40054519791/job120754414711/attempt1, ZIP45.579.201 bytes/SHA89c8da63686e8d4826e0c4a43a6197af791681acd1f1556a43385156f188e677. Extraídas36 PNGs públicas; Root viu sete e a referência do protótipo. Toolbar320 legível nos dois temas e confirmações320/390 sem cortes nas amostras. Nenhum novo ajuste visual foi necessário; isso não aceita shell integrado, contraste não medido nesta passada, hardware, Storage ou novas operações financeiras.

## Correção nativa V3 — revisão e controles próprios de 24/10

A Root revisou os três deltas congelados no manifesto `5116d056d6209bc4792e01bc43350488f70167664e8d9670a927f739067710e4`, transportados sobre `7f14507353d211737b0ee22395673fb4968df785`. O parecer independente está em [t054-native-v3-independent-review-20261024.md](evidence/t054-native-v3-independent-review-20261024.md). Os oito demais arquivos N permanecem byte a byte iguais à V2; Sources, propostas SQL, limites, observações de terminais, limpeza e relatório operacional V2 foram preservados.

A comparação de oldSource agora aponta para o corpo privado que a M1 efetivamente copia. A prova é a extração dos dois corpos das fontes públicas pinadas, não uma nova leitura ou adaptação ao banco. O diagnóstico de PROCESS_REFUSED é separado, fechado, limitado a 1.024 bytes e só emitido no ramo da recusa original. A causa do PROCESS_REFUSED da PR7f ainda não é conhecida.

Validação local própria da composição V3: 33/33 controles puros passaram, sem falha, cancelamento ou skip; ESLint dos dois .mjs alterados passou com zero warnings; o portão de dependências passou com 551 módulos e 2.402 relações; o scanner de segredos passou em 2.350 arquivos. Foram usados processos leves, um por vez, sem stack, Postgres, navegador, build ou instalação local. Os logs originais estão no diretório operacional privado, com prefixo root-native-v3-. Esses checks locais não representam aceite dos 12 confrontos SQL.

Os dois originais nativos7f são falhas diferentes e devem ser preservados: [PR/run40059892697](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40059892697), PROCESS_REFUSED em sources antes de haver fonte ou servidor conhecidos; [push/run40059889766](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40059889766), CATALOGUE_REFUSED em companions após inventário de 130 fontes, 45 dependências e PG170011. Nenhum executou os 12 casos. Não atribuir a primeira falha a stdin ou outro terminal por hipótese, nem considerar os demais campos do catálogo aditivo aprovados apenas por terem sido corrigidos o alvo e o hash desta associação.

A composição só poderá ser publicada depois do encerramento dos 19 originais7f. O próximo SHA exigirá seus próprios originais, sem rerun, dispatch, cancelamento, relaxamento do gate ou transferência de PASS anterior. Merge, produção e ativação hospedada das propostas financeiras permanecem bloqueados.

## Transporte de entrada sem payload — candidato após diagnóstico bf1

Os dois originais N de bf1 recusaram PROCESS_REFUSED em sources. A linha diagnóstica fechada identificou git-head, stdoutEnd/stderrEnd/exit/close iguais a1, stdinFinish0, códigos0, sinais ausentes, grupo confirmado e needInput=false. Isso demonstra qual observação faltou; não demonstra uma causa interna específica do stream nem autoriza dispensar finish. PR/run40061810919/job120776747309 e push/run40061808046/job120776737369 permanecem originais distintos, com33 controles puros aprovados e zero confrontos SQL executados.

O candidato de transporte muda somente a chamada de fechamento em runBoundedProcess: entrada ausente, undefined, null ou string vazia chama stdin.end() sem chunk; entradas não vazias e binários vazios explícitos mantêm stdin.end(input), com identidade e bytes originais. Não usa truthiness, não converte0/false/objetos e não muda spawn, stdio, observadores, grupos, prazos ou limites. O strictRun e os cinco eventos obrigatórios do N permanecem intactos.

A hipótese é fundamentada na implementação oficial de [Writable.end do Node24](https://github.com/nodejs/node/blob/v24.x/lib/internal/streams/writable.js): um chunk definido passa pelo caminho de escrita, mesmo se a string for vazia; a chamada sem chunk evita essa escrita. O [tratamento do filho](https://github.com/nodejs/node/blob/v24.x/lib/internal/child_process.js) também encerra seu stdin na saída. Isso sustenta o candidato, mas não prova a sequência que ocorreu no Linux.

Os novos controles usam Writable real: observam a aridade, preservação de bytes e instalação antecipada do observador, recusam a escrita vazia deliberadamente e deixam o próprio stream emitir finish. Uma falha no _final continua com finish0, mesmo com exit/close0 e grupo confirmado; não se fabrica um terminal. Nenhum teste inicia subprocesso, serviço ou banco. Execução local, peer e CI próprios devem ser registrados antes de promover qualquer resultado. A correção só poderá ser publicada após os19 originais bf1 terminarem, para preservar os resultados em andamento.

A Root executou os quatro novos controles junto dos33N:37/37 PASS, sem falha, cancelamento ou skip; executou também os cinco controles focais existentes do helper compartilhado, todos PASS, sem SQL. ESLint dos dois .mjs alterados passou com zero avisos. O peer independente está em [t054-native-stdin-close-independent-review-20261024.md](evidence/t054-native-stdin-close-independent-review-20261024.md). A reversão do único bloco de fechamento reproduz exatamente o blob pai d803ca9b24caee7f82c909bba2aefb609a34af87. Estes controles não observam um processo Linux real; a resolução da recusa depende do próximo original N, mantendo finish obrigatório.
## Primeiro aceite nativo próprio — dad0c5e

Os originais [PR/run40063419598/job120781561190](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40063419598) e [push/run40063417358/job120781554131](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40063417358) aprovaram o gate N na fonte dad0c5eb3a32ef4416e93a845fd4b6877df5e261, árvore46d6c6d4280af6c1c3b25ede478560fa2664fc8b, attempt1. O checkout da PR ae8190740b860fa08873faa803a6b9bd543c50ea tem essa mesma árvore. Cada original aprovou33 controles puros, e seu relatórioV2 contém12/12 confrontos PASSED/complete, Node24.21.0 e PG170011; são24 observações próprias.

Root conferiu os hashes e extraiu novamente o relatório da única linha JSON de cada raw original, comparando-o ao recibo e ao validador original. Pending commands/http/backends0, writeOutcomeUncertain=false e cleanup groups/backends/stack/temp=true em ambos. StrongReceiptGuard=true exatamente nos três OLD_EXECUTOR de cada run; os outros nove casos preservam false conforme contrato. Os130 blobs/1.987.473bytes foram conferidos contra Git sem drift e45 dependências foram observadas iguais entre os relatórios, sem afirmar releitura independente dos bytes instalados.

Os raws PR80.430B/SHA9c4cd47d5512f6f2c2af0bd48f0fb2d617e0577b4c69797dbb355b632799c60d e push79.850B/SHA17c27fbe218126909c5d88ff594771493516928f29c045f91d60d384fd0e5ea5 permanecem no diretório operacional. O recibo de fontes/fatos tem149.037B/SHA69993f62fa07dfd266bb62e12cedd711b63cb25ce3f8997418f7b69f742d61c6. Não houve rerun ou runtime nativo local. Este é aceite do gate descartável nessa fonte; o cohort geral, nova união R/E, banco hospedado, imagens, browser, restore e produção têm gates próprios.

O histórico bf1 encerrou19 originais,16PASS/3FAIL, sem cancelamento/reexecução. Os dois gerais aprovaram217arquivos/3.440unidades em cada fuso,1.996scripts e478E2E. O Admin Backend PR falhou com COMMAND_FAILED antes de PG/migrations/catálogo e conservou seu envelope; não foi atribuída causa interna. O Admin próprio de dad0 aprovou, sem reclassificar retroativamente aquele original.

## Composição local R2 — posterior ao aceite nativo acima

R2 foi incorporada somente à branch de revisão no commit4f10655fc4e4efc61291b66a1e6f7962c7329419/árvoree1320ff6505d342e1c96adafbc9481a15979753a, nove paths byteexatos incluindo dois peers. Manifesto9ac3f3f2107d56d4054bb60481e96f41ae2a1b6042264d738e49b4ac2c91feef. A V1 recusada pelo P2 de liveness fica preservada; a V2 confere o candidato B sob lease, libera apenas o hold local após B durável coerente e mantém A/UUID B se o SET não teve efeito.

Root revisou client/coordinator/J2 e os novos controles; lint dos seis TypeScript passou sem avisos, camadas551módulos/2.403relações sem violações e segredos2.357arquivos aprovados. Vitest, typecheck e os testes escritos de três ciclos ainda não foram executados nesta composição; dependem do CI próprio. O native PASS dad0 não é transferido para4f10655. Nenhum host/Workspace, API, Core, schema, flag ou ambiente foi ativado por R2; merge e produção continuam bloqueados.
## Fechamento19/19 de dad0 e composição E3 posterior

Os19 originais dad0 encerraram SUCCESS/attempt1, sem rerun/cancel/dispatch. Ambos os gerais executaram217arquivos/3.440unidades por fuso,2.000scripts e478E2E; audit0. Os14 envelopes nativos históricos sem violações permanecem separados dos dois N qualificados e do experimento no-store. Fontes549blobs/5.793.011bytes, zero drift;63 dependências observadas. Closure120.535B/SHAd5f820dd09c692aa7049aadc4111dc658df935678d1f214018a085c031a1ca8a e índice95arquivos/17.090B/SHA4f931377eba48e5ff50102e2054cd81987af115916e2b997706aec6aff2ca753 preservam esse fechamento. Nenhuma captura repetida de dad0 foi baixada.

A composição E3 posterior consome R2 sem mudar o port financeiro ou o Workspace. O manifesto39acf7aa6d17c66667193474acf7f08305cf0706729d6460f3c2d55ec8e4a59f fornece sete paths; produto e fixture E2 preservados, exceto os testes e o documento declarados. Foram corrigidos em sequência três achados da revisão: selected sem ID não pode virar null/omissão; a fixture update distingue omissão e remoção explícita; o double do presenter retorna ReactElement, compatível com a assinatura real. Os peers E1/E2 recusados permanecem no histórico e são superados pelos peers E3 e do delta Root.

Root verificou apply --check/whitespace dos patches E2 e E3 sem aplicá-los, conferiu os sete payloads antes do transporte e os copiou exatamente. Depois fez duas derivações próprias explícitas: trocou somente o literal PNG sintético truncado67B por PNG válido70B/SHA44cd598daa29e0dfe2ddb86b1af21dbec9b37b2f214d320c2af0450610e218e8 (três CRCs corretos e inflate local conferidos), e tipou o mock prepare por generic para remover unused sem perder GoalCommand nas calls. As inversões de uma substituição por arquivo reproduzem os respectivos E3 raw; os outros cinco paths continuam exatos. Nenhum asset de produto foi alterado.

O lint inicial de E3 recusou um warning de parâmetro não usado no mock. Após o ajuste, os seis arquivos passaram com zero avisos. O portão de camadas passou552módulos/2.413relações. A Impeccable local analisou os dois TSX uma vez, detect --json retornou[]/exit0; isso é controle mecânico, sem aceite gráfico. Os testes escritos produzem seis capturas320/390/768px×claro/escuro após fontes e prévia carregadas, e verificam retorno de foco. As capturas ainda precisam ser produzidas e inspecionadas no novo CI; não houve renderer, Vitest, typecheck, build ou instalação local.

A união R2/E3 exige CI próprio, conferência de qualquer delta e revisão visual dos artefatos. O PASS dad0 não é transferido. Montagem real, promoção para migrations novas, catálogo/tipos, aplicação supervisionada na homologação e aceites Auth/RLS/Storage/duas abas/perda de resposta continuam pendentes. Merge, produção, checkout Asaas, Drive e restore permanecem fora desta composição.
## Primeira execução da união deb586d e correções restritas

Os19 originais de deb586d261fb06a684d891edb36dbda72b968088 encerraram17PASS/2FAIL, attempt1. As únicas falhas foram os gerais [PR/run40065751176/job120788527969](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40065751176) e [push/run40065749074/job120788520778](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40065749074): Typecheck TS2322 em finance-goals-image-upload-fixture.tsx(32,79), Promise<Promise<T>> incompatível com Promise<T>. Nenhuma unidade, scripts ou E2E dos gerais executou; nenhum PNG desta união foi produzido ou baixado. Os raws59.873B/SHAbcd5344339ab9749ce2f94abb874f2d30fb22165fb03ac03b8c062f632e4c2c6 e59.295B/SHAe01543f3f6a9eccf8b32c27cffd6b93c0c88ebe974acd34b300c44e082ce9b86 preservam a recusa.

Os14 envelopes históricos, o experimento no-store e os dois N próprios de deb passaram. Cada N manteve12/12 casos/pending0/unknownfalse/cleanup4true. A closure120.590B/SHA1837cebe42e2f0d8fdd19719fe150079c1734a237ff15af161c5a9409c86070a e o índice91arquivos/SHA51958d02b91ba09d299b4bc52d1878946f6bea30a7a503ce42d0f0aba86295f7 conservam o conjunto. Isso não executa os testes R/E bloqueados no Typecheck nem aceita imagens/host/produção.

EFix usa somente o pacote finance-goals-image-upload-editor-efix1-r2-20261024, manifesto47fc3930bc951eff7b1deacb8584f1ce082ede29921bf0458a3937a5f42b1fd0. O pacote anterior sem-r2 tem patch vazio por colisão de alias PowerShell, foi preservado como incidente e não foi aplicado. A correção válida muda somente o wrapper da Web Lock para async+await, preservando navigator.locks.request(name, work), nome/callback e lifetime nativos. Sem cast, supressão ou fallback. Root e peer conferiram os dois payloads, e apply --check/whitespace passou antes do transporte byteexato.

Em paralelo, revisão estática encontrou uma classificação inconsistente ainda NÃO executada pelo CI: a tentativa antiga A sobre B prepared retornava PENDING por checar fase/ID antes de identidade, mas as expectativas anteriores exigiam STALE. R3, manifesto7cea88ce34facc8988fff1fdd035ba7cbd3071f1bf2390bb315a86fab1eee97b, confere ausência, depois identidade, depois fase/ID; não admite efeito, IO ou nova autoridade. O novo negativo preserva PENDING para a própria A ainda prepared, zero finalize/Storage/UUID novo e metadata intacta. Nenhuma expectativa STALE existente foi afrouxada.

Os peers [R3](evidence/t054-upload-retirement-v3-independent-review-20261024.md) e [Web Locks](evidence/t054-upload-editor-web-locks-independent-review-20261024.md) são favoráveis estáticos. Root leu os deltas e executou lint dos três arquivos de código afetados com zero avisos. Arquitetura, imports, Core, API, schema, canonical001–026, flags e UI não mudam nestas correções; o detector visual não foi repetido. Não houve tsc/Vitest/browser/SQL local. O próximo SHA exige seus próprios originais e as capturas; merge e produção permanecem bloqueados.