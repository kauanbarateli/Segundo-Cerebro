# Dependências — reconferência de upstream em 16/10/2026

Pesquisa somente em manifests e fontes oficiais públicas, com revisão de Root. Nenhum pacote/lockfile/override foi alterado; não houve instalação, novo npm audit ou teste por este recorte. A mitigação de [12/10](dependency-lint-mitigation-20261012.md) conserva seu escopo e suas provas próprias.

O [advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ainda informa braces até 3.0.3 afetado e nenhuma versão corrigida. O registry oficial mantém [braces latest 3.0.3](https://registry.npmjs.org/braces/latest); [micromatch 4.0.8](https://registry.npmjs.org/micromatch/latest) depende de braces ^3.0.3, e [fast-glob 3.3.3](https://registry.npmjs.org/fast-glob/latest) de micromatch ^4.0.8.

Há backport Next/config/plugin 15.5.28, mas o [plugin 15.5.28](https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/eslint-plugin-next/package.json) ainda fixa fast-glob 3.3.1. O [config 15.5.28](https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/eslint-config-next/package.json) admite ESLint 7/8/9 e hooks ^5; o [plugin 16.4.2](https://raw.githubusercontent.com/vercel/next.js/v16.4.2/packages/eslint-plugin-next/package.json) também mantém fast-glob 3.3.1. Portanto atualizar somente o patch do Next não elimina essa dependência nem justifica retirar o alias restrito.

ESLint 10.13.0 existe, mas os peers atuais de eslint-plugin-react 7.37.5, import 2.32.0 e jsx-a11y 6.10.2 ainda não admitem 10; hooks 7.1.1 já admite. A [política oficial de suporte](https://eslint.org/version-support/) mantém a necessidade de migrar a linha 9 após compatibilidade da cadeia inteira. Não forçar peers, rebaixar Next ou desligar regras para fabricar conformidade.

O PostCSS latest 8.5.30 merece avaliação própria de patch; não é razão para retirar o override vigente 8.5.29 nem foi aplicado nesta pesquisa.

**#36 permanece aberta.** Não há correção oficial compatível que permita remover agora a mitigação dessa cadeia. A pesquisa não declara segurança universal, aceite de release ou equivalência a audit recente. Próximo recorte: avaliar patches compatíveis em branch própria, repetir checks pertinentes se houver mudança e remover overrides somente quando a dependência principal trouxer cadeia segura.
