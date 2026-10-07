# Shell navegável — T-004

## Superfície e propósito

Modo **Operate**. Grupo `src/app/(workspace)` e moldura em `src/components/layout/workspace-shell.tsx`. Substitui o Início provisório T-001 descrito em `home.md`, que fica como registro histórico. Preserva a identidade D-030/DS 2.1 aprovada, sem nova direção visual.

Navegar pelas treze áreas D-016 e reconhecer o contexto atual. As páginas são estados vazios de construção, sem dados pessoais, autenticação ou ações de domínio fictícias. Ajuda e Sair são alcançáveis pelo trilho, perfil e Mais. Sair restaura as opções de demonstração, incluindo o privilégio Admin, sem simular logout real.

## Composição

- **OBSERVADO, doc 14 §2.1:** trilho fixo a 18px, largura 228px, raio 28px, conteúdo com margem 268px. Recolhido: trilho 74px, margem 106px. A diferença de 162px retorna integralmente ao conteúdo. Tablet até 1119px usa trilho recolhido.
- **OBSERVADO:** até 767px, trilho oculto, cabeçalho com marca e controles, conteúdo e barra inferior com quatro módulos + Mais. Margens e navegação respeitam safe-area; o conteúdo reserva 132px + safe-area inferior.
- **OBSERVADO:** cabeçalho 60px, raio 20px; contexto à esquerda, busca compacta, tema e perfil à direita. Título operacional 28px/24px. Foto ilustrativa 36px, grayscale, extraída sem alterações do JPEG embutido no protótipo (fonte registrada no doc 14 §8).
- **RECOMENDADO:** moldura opaca com o fallback DS validado em ambos os temas. Sem blur ou animação de entrada. Links ativos usam o par accent/accent-ink; os demais usam os pares neutros validados. Busca filtra apenas atalhos de módulos, claramente identificada como casca.
- **INFERIDO:** trilho é o primeiro bloco de navegação no DOM desktop; no mobile ele sai da árvore acessível, deixando cabeçalho, conteúdo e barra na ordem visual. Estado vazio contém uma única h1 e seção h2. Sem cartões aninhados.

## Acesso e demonstração

O resolvedor puro `src/core/access/resolve-access.ts` mantém Entitlement separado de Preferência (ADR-0003). Plano Pessoal concede acesso implícito; veto bloqueia página e atalhos. Ocultar preserva acesso direto. Admin requer privilégio explícito além do Entitlement. Esta guarda de interface não protege operações de produção: autenticação e enforcement no servidor pertencem à etapa de identidade.

O provedor usa `sessionStorage` com chave exclusiva e versão; se indisponível, a sessão montada usa memória. Dados recuperados são validados por lista de chaves, tipos e números finitos. Configurações separa preferências de usuário de controles de cenário simulado. Início e Configurações não são editáveis por esses controles, preservando recuperação. Nenhum banco ou serviço externo é chamado.

## Interação e verificação

Primitivos Button, Field, Brand, Icons, ThemeSelector e Dialog compartilhados. Busca e Mais usam Dialog (modal e sheet) do T-006. Perfil usa popover nativo, com Escape e clique externo. Busca aceita Ctrl/Cmd+K; resultados são links nativos, com Tab, Enter e Escape. A busca de conteúdo e navegação por setas do protótipo completo permanecem fora da casca T-004.

Alvos mínimos 44px; foco em duas camadas; skip-link aponta para main focalizável; navegação entre rotas foca o conteúdo. Movimento reduzido remove transições. Testes unitários cobrem acesso, taxonomia, ordenação, busca e armazenamento inválido; E2E cobrem treze rotas, 320/768/1280px, largura recuperada, teclado, menus e distinção de acesso. Execução visual final e seus resultados são responsabilidade da validação integrada; este brief não afirma execução não realizada.
