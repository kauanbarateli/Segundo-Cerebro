# T-001 — Registro de validação

Data: 07/10/2026. Escopo: [issue #8](https://github.com/kauanbarateli/Segundo-Cerebro/issues/8), fundação do aplicativo. Este registro não atesta M0 completo nem funcionamento dos módulos futuros.

## Implementação e origem

Next 15.5.27, React 19.2.8, TypeScript estrito, Tailwind 4 e Geist local. Planejamento, glossário, ADRs e skills preservam as origens registradas nas [decisões operacionais](decisoes-operacionais.md). Página provisória herda a identidade DS 2.1; migrations não foram criadas nem aplicadas porque não houve alteração de banco.

## Validação local

- `npm ci`: instalação reproduzível a partir do lockfile, sem variáveis de aplicação.
- `npm run typecheck` e `npm run lint`: aprovados.
- `npm test`: 6 casos de contrato aprovados. Núcleo recusa framework/adapters; UI recusa features; módulos de features não se importam; componentes não alcançam banco; dependências internas puras são permitidas.
- `npm run check:layers`: nenhuma violação na aplicação.
- `npm run build`: aprovado sem credenciais e sem requisição de fonte ao Google.
- `npm run test:e2e`: 7 casos aprovados, incluindo 320/390/768/1280px, ausência de erro de navegador, idioma, título, skip-link, destinos e alvos dos links, cores do tema e movimento reduzido.
- `npm audit --omit=dev`: zero vulnerabilidades. Audit completo: cadeia de lint pendente em [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36).
- Revisão de segredos e trailers adicionais: nenhum achado no conteúdo final. O diagnóstico histórico foi ajustado conforme OP-003.

O primeiro teste do contrato reprovou sem a configuração. Após implementação, os casos negativos continuam comprovando recusa e o caso permitido passa. O código de saída do dependency-cruiser expressa quantidade de violações: o teste exige resultado positivo e a regra esperada, não um valor fixo igual a 1.

## Revisão Standards

Revisor independente encontrou um teste de tema/movimento que verificava apenas a preferência emulada. Correção incorporada: comparação da cor de fundo renderizada e verificação de transições/animações computadas. Nenhum outro achado material registrado.

## Revisão Spec

Revisor independente não encontrou desvio material de T-001. Confirmou as cinco etapas de CI, o bloqueio do Núcleo, as conciliações D-019 e a integridade das 26 skills em 133 arquivos por espelho. A execução do CI remoto e a prova de falha/reversão são registradas abaixo após sua conclusão.

## Inspeção visual

Conferência em lote de desktop, 320px e tema escuro, sem transbordo ou conteúdo cortado. A identidade preserva marca, neutros quentes e painéis do planejamento; a página informa seu estado provisório sem simular módulos disponíveis.

- [Desktop](evidencias/t001-desktop.png)
- [Mobile](evidencias/t001-mobile.png)
- [Escuro](evidencias/t001-dark.png)

Essas imagens e testes não substituem os futuros testes físicos de instalação Android/iOS de T-005.

## CI remoto

Pendente de execução após o primeiro push. A prova negativa será feita em branch própria, com import de framework no Núcleo e posterior reversão; nenhum defeito deliberado será incorporado em `main`.
