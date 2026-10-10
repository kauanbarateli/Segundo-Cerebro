# Capturar: persistência entre contextos e erro RLS na interface

Os dois novos E2E de Capturar passaram na fonte própria `edfa9474c170dca41dd83d5eb60b99f05b45403f`. A [Foundation 38071597437](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38071597437) terminou com success: 1.595 testes em UTC e São Paulo, 350 scripts mais dois controles separados de scanner, **192 E2E/zero failed/zero flaky**, 17 migrations, 35 arquivos de asserção SQL e catálogo local 1.243. Os E2E são 187 demo + um de preferências + dois de Início/Atividade sobre SQL + estes dois de Capturar. A [projeção fechada](evidence/issue22-capture-browser-ci-passed-20261010.json) liga os status, hashes e títulos exatos à execução própria; não publica os logs privados.

## Captura móvel e leitura no desktop

O [spec](../../tests/e2e/issue22-capture-persistence-sql.spec.ts) cria dois contextos Chromium independentes, com viewports 390×844 e 1440×900, para o mesmo dono descartável e duas sessões distintas. A [fixture](../../tests/e2e/fixtures/issue22-capture-persistence-browser.tsx) usa `CaptureView`, providers, application conectado, cliente, drafts e journal reais. CSS de componentes, globals/Tailwind, tokens e fonte são canônicos; navegação/Link e HTTP são seams explícitas. O bundle Node conserva os decoders, orquestrador Core, Gateway e Store reais, com as RPCs parametrizadas executadas na cadeia canônica em PGlite.

O envio feito pela tela móvel produz exatamente uma linha SQL, um evento `capture/created/web` com `before=null`/`after` igual ao registro e um recibo com resultado igual ao ACK. O journal móvel registra `confirmed`, sem pendência. O desktop iniciado vazio recarrega e lê o título e o conteúdo desse registro, usando epoch diferente e journal sem envio. Depois de fechar o contexto móvel, outro reload do desktop conserva o conteúdo; o desktop não escreve. A prova é o registro SQL e a leitura nova, não o compartilhamento de estado em memória entre as telas.

## Recusa RLS apresentada como erro

A nota de fixture é criada pelo Core antes da leitura. O catálogo confirma `SELECT` concedido ao papel `authenticated`, RLS ativo, policy `own_read` e papel sem superuser/bypass. Com JWT de fixture dono/sessão, um `SELECT` autenticado com `row_security=off` recusa de verdade com `42501` porque a consulta exige a policy. Esse probe precede o snapshot e injeta sua recusa no transporte; **não é a função SECURITY DEFINER privilegiada recusando por RLS**. O Gateway real traduz a recusa para forbidden; a seam HTTP retorna 403 somente depois de verificar esse erro SQL daquele request.

A tela mostra o alerta e “Tentar novamente”, sem lista vazia, nota de exemplo ou fallback demo. Ao remover a injeção e tentar novamente, a interface lê a nota SQL original. Catálogo e ledger de capturas/tarefas/eventos/recibos/revisões/limitador ficam iguais ao baseline, sem escrita da GUI ou novas chamadas de commit/receipt. Isso atende ao literal do erro RLS plantado no alcance declarado.

## Auth próprio e falhas preservadas

O [Auth 38071597455](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38071597455), da mesma fonte, também terminou com success. Seu report schema4 foi reavaliado por `evaluateBrowserCase`: logout, identidade/Data API e senha passaram; identidade inclui os quatro componentes, fixtures de Capturas/Tarefas ausentes, namespaces naturais, zero usuários entre casos e limpezas de stack/diretórios. Foram 17 migrations e 1.246 checks no catálogo nativo. Esse ensaio de serviços locais é separado da seam Auth da GUI.

A Foundation histórica `f3d301c` falhou com 191 E2E aprovados e um falho na asserção do feedback global do novo envio. A correção revisada afetou o teste: o ACK fresco deixa o feedback global `idle`; a confirmação é comprovada pelo settlement `confirmed` e pelo recibo SQL. Nenhuma mudança de produto foi necessária para essa correção. O [FAIL Auth histórico de `9a00d75`](evidence/auth-local-ci-password-transport-failed-20261010.json), com transporte terminal não comprovado e cleanup incerto, continua preservado; o sucesso de outro SHA/run não determina sua causa nem transforma aquela execução em PASS.

## Alcance dos critérios e pendências

As jornadas de captura em dois contextos e apresentação do erro RLS possuem aceite funcional local próprio. A publicação dos checkboxes da [#22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22) ainda requer readback separado. A issue não está encerrada: o [contrato M1 real](t015-real-m1-contract-20261010.md) passou, mas o primeiro checkbox também exige diff visual ≈ zero e tratamento das exceções do porte; upload por URL assinada, tamanho real e EXIF continuam separados.

Não foram executados Next handler/runtime factory/SDK/GoTrue/PostgREST pela ponte de navegador, nem Auth real pela fixture de catálogo. PGlite e dois contextos de viewport não certificam persistência hospedada, aparelho físico, paridade completa do shell ou auditoria Impeccable. 017 manual/export oficial e revisão humana de produção permanecem no [guia de pendências](pendencias-atuais-20261010.md). Nenhuma migration nova ou SQL remoto de escrita foi executado por esta entrega.
