# Apresentação pública /conheca

Em 12/10/2026, a pedido do mantenedor, o Segundo Cérebro ganhou uma página de apresentação comercial em `/conheca`. Ela mostra o produto como ele é hoje, sem pagamento, preço, plano, formulário ou redirecionamento. A rota `/` continua sendo o Início autenticado e o login não mudou.

## Decisões confirmadas

| Tema | Decisão |
| --- | --- |
| Estrutura | "Seis perguntas": cada capítulo abre com uma pergunta do dia a dia, respondida por uma tela real. Escolhida pelo mantenedor entre três estruturas sorteadas pela Impeccable (seed `4115d4a0`). |
| Rota | Pública em `/conheca`, incluída na lista de páginas públicas de `src/middleware.ts`, sem consulta de sessão. |
| Ação | Sem redirecionamento nesta etapa. "Ver como funciona" e o cabeçalho usam âncoras da própria página; "Quero acesso" informa no lugar que o acesso ainda não está aberto. |
| Tipografia | Papéis `vitrine` (título de apresentação, até 96px) e `chamada` (parágrafo de abertura) entraram em `tokens.json` como **RECOMENDADO**; os demais papéis seguem inalterados. |
| Indexação | `noindex, nofollow` até haver domínio e oferta definidos (`INDEXACAO_PUBLICA` em `content.ts`). |

## Estrutura

`src/app/conheca/page.tsx` define metadados (título, descrição, canônica, Open Graph, Twitter e robots) e entrega `LandingPage`. A composição fica em `src/components/features/conheca/`:

- `content.ts`: todo o texto publicado e o ponto de integração comercial (`acesso.destino`). Hoje é `{ tipo: "aviso" }`; um destino aprovado entra como `{ tipo: "link", href, rotulo }`. Preços e planos podem entrar como uma nova seção antes de "acesso", sem reconstruir a página.
- `landing-page.tsx`: abertura, dispersão, três movimentos, seis capítulos, conexões, princípios, acesso e rodapé. Cada capítulo tem duas colunas: a do texto (`__coluna`) e a da tela (`__palco`), que reservam o percurso da pergunta parada.
- `landing-header.tsx`: cabeçalho fixo com âncoras e a marca compacta com o nome em 14px; abaixo de 768px as seções viram um painel com `aria-expanded` e fechamento por Escape; abaixo de 420px o nome da marca fica na barra e "Quero acesso" passa para o painel.
- `access-action.tsx`: botão de acesso com região `role="status"`.
- `product-shot.tsx`: moldura das telas com `next/image` (`<picture>` com `getImageProps`). Cada cena tem um quadro por tema: o do sistema segue `prefers-color-scheme`; os quadros claro e escuro assumem quando o tema é escolhido no rodapé (`html[data-theme]`) e só carregam se forem exibidos. Abaixo de 768px entra a captura de celular da mesma cena. A figura recebe a proporção e a largura nativa da captura para limitar a tela à altura da janela sem ampliar a imagem.
- `landing.css`: somente tokens DS 2.1. A partir de 1024px de largura e 700px de altura, a pergunta de cada capítulo para abaixo do cabeçalho, a tela começa 56vh abaixo e sobe até alinhar com ela, as duas ficam juntas por 16vh e seguem juntas. Abaixo de 1024px a leitura é em coluna única, sem fixar a pergunta, que tomaria um terço do celular enquanto a captura passa; em janelas com menos de 700px de altura o texto não caberia parado e os capítulos ficam lado a lado sem fixar. O movimento (a tela do Início que se abre, a tela do capítulo que chega ao tamanho final ao alcançar a pergunta e o fio dos três movimentos) usa linhas do tempo de rolagem, com conteúdo visível por padrão, e desaparece com `prefers-reduced-motion` ou sem suporte.

## Afirmações e limites

Cada frase de `content.ts` foi conferida no código antes de publicar: Capturar com Caixa de entrada, vínculos `[[...]]` e conversão em tarefa; Início com foco, tarefas, agenda, hábitos, mês financeiro e caixa de entrada; Financeiro com fatura derivada, pagamento parcial, limites por categoria e ocultação de valores; busca em tarefas, capturas, páginas, lançamentos, projetos e hábitos; Hábitos com cadências, 26 semanas e pausas; Cofre com cifra no navegador, kit em duas metades, bloqueio em 5 minutos e limpeza do clipboard em 30 segundos; Calendário Google somente leitura com até duas contas; Admin sem acesso ao conteúdo.

Ficaram de fora: Drive (D-032), IA, grafo persistente, Kanban, uso offline, escrita no Google, métricas agregadas no Admin, instalação validada em aparelhos e qualquer condição comercial. `tests/features/conheca-content.test.ts` impede esses termos no texto publicado.

## Telas reais

As imagens de `src/components/features/conheca/telas/` são capturas do próprio app em modo demonstração, geradas por `scripts/landing/capturar-telas.mjs` contra um build local:

1. `npm run build`, depois `npm run start -- --hostname 127.0.0.1 --port 3110`. Não rode `next dev` na mesma pasta ao mesmo tempo: os dois usam `.next` e o servidor de produção passa a falhar.
2. `node scripts/landing/capturar-telas.mjs --base http://127.0.0.1:3110`.
3. Com a página construída, `node scripts/landing/capturar-telas.mjs --base http://127.0.0.1:3110 --og` atualiza `src/app/conheca/opengraph-image.png`.

Cada cena sai nos temas claro e escuro (sufixo `-escuro`), na largura do computador em densidade 2 e na do celular (sufixo `-celular`) em densidade 3, como num telefone atual. O script usa ações reais do app: escreve e vincula uma nota, cria tarefa e projeto para a busca e cria um Cofre em memória com kit de recuperação e três itens. Financeiro e Hábitos são recortados no que os dados de exemplo preenchem (despesas do mês por categoria e hábitos do dia); o texto não promete o histórico que a demonstração não tem. Nas telas de celular, o conteúdo que já rolou para trás do cabeçalho flutuante fica invisível, sem mudar o layout, para a captura não mostrar fragmentos nas bordas. Drive e Integrações saem da navegação pelo veto simulado da própria demonstração. Os exemplos que citavam marcas, clientes e jargão interno recebem nomes neutros apenas no texto; interface, valores e comportamento continuam os do app. A foto ilustrativa do perfil, sem origem documentada para uso público, é substituída pelo ícone de conta sem foto. Cada arquivo carrega a origem no EXIF e num registro lateral `.json` lido por `impeccable embed-prompt --scan`; a página informa no rodapé que as telas usam dados fictícios.

Não havia ferramenta de geração de imagens neste ambiente; nenhuma imagem conceitual foi criada.

## Verificação

Em 12/10/2026, sobre um build de produção em modo demonstração, no Windows 11:

- `typecheck`, `lint`, `check:layers`, `check:design-system` (164 pares de contraste), `check:secrets`, `check:sql-editor`, `check:client-auth`, `check:impeccable` e `test:local-sql`: aprovados.
- `vitest`: 117 arquivos e 1760 testes aprovados.
- Fusos UTC e America/Sao_Paulo: 1760 de 1760 em cada um, com dois processos de teste. No paralelismo padrão um processo caiu por falta de memória desta máquina, sem falha de asserção.
- `tests/e2e/conheca.spec.ts`: 12 de 12, incluindo a pergunta parada e a troca de tema; portões visuais de todas as rotas em 320, 390 e 768px, claro e escuro: 6 de 6.
- Suíte E2E completa: 227 aprovados. Quinze testes falham de propósito fora do Linux (SQL e porte visual exigem o CI Linux) e 14 não rodam por pertencerem a esses blocos.
- `test:scripts`: 17 testes de backup, restauração e do resolvedor de raiz do Next falham igualmente numa cópia do repositório sem estas mudanças; dependem do layout de pastas desta máquina e ficam para o CI.
- Impeccable: detector sem achados em `src/components/features/conheca` e `src/app/conheca`; `embed-prompt --scan` com 31 imagens e nenhuma sem origem; a revisão final pediu uma rodada de correções e, na verificação, pontuou as oito como resolvidas (disposição `ship`, restrita a essas correções).

## Pendências

- Domínio próprio, liberação da indexação e `sitemap`.
- Destino comercial do botão "Quero acesso" e política de privacidade/termos públicos.
- Analytics: a CSP atual não permite serviços de terceiros.
- Link para `/conheca` a partir de outras páginas públicas, se desejado.
- Revisão humana em aparelhos físicos Android e iOS.
