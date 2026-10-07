# T-003 — Registro de validação

Escopo: [issue #10](https://github.com/kauanbarateli/Segundo-Cerebro/issues/10), primitivas de nível 1. T-002 foi concluído no commit `282e7b2`, com [CI aprovado](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37574692462), antes de iniciar esta implementação.

## Implementado

Button com quatro variantes, três tamanhos, loading embutido e disabled; Card bento com superfícies clara/inversa/suave e borda ou sombra; Badge e PillButton; Field compartilhado com input/textarea/select; 47 ícones e marca tokenizada. O seletor de tema usa Field. A página `/design-system` permite testar ações locais, erros, carregamento, seleção e navegação por teclado. APIs e estados estão em [src/components/ui/README.md](../../src/components/ui/README.md).

Utilidades históricas `sb-target-44`, `eyebrow`, scrollbar fina e `toast-out` foram portadas com as correções vigentes de D-030. As primitivas têm alvo real ≥44px; a utilidade de ampliação está disponível para desenhos menores. Eyebrow preserva caixa normal; Toast completo pertence a T-006.

O lint proíbe elementos de entrada nativos fora de Field e constantes paralelas herdadas como inputCls. O teste primeiro falhou nos quatro casos proibidos e passou após a regra; os casos permitidos continuam aceitos. O teste de loading também falhou no build T-002, que ainda não continha as primitivas, e passou após integração.

## Revisão e correções

Três agentes implementaram partes independentes. Root integrou e revisou diffs, contratos e evidências. Revisões cruzadas de Spec e Standards não deixaram achados materiais pendentes.

- Removido alias de tipo duplicado remanescente no porte de Icons, detectado pelo TypeScript integrado.
- Corrigido contraste de label, ajuda, carregamento e foco de Field dentro de Card inverse; erro recebeu superfície opaca própria com danger-ink. Os testes verificam as cores renderizadas dessa composição nos dois temas.
- Não foi portado o danger-solid antigo com contraste insuficiente. Button danger usa superfície neutra e danger-ink.
- A geometria dos 47 SVGs foi comparada ao snapshot histórico, preservando desenhos e traço1.75; nome acessível pertence ao elemento que usa o ícone. A marca preserva sua geometria e usa texto HTML em Geist.

## Validação

- `npm run check`: TypeScript, ESLint, 67 testes de unidade/contrato, fronteiras de arquitetura, validador DS com 164 pares e build aprovados.
- `npm run test:e2e`: 34 casos aprovados. Cobrem os cenários anteriores e loading sem envio duplicado, mensagens de campo associadas, foco no erro, seleção via teclado, 47 ícones, marca, alvos44, fonte de campo16, foco duplo, hover/pressed/disabled/readOnly/loading e movimento reduzido.
- Contraste renderizado de botões, badges, cartões e textos de campo medido nos temas claro/escuro, incluindo hover, loading e inversa. Texto ativo mantém ≥4.5:1.
- Após ampliar a captura mobile e a medição de loading, os seis casos de primitivas foram confirmados novamente. Não se contam como testes adicionais.
- Inspeção visual em lote de desktop claro/escuro e mobile, sem cortes ou transbordo. Verificação responsiva completa em 320/390/768/1280px.

Capturas: [desktop claro](evidencias/t003-desktop.png), [desktop escuro](evidencias/t003-dark.png), [mobile em carregamento](evidencias/t003-mobile.png).

O resultado do CI para este commit será registrado na issue antes do fechamento. A evidência local não substitui essa confirmação remota.

## Limites e próximos tickets

O formulário de demonstração não envia nem persiste dados. O indicador de loading mantém o rótulo, mas pode ampliar a largura do botão; os layouts testados permitem essa ampliação. Cartões e badges estáticos não recebem estados de interação artificiais.

T-004 entrega a navegação do aplicativo e T-006 as superfícies e componentes de dados. T-005 ainda exige PWA e evidência em aparelhos físicos. A issue #36 continua acompanhando a dependência de lint sem correção compatível. Nenhuma alteração ou aplicação de banco/migrations ocorreu.
