---
version: 1
slug: "src-app-privacidade-page-tsx"
primary_target: "src/app/privacidade/page.tsx"
related_targets: ["src/app/termos-de-servico/page.tsx", "src/components/legal", "src/components/ui/legal-links.tsx", "src/components/features/configuracoes/settings-legal-section.tsx"]
---

# Privacidade e termos — contrato de leitura

## Modo e autoridade

**Read.** Extensão precisa do mundo DS 2.1 vigente em DESIGN.md. Execução code-led; não há novo mundo, comp aprovada, imagem ou torneio conceitual. Herda Geist, marca, paleta/tokens, foco e temas existentes. As rotas públicas exatas são `/privacidade` e `/termos-de-servico`; as demais rotas mantêm suas regras de acesso. Não modifica DESIGN.md, o layout dos capítulos, a animação ou o CTA de `/conheca`.

## Tarefa do leitor

Encontrar sem login quem responde pelo serviço, como os dados são usados, como pedir atendimento e quais condições regem o uso. Os textos atuais são minutas locais em revisão; não representam abertura comercial ou certificação. Endereço/documento privados não entram nos dados versionados, capturas ou logs. O nome público e o contato foram confirmados pelo mantenedor.

## Composição e integração

- Moldura pública leve com marca, Tema e retorno à apresentação; um h1, resumo, versão/data e aviso de revisão.
- **OBSERVADO:** moldura de até 1184 px, respiro lateral de 32 px e de 16 px até 600 px, com safe areas. Índice de âncoras antes do conteúdo no DOM; acima de 780 px, índice de até 15rem e prosa lado a lado; até 780 px, leitura linear. Texto com medida até 70ch, hierarquia simples e sem painéis decorativos, sombras ou novas cores.
- **OBSERVADO:** título em aliases herdados de 32/28 px, seções de 18 px, prosa de 16 px com entrelinha 1.8, índice e aviso de 14 px, versão/data de 13 px. Essas aplicações pertencem à superfície; não ampliam os tokens globais.
- Quatorze seções de privacidade e treze de termos, com fontes/linkagem útil quando aplicável; leitura principal renderizada no servidor, sem depender de JavaScript ou conta.
- Rodapé com acesso aos dois documentos, contato e Configurações. `LegalLinks` compartilha os mesmos destinos na moldura legal, no rodapé da landing e na seção própria de Configurações demonstrativas/conectadas, inclusive durante loading/erro do perfil conectado.
- Sem aceite por simples navegação, banner de rastreamento fictício, checkout, novo formulário, coleta etária ou gravação de dados nesta entrega.

## Barra de qualidade

1. Documentos e direitos localizáveis por títulos/índice/links; estado de revisão e contratação futura claramente separados do uso atual.
2. Claro/escuro com contraste textual medido nos fundos reais; controles ≥44 × 44 px, foco visível e ordem de teclado. O seletor Tema compartilhado é a única ilha de cliente da moldura legal; não há novo campo ou formulário.
3. Sem transbordamento em 320/390/1440 px; fonte, marca e navegação coerentes com o produto; movimento reduzido respeitado.
4. Texto disponível sem JavaScript, URLs públicas com Auth indisponível e Configurações privadas preservadas. Nenhum segredo/documento pessoal na superfície.
5. Links da landing e de Configurações apontam às mesmas páginas e preservam a composição existente.

## Evidência e limite

Oito capturas de viewport em `.impeccable/review/legal-20261018/` registram as duas primeiras dobras em computador/celular, termos em 320 px, direitos, Configurações demonstrativas e rodapé da landing. A matriz em `work/legal-20261018/visual-and-public-results.json` confirma 12 combinações (duas rotas × 320/390/1440 px × claro/escuro): um h1 por documento, 14/13 seções, sem transbordo e sem controle medido abaixo de 44 × 44 px; menor contraste textual amostrado de 5.954828:1. Isso não certifica pares arbitrários, aparelhos físicos ou produção.

Leitura sem JavaScript, âncoras, skip link e navegação estão cobertos pelo E2E local. Com a configuração de Auth indisponível, o ensaio negativo retorna 200 nas duas páginas legais e 503 em `/configuracoes`. A leitura opcional de apresentação no RootLayout é herdada e suas falhas são capturadas; não afirmar que todo o servidor deixou de usar Auth. A reconciliação e os limites estão em `docs/implementation/paginas-legais-documentacao-visual-20261018.md`.

Hospedagem ficou adiada e o trabalho é local (D-072). Nenhuma captura contém os valores do arquivo privado do fornecedor. Identificação complementar, retenções e transferências internacionais permanecem gates para a versão definitiva.
