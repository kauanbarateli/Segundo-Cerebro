# Segundo Cérebro

O novo Segundo Cérebro começa pela fundação: Next.js 15, React 19, TypeScript estrito e Tailwind 4, com uma página inicial provisória e verificações de arquitetura e navegação. O planejamento original está em [docs/planejamento](docs/planejamento/00-indice.md).

## Executar

Use Node.js 24 LTS (registrado em `.nvmrc`) e npm. Não é necessário criar `.env` nem conectar um banco para esta etapa.

```sh
git clone https://github.com/kauanbarateli/Segundo-Cerebro.git
cd Segundo-Cerebro
npm ci
npm run dev
```

Abra `http://localhost:3000`. Para a versão de produção local: `npm run build` e `npm start`. A fonte Geist é empacotada localmente; o build não busca fontes no Google.

## Validar

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` executa typecheck, lint, testes, contrato de camadas e build. Os testes de navegador usam o build em `http://127.0.0.1:3100`; mantenha essa porta livre. O CI executa os mesmos portões, instala Chromium e preserva relatórios em caso de falha.

O teste de arquitetura planta imports proibidos em fixtures e verifica a recusa pelo dependency-cruiser. Testamos as fronteiras já aprovadas em SPEC-01: grafo de dependências e DOM da rota, sem testar detalhes internos de componentes.

Em 07/10/2026, `npm audit --omit=dev` não apontou vulnerabilidades. O override de PostCSS 8.5.29 corrige a versão transitiva do Next 15. O audit completo ainda aponta a cadeia de desenvolvimento `eslint-config-next → braces`, sem correção publicada na consulta; o acompanhamento está na [issue #36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36). Não usar `npm audit fix --force` para rebaixar o framework/config.

## Estrutura

| Pasta | Responsabilidade |
| --- | --- |
| `src/app` | Rotas e composição do canal web |
| `src/core` | Núcleo: regras e contratos de domínio independentes de framework/SDK |
| `src/adapters` | Implementações dos contratos, por integração |
| `src/components/ui` | Primitivos visuais compartilhados |
| `src/components/layout` | Moldura e navegação |
| `src/components/features` | Interfaces por funcionalidade, independentes entre si |
| `src/lib` | Infraestrutura do canal web |
| `tests` | Contratos e jornadas observáveis |
| `docs/adr` | Decisões de arquitetura |
| `docs/planejamento` | Planejamento, referências e evidências de setembro de 2026 |
| `docs/prototipo` | Demonstração histórica; não é o aplicativo de produção |

As pastas ainda vazias estão reservadas pelos ADRs. Não há autenticação, persistência, módulos funcionais ou PWA nesta primeira entrega. Esses incrementos pertencem aos tickets seguintes.

## Trabalho e decisões

O tracker canônico é [GitHub Issues](https://github.com/kauanbarateli/Segundo-Cerebro/issues). Consulte [CONTEXT.md](CONTEXT.md), [AGENTS.md](AGENTS.md), [decisões operacionais](docs/implementation/decisoes-operacionais.md) e [T-001](docs/planejamento/13-tickets.md).

O destino atual é este repositório; nomes e caminhos antigos no planejamento são evidência histórica. `segundo_cerebro` e `novo-segundo-cerebro` são fontes somente de leitura.

Alterações de banco serão migrations versionadas para **execução manual posterior**, conforme [contrato de migrations](migrations/README.md). Não há aplicação automática nem credenciais de produção neste projeto.
