# Peer estático — contraste textual H1

Parecer favorável, sem bloqueador objetivo no recorte. Não executei Node, renderer, browser, testes ou rede; não alterei fontes.

Conferi os cinco artefatos do manifesto6ce009ee148653cc5279a9a5d6afd1059cc8e308eecf6851065cef2c9d2f6dc2 por bytes/SHA256. Before spec b3c1ad1453b8ba2d3f62c9093263c5f1a99b62b2ce375f90765f7080d6179010; after93543c67168e86fdc2f28e9ee576e8519281e6587b23fbbaffc874dcd00aaa23. Minha inversão literal do import/helper/chamada reproduziu o before inteiro, preservando casos, asserts anteriores, IO/foco/Escape, screenshots, retries e timeouts.

- Os cinco locators são fechados, únicos e visíveis no estado inicial; título Nova meta financeira, status literal e botão de retorno habilitado correspondem ao cenário. O label interno do botão evita medir um container de conteúdo misto. São cinco amostras nos seis casos existentes, nenhum caso novo.
- RGB(A) legado aceita somente inteiros0–255 e alpha compatível com rgb/rgba. Foreground precisa ser opaco; formato unsupported, canal fora do intervalo e alpha parcial recusam. Não há cor fallback ou razão inventada.
- O fundo é o primeiro backgroundColor opaco no caminho real do texto. Transparente é apenas atravessado; imagem/gradiente relevante ou composição parcial recusam. filter/mixBlend são conferidos em todos os ancestrais, inclusive após encontrar o fundo. O produto de TODAS as opacidades deve ser1.
- Na CSS atual, o Dialog tem superfície sólida var(--surface); seu ::backdrop é separado e não participa do par do texto. O helper não compõe sobre branco ou sobre o backdrop. O escopo não é um oráculo geral para overlays/pseudo-elementos/CSS complexa.
- O poll espera o término/idle das animações da subárvore sem cancelá-las ou alongar prazos. A razão reutiliza contrastRatio do design-system/validate.mjs: luminância sRGB e (Lmaior+0,05)/(Lmenor+0,05), sem arredondamento antes de exigir4,5 para cada amostra.
- O attachment conserva os cinco pares/razões antes da asserção do limiar; somente nomes sintéticos, tema, largura e cores. Não contém conteúdo financeiro, identificadores ou arquivo do Usuário.

Limite: nenhuma razão foi medida nesta revisão. O parser deliberadamente recusa formatos computados que não suporta; sua adequação ao Chromium real e as30 medições dependem do novo CI próprio. Não se transfere sucesso do c781, que parou antes de E2E. Não há aceite AA completo, foco/bordas/disabled, dispositivo físico ou hosted por este delta.
