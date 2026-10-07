# T-005 — PWA e limites de validação

Implementação revisada em 07/10/2026. A issue #12 permanece aberta até testar instalação em Android e iOS físicos, com capturas. Chromium automatizado e viewport emulada não equivalem a essa prova.

## Implementado

- `manifest.ts`: identidade, janela standalone, escopo próprio, ícones comuns e maskable em 192/512px, atalhos Capturar/Tarefas/Financeiro e share target multipart.
- Apple touch icon e 22 splash em retrato, em claro/escuro e classes de viewport/DPR documentadas. `npm run pwa:assets` usa Sharp fixado no lockfile e a geometria histórica da marca; hashes e dimensões em `design-system/pwa-assets.json`. Dispositivos fora dessas classes usam o comportamento de abertura da plataforma.
- Serwist 9.5.13, desativado no servidor de desenvolvimento. O build produz `public/sw.js` ignorado pelo Git. A versão nova espera as janelas antigas fecharem; não força mistura de bundles.
- Precache exclusivamente de `/offline`, arquivos imutáveis `/_next/static/` e imagens públicas de marca. Entradas dos ícones/splash são explícitas, com revisão SHA-256. O plugin ignora `globPublicPatterns` quando há `additionalPrecacheEntries`, detalhe corrigido na revisão independente.
- Navegação usa rede com fallback público offline. APIs, escritas, páginas pessoais, RSC e URLs assinadas não recebem cache de runtime. Leitura de snapshots/outbox autenticada pertence à etapa posterior e precisa de política própria de isolamento/limpeza.
- Convite de instalação só em Configurações. O provider raiz retém o evento do navegador antes da pessoa visitar a tela. Não é exibida confirmação de instalação sem evento real `appinstalled`/standalone; aceitar o prompt informa apenas a solicitação.
- `/compartilhar/receber` aceita POST e redireciona ao placeholder. Não lê, registra ou persiste o payload; a página diz para conservar o original.

## Evidência

- Build, tipos, lint, camadas e 164 pares de contraste aprovados.
- **94 testes de unidade/contrato da fundação** e **74 E2E** aprovados localmente. O núcleo T-007, desenvolvido em paralelo, terá relatório e commit próprios.
- Verificação real de `Page.getInstallabilityErrors` no Chromium: nenhum erro; ícones/manifest carregados, service worker ativo.
- Cache inspecionado por URL, incluindo ícones/splash/fontes/scripts; rota pessoal demonstrativa ausente do cache. Com a rede desligada, uma nova navegação exibe a orientação offline; reconexão funciona pelo botão.
- 108 observações de rotas nos portões visuais, overlays abertos e provas negativas: [auditoria](t005-visual-guards.md). O portão encontrou o link Raios com 40,45px; foi ajustado para o alvo mínimo de 44px.
- Detector Impeccable engine 0.1.6 sem achados. Dependências de produção: `npm audit --omit=dev` com zero vulnerabilidades na verificação desta entrega. A pendência da cadeia de ferramentas de desenvolvimento continua em #36.
- Resultado remoto do CI e artefatos de navegador registrados na issue após o push. Não confundir a evidência local com conclusão remota antecipada.

## Critério ainda pendente

O Lighthouse removeu a categoria PWA na versão 12. A substituição por verificação do Chromium está registrada em OP-006, com [fonte oficial](https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0). Falta instalar e abrir em Android/iOS reais sob HTTPS, conferir ícone/splash/standalone/safe areas/offline, registrar aparelho/versão e anexar capturas. Nenhum serviço externo ou banco foi modificado para simular essa aprovação.

Referências técnicas consultadas: [Serwist com Next.js](https://serwist.pages.dev/docs/next/getting-started), [PWA no Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps).
