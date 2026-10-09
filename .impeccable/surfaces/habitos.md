# Hábitos — T-012

Modo Operate. Direção DS 2.1 aprovada; Geist, tokens neutros, dados sólidos e alvos de 44px. Impeccable local, Operate e Craft Floor lidos; fallback documental desta sessão, sem repetir launcher.

OBSERVADO: T012 exige dia passado e pausa; três hábitos já compõem o universo do Início. RECOMENDADO: Hoje + histórico26semanas + Pausas, com Drawer Registrar dia/Registrar pausa. O mapa não é interativo: edição usa controles≥44px, resumo e legenda. Query habits e comandos mark/pause do Núcleo; nenhum store paralelo. Novo hábito omitido até existir seu comando. Datas civis, marcas futuras proibidas e pausas futuras permitidas. Skeleton linhas+mapa; erro de leitura com retry separado de erro de comando.

Entrada: src/app/(workspace)/habitos/page.tsx; implementação: src/components/features/habitos/. O shell conserva H1, acesso, navegação e safe area. UI existente fornece controles, foco, tema e reduced-motion.

Evidência em [t012-content-shells.md](../../docs/implementation/t012-content-shells.md). Browser/E2E e contraste computado aguardam integração; nenhuma aprovação visual ou de aparelho real é inferida do CSS.

## T023 — operação persistente

IMPLEMENTADO: Novo hábito e edição em Drawer com três cadências, dias selecionáveis com aria-pressed e meta de 1 a 7; arquivar/restaurar mantém histórico, início permanece protegido. Pausas gerais e individuais têm remoção explícita. O reader usa todas as marcações para sequência e o mapa mantém sua janela de 26 semanas. Texto distingue dia demonstrativo de hoje em São Paulo. Foco inicial/retorno, pending, campos preservados e client_id estável usam os primitives DS 2.1 existentes, com Field de 16px e alvos de 44px.

VALIDADO: domínio/adapter/API em Vitest, incluindo sequência de 230 dias e teto São Paulo. Catalogue/behavior no PostgreSQL descartável PGlite verificam RLS/grants, 120 marcações sem truncamento, futuro, pausa e veto. Esses dados sintéticos não comprovam Auth/concorrência hospedada. Jornadas de foco, três cadências, marcação passada, arquivo/restauração e pausas preparadas; browser e inspeção visual final pertencem à integração do root. Relatório e pendências externas em [t023-projetos-habitos.md](../../docs/implementation/t023-projetos-habitos.md).
