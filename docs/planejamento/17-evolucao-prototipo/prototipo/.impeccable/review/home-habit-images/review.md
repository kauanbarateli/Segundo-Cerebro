# Microrevisão — imagens dos hábitos no Início

21/10/2026 — **Aprovado, sem achados materiais no escopo.**

- Diff conferido contra os arquivos anteriores em `work/home-habit-images/`: alteração limitada ao resolvedor visual, ao fallback de erro e ao CSS das miniaturas no Início.
- `App.habits.picture` preserva o contrato existente: exemplos legados recebem sua imagem; remoções explícitas não recuperam a capa padrão. A fonte passa pela sanitização existente e pelo escape no atributo.
- Miniaturas decorativas mantêm `alt=""`, contêiner com `aria-hidden="true"`, dimensões explícitas e recorte proporcional; botão de marcação conserva nome e estado acessíveis. O tratamento de erro remove apenas a imagem da interface, revelando o ícone sem alterar os dados.
- Capturas `home-habits-1440-light.png` e `home-habits-320-dark.png` inspecionadas: miniaturas, títulos, frequência e marcação permanecem legíveis e alinhados. A largura fixa da miniatura e `min-width:0`/quebra de palavras contêm o texto dentro da linha.
- `verification.json` registra as seis combinações 320/390/1440 px × claro/escuro sem overflow, imagens de 44 × 44 px carregadas, imagem personalizada salva e persistida, marcação funcional, remoção persistida e ícone após falha da imagem, com zero erros JavaScript.

Limite: esta microrevisão inspecionou código, capturas e o relatório da execução principal; não repetiu o navegador nem os testes dos demais módulos. Nenhuma alteração na implementação ou em `DESIGN.md` foi feita pelo revisor.
