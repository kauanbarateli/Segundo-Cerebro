# Projetos — T-012

Modo Operate. Direção DS 2.1 aprovada; Geist, tokens neutros, dados sólidos e alvos de 44px. Impeccable local, Operate e Craft Floor lidos; fallback documental desta sessão, sem repetir launcher.

OBSERVADO: doc05 define projeto como contexto do contêiner; T012 pede lista+detalhe. RECOMENDADO: dois projetos reais e detalhe com tarefas/capturas/cadernos/pastas/agenda. Query projects é independente de projectsVisible; seções consultam apenas módulos allowed+visible depois de encontrar projeto. Sem import entre features ou cópia. Progresso feito/total calculado; percentuais do HTML não reutilizados. Skeleton lista/linhas por seção; erro com retry, ID ausente com mensagem.

Entrada: src/app/(workspace)/projetos/page.tsx; implementação: src/components/features/projetos/. O shell conserva H1, acesso, navegação e safe area. UI existente fornece controles, foco, tema e reduced-motion.

Evidência em [t012-content-shells.md](../../docs/implementation/t012-content-shells.md). Browser/E2E e contraste computado aguardam integração; nenhuma aprovação visual ou de aparelho real é inferida do CSS.

## T023 — operação persistente

IMPLEMENTADO: Drawer criar/editar projeto, confirmação de exclusão somente do projeto e lixeira com restauração. Seções autorizadas passam a criar aqui, vincular existente e desvincular por metadados do reader, preservando conteúdo. Campos e estado sobrevivem a falha; o client_id permanece no mesmo envio, e pending impede repetição. Foco inicial, retorno ao acionador, campos Field de 16px e botões/alvos de 44px usam os primitives existentes. Nenhum import entre features.

VALIDADO: contratos de domínio/adapter/API em Vitest, parser estático e catalogue/behavior no PostgreSQL descartável PGlite. A revisão cobre criação contextual de caderno, nomes de fontes até 200, preservação de conteúdos/vínculos e guards owner/Entitlement. Auth/Storage são fixtures explícitas; nenhuma prova hospedada ou visual é inferida. Jornadas de desktop/mobile preparadas em projects-habits.spec.ts; execução e inspeção visual final pertencem à integração do root. Relatório e pendências externas em [t023-projetos-habitos.md](../../docs/implementation/t023-projetos-habitos.md).
