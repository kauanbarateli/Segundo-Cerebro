# Handoff — duas frentes do MVP

**Orientação vigente do mantenedor em 12/10/2026:** a Frente A fica com outro agente, para construção e validação local sem serviços reais, entregue em PR. A Frente B fica com a raiz desta conversa, responsável pela criação que exige conexões, validação integrada e revisão da PR.

Este acordo substitui a divisão em quatro frentes do [handoff histórico](handoff-retomada-20261012.md#6-retomada-em-quatro-frentes-sem-conflitos-de-edição). A preparação deste pacote não iniciou implementação funcional nem novo ensaio conectado.

## 1. Contexto mínimo

Repositório principal: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). Partir da `origin/main` atualizada num checkout isolado; registrar seu SHA real antes das alterações. A base funcional consultada nesta preparação é `b8bf4ced273c6507c04385db706b06c49d01f53c`; este pacote documental não altera seu código. Registrar a main atualizada como base da PR; não reutilizar as contagens de CI de b8 em outro SHA.

As 12 issues abertas foram reconferidas para esta divisão: executivas #12/#21/#24/#32/#34/#35/#36/#37 e épicos #2/#4/#6/#7. Muitas construções já existem. Pendência de aceite não significa funcionalidade ausente: diagnosticar antes de reconstruir.

Leitura obrigatória, nesta ordem:

1. `AGENTS.md`, `CONTEXT.md`, este acordo e [prompt da Frente A](prompt-frente-a-construcao-offline.md).
2. [Pendências vigentes](entrega-mvp-pendencias.md) e as issues relevantes no GitHub; distinguir os registros históricos da seção atual.
3. [Índice do planejamento](../planejamento/00-indice.md), [tickets](../planejamento/13-tickets.md), [jornadas-âncora](../planejamento/05-arquitetura-de-produto.md#3-jornadas-âncora-critério-de-aceite-do-produto-inteiro), [DS 2.1](../planejamento/14-prototipo-interacoes.md) e [decisões operacionais](decisoes-operacionais.md).
4. ADRs pertinentes, incluindo [fronteiras do Núcleo](../adr/0002-nucleo-e-a-unica-porta-para-os-dados.md), [eventos de domínio](../adr/0004-toda-escrita-emite-evento-de-dominio.md) e [Google somente leitura](../adr/0008-google-calendar-readonly.md).

Drive foi retirado do MVP (D-032/OP-018). Não reabrir #29 nem criar substituto. Capturar, Avatar e Storage privado continuam. Não acrescentar fase 2, IA, billing, compartilhamento ou grafo persistente.

## 2. Responsabilidade por frente

| Área | A — outro agente, offline | B — raiz desta conversa |
| --- | --- | --- |
| #12 PWA | Manifest/ícones, experiência offline e regressões de interface existentes; corrigir defeito comprovado localmente | Instalação/uso Android e iOS reais e evidência física |
| #21 Auth | Revisão estática e controles herméticos de apresentação/contratos existentes; encaminhar diagnóstico | Implementação que dependa de Auth, cookies, RPC, rate-limit, SMTP, refresh/revogação e execução real da stack |
| #24 Admin | Revisão da apresentação com dados sintéticos; relatório de hipóteses verificáveis offline | Guards, backend, protocolo/lifecycle dos runners, BLOCK/FIRST, bloqueio vivo, troca forçada e limpeza real |
| #32 Google | Projeções/grades, três dias com fixture, navegação e janela na UI montada com portas falsas; estados visuais | OAuth, API/provider, persistência/RPCs, revogação/reconciliação, scheduler e validações reais |
| #34 Configurações | Painéis, temas visuais, estados, teclado, foco, responsividade e comportamento local das preferências com fixture | Persistência na própria conta, isolamento entre contas e sincronização entre aparelhos; upload/avatar e troca de senha conectados |
| #35 Release | Auditoria Impeccable local das seis jornadas, correções medidas e relatório próprio com limites | Catálogo hospedado, runtime permitido, perfis/ACL/custódia, quiescência, backup/restore/owners/Auth/Storage/Cofre reais, jornadas de produção e iPhone |
| #36 Dependências | Preservar a mitigação; checks estáticos/locais afetados pelo próprio diff | Reavaliar upstream/audit, instalar/validar mudanças da stack quando justificadas; não duplicar mitigação existente |
| #37 Sessões próprias | Apresentação da lista, datas/nulos, ordenação e estados com fixtures; não reconstruir o produto já implementado | Identidade/cookies/endpoint/SQL, isolamento e jornada ligada ao Auth; conclusão dos runners |
| Épicos | Informar os recortes entregues | Consolidar aceites e fechar somente após todos os filhos e critérios |

A pode construir algo cujo comportamento seja demonstrável por testes herméticos, em dados sintéticos, sem acesso ao produto hospedado. Se a causa ou o resultado depende de um serviço real, a criação/correção correspondente é de B. A anota a necessidade e continua com os itens independentes, sem implementar um backend paralelo.

**A não fará:** chamadas Supabase/Vercel/Google/Sentry/SMTP, Auth/GoTrue local real, runners nativos conectados, backup/restore reais, migrations remotas, alteração de segredos, permissões ou scheduler. PGlite em memória com Auth/Storage de fixture é permitido e não representa Supabase real. Rede para ler o planejamento no GitHub, obter dependências públicas fixadas/documentação oficial e entregar a PR é permitida; não é autorização de testes de integrações.

## 3. Backlog inicial da Frente A

### A-01 — Calendário montado e expansão de janela (#32)

Primeiro recorte recomendado para a PR. A fonte [CalendarWorkspace](../../src/components/features/calendario/calendar-workspace.tsx) contém efeitos de expansão de janela e `router.replace`. [calendar-connected.test.tsx](../../tests/features/calendar-connected.test.tsx) usa renderização estática, sem executar esses efeitos; o E2E [calendar-google.spec.ts](../../tests/e2e/calendar-google.spec.ts) cobre a demonstração. O fixture [calendar-timeline-browser.tsx](../../tests/e2e/fixtures/calendar-timeline-browser.tsx) cobre Timeline/Drawer, não o fluxo completo de Workspace.

Construir prova local interativa usando a **UI original montada**, roteamento e portas de dados sintéticas nos seams existentes. Não criar outra implementação do Calendário para testar.

Aceite do recorte:

- Trocar Dia/Semana/Mês e navegar pelos controles reais, com URL/seleção e conteúdo coerentes.
- Um evento sintético de três dias aparecer nos três dias nas visões correspondentes, respeitando término exclusivo e fuso.
- Sair da janela carregada provocar o comando de sincronização esperado e refresh do snapshot, sem reload completo; dentro da janela não provocar sincronização indevida.
- Confirmar efeitos/estado posteriores à resposta e impedir chamadas a serviços externos. Não chamar OAuth nem emitir token real.
- Correção de código de produto somente diante de defeito reproduzível na lógica/apresentação offline. Transportes, provider e regras de segurança continuam com B.

O critério original de #32 diz expressamente **“fixture prova”** para três dias. Não acrescentar exigência de evento Google real a esse critério. A prova sintética de expansão demonstra a UI/contrato; não certifica a busca e a persistência no provedor, que B valida separadamente.

### A-02 — Matriz visual de Configurações e sessões (#34/#37)

Reutilizar [issue34-settings-sql.spec.ts](../../tests/e2e/issue34-settings-sql.spec.ts) e seus [fixtures](../../tests/e2e/fixtures/issue34-settings-browser.tsx), além de testes existentes de sessões. Eles oferecem UI real e PGlite descartável, sem servidor Supabase.

Cobrir os painéis e estados relevantes — carregamento, vazio, falha, nova tentativa e lista — em claro/escuro, teclado/foco, 320/390/768 e desktop, movimento reduzido, alvos mínimos e campos. Priorizar gaps reais do diff; não escrever testes que apenas repitam a implementação.

O runner existente `issue34-settings-sql.spec.ts` exige Linux explicitamente. Usar apenas ambiente Linux já disponível e permitido; no Windows, registrar o impedimento e encaminhar a execução a B, continuando os recortes independentes. Não remover o guard, simular `process.platform` ou instalar um ambiente por suposição para obter PASS.

[SettingsConnectedWorkspace](../../src/components/features/configuracoes/settings-connected-workspace.tsx), [CSS](../../src/components/features/configuracoes/settings.css) e [OwnSessionsSection](../../src/components/features/configuracoes/own-sessions-section.tsx) são referências de apresentação. Sessão atual, UTC e nulos precisam permanecer factuais; não exibir IDs/IP/dispositivos inventados. Tema no mesmo fixture não prova sincronização no celular real.

### A-03 — Audit local e correções finais (#12/#35)

Aplicar Impeccable local e medir achados nas seis jornadas vigentes do doc 05. Reaproveitar [visual-guards.spec.ts](../../tests/e2e/visual-guards.spec.ts), [pwa.spec.ts](../../tests/e2e/pwa.spec.ts) e jornadas existentes. Registrar viewport, tema, passos, fonte e natureza sintética dos dados.

Corrigir somente achados reproduzidos: transbordo, campos/alvos, semântica, teclado/foco, hierarquia, mensagens/estados e movimento. Preservar Geist, monocromia e DS 2.1; não redesenhar o produto nem acrescentar funcionalidades para justificar a PR. Instalação em emulação não é instalação Android/iOS; audit local não é aceite de produção.

Se um item já estiver completo, registrar a prova existente e o limite. Se nenhuma correção de produto for necessária, a PR pode conter apenas a cobertura significativa e o relatório da construção existente.

## 4. Limites de edição e de concorrência

A trabalha em branch própria, sugerida `codex/mvp-construcao-offline`, sem editar o checkout principal da raiz. Inspecionar se a branch já existir; nunca resetar/destruir trabalho. Preferir worktree gerenciada adequada quando disponível ou checkout separado. Não copiar `.env.local`, `work/`, sessões, uploads, perfis DPAPI ou chaves da raiz.

**A pode alterar:** apresentação/puras projeções necessárias ao backlog, testes/fixtures herméticos correspondentes e relatório próprio em `docs/implementation/frente-a-entrega.md`. Em arquivo misto, limitar o diff à apresentação/lógica local; mudança de transporte/segurança deve ser encaminhada.

**B é dono:** `src/lib/auth/`, `src/lib/supabase/`, `src/adapters/db/`, `src/app/api/`, migrations/pacote SQL Editor, `scripts/operations/`, `scripts/verification/`, `tests/e2e-auth-local/` e workflows de integração/produção. A pode ler fontes versionadas para contexto, sem alterar esses contratos ou executar seus runners.

Não mexer em arquivos de gate/backend para conseguir PASS local, enfraquecer CSP/RLS/guards, alterar deadlines/cleanup ou sintetizar EOF. Diagnósticos históricos de Admin/Recovery têm capturas fechadas e limites; B assume mudanças do observer e dos fluxos reais. Não reabrir logs privados, nem transformar controle RAM em causa comprovada do CI.

A raiz mantém documentos canônicos de evidência/pendências/decisões. A entrega relatório próprio e referências de issue na PR; não reescrever simultaneamente os mesmos documentos. Antes de iniciar B em arquivo de apresentação compartilhado, raiz coordena pelo diff da PR para evitar alterações concorrentes.

## 5. Ambiente e verificações locais

Usar o runtime indicado em `.nvmrc`/engines e o lockfile; não atualizar a stack por rotina. Se necessário, `npm ci --no-audit` num checkout limpo obtém as dependências públicas do lock, preservando as regras de install scripts do projeto. Não copiar dependências/chaves/perfis privados do checkout da raiz.

Build e browser local usam **APP_MODE=demo somente no processo do agente**. Não cadastrar esse valor na Vercel nem criar `.env` de produção. `playwright.config.ts` já fixa demo e `reuseExistingServer=false`; preservar isso. Não reaproveitar um servidor conectado, nem encerrá-lo para liberar porta; usar a porta/configuração própria do teste.

Exemplos de comandos existentes, selecionados conforme o diff:

```powershell
npm run typecheck
npm run lint
npm run check:layers
npm run check:design-system
npm run check:secrets
npm run test:local-sql
node node_modules/vitest/vitest.mjs run tests/core/calendar.test.ts tests/features/calendar-projections.test.ts tests/features/calendar-connected.test.tsx tests/features/calendar-boundary.test.ts
node node_modules/vitest/vitest.mjs run tests/core/settings.test.ts tests/core/own-sessions.test.ts tests/features/own-sessions-reader.test.ts tests/features/own-sessions-section.test.tsx
$env:APP_MODE = 'demo'
npm run build
npm run check:client-auth
npx --no-install playwright test tests/e2e/calendar-google.spec.ts tests/e2e/calendar-timeline.spec.ts
git diff --check
```

Incluir o novo teste local no comando de Playwright quando criado. PGlite/local SQL somente se pertinente. Obter checks completos exigidos para o próprio diff, sem repetir suites amplas após aprovação sem motivo. O scanner nunca imprime segredos; não listar variáveis reais.

Em Linux já disponível e permitido, a matriz Configurações usa separadamente:

```sh
npx --no-install playwright test tests/e2e/issue34-settings-sql.spec.ts
```

Ausência desse ambiente é execução pendente, não aprovação. B assume esse check se A não conseguir executá-lo dentro do escopo.

**Não executar às cegas** `npm run check`, `test:scripts`, `test:auth-live`, `test:rate-limit` ou configs/runners Auth: há testes/scripts de integração e opt-ins que precisam de triagem e pertencem a B. Auditar a necessidade de rede/processos antes de escolher qualquer script. Não usar a ausência de execução desses testes como PASS.

## 6. Skills sugeridas

- **Impeccable obrigatória para interface:** ler [SKILL.md local](../../.agents/skills/impeccable/SKILL.md) inteiro e suas referências; usar o launcher/workflow indicado no arquivo. O arquivo global não substitui a versão do planejamento.
- [diagnosing-bugs](../../.agents/skills/diagnosing-bugs/SKILL.md), quando houver defeito reproduzível; preservar evidência e corrigir a causa.
- [code-review](../../.agents/skills/code-review/SKILL.md), para revisar a própria entrega.
- Supabase somente como orientação de fontes/arquitetura se pertinente; sua skill não autoriza A a usar conexões ou executar SQL real.
- Não alterar skills espelhadas, catálogo ou lock sem necessidade do escopo.

## 7. Entrega em PR e aceite pela raiz

1. Commits objetivos, sem coautoria, apenas arquivos da Frente A; push somente na branch própria.
2. Abrir **PR Draft para main** com escopo final coerente. Usar `Refs #...`, sem `Closes/Fixes/Resolves` de issues mistas. Não fazer merge, deploy, fechar issues ou alterar scheduler.
3. Descrever problema/resultado, arquivos, passos reproduzidos, comandos/resultados reais, dados sintéticos, limitações, riscos e testes conectados que B deverá executar. Evidência local pertence ao SHA efetivamente testado; não inventar status de CI.
4. Incluir relatório `frente-a-entrega.md` com matriz **implementado / validado localmente / pendente de B**, organizada por issue. Novas migrations são responsabilidade de B; nenhuma prevista neste recorte.
5. Conferir no GitHub que a PR existe, destino/main e commits corretos. Em Codex, anexar a PR à conversa se a ferramenta estiver disponível. Retornar URL, branch/SHA, resumo e checklist para a raiz.
6. Os workflows existentes podem disparar automaticamente com push/PR. A não os desativa/pula nem dispara integrações manualmente; B revisa os resultados e captura os relatórios necessários. GitHub disponível para entrega não é autorização para usar credenciais do produto.
7. B revisa código, contraste/a11y, arquitetura, contratos e dados de teste; reproduz os checks locais necessários; executa apenas as integrações pertinentes e valida o conjunto antes de incorporar. Se precisar de ajustes, pedir na própria PR.
8. B registra evidências do SHA aceito e consolida issues. Merge de A não equivale a MVP completo ou a release; só B conclui os aceites dependentes de conexões.

Se faltar acesso GitHub, continuar o trabalho local e informar esse bloqueio com branch/patch revisáveis, sem pedir tokens no chat. Não editar credenciais globais ou chaves do Sistema VOE para conseguir abrir PR.

## 8. Estado entregue à Frente B

Recuperação por e-mail com conta comum e identidade final já foi [validada](smtp-producao-20261012.md); não repetir criação/link por rotina. [Google](google-producao-20261012.md): duas contas, sync manual, filtros/retirada de aviso e cron supervisionado HTTP200/duas concluídas/zero falhas, Admin correspondente. Agenda diária habilitada às 02:17 Fortaleza; primeiro disparo automático ainda não observado no checkpoint.

Backup continua sem execução/restore/perfil real. Origem17.11 e CA/TLS do processo comprovados; ZIP17.11 com hash oficial, execução bloqueada pelo Windows. B resolve runtime permitido, perfil/custódia e alvo novo/vazio, mantendo a política do Windows e VOE. [Estado operacional completo](handoff-retomada-20261012.md#preparação-do-backup--35).

001–019 aplicadas no projeto pessoal; nenhuma migration pendente. MCPs Supabase/Vercel estavam sem permissão no último teste; painel pessoal autenticado e SDK Auth funcionaram. Reexaminar acesso somente quando houver mudança de estado, sem loop de login. CI de b8:5/8 push aprovados e3 failed, por metadados, sem causa atribuída; não transformar isso em bloqueio de toda construção offline.

A divisão reduz dependência e disputa de arquivos; não remove critérios de segurança, integrações reais, aparelhos ou release.
