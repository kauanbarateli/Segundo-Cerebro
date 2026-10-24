# T-054 — exibição privada das imagens de Metas (E1-B1)

Candidato de interface somente leitura sobre bafc9f654d43c2b952d0c0835e89893a6598e29e. A base real inclui o Cancelar de Root em GoalDetail e a prop correspondente no GoalsPanel; ambos são preservados. Nenhum picker, reserva, upload, finalize, setter, edição de imagem, comando financeiro, SQL ou flag é acrescentado nesta fatia.

## Implementado

- GoalCard recebe capa opcional privada16:9 acima do corpo (16:8≤600px). A capa inteira abre o detalhe pela ação já existente, com rótulo acessível; imagem decorativa não duplica o título. O botão conserva alvo mínimo44 e foco com anel em duas cores dos tokens, inclusive sobre a foto. Card compacto usa foto de borda a borda e padding16 no conteúdo, preservando cabeçalho/controles e destaque explícito.
- GoalDetail agrupa o conteúdo existente à direita de uma imagem opcional: minmax(120px,.75fr) + minmax(0,1.4fr), gap24, imagem até340px. Em610px com padding24, o conteúdo útil562px menos gap dá aproximadamente188px/350px. Sem imagem/erro, a coluna some. Até600px é uma coluna com imagem150px acima. O formulário permanece em duas colunas até350, quando se reduz a uma.
- Leaf GoalImage aceita somente UUIDs de owner/Meta/arquivo e delega a PrivateImage existente. Fonte vem da projeção de Meta própria já validada no canal; não se recebe URL, bytes, tokens, objeto File ou origem remota. Sem ID válido, nem monta o leitor. A rota autenticada existente decide a leitura; uma imagem renderizada não substitui a prova/finalização de E1-A.
- PrivateImage mantém estado de falha keyed por owner:file; GoalImage também é keyed por owner:goal:file, e a sessão da superfície já remonta por owner:epoch. Nenhum callback de rede novo pode atualizar outra instância. O fallback nominal é apenas um marcador de DOM. CSS :has(img) abre as áreas; no onError o marcador substitui a imagem, capa/coluna recolhem e o vínculo não é apagado. Browsers sem suporte a :has mantêm essas áreas ocultas e o conteúdo textual em uma coluna, sem criar uma coluna vazia.
- Os formulários, Cancelar, revisão/confirmacão CAS, recibo/journal, máscara de dinheiro/percentual/geometria e44px/16px existentes não são alterados. A foto é contexto da Meta, não valor monetário. Não foi acrescentada animação, zoom de hover ou cor nova; reduced-motion conserva o comportamento existente.

## Contratos preservados

A leitura usa PrivateImage→fileReadUrl→/api/files/read com dono/UUID. Nenhum otimizador público, bucket público, URL arbitrária, signed capability persistida, setter genérico ou autoconcessão de Drive. Falha404/403/corrupção só remove a apresentação nesta montagem: não remove referência, não envia comando e não tenta upload/reconexão. Nome/alvo/reserva/liberação e disponibilidade não são recalculados pela imagem. Selecionar/trocar/remover/confirmar uma imagem continua fora desta fatia E1-B1.

GoalsPanel, GoalEditor, PrivateImage, teste E2E,26 migrations canônicas e Vercel estão fora da autoria. A dependência visual nova do grafo é o leaf, que alcança PrivateImage e seu layout/private-image.css compartilhado. Root precisa incluir esse CSS na allowlist/concatenação do harness E2E isolado já existente. As capturas com foto exigem fixture pública e resposta sintética de imagem na rota de leitura; não devem usar dados/URLs pessoais nem uma URL demo dentro do produto. Root é dono do harness/capturas.

## Validação e pendências

Validado nesta autoria: leitura de AGENTS, Impeccable local e referências operate/adapt/craft-floor; comparação com doc17 JS/CSS/captura pública; diff textual e hashes de preservação. Nenhum launcher/detector, Node, lint, typecheck, teste, browser, rede ou serviço foi executado. Não há claim de renderização ou contraste medido.

Root/CI deve conferir: fotos próprias/carregamento/falha/troca de dono e de fileId; zero request quando id ausente/inválido; ausência de qualquer escrita; fallback recolhendo card/detalhe sem alterar referência; teclado/foco da capa e Cancelar;320/390/768/1024/1440, temas claro/escuro/Sistema, zoom200%, reduced-motion, nome longo e imagem muito larga/vertical;44×44, campos16, zero overflow e contraste real dos anéis/textos. Comparar PNGs do detalhe com o protótipo, deixando a revisão financeira real em duas etapas. Conferir DOM/aria da máscara e que a capa não adicionou números ocultos. Essas verificações ainda não foram executadas por esta autoria.

E1-A permanece proposta SQL inerte até promoção supervisionada/revisão/CI próprios. Esta exibição não habilita criação de imagem, Core lookup, schema, rollout ou abertura comercial. Merge/deploy e aceites conectados continuam com Root.

## Composição Root para o CI

Os cinco arquivos foram transportados por hashes para a composição sobreeb6d8ac, preservando o Cancelar e a correção dos canais. Houve peer independente do display e dos reforços de SQL. O lint dos17 TypeScript/TSX compostos passou, sem erros/avisos; as alterações posteriores do harness recebem lint focal próprio antes do commit.

O harness inclui o CSS privado alcançado pelo import e serve somente o documento sintético e a leitura GET da imagem pública original do protótipo, vinculada ao owner/id fixos. Qualquer requisição inesperada é negada e faz o teste falhar. São escritos32 PNGs por conjunto E2E: lista/editor/detalhe sem foto, card/detalhe com foto em320/390/1440 e claro/escuro, além do destaque compacto390 nos dois temas. A fixture compacta inicia com destaque explícito próprio, sem selecionar automaticamente no produto.

Os negativos403/corrupção conferem recolhimento geométrico da coluna, referência preservada e zero comandos; o fechamento por Cancelar confere foco. O asset de paisagem permanece arquivo de teste/documentação, sem inserção como imagem padrão em contas reais. Nenhuma captura ou resultado de navegador é presumido antes do CI deste candidato. Picker, upload e vínculo de uma imagem escolhida pelo usuário continuam pendentes da fatiaE1-B2 e do protocolo financeiro terminal.
