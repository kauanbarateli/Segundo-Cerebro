# Instalação reproduzível das dependências — 13/10/2026

A reconferência da #36 identificou divergência local: o lock exige o alias restrito `tinyglobby@0.2.17` no plugin Next, mas o plugin instalado em Main resolvia `fast-glob@3.3.1`. O agente observou três regressões aprovadas e uma falha nessa instalação; `npm audit --package-lock-only` aprovou zero vulnerabilidades em 604 registros, sem certificar a árvore instalada.

O [relatório público original do agente](evidence/dependency-release-recheck-20261013.json) conserva sua reprodução independente: quatro arquivos públicos byte iguais, instalação exclusiva de 477 pacotes com `npm ci --ignore-scripts` e **4/4 regressões aprovadas**. Não alterou Main, manifests ou lock.

Após os testes paralelos em Main terminarem, Root reconstituiu `node_modules` pelo lock, com `npm ci --ignore-scripts`, sem executar scripts de instalação. Essa rodada informou **475 pacotes adicionados**; não se herda a contagem 477 da pasta isolada. Manifest e lock permaneceram nos hashes originais `3059287dd0f9bfeba6d1e627d7daba7543d7dd1bb25e017ff282c586577e08ba` e `f35dd10194b2b7c3ead7f79b811638f9f36b4c92ea4ce041c4b0e8e94468c38a`.

Em Main reparado, Root repetiu as **4/4 regressões de lint** e **6/6 testes de preflight**, total **10/10**, sem falhas/skips. Isso corrige a instalação local; não modifica o produto, publica um novo patch upstream ou reclassifica os runs nativos Admin/Recovery.

A #36 conserva o limite de manutenção: [Next 16.4.0](https://raw.githubusercontent.com/vercel/next.js/v16.4.0/packages/eslint-plugin-next/package.json) ainda traz fast-glob, e o [plugin React publicado](https://registry.npmjs.org/eslint-plugin-react/7.37.5) não admite ESLint 10. A instalação informou o aviso de suporte encerrado do ESLint 9, consistente com o [registro oficial](https://eslint.org/version-support/). Não houve downgrade, alteração de peers, regra desabilitada ou waiver. A mitigação restrita permanece necessária; esta correção local não encerra a issue.
