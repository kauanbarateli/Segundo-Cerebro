# Fundamentos visuais

Route: `/design-system`. Entry: `src/app/design-system/page.tsx`. Mode: **Read**.

Página de verificação prevista em T-002, expandida pelos tickets de primitivas. Herda o DS 2.1 aprovado. A pessoa percorre superfícies, tintas, semânticas, papéis de tipografia e raios, podendo comparar os temas no select nativo.

Leitura: título e explicação curta, índice de âncoras, amostras de superfícies em quatro colunas no desktop/duas no celular, inversa, semânticas com rótulos, lista de tipografia e amostras de raios. A documentação técnica pertence a esta rota de verificação. Exemplos não representam dados pessoais nem funcionalidades disponíveis.

Piso 320px; tipografia em uma coluna no mobile; alvos 44px; campos 16px; foco, skip link, números tabulares e movimento reduzido. Os valores vêm dos tokens documentados em `design-system/README.md`. A página não usa vidro ou animação de entrada.

Capturas e validação em `docs/implementation/t002-validacao.md` e `t003-validacao.md`. T-003 adiciona primitivas interativas: simulação explícita de loading e conclusão, validação local de campos, filtro toggle, cartões claros/inversos/suaves, três versões da marca e catálogo recolhido dos 47 ícones. O formulário usa o mesmo Field do seletor de tema; não envia ou persiste dados. Amostras se reorganizam em uma coluna no mobile.

T-006 acrescenta duas seções ancoradas: superfícies interativas e dados/controles. Demonstra diálogo aninhado e ajuda contextual, drawer, confirmação, bottom sheet, avisos com ação e pausa, coleção compartilhada entre tabela/cartões, estados de leitura, switch, gráfico com resumo, progresso e recolhimento. A extensão preserva o mundo visual e o propósito de leitura/verificação; validação em `docs/implementation/t004-t006-validacao.md`.
