# Páginas legais — reconciliação visual de 18/10/2026

As páginas `/privacidade` e `/termos-de-servico` estendem o mundo DS 2.1 em modo **Read**. São minutas locais de versão `0.1 · revisão`, datadas de 18/10/2026, com aviso explícito sobre pendências e contratação ainda fechada. A disposição do revisor fresco foi **ship**, sem correção material nas oito capturas e no código revisados. Essa disposição encerra o passe visual local; não aprova publicação, abertura comercial ou conteúdo jurídico definitivo.

O papel Impeccable Documenter foi executado por um agente genérico isolado, pois o harness não oferece `agent_type` nativo. Este passe leu as referências `reference/degraded/documenter.md` e `reference/document.md`, o contexto de produto, o sistema vigente, o brief e o código; inspecionou as oito imagens existentes sem abrir navegador, executar serviços ou acessar o arquivo privado do fornecedor. Os resultados de testes abaixo pertencem à execução principal; não foram repetidos neste passe documental.

## Autoridade e fronteira

O pedido é uma extensão code-led: páginas legais públicas, links no rodapé de `/conheca` e em Configurações demonstrativas/conectadas, inclusive loading/erro. Herda marca, Geist, temas, tokens, foco e alvos existentes. Não há nova identidade, fotografia, comp, exploração conceitual ou alteração aprovada do sistema.

As fontes normativas continuam sendo [DESIGN.md](../../DESIGN.md), [PRODUCT.md](../../PRODUCT.md), [tokens DS 2.1](../../design-system/tokens/tokens.json) e [aliases do layout](../../src/components/ui/aliases.css). A aplicação específica fica no [brief legal](../../.impeccable/surfaces/src-app-privacidade-page-tsx.md). Apenas esse brief e este registro foram escritos neste passe; DESIGN.md, PRODUCT.md, sidecar/config e código do aplicativo ficaram fora da fronteira de escrita.

## Comparação com o sistema herdado

| Aspecto | Regra herdada | Aplicação observada nas páginas legais |
| --- | --- | --- |
| Cor | Neutros quentes, acento monocromático e temas do JSON | Fundo sólido do body, tinta principal e `ink-muted`; divisórias em `line`; nenhuma cor literal nova na folha legal. |
| Marca e família | Símbolo “2” com dois nós; Geist local com fallback existente | `Brand` compartilhada em link para `/conheca`; mesma família do app, sem imagem nova. |
| Hierarquia | Aliases de página 32/28 px e seção 18 px; papéis DS para prosa e metadados | Um h1; h2 de seção; prosa de 16 px/1.8; resumo de 16 px/1.5; índice/aviso de 14 px e versão/data de 13 px. São aplicações locais de valores existentes. |
| Medida e ritmo | Páginas de leitura de até 1184 px, piso de 320 px e escala de espaço existente | Prosa até 70ch; padding de 32 px, reduzido a 16 px até 600 px; safe areas; separação principal de 48 px. |
| Responsividade | Breakpoints por necessidade, sem esconder transbordo global | Acima de 780 px, índice de até 15rem ao lado da prosa; até 780 px, uma coluna na mesma ordem do DOM. Em 320 px, marca e Tema quebram de linha. |
| Material | Superfícies sólidas, elevação controlada e vidro restrito à landing | Linhas separam cabeçalho, aviso, índice móvel e rodapé. A moldura legal é plana, sem vidro, sombra, cartão decorativo ou movimento novo. |
| Interação | Alvos de 44 × 44 px, foco visível, select nativo e skip link | Tema compartilhado; links com quebra de texto; índice de âncoras; retorno à apresentação/início; contato e rodapé. A hierarquia de leitura permanece disponível sem JavaScript. |
| Integração | Configurações e landing preservam suas composições | `LegalLinks` oferece os mesmos dois destinos nas páginas legais, no rodapé da landing e em `SettingsLegalSection`. A seção usa o painel já existente de Configurações. |

Essas medidas descrevem o que foi implementado na superfície; não criam tokens nem proibições globais para telas futuras. As páginas contêm 14 seções de privacidade e 13 de termos, com índice antes do artigo no DOM. O modo Read e a medida de prosa pertencem ao brief legal, não à identidade inteira do produto.

## Fontes de implementação conferidas

- [Moldura legal](../../src/components/legal/legal-document.tsx) e [folha da leitura](../../src/components/legal/legal-document.css): composição, semântica, medidas e responsividade.
- [Privacidade](../../src/app/privacidade/page.tsx) e [termos](../../src/app/termos-de-servico/page.tsx): páginas de servidor com título/descrição próprios, usando o mesmo componente e os [textos públicos versionados](../../src/lib/legal/documents.ts).
- [Links compartilhados](../../src/components/ui/legal-links.tsx), [rodapé da landing](../../src/components/features/conheca/landing-page.tsx) e [seção legal de Configurações](../../src/components/features/configuracoes/settings-legal-section.tsx).
- [Configurações demonstrativas](../../src/components/features/configuracoes/settings-workspace.tsx) e [conectadas](../../src/components/features/configuracoes/settings-connected-workspace.tsx): seção legal preservada na composição normal, no carregamento inicial e no erro de perfil conectado.
- [Middleware](../../src/middleware.ts), [RootLayout](../../src/app/layout.tsx) e [apresentação opcional da conta](../../src/adapters/db/account-presentation.ts): as duas rotas exatas são públicas; a apresentação herdada ainda pode consultar Auth/Configurações no servidor e captura falhas. A entrega não remove toda consulta a Auth do servidor.

## Evidência visual e validação

As oito capturas locais foram inspecionadas neste passe e compõem o pacote que recebeu **ship** do revisor fresco:

| Captura | Cena registrada |
| --- | --- |
| [desktop.png](../../.impeccable/review/legal-20261018/desktop.png) | Privacidade em 1440 × 1000 px, claro; abertura, aviso e índice ao lado do artigo. |
| [terms-desktop.png](../../.impeccable/review/legal-20261018/terms-desktop.png) | Termos em 1440 × 1000 px, claro; mesma moldura e hierarquia. |
| [mobile.png](../../.impeccable/review/legal-20261018/mobile.png) | Privacidade em 390 × 844 px, escuro; abertura e início do índice linear. |
| [terms-mobile.png](../../.impeccable/review/legal-20261018/terms-mobile.png) | Termos em 390 × 844 px, escuro. |
| [user-320.png](../../.impeccable/review/legal-20261018/user-320.png) | Termos em 320 × 844 px, claro; cabeçalho e texto adaptados ao piso. |
| [privacy-rights-mobile.png](../../.impeccable/review/legal-20261018/privacy-rights-mobile.png) | Trecho de direitos e contato em 390 × 844 px, escuro. |
| [settings-mobile.png](../../.impeccable/review/legal-20261018/settings-mobile.png) | Seção legal nas Configurações demonstrativas, entre painéis existentes, em 390 × 844 px, escuro. |
| [landing-footer-mobile.png](../../.impeccable/review/legal-20261018/landing-footer-mobile.png) | Links legais junto a Tema e Configurações no rodapé da landing, em 390 × 844 px, escuro. |

A [matriz de métricas e ensaio público](../../work/legal-20261018/visual-and-public-results.json), gerada pelo [script local](../../work/legal-20261018/capture-and-public-check.mjs), cobre duas rotas × três larguras (320/390/1440 px) × dois temas: **12 combinações**, todas sem transbordamento horizontal, com um h1 por documento, 14/13 seções e sem link/select medido abaixo de 44 × 44 px. A prosa medida é de 16 px. O menor contraste da amostra foi **5.954828035965534:1** no claro e **9.047319159242406:1** no escuro, calculado para os seletores amostrados sobre o fundo sólido efetivo do body. Isso não substitui o contrato global de contraste do DS nem certifica combinações arbitrárias.

O ensaio negativo usa configuração de Auth indisponível: `/privacidade` e `/termos-de-servico` respondem **200** com conteúdo de servidor, enquanto `/configuracoes` responde **503**. As rotas públicas não ampliam a exceção para Configurações. O [E2E legal](../../tests/e2e/legal-pages.spec.ts) cobre leitura sem JavaScript em 320 px/escuro, âncoras, skip link, contato, navegação da landing e Configurações e troca de tema. O [resultado E2E consolidado](../../work/legal-20261018/e2e-results.json) registra **17 esperados, zero inesperados, zero ignorados e zero instáveis**.

A execução principal informou também **56 testes unitários**, build, typecheck, lint, fronteiras de dependência e validador DS aprovados. Este documento não apresenta esses checks como nova execução do documenter. As capturas mostram viewport, não todas as linhas dos documentos; os estados de Configurações conectadas/loading/erro foram conferidos no código, sem atribuir à captura demonstrativa uma sessão real.

## Deriva preexistente e limites

O DESIGN.md vigente usa seções próprias e não adota o frontmatter/esquema canônico descrito na referência atual da Impeccable. `.impeccable/design.json` não existe neste checkout, e o [contexto inicial registrado](../../work/legal-20261018/impeccable-context-ui.txt) reporta `config-build-path-unset`. O contexto foi capturado antes da criação das páginas/brief; seu `targetExists: false` não descreve o estado final. A documentação de produto/sistema também conserva trechos históricos da fundação que não constituem um inventário completo das capacidades atuais.

Essa deriva foi registrada, sem reparo ou canonização: a autorização cobre uma extensão local do sistema existente, não sua migração documental ou uma nova escolha global entre comp/code. Nenhum valor foi adicionado ao sistema para justificar um defeito; o revisor fresco não identificou correção material para as oito cenas.

Conforme D-072, a hospedagem permanece adiada e esta entrega fica local, sem push, PR, merge ou deploy. Identificação complementar, retenções e transferências internacionais continuam pendências da versão definitiva. A revisão visual não comprova funcionamento da caixa de suporte, validação jurídica, produção, aparelhos físicos, checkout, aceite versionado, onboarding ou abertura da oferta. O arquivo privado do fornecedor não foi lido, copiado nem usado como evidência neste passe.
