# Execução, ownership e aceites

## Preparação

1. Fetch main, registrar SHA exato, ler AGENTS, CONTEXT, doc20, decisões operacionais e este doc21.
2. Conferir PRs que mexem em WorkspaceShell/Configurações/tema antes de editar. #129 e #132 estavam fechadas na consulta, mas isso não substitui revisar a main atual. Não reabrir #120/#129/#132 por causa da nova variante.
3. Criar branch `codex/dock-desktop-opt-in` da main atual. Importar somente documentos de referência se ainda não integrados. Não cherry-pick de toda a branch antiga do MVP.
4. Proteger o Preview da branch antes do primeiro push, preservando bloqueios existentes. PR em rascunho para revisão; sem auto-merge nem deploy por esta autorização.
5. O plano não depende de migrations, Supabase, Google OAuth ou credenciais. Usar modo demo e fixtures de política inicialmente; aceites de sessão conectada só em ambiente já autorizado.

## Quatro lotes coordenados (uma entrega vertical)

| Lote | Entrega e autoria | Dependências | Prova |
|---|---|---|---|
| A — preferência e bootstrap | parser/store/browser key, snapshot e SSR/CSP, testes puros; contrato compartilhado | nenhum | default/invalid/storage/abas/SSR |
| B — dock e shell | componente desktop, rotas/ícones reais, overflow, busca/conta, reserva e fallback | contrato A | navegação real, preservação funcional, visual |
| C — Configurações | fieldset/miniaturas, rascunho/apply/status, demo+conta, texto de escopo local | contrato A | alternar, recarregar, voltar sidebar, sem alterar tema |
| D — revisão e evidências | testes UI/negative, baseline sidebar/mobile e matriz visual; revisão independente | pode escrever casos antes; executa sobre A+B+C | checklist abaixo, SHA único e relatório |

Ownership: A não edita WorkspaceShell nem Settings; B não edita formulário; C não edita bootstrap; D propõe correções sem sobrescrever autores. Um integrador resolve imports/layout final, revisa diff e registra evidências. Miniaturas e dock compartilham tokens, não dependência circular entre features.

Na máquina de 8 GB: agentes podem ler/escrever em paralelo; **um** processo pesado local por vez. Não abrir quatro Next dev ou quatro Chromium. Typecheck/lint focados seriados; CI GitHub para build/matriz E2E, sem mudar workflows para ocultar falhas. Evitar disparar pipelines em cada microcommit. Um PR com commits A/B/C/revisão evita PRs dependentes sem utilidade.

## Critérios verificáveis

| ID | Aceite e teste negativo |
|---|---|
| N01 | Sem key/valor inválido/JSON arbitrário: sidebar, nunca dock; CSS/script não lançam exceção |
| N02 | Apenas Configurações aplica variante; recolher/expandir segue sendo recolher/expandir |
| N03 | Selecionar rádio não muda menu até Aplicar; aplicar e recarregar preservam; voltar recupera estado collapsed anterior |
| N04 | Storage bloqueado mantém escolha na aba e avisa limite; reload volta ao default se nada foi persistido |
| N05 | Troca não perde nome/tema/módulos ainda não salvos, rascunho do editor, query/hash ou scroll; nenhum POST de preferências por escolher dock |
| N06 | Segunda aba acompanha storage; draft local não é descartado por mudança remota; logout/login preservam só apresentação, nunca permissões da conta anterior |
| N07 | 320/390/600: drawer/bottom atuais intactos; 601/768/1050: sidebar atual; 1051/1280/1440/1920 com ponteiro fino: dock opt-in; touch-only nunca ativa |
| N08 | Resize, zoom 200% e rotação retornam à navegação adequada sem apagar preferência nem deixar foco no elemento oculto |
| N09 | Tab/Shift+Tab, Enter, nova aba, tooltip hover/foco/Escape, reduced-motion, touch híbrido: sem trap, ícone preso ou duplicidade de landmarks |
| N10 | Configurações, busca, Ctrl/Cmd+K, perfil, senha, sair, Atividade, Feedback/Ajuda/suporte continuam alcançáveis; flags desligadas não geram links mortos |
| N11 | Conta comum não vê Admin/Métricas indevidos; veto/ocultação/ordem persistidos continuam; Drive não é ressuscitado; política real governa servidor |
| N12 | Todos os itens + títulos longos + overflow Mais: nada cortado, alvos ≥44, current correto, zero scroll horizontal de documento |
| N13 | Claro/escuro: contrastes medidos (texto 4.5:1, ícones/estados essenciais 3:1), ativo não só cor, captura visual comparável |
| N14 | Primeira pintura/reload/deep link sem flash lateral→dock perceptível ou hydration errors; JS/chunk falho mantém fallback utilizável e CSP vigente |
| N15 | Modais/CommandPalette/QuickCapture/Meta upload/Cofre: prioridade visual, foco e recuperação íntegros; não usar segredos reais em screenshots |
| N16 | Zero regressão visual e funcional em sidebar expandida/recolhida e mobile; última ação de módulos acessível acima da dock/footer |

A referência do Início não atesta N01–N16 na aplicação. A tabela é critério de conclusão, não uma lista de testes já executados.

## Onde estender testes existentes

- `tests/navigation.test.ts`, `tests/theme.test.ts`: política/ordem e bootstrap.
- `tests/e2e/navigation.spec.ts`, `tests/e2e/doc18-shell-composition.spec.ts`, `tests/e2e/theme.spec.ts`: shell, teclado e responsivo.
- `tests/features/feedback-navigation-composition.test.tsx`, `tests/features/updates-shell-connected.test.tsx`, `tests/e2e/updates-shell-geometry.spec.ts`: links opcionais e geometria.
- `tests/features/settings-preference-draft.test.ts`, `tests/e2e/issue34-settings-sql.spec.ts`: provar que tema/rascunhos existentes não mudam. Não exigir banco novo para preferência local.
- Acrescentar testes focados de parser/store e um fluxo E2E de escolha/reload/reversão. Não escrever testes que só confirmam nome de classe CSS.

Comandos existentes para executar na implementação, seriados:
```sh
npm run typecheck
npm run lint
npm run check:layers
npm run check:design-system
npm run check:secrets
npx vitest run tests/navigation.test.ts tests/theme.test.ts tests/features/settings-preference-draft.test.ts
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/doc18-shell-composition.spec.ts tests/e2e/theme.spec.ts --workers=1
```

Acrescentar os testes novos aos comandos conforme os nomes escolhidos. Respeitar configuração/env dos fixtures; não usar credenciais de produção. CI canônico e build devem executar no SHA final. npm audit se houver dependência nova; investigar achados sem instalar major “fix” indiscriminadamente.

## Evidências para a PR

- SHA e diff, versões de Node/dependências, comandos/saídas, links CI do mesmo SHA.
- Capturas 1440 claro/escuro: sidebar e dock; Configurações com cada opção; foco/hover/overflow. 390 e 600 de navegação mobile **existente**. 1050/1051 e zoom para limites.
- Comparação referência↔aplicação com diferenças justificadas: catálogo dinâmico, utilitários, breakpoint e sem mobile dock.
- Separar implementado, validado local, validado CI, validado QA e pendente.
- Rollback de produto: usuário escolhe sidebar em Configurações; fallback sidebar permanece mesmo se componente dock falhar. Rollback de código, se necessário, por commit revisado, não reset de banco.
- Sem merge/deploy automático. Aprovação de implementação não é aprovação de publicação em produção.
