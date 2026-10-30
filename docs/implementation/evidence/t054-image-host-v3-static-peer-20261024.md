# H1 V3 — delta-peer estático (24/10/2026)

Parecer favorável estático dos três deltas, sem novo bloqueador objetivo. A revisão funcional V1 permanece válida para os nove payloads byteiguais; seus dois limites conhecidos ficam resolvidos no candidato V3: cleanup estável e precondição do teste de privacidade. Nenhuma execução de Node, lint, TypeScript, unitário, browser, SQL, rede ou serviço foi feita por este peer.

## Identidade conferida

EV/finance-goals-image-host-freeze-v3-20261024/manifest.json: 11.334 bytes, SHA256 ccd11e93935af2b98ab3dc8592b995a3a4715d2ddda0ad113f7a94f9c9b89935.

Conferi os 12 after, 12 previous-v2 contra as cópias do freeze V2, seis before e três patches. Comparação direta contra V1 confirma apenas:
- goal-image-source-recovery.tsx: 6.232 bytes, SHA256 13f8fdffad675fa65ce5ff84d0310932aac50546a4842e962a8ca286748c0bd4.
- fixture: 14.914 bytes, SHA256 24f6f717a3a6b97b729195b00a7a9ae8906969f22d44d41e72951f1df1904db1.
- spec: 14.076 bytes, SHA256 f432dae4f1e2ba03a11270907bdbf12814a51bd8d942bd802d00587a8e4a13a3.

Os outros nove são idênticos a V1, inclusive binder, editor, sessão, painel, hook, unitário, Page e documento. Scope A/B, APIs, cliente, barreira, controlador e autoridade nominal não receberam delta. O parecer V1 permanece em review/finance-goals-image-host-v1-static-peer-20261024.md, SHA256 0bd41c958f21bf23971a2decdcdf3c25da9e29bf0e7a7f7941ad66e652be959e.

Fullpatch: 110.369 bytes, SHA256 5f16467ab98ba46bf9710df45abda23634c56943454238166bb09aaa79f0b904. A aplicabilidade/reverse-check é evidência declarada pelo autor; não executei Git neste peer.

## Cleanup estável

SourceRecovery:19–28 move o mesmo corpo para closeSource=useCallback(...,[]) e devolve a função no useLayoutEffect. O callback usa os objetos ref estáveis da instância: active=false, incremento da geração ATUAL, running=false, captura/removal de handle.current e dispose. Não captura antecipadamente o valor numérico da geração nem o handle, não remove guard e não escreve/limpa J2.

As dependências source/hidden/closeSource mantêm o teardown da instância anterior antes da próxima configuração. live() ainda exige source/generation/hidden/current, e os guards após await continuam idênticos. A correção atende ao warning de exhaustive-deps sem eslint-disable ou callback obsoleto.

## Fixture de privacidade

O P2 anterior era uma precondição do teste: com showModal, o botão externo do host está inert; clicar nele não é o mecanismo de transição de contexto pretendido. Não foi identificado um bug de privacidade do produto nesse ponto.

A fixture V3 acrescenta apenas o seam tipado __setGoalsHostHidden(boolean). Seu wrapper recusa valores não booleanos antes do setter e exige o Surface atual. useLayoutEffect publica a closure própria de f/setHidden e o cleanup só remove esse mesmo registro; não conserva um setter de outro Surface. A chamada usa o caminho já existente f.setHidden→binder.conceal e setHidden, sem alterar client, upload, journal, seleção ou intenção.

O spec usa page.evaluate para simular a mudança externa do host e exige que o Dialog continue visível. Recusa a string "true", preserva o estado inicial habilitado, oculta source/Picker/nome, volta a exigir preparação humana e mantém A/J2 após revelar/desmontar/reabrir. Não há force click, fechamento forçado do modal ou exclusão de asserts físicos de privacidade.

Conferi prefixo/sufixo exatos fora do único bloco privacy: os outros 12 casos de browser continuam byteiguais. O novo seam não autoriza File/Ready/Linked/G0 nem existe no produto.

## Lint existente e pendências reais

Li e conferi hashes de EV/finance-goals-image-host-focal-lint-20261024/run-3/launch.json e seus logs. Launch: 8.159 bytes, SHA256 8e4eb49e7e1d17dd281870d327c4580d47c89c5742fc1ff0309682ab5aa22269. O registro contém Node24.19.0/heap192, ESLint focal --no-cache/--max-warnings=0, 11 arquivos e exit0. Todos os hashes before/after desse registro correspondem ao V3; stdout está vazio.

stderr contém somente o aviso ambiental de react detect: sem pacote React local nesse WT, o plugin assume a versão mais recente. Isso não é teste de render nem prova da versão React efetivamente instalada. Não reexecutei ou herdei esse lint como Typecheck/CI. O documento do produto permanece a fotografia V1 sem nova autoria; o estado atualizado de QA está no manifesto V3 e nesse recibo separado.

Continuam pendentes: reconciliação Root sobre o checkout atual, grafo/contagens reais, Typecheck e CI próprio, execução dos 13 unitários/13 E2Es e inspeção dos PNGs, Provider/Auth/Storage/Signed URL e lifecycle conectado. Nenhuma ativação de schema/flag, aceite nativo/hospedado, merge, produção ou restore é autorizado por este parecer.
