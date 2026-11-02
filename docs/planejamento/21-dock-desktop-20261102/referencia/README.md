# Referência visual preservada

## O que cada arquivo representa

- [desktop.png](desktop.png): Início demonstrativo em 1440×900, claro, magnificação do Calendário.
- [desktop-dark.png](desktop-dark.png): Início demonstrativo em 1440×900, escuro, foco visível em Projetos.
- [floating-dock.tsx.txt](floating-dock.tsx.txt): fonte React/Motion da dock refinada, derivado do prompt fornecido pelo mantenedor (Floating Dock — ProfitizeBuild).
- [dock-preview.tsx.txt](dock-preview.tsx.txt): adaptador demo, lista fixa e seleção local; não usar como router real.
- [dock-preview.css.txt](dock-preview.css.txt): acabamento DS aplicado sobre fonte original; os seletores globais servem apenas à demonstração.
- [index.html.txt](index.html.txt): entrada HTML preservada da prévia.
- [preparar.mjs](preparar.mjs): reconstitui o ambiente isolado usando o snapshot doc17 já presente no repositório.
- [manifest.json](manifest.json): SHA-256 de cada arquivo de referência. Não inclui a si próprio.
- [MOTION-LICENSE.md](MOTION-LICENSE.md): licença da biblioteca utilizada. Sem atribuir licença inventada ao trecho fornecido pelo usuário.

Os fontes estão como .txt para não entrar no typecheck global do produto. Não adicionamos React/Motion ao package.json da aplicação. Biblioteca original: Motion 12.43.0; React/React DOM 19.2.8; esbuild 0.25.12. Reavaliar versão e auditoria ao integrar de verdade.

## Reproduzir a prévia em outro computador

Na raiz de um checkout contendo este pacote e o doc17:
```sh
node docs/planejamento/21-dock-desktop-20261102/referencia/preparar.mjs
cd work/dock-reference-20261102
npm install
npm run build
npm run preview
```

Abrir http://127.0.0.1:3109/#/inicio. Sem .env, conta ou Supabase. O script recusa destino existente e não apaga arquivos; para repetir escolha um diretório novo com argumento, por exemplo `node .../preparar.mjs work/dock-reference-2`. Diretório deve estar sob work da raiz; não escrever dentro de src/public. O npm instala somente no diretório gerado. Os pins fixam dependências diretas; o primeiro install resolve transitivas e gera lockfile local, não há promessa de build byte a byte idêntico.

O servidor só entrega arquivos estáticos locais. O protótipo usa dados de exemplo e seu próprio storage demo. Os ícones da dock **apenas marcam seleção** e não implementam navegação de produção.

## O que NÃO transportar

- O componente contém ramo mobile histórico para reproduzir o experimento; está **fora do plano**. Não implementar no produto, mesmo que funcione na prévia.
- Sidebar globalmente escondida, breakpoint de 768 px, 11 itens hardcoded, window.App, dados fictícios e seleção local não são arquitetura válida para a aplicação.
- Tooltip do experimento tem pointer-events:none. A implementação deverá cumprir hover persistente/Escape/foco e demais aceites, não copiar a limitação.
- MotionConfig sozinho não é prova de redução de movimento em valores animados. O fonte já evita pointer tracking com reducedMotion, mas a implementação precisa testar mudanças dessa preferência durante hover.
- Esta prévia não contém o seletor de Configurações. Seu layout e seus estados estão especificados no [documento 02](../02-layout-e-interacoes.md).
- Sem deploy nesta publicação; não colocar o protótipo sob uma rota pública do app.

## Evidência e limites

As duas capturas vieram da prévia local revisada com Impeccable, não de produção nem da main atual. Testes originais no Edge headless verificaram tooltip, controles, foco, limite de largura e movimento reduzido. Não comprovaram autorização, persistência da opção, SSR, CSP, desempenho de toda a aplicação ou navegação real. A referência tem aparência aprovada para planejamento, não dispensa revisão do delta integrado.
