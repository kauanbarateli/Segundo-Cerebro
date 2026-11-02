# Dock desktop opcional — doc21 (02/11/2026)

Execução do [doc21](https://github.com/kauanbarateli/Segundo-Cerebro/pull/223) na branch `codex/dock-desktop-opt-in`, criada a partir da `main` reconciliada e rebaseada sobre `7519b614`. A branch antiga da PR #120 não foi retomada. Merge e deploy permanecem bloqueados; o deploy desta branch está desligado em `vercel.json`.

## Implementado

| Lote | Entrega |
| --- | --- |
| A — preferência/SSR | `src/lib/navigation/desktop-navigation-preference.ts`: chave `segundo-cerebro-desktop-navigation-v1`, parser estrito (só `"dock"` ativa), elegibilidade `(min-width:1051px) and (any-pointer:fine)`, gravação verificada com fallback em memória da aba e sincronização entre abas. O mesmo script CSP-hash do tema (`src/lib/theme.ts`) pinta `data-desktop-navigation` antes da hidratação, sem tocar `segundo-cerebro-sidebar`. Sem conta, POST ou migration. |
| B — dock/shell | `src/components/layout/desktop-dock.tsx/.css`: itens de `groupNavigationRoutes(getVisibleRoutes(policy))` (ordem, vetos, ocultação, Admin) + Métricas quando disponível; separadores só entre grupos reais; "Mais áreas" quando falta largura, sem encolher alvos. Ampliação por mola (valores OBSERVADOS do protótipo) via variáveis CSS, sem estado React por `pointermove`; toque e movimento reduzido não ampliam. Balão com hover persistente, foco e Escape. Na topbar entram marca, busca e o botão de conta que abre o mesmo popover (com "Meu perfil"). Troca de variante leva o foco ao mesmo destino visível; toasts e o fim do conteúdo reservam a altura da dock. |
| C — Configurações | Aparência → "Navegação no computador": cartões exclusivos Menu lateral (Padrão) e Dock inferior com miniaturas; rascunho até "Aplicar navegação"; avisos de storage bloqueado e de mudança em outra aba; em celular/toque só a explicação. Demo e conta conectada. |
| D — testes | Unidade: `tests/desktop-navigation-preference.test.ts`, `tests/desktop-dock.test.ts`, `tests/theme.test.ts`. E2E: `tests/e2e/desktop-dock.spec.ts`. Inventários de fontes Admin/Recovery/Drive e listas CSS dos fixtures atualizados com os caminhos novos derivados. |

Não copiados do protótipo: lista fixa de itens, router demonstrativo e `FloatingDockMobile`. A navegação do celular é a atual.

## N01–N16

| Critério | Evidência |
| --- | --- |
| N01 | Unidade (parser, script do head com chave ausente/inválida/JSON/vazia/storage bloqueado) e E2E com cinco valores + storage inacessível |
| N02 | E2E: só Configurações troca; botão recolher fica fora da dock; chave da lateral intacta |
| N03 | E2E: rádio não muda o menu; Aplicar, recarregar e deep link preservam; voltar restaura a lateral recolhida |
| N04 | Unidade e E2E: storage bloqueado aplica na visita, avisa e volta ao padrão no reload |
| N05 | E2E: nenhum POST, URL/hash, tema e rolagem preservados |
| N06 | Unidade (eventos `storage`) e E2E: segunda aba acompanha; seleção não aplicada é mantida com aviso; Sair da demonstração preserva só a apresentação (Admin some) |
| N07 | E2E 320/390/600 (celular atual), 601/768/1050 (lateral), 1051/1280/1440/1920 (dock); contexto touch-only |
| N08 | E2E: resize ida e volta sem apagar a preferência, foco no destino equivalente visível |
| N09 | E2E: Tab/Shift+Tab sem armadilha, Enter, balão no foco e Escape, landmark único, movimento reduzido |
| N10 | E2E: busca, Ctrl+K, conta, Meu perfil, Configurações, Sair, links sem destino morto |
| N11 | Unidade (oculto/vetado/Admin/Métricas/ordem intercalada) e E2E (Admin só com privilégio, mesma ordem da lateral) |
| N12 | E2E: uma linha, alvos ≥44, sem scroll horizontal, `aria-current` correto. Overflow "Mais áreas" coberto por unidade (`dockCapacity`) |
| N13 | E2E: contraste medido em claro/escuro (balão ≥4,5; ícones ≥3) e marcador do ativo; capturas abaixo |
| N14 | E2E: primeira pintura já é dock, sem erro de hidratação/console, foco não roubado no load, chunks bloqueados mantêm links navegáveis |
| N15 | E2E: busca e Capturar acima da dock, foco contido e Escape |
| N16 | E2E: última ação acima da dock em Configurações, Tarefas e Projetos; suíte E2E existente da lateral e do celular |

## Pendente

- Com o catálogo atual, a dock cabe inteira a partir de 1051 px; o overflow "Mais áreas" só é exercitado em navegador quando houver mais módulos (coberto por unidade).
- Zoom de 200% é equivalente ao resize para 720 CSS px (coberto); rotação física e laptop híbrido real não foram testados em hardware.
- Sincronização da preferência com a conta fica fora (padrão do doc21: somente neste navegador).

## Capturas (demo, `capturas/`)

`lateral-1440`, `dock-1440` (com balão), `dock-1051`, `configuracoes-1440` e `celular-390-com-dock-salva`, cada uma em `-light` e `-dark`.
