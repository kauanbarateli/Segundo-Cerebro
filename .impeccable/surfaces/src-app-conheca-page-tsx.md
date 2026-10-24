---
version: 1
slug: "src-app-conheca-page-tsx"
primary_target: "src/app/conheca/page.tsx"
related_targets: ["src/components/features/conheca"]
---

# Apresentação comercial — /conheca

## Superfície e modo

**Persuade.** Rota pública `/conheca`; entrada `src/app/conheca/page.tsx`, composição em `src/components/features/conheca/`. Não substitui `/` (Início autenticado) nem o login. Herda o mundo DS 2.1 aprovado em DESIGN.md; não é exercício de nova identidade.

## Público, tarefa e ação

Pessoas que hoje espalham ideias, tarefas, agenda, gastos e senhas por vários aplicativos e avaliam um sistema pessoal único. Elas precisam entender em segundos o que o Segundo Cérebro faz, acreditar que é real (telas do app, não maquetes) e saber o estado do acesso. Ação desta etapa: percorrer as perguntas e chegar ao bloco de acesso. O acesso público continua fechado; um link secundário permite a uma conta existente chegar a `/entrar`. Sem pagamento, preço, plano, formulário de inscrição ou redirecionamento comercial; o ponto de integração comercial fica isolado no código. D-077 inclui o onboarding autenticado de nove telas no MVP, sem transformá-lo em rota de inscrição a partir desta página.

## Prova e conteúdo

Telas reais do app em modo demonstração, com dados fictícios e nomes neutros, declaradas como tal na página. Afirmações limitadas ao que existe no código hoje; Drive, IA, grafo persistente, cobrança e integrações não entregues não aparecem.

## Direção escolhida

Estrutura "Seis perguntas", escolhida pelo mantenedor entre três estruturas sorteadas. Momento memorável: a pergunta fica presa no alto enquanto a tela real que a responde sobe ao encontro dela.

- A partir de 1024px de largura e 600px de altura, nos seis capítulos: a pergunta para abaixo do cabeçalho, a tela começa 56vh abaixo e sobe até alinhar com ela, as duas ficam juntas por 16vh e seguem juntas. A tela chega ao tamanho final no instante em que alcança a pergunta; com movimento reduzido ou sem linhas do tempo de rolagem, só a rolagem move a tela. O piso de 600px conserva a correção dos capítulos no Edge em janela normal.
- Abaixo de 1024px, coluna única sem pergunta fixa: a leitura já é pergunta, resposta e tela, e uma pergunta presa tomaria um terço do celular enquanto a captura passa. Em telas baixas (menos de 600px) os capítulos ficam lado a lado sem fixar. Fontes de fallback ou texto ampliado continuam alcançáveis após liberar o sticky.
- Telas por tema e largura: cada cena tem captura clara e escura, trocadas pelo tema do aparelho e pelo tema escolhido no rodapé; abaixo de 768px entra a captura de celular da mesma cena.

## Decisões em aberto

Indexação pública e destino comercial do CTA permanecem para a etapa comercial. O domínio e as páginas legais existentes não autorizam oferta ou preço por este recorte. Analytics não integra a entrega (CSP atual não permite terceiros). Atualização das capturas e o preview Projetos/Kanban dependem do produto integrado e de uma próxima rodada de evidências.

## Direction contract

THESIS: o produto se explica pelas perguntas que a pessoa já faz todo dia, cada uma respondida por uma tela real; recusa a vitrine de recursos em grade de cartões com ícones.

OWN-WORLD: neutros quentes do DS 2.1, preto como acento, um ou dois blocos inversos, Geist em escala de vitrine, linhas finas em vez de cartões, telas do app como objetos com raio 28px e uma única elevação.

STORY: a pessoa reconhece a dispersão, entende os três movimentos (capturar, conectar, reencontrar), vê seis respostas concretas, percebe que tudo se liga sem cópias, confia nos princípios verificáveis e encontra o estado honesto do acesso.

FIRST VIEWPORT: marca e âncoras no topo; título em vitrine "Capture agora. Encontre depois." com chamada curta; ação primária "Ver como funciona" e índice das seis perguntas como atalhos; abaixo, a tela real do Início ocupando a largura útil, cortada pela dobra.

FORM: "Seis perguntas", posição 2 de 7 na lista ordenada; seed key 4115d4a0 (mão sorteada 7, 2, 1; escolha do mantenedor: 2).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
