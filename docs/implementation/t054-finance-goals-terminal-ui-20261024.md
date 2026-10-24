# T-054 — resolução explícita de tentativa na interface (M2-U)

Base da composição: `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`. Esta fatia usa o contrato M2-B, sem editar client, controller, journal, API, SQL, flags, FinanceWorkspace ou o harness. O Typecheck original da base falhou no teste B2a; a correção desse teste é outro delta Root. Nenhum resultado de CI anterior certifica esta autoria.

## Implementado

O aviso pendente conserva “Consultar tentativa”. A consulta usa `attemptStatus()` quando existem os dois métodos de `client.terminal`; sem a capacidade agrupada usa o reconcile V1 somente leitura. “Encerrar esta tentativa” aparece apenas com a capacidade completa e o pending lógico original fornecido pelo controller. A disponibilidade para criar Metas não é autorização de recovery: o hook conserva o journal ao receber available=false, e o aviso permanece visível fora de um overlay retido que não possa mais ser renderizado. Auth, Entitlement e sessão continuam a cargo do controller/client.

Encerrar primeiro abre uma confirmação inline, no mesmo aviso. O texto aprovado explica consulta do resultado, prevenção de commit futuro e preservação dos valores registrados. “Voltar” só altera a apresentação e devolve o foco ao botão; não consulta, escreve ou limpa o pending. Somente um novo clique em “Confirmar encerramento” chama `attemptSettle()`, sem gerar UUID ou modificar o corpo original. O busy síncrono do canal/controller protege duplo clique e os controles ficam desabilitados durante o envio. A confirmação não é descartada após erro/resultado incerto. Não há transporte em effect, timeout, mount, unmount ou retry automático.

A confirmação remonta por comando/client_id; owner/epoch já remontam GoalsSession. As keys não contêm valores financeiros, fingerprint ou corpo. O conteúdo aprovado é estático; nenhum valor ou nome de Meta foi acrescentado ao aviso ou aos rótulos.

Um positivo closed/confirmed do controller só é consumido depois de sua prova nominal e reconhecimento durável. A UI fecha o overlay e chama `resolved(kind)`: needsRefresh=true e reviewedCurrent=false. Closed mostra “Tentativa encerrada” e não promete devolução de dinheiro nem mostra “Operação confirmada”. Confirmed mostra resultado confirmado. A confirmação legada conserva sua semântica. Nova revisão atual bem-sucedida e clique humano em “Conferi os dados atuais” continuam obrigatórios antes de outro UUID; a UI não apaga ou reconstrói o journal para desbloquear ações.

## Foco e visual

O título recebe foco ao entrar na confirmação; Voltar devolve ao botão. Consultar e enviar mantêm foco lógico no status/título enquanto o botão fica busy. Após resolução, o status distinto recebe foco; após o reconhecimento humano bem-sucedido, o título persistente de Metas recebe foco em vez de abandonar o botão desmontado. Os efeitos são exclusivamente de foco, cercados pelo lifecycle existente. Não há segundo modal, paleta ou movimento novos. Tokens DS 2.1, máscara, alvos de 44 px e os campos existentes de 16 px permanecem preservados.

## Validação e limites

Nesta autoria: leitura estática, coordenação do contrato com M2-B, revisão dos caminhos de indisponibilidade e `git diff --check`. Nenhum Node, compilador, lint, DOM, browser, rede, serviço ou SQL foi executado pelo autor. Uma tentativa vazia de apply_patch foi recusada antes de qualquer alteração; o patch válido subsequente contém somente os paths autorizados.

Root é dono das fixtures/E2E. Os positivos devem usar cápsula nominal real do módulo capture/receive; não basta um objeto com cast ou uma prova inventada. Testar: ausência da capacidade, pending recuperado com available=false, consulta confirmada/closed/incerta, Voltar sem transporte, duplo clique, erro/recusa/perda de resposta sem liberar hold, desmontagem/troca de owner e de intenção, ack/readback parcial, atualização e revisão humana antes de novo preparo, foco após cada transição, máscara, temas, 320/390/1440 e contraste medido. Fixtures RAM não certificam HTTP, SQL, journal durável ou operação hospedada. M2-S/M2-B/M2-U e a correção do teste exigem CI próprio da união revisada antes de qualquer promoção.
