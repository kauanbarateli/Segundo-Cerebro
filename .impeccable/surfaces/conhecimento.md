# Conhecimento — T-012

Modo Operate. Direção DS 2.1 aprovada; Geist, tokens neutros, dados sólidos e alvos de 44px. Impeccable local, Operate e Craft Floor lidos; fallback documental desta sessão, sem repetir launcher.

OBSERVADO: docs05/14 mantêm o registro único de Captura ao organizar; T012 pede cadernos/árvore sem editor. RECOMENDADO: cadernos260px + leitor até72ch, empilhados abaixo900px; resultados de busca separados do corpo. Query knowledge tem gate próprio; memberships só ligam IDs. Notas sem membership vão a Sem caderno. Corpo é texto escapado com wiki-links resolvidos; sem toolbar de editor. Editar em Capturar depende do acesso. Skeleton árvore/leitor; nota desconhecida tem mensagem própria.

Entrada: src/app/(workspace)/conhecimento/page.tsx; implementação: src/components/features/conhecimento/. O shell conserva H1, acesso, navegação e safe area. UI existente fornece controles, foco, tema e reduced-motion.

Evidência em [t012-content-shells.md](../../docs/implementation/t012-content-shells.md). Browser/E2E e contraste computado aguardam integração; nenhuma aprovação visual ou de aparelho real é inferida do CSS.

## Extensão T-021 — 09/10/2026

Modo Operate preservado. OBSERVADO: composição árvore/leitor, Geist e tokens DS 2.1 do brief vigente. RECOMENDADO: manter a coluna de cadernos e acrescentar editor TipTap lazy no leitor, toolbar textual de 44px, caderno/página mãe em campos nativos, criação em diálogo com foco protegido. Lixeira e arquivadas usam a mesma navegação; restauração explica o alcance da árvore. Campo de título e texto do editor >=16px; estados de salvar, envio incerto e conflito conservam o conteúdo.

O componente conectado usa DTOs de páginas, separado da demonstração anterior. Backlinks e Relacionado abrem os registros reais. Rascunho existe só em memória; envios persistidos passam pelo journal compartilhado. Não há grafo visual, prévia de anexos ou integração simulada dentro da conta conectada.

Foco de QA pendente: desktop/mobile, claro/escuro, navegação por teclado das sugestões `[[`, aba oculta, conflito entre duas sessões e árvores restauradas. O launcher não executou nesta sessão; fallback documental lido, sem declaração de visual audit aprovado. Implementação/evidência em [t021-conhecimento.md](../../docs/implementation/t021-conhecimento.md).
