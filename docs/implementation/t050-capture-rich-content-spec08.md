# T-050 / #75 — leitor puro de conteúdo documental

Refs #75. Part of #71. Contrato mínimo congelado pela Root em21/10/2026; implementação filha da extração neutra `01b836a35f5dc316763a1c14eb53dadce3494b6a`, baseada no planejamento `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. As branches fontes de imagens, calendário, finanças e vigências continuam preservadas. Esta filha reutiliza a clone limpa em branch própria; não incorpora seus WIPs.

## Implementado

`lerConteudoDocumentalDaCaptura(input:unknown):LeituraDocumentalDaCaptura` tem entrada discriminada fechada. `{kind:"legacy",content:string|null}` preserva literalmente texto/nulo, sem trim, conversão, interpretação HTML ou resolução de colchetes. A saída declara `document:null,document_version:0`. O limite existente é30.000 unidades UTF-16, incluindo espaços, quebras e pares substitutos.

`{kind:"rich",document,document_version}` exige revisão inteira segura positiva e documento JSON válido. Devolve cópia independente do documento, mesma revisão e texto derivado. A projeção bruta de `textoDoDocumento` deve caber em30.000 unidades UTF-16 **antes** do trim; a saída textual é `text.trim()||null`. Espaços e quebras do JSON permanecem. `content` no input rico é extra, mesmo undefined; o leitor não aceita duas autoridades textuais nem confere um cache persistido.

Discriminante ausente/desconhecido, pares incompletos, null/undefined indevidos e campos cruzados são recusados com `VALIDATION`, sem fallback. A revisão não é criada, incrementada ou usada como prova de CAS. Conteúdo vazio é representável aqui; o comando de criação ainda mantém sua validação de título/conteúdo e não foi alterado.

O envelope e a árvore são lidos por descriptors próprios de dados antes de validação/projeção. Objetos comuns ou de protótipo nulo são aceitos; custom prototypes, accessors, símbolos, funções, valores undefined, números não JSON, ciclos e listas esparsas/estendidas são recusados. Não se usa get dos objetos originais. A reflexão pode executar traps de introspecção de Proxy; não há promessa de pureza absoluta. Erros de reflexão viram erro de domínio estático, sem propagar texto arbitrário.

A revisão encontrou e corrigiu um P2 no tratamento de exceção: uma trap pode lançar um `ErroDeDominio` com código/mensagem arbitrários ou outro Proxy. O catch final ignora o valor lançado, sem `instanceof`, inspeção ou repropagação; qualquer falha desta leitura devolve `VALIDATION` e a mensagem estática “Conteúdo documental inválido.”. A distinção entre mensagens internas não faz parte desta interface pura. Negativos incluem NOT_FOUND/CONFLICT/VALIDATION falsos, Error comum, Proxy lançado e Proxy revogado.

A cópia JSON usa percurso iterativo com detecção de ancestrais cíclicos e orçamento dos bytes JSON, incluindo chaves, strings escapadas e pontuação, limitado aos mesmos512KiB do contrato neutro. Referências compartilhadas acíclicas são copiadas por ocorrência. Depois da cópia, o validador neutro continua sendo autoridade para32níveis/10.000blocos, nós/marcas, atributos e links HTTP(S) sem credenciais. Nenhuma permissividade de Conhecimento foi retificada ou ampliada incidentalmente.

Qualquer nó `wikiLink` de Página é recusado no ramo de Captura. `captureLink` e alinhamento ainda não são admitidos. Texto `[[literal]]` é texto; não se resolvem IDs, títulos, aliases ou destinos promovidos. O leitor não concede acesso a Captura ou Conhecimento.

## Compatibilidade e fronteira

Um legado válido de9.999caracteres (`"a\n".repeat(4999)+"a"`) gera10.001nós no conversor atual e não cabe no limite de documento. O leitor legado conserva esse texto sem prometer conversão total, truncar ou inventar fallback de bloco de código. A futura adaptação de editor/promoção precisa resolver esse caso explicitamente antes de ativar o consumidor.

Quatro paths reservados: `core/capturas/rich-content.ts`, export em `capturas/index.ts`, teste focal e este documento. Não muda `Captura`/`CamposCaptura`, comandos, drafts, CAS, recibos, eventos, editor, promoção, adapters, rotas, tipos SQL, package/lock ou validador neutro. Não há migration, timestamp ou operação remota. Persistência, conflitos, promoção A→B nas duas ordens, namespaces e UI continuam nos próximos recortes de #75, sem sistema duplicado.

## Validação e entrega

Testes preparados para ramos fechados, limites UTF-16/JSON/nós/profundidade, formatos existentes, links inseguros, referências ainda recusadas, legado com muitas linhas, cópias/imutabilidade, protótipo nulo e getters/Proxy. Não se atribui PASS a testes preparados. SHA, quatro hashes, patch e revisão estática constam do manifesto da entrega.

Nenhum Node, npm, teste, lint, compilador, build, banco ou navegador local foi executado. A Root conserva publicação e CI nos runners descartáveis, com inventários finitos reconciliados e guarda de deploy da própria branch. O novo export alcançável pode alterar os coletores transitivos; não presumir números da FFC nem os da #76. Nenhum PASS de #83–87 é transferido a esta filha.

Próxima validação proposta: teste focal em UTC/São Paulo, TypeScript/lint/camadas pertinentes e contratos de extração/paridade já existentes, no SHA integrado. A prova conectada de persistência/reload/CAS/promoção não é executável por este leitor e segue pendente de implementação. #75/#71/#81 permanecem abertas. Sem push, PR, merge, SQL remoto ou deploy por esta frente.
