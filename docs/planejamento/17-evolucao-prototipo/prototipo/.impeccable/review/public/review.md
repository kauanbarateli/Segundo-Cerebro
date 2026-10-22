# disposition

**fix** — uma correção local de texto responsivo antes da entrega. A composição, o sistema visual e o fluxo não precisam ser reconstruídos. Revisão independente por código e capturas reais, sem navegador e sem nova execução do detector.

# material findings

**P2 — três títulos da landing juntam palavras no celular.** Em `public.js:17–19`, os títulos contêm `precisa<br>ficar`, `tempo,<br>com` e `plano<br>ao`. A regra `.public-chapter h2 br{display:none}` em `public.css:93`, aplicada até 760 px, retira a quebra sem introduzir espaço. As capturas `landing-mobile-light.png` e `landing-mobile-dark.png`, inspecionadas em tamanho original, exibem “precisaficar”, “tempo,com” e “planoao”. É um defeito de texto visível, não uma preferência estética.

Correção mínima: acrescentar espaço textual depois dessas três quebras, preservando a quebra no desktop e o texto corrido no celular. Recapturar apenas as duas landings móveis e conferir os três títulos. Nenhuma alteração de tokens, escala, composição ou identidade é necessária.

Não foram encontrados outros bloqueios materiais nas capturas obrigatórias ou na revisão estática dos caminhos novos. A documentação de produto ainda descreve a abertura antiga pelo onboarding; o responsável pela entrega informou que atualizará esse registro para a entrada em `/conheca` no fechamento documental.

# fidelity

- A landing mantém os elementos estruturais solicitados de `/conheca`: título em duas linhas, índice discreto no desktop, interface ampla, faixa inversa e capítulos alternados. As capturas atuais substituem explicações longas; não há métricas, depoimentos ou garantias inventadas. Trata-se de extensão orientada pelo código de referência, sem comp aprovado e sem alegação de equivalência de pixels.
- A marca “2”, Geist, neutros quentes e papéis cromáticos do DS 2.1 permanecem coerentes nos dois temas. Checkout e perfil usam a linguagem operacional existente. Os documentos legais adotam uma coluna de leitura e índice lateral no desktop.
- Oferta integral de R$ 29,90/mês presente na landing e no checkout; simulação e cobrança de R$ 0,00 são explícitas. O código encaminha ao onboarding existente, cujo resumo aplica escolhas sem substituir os registros dos módulos.
- Os legais identificam a minuta do PR #70, versão 0.2, e conservam os avisos de revisão e contratação futura. O relatório de origem registra 13 seções de Termos e 14 de Privacidade e comparação integral de texto e links aprovada. A oferta vem do pedido e do PR #69; esta revisão não interpreta a minuta como autorização de cobrança.
- Perfil acessível pelo avatar superior, com iniciais por padrão, prévia local e salvamento explícito. O uso da mesma identidade no topo e na lateral é consistente com o pedido.

# craft-floor

O único desvio material encontrado é a separação de palavras nos títulos móveis descrita acima. As demais superfícies obrigatórias apresentam hierarquia legível, grupos claros, controles utilizáveis e adaptação coerente entre desktop e celular. Não há hero de métricas, grade repetitiva de cartões de benefícios, kicker decorativo, gradiente em texto ou iconografia improvisada nas superfícies públicas novas.

Os 25 registros do detector são consultivos de tamanhos e raios; não há achados primários. A escala display da landing deriva da composição solicitada de `/conheca` e fica abaixo de 6rem. Raios de capturas, seletor e aviso legal são decisões locais compatíveis com componentes existentes. Os tamanhos de marca, preço e títulos de leitura têm função distinta dos controles. Não há motivo material para ampliar os tokens globais ou normalizar esses valores mecanicamente.

Os pares declarados de texto/canvas ou texto/superfície foram calculados nesta revisão: secundário claro 5,95:1; placeholder claro 6,21:1; erro claro 5,32:1; secundário escuro 9,05:1; placeholder escuro 6,74:1; erro escuro 6,27:1. Texto secundário das faixas inversas: 9,03:1 e 6,04:1. Isso corrobora a paleta aplicada, sem equivaler a uma auditoria de todos os pixels e estados.

O código fornece foco visível, texto de erro ligado ao campo, foco no primeiro erro, estado ocupado e recuperação de falha de armazenamento no checkout. A leitura legal em diálogo preserva os campos e reutiliza retorno de foco. Textos variáveis são escapados; a foto aceita somente data URI raster validada e preparada localmente. Número, validade e código do cartão não entram no objeto persistido. Essas conclusões são de inspeção estática; não foram executados novos testes de interação por este revisor.

# evidence

Consultados: `direction.md`, `PRODUCT.md`, `DESIGN.md`, `craft-floor.md`, `polish.md`, fontes de `/conheca`, procedência legal, `public.js/css`, `checkout.js/css`, `profile.js/css`, `legal-content.js` e integrações em `app.js`, `life.js`, `onboarding.js`, `index.html`, navegação e componentes compartilhados relevantes.

**22 capturas reais inspecionadas:**

- `landing-desktop-{light,dark}` e `landing-mobile-{light,dark}`; as móveis também foram vistas em pixels originais.
- `checkout-desktop-{light,dark}` e `checkout-mobile-{light,dark}`.
- `legal-desktop-top-{light,dark}` e `legal-mobile-top-{light,dark}`.
- `profile-1440-{light,dark}`, `profile-390-{light,dark}` e `profile-collapsed-{light,dark}`.
- `checkout-errors`, `onboarding-welcome`, `onboarding-summary` e `dashboard-personalized`.

Nenhuma captura obrigatória está ausente ou inválida. A nova captura móvel é necessária para fechar a correção encontrada, não para substituir evidência inexistente.

Os relatórios existentes `results.json` e `final-evidence.json` registram aprovação do fluxo público, ausência de overflow em 320/390/768/1024/1440, temas, legais, preservação dos registros e ausência de persistência de cartão. `work/profile-qa/results.json`, na raiz do workspace, registra 17 cenários aprovados, incluindo upload, substituição, remoção, tamanho/formato inválidos, rollback e foco do menu móvel. Esses resultados foram lidos, não reexecutados. A fixture geométrica do perfil pertence ao QA; não é fotografia entregue ao produto.
