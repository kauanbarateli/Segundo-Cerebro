---
version: 1
slug: "src-app-conheca-page-tsx"
primary_target: "src/app/conheca/page.tsx"
related_targets: ["src/components/features/conheca"]
---

# Apresentação pública — /conheca

## Superfície e modo

**Persuade.** Rota pública `/conheca`; entrada `src/app/conheca/page.tsx`, composição em `src/components/features/conheca/`. Não substitui `/` autenticado nem o login. Preserva Geist, marca, cores e o mundo DS 2.1 aprovado em DESIGN.md.

## Público, tarefa e ação

Pessoas que espalham ideias, tarefas, agenda e registros por vários aplicativos. Precisam reconhecer em segundos o que o Segundo Cérebro faz, ver telas reais e entender o estado do acesso. A ação principal é percorrer os recursos e chegar ao aviso de acesso fechado. Conta existente entra por `/entrar`; não há preço, inscrição, checkout, pagamento ou abertura comercial. D-077 autoriza a landing e o onboarding autenticado, sem criar inscrição pública.

## Atualização de direção aprovada

Doc 17 e D-077 substituem a extensão das **seis perguntas** por **três capítulos: Captura, Agenda e Projetos**, com prévia alternável Projetos/Kanban. A escolha anterior “Seis perguntas” (seed 4115d4a0, posição 2) é histórica; sua coreografia sticky e seu mundo visual são preservados, não um compromisso com seis seções. O preço e o checkout do HTML de referência ficam fora desta implementação por decisão explícita do mantenedor.

A abertura conserva “Capture agora. Encontre depois.”, uma chamada curta, o CTA “Ver como funciona”, três âncoras e a hero real do Início. A faixa inversa resume os movimentos; os capítulos alternam texto/tela; princípios, demonstração declarada, acesso e legais encerram a página. Os módulos Financeiro, Hábitos e Cofre continuam identificáveis no panorama e nos princípios, sem capítulos redundantes.

## Prova, composição e interação

- Telas são capturas reais do app em demonstração, com dados fictícios e nomes neutros, nunca screenshots do HTML/maquetes anunciados como produto. Reutilizar Início/Captura/Projetos com proveniência existente; Agenda Lista/Kanban exigem seus oito novos WebPs e sidecars reais qualificados. Antes disso a integração permanece pendente, sem build declarado.
- Cada cena tem claro/escuro e variante mobile. O tema escolhido no rodapé e o tema do aparelho continuam resolvendo os quadros existentes. Hero prioritária permanece separada do conteúdo client; demais capturas lazy. Abaixo de 768px usa-se a imagem mobile; o seu tamanho vem do recibo de captura, sem inventar dimensão pelo viewport.
- A partir de 1024px e 600px de altura, os três capítulos conservam o percurso corrigido no Edge: 56vh de subida,16vh de pausa, texto e tela sticky alinhados abaixo do cabeçalho. Sem suporte ou com movimento reduzido, a escala não anima; conteúdo permanece visível. Em largura menor/tela baixa a leitura é linear. Fallback e texto ampliado permanecem alcançáveis após liberar o sticky.
- Projetos/Kanban são tabs locais: seleção identificada por texto/estado/linha, uma tab no percurso Tab, setas/Home/End alternam e focam; o painel inativo fica hidden. Trocar a prévia não muda URL, dados ou filtros do produto. Sem JavaScript, Projetos continua visível. Sem autoplay, carrossel, foco por efeito ou animação adicional.
- Alvos ≥44px, foco visível, uma h1, headings e âncoras semânticos, aviso role=status, links legais e login permanecem. Sem novos tokens, telas falsas, padrões de cores ou biblioteca de animação.

## Direction contract

THESIS: reconhecer ideias, tempo e planos em três cenas reais, sem uma vitrine de cartões repetidos.

OWN-WORLD: neutros quentes DS 2.1, acento monocromático, Geist, linhas finas, faixa inversa e capturas com uma única borda. A identidade permanece a mesma.

STORY: capture uma ideia, enxergue seu dia, avance um projeto; veja como os registros se ligam e conheça o estado honesto do acesso.

FIRST VIEWPORT: marca e navegação, título autoral, chamada curta e três atalhos; hero real do Início cortada pela dobra.

FORM: três capítulos e alternância local de duas prévias no terceiro, preservando a coreografia da estrutura anterior.

FINISH: checks de código e evidência visual nos dois temas/desktop/mobile após assets reais; testes escritos ou snapshot não equivalem à validação do produto integrado. Indexação permanece fechada, analytics fora e oferta comercial pendente.
