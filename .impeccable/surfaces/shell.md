# Shell navegável — T-004 / layout Codex

## Superfície e propósito

Modo **Operate**. Grupo `src/app/(workspace)` e moldura em `src/components/layout/workspace-shell.tsx`. Substitui o Início provisório T-001 descrito em `home.md`, que fica como registro histórico. Preserva a identidade D-030/DS 2.1 aprovada, sem nova direção visual.

Navegar pelas treze áreas D-016 e reconhecer o contexto atual. As páginas são estados vazios de construção, sem dados pessoais, autenticação ou ações de domínio fictícias. Ajuda e Sair são alcançáveis pelo trilho, perfil e Mais. Sair restaura as opções de demonstração, incluindo o privilégio Admin, sem simular logout real.

## Composição

Layout Codex (D-033, doc 15, issue #46) substitui a moldura flutuante do doc 14 §2.1; a versão anterior fica no histórico do Git.

- **OBSERVADO:** lateral em grid de 232px (recolhida 76px, devolve 156px ao conteúdo), `surface-muted`, borda direita `line`, padding 24/12/16px; marca empilhada (símbolo 38px, texto 21px), busca de 44px com Ctrl K, grupos Meu dia / Meu contexto / Vida pessoal (rótulos 12px, links 44px, raio 9px, 14px), utilitários (Configurações, Integrações, Admin) e Ajuda no rodapé, perfil com avatar 36px e popover de conta.
- **OBSERVADO:** topbar 76px com divisor; alternar lateral, breadcrumb 13px, estado da sessão, Tema, Atividade e Capturar. Conteúdo até 1600px com respiro 32/24/16px; título de página 32/28px com subtítulo do módulo.
- **RECOMENDADO:** grupos derivados de `getVisibleRoutes(policy)`; ordem personalizada que intercala grupos vira lista única sem rótulos (nunca reordena). Estado recolhido é preferência de apresentação do navegador (`segundo-cerebro-sidebar`), pintado no `<head>`; sem escolha, recolhe até 1050px. Lista esmaece a borda que ainda esconde itens em janelas baixas.
- **RECOMENDADO:** até 600px a mesma árvore vira menu modal (`role=dialog`, `aria-modal`, foco no X, Tab contido, fundo `inert`, scroll travado, retorno ao abridor); barra inferior 68px + safe-area com quatro módulos e Mais; conteúdo reserva 88px.
- **INFERIDO:** cores somente de tokens; ativo em accent/accent-ink; dicas da lateral recolhida em accent com `role=tooltip`.

## Acesso e demonstração

O resolvedor puro `src/core/access/resolve-access.ts` mantém Entitlement separado de Preferência (ADR-0003). Plano Pessoal concede acesso implícito; veto bloqueia página e atalhos. Ocultar preserva acesso direto. Admin requer privilégio explícito além do Entitlement. Esta guarda de interface não protege operações de produção: autenticação e enforcement no servidor pertencem à etapa de identidade.

O provedor usa `sessionStorage` com chave exclusiva e versão; se indisponível, a sessão montada usa memória. Dados recuperados são validados por lista de chaves, tipos e números finitos. Configurações separa preferências de usuário de controles de cenário simulado. Início e Configurações não são editáveis por esses controles, preservando recuperação. Nenhum banco ou serviço externo é chamado.

## Interação e verificação

Primitivos Button, Field, Brand, Icons, ThemeToggle/ThemeSelector e Dialog compartilhados. Busca usa Dialog do T-006 e abre sem transição; Mais abre o menu modal da lateral. Perfil usa popover nativo, com Escape e clique externo. Busca aceita Ctrl/Cmd+K; resultados são links nativos, com Tab, Enter e Escape. A busca de conteúdo e navegação por setas do protótipo completo permanecem fora da casca T-004.

Alvos mínimos 44px; foco em duas camadas; skip-link aponta para main focalizável; navegação entre rotas foca o conteúdo. Lateral e diálogos animam 180ms na curva DS; teclado e movimento reduzido não esperam transição. Testes unitários cobrem acesso, taxonomia, ordenação, busca e armazenamento inválido; E2E cobrem treze rotas, 320/768/1280px, largura devolvida, persistência e padrão compacto, dicas, menu modal, teclado e distinção de acesso. Execução visual final e seus resultados são responsabilidade da validação integrada; este brief não afirma execução não realizada.
