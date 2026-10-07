# T-002 — Registro de validação

Escopo: [issue #9](https://github.com/kauanbarateli/Segundo-Cerebro/issues/9), tokens DS 2.1 e tema em três estados. A nomenclatura DS 2.0 do ticket é histórica; D-030/doc 14 definem a revisão vigente.

## Implementado

- Fonte única JSON, CSS gerado e aliases `@theme inline` do Tailwind 4; paletas genéricas de cor/tipografia desligadas.
- Tokens com origem e classificação, preservando as métricas observadas no protótipo. Documentação em `design-system/README.md`.
- Claro/Escuro/Sistema com persistência segura, acompanhamento do SO, sincronização entre abas e bootstrap síncrono anterior à hidratação. `theme-color` deriva do canvas resolvido.
- `/design-system` exibe superfícies, tintas, semânticas, escala nomeada e raios. Geist local e números tabulares nos exemplos de valores.
- Validador integrado ao CI: JSON×CSS, 164 pares de contraste, pisos de 16/44px, cores cruas e integridade do favicon histórico. O asset estático é a única exceção de cores, registrada por origem e hash; a marca inline usa tokens.

## Fontes e revisão

Tokens e geometria consultados em `novo-segundo-cerebro@20914ce61fefa268ab06fb52d6e0c27fad7e7143`; comportamento e testes de tema em `151b2db4eb2bd9a7410342725d5865548883bbf4`. As cores e a tipografia vigentes vêm do protótipo DS 2.1, não do snapshot antigo. O link relativo para esse HTML no doc 14 foi corrigido para sua localização na cópia do planejamento.

Dois agentes implementaram tokens e tema, e outro revisou a integração de forma independente. Root revisou os diffs, integrou a página de verificação e executou a suíte completa. Três achados corrigidos antes do envio: tamanho inválido escapando do piso por NaN; cores CSS nomeadas/camelCase escapando do guard; barra do navegador seguindo somente o SO em vez da preferência explícita.

## Validação local

- Typecheck, lint e contrato de camadas aprovados.
- 61 testes de unidade/contrato aprovados, incluindo sabotagem de contraste com CSS regenerado, CSS divergente, token ausente, unidades inválidas e cores cruas.
- 164 pares aprovados, mínimo textual 4.5109:1; comparação sem arredondar o limiar.
- Build de produção sem credenciais ou banco.
- 28 testes E2E aprovados: a suíte cobre layout em 320/390/768/1280px nos dois temas, preferência persistida, mudanças do SO, abas, armazenamento indisponível, hidratação e resolução do tema/meta com bundles de React bloqueados.

A execução remota do commit e seu resultado serão registrados na issue antes do fechamento. A existência deste documento não atesta CI ainda em andamento.

## Inspeção e limites

Inspeção visual em lote, com desktop claro e mobile escuro, sem cortes nem transbordamento. Capturas do build validado:

- [Desktop claro](evidencias/t002-desktop.png)
- [Mobile escuro](evidencias/t002-mobile-dark.png)

Não há módulos funcionais, autenticação ou PWA nesta etapa. Testes em Chromium não substituem aparelhos físicos de T-005. Banco e migrations permanecem inalterados. A pendência de ferramenta de lint permanece em #36, sem correção compatível publicada na reavaliação.
