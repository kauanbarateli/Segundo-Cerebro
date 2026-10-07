# Calendário — T-012

Modo Operate. Direção DS 2.1 aprovada; Geist, tokens neutros, dados sólidos e alvos de 44px. Impeccable local, Operate e Craft Floor lidos; fallback documental desta sessão, sem repetir launcher.

OBSERVADO: doc05 e T012 pedem leitura da agenda em dia/semana/mês; protótipo tem grade semanal e três compromissos do dia. RECOMENDADO: mês vira lista abaixo768px; dia/semana têm rolagem interna; fim de evento é exclusivo no dia civil do Núcleo. Extras começam amanhã, sem mudar os números do Início. Composição: controles visão/data → período → agenda → Drawer de detalhe. IDs/datas/visão ficam na URL; query agenda; vínculos só quando autorizados. Skeleton específico da visão, vazio com Hoje e erro do reader com Tentar de novo.

Entrada: src/app/(workspace)/calendario/page.tsx; implementação: src/components/features/calendario/. O shell conserva H1, acesso, navegação e safe area. UI existente fornece controles, foco, tema e reduced-motion.

Evidência em [t012-content-shells.md](../../docs/implementation/t012-content-shells.md). Browser/E2E e contraste computado aguardam integração; nenhuma aprovação visual ou de aparelho real é inferida do CSS.
