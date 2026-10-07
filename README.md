# Segundo Cérebro

O Segundo Cérebro reúne organização pessoal, tarefas, hábitos, calendário, finanças e conhecimento. A etapa M1 está concluída: os módulos são navegáveis e as operações demonstrativas compartilham uma sessão em memória. Recarregar restaura os exemplos. A base usa Next.js 15, React 19, TypeScript estrito e Tailwind 4. O planejamento original está em [docs/planejamento](docs/planejamento/00-indice.md).

## Executar

Use Node.js 24 LTS (registrado em `.nvmrc`) e npm. O modo padrão é `demo`: não é necessário criar `.env` nem conectar um banco.

```sh
git clone https://github.com/kauanbarateli/Segundo-Cerebro.git
cd Segundo-Cerebro
npm ci
npm run dev
```

Abra `http://localhost:3000` para usar a demonstração e `/design-system` para conferir os fundamentos visuais nos temas claro, escuro e sistema. Configurações permite explorar coleções vazias e falhas recuperáveis. Para a versão de produção local: `npm run build` e `npm start`. A fonte Geist é empacotada localmente; o build não busca fontes no Google.

## Validar

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` executa typecheck, lint, testes, contrato de camadas, tokens/contraste, integridade do pacote SQL Editor, build e varredura do bundle público de Auth. Os testes de navegador usam o build em `http://127.0.0.1:3100`; mantenha essa porta livre. O CI executa esses portões, parsing SQL sem banco, testes nos dois fusos, Impeccable e Chromium, preservando relatórios em caso de falha.

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
| `design-system` | Tokens DS 2.1, gerador, validador e origem visual |
| `src/lib` | Infraestrutura do canal web |
| `tests` | Contratos e jornadas observáveis |
| `docs/adr` | Decisões de arquitetura |
| `docs/planejamento` | Planejamento, referências e evidências de setembro de 2026 |
| `docs/prototipo` | Demonstração histórica; não é o aplicativo de produção |
| `supabase/migrations` | SQL versionado, com aplicação exclusivamente manual posterior |
| `supabase/tests` | Asserções de banco preparadas para execução manual em ambiente dedicado |
| `supabase/sql-editor` | Cópias numeradas das migrations com manifest de integridade SHA-256 |

As [primitivas compartilhadas](src/components/ui/README.md) têm demonstrações interativas em `/design-system`. Capturar, Tarefas, Hábitos e Financeiro operam sobre os mesmos dados demonstrativos usados pelo Início. Os demais módulos oferecem navegação e estados próprios; Drive contém metadados e Cofre é uma maquete sem criptografia ou armazenamento de segredos. A PWA possui verificações automatizadas, com aceite em aparelhos reais ainda pendente na issue #12. Autenticação e persistência real pertencem à etapa M2.

O [relatório de M1](docs/implementation/t011-t012-integracao.md) registra a revisão dos agentes, evidência visual e CI aprovado com 614 testes em cada fuso e 130 cenários E2E. A [preparação de identidade e Auth](supabase/README.md) contém os arquivos de banco e distingue validação estática de testes ainda não executados.

## Autenticação e SQL Editor

T-014 implementa entrada, recuperação e troca de senha no servidor, cookies httpOnly, guards por página/operação e CSP em bloqueio. Sem configuração, as quatro telas de acesso informam indisponibilidade e não recebem senhas. O modo conectado é explícito: consulte [.env.example](.env.example) e o [runbook de Auth](docs/implementation/t014-auth-backend.md). Os módulos continuam usando exemplos em memória até a integração dos adapters; autenticar não os torna persistentes.

Por orientação do mantenedor, o desenvolvimento prossegue **sem conexão Supabase**. O [pacote para o SQL Editor](supabase/sql-editor/README.md) contém duas migrations numeradas, que devem ser revisadas e aplicadas manualmente, um arquivo completo por vez, em um projeto pessoal novo e dedicado. BlackSheep e Sistema VOE não podem ser usados. Asserções e bootstrap são separados; nenhum SQL foi aplicado. Configuração Auth/SMTP e variáveis de ambiente ficam fora do SQL Editor. O [relatório T-014](docs/implementation/t014-integracao.md) registra validações locais e critérios reais ainda pendentes.

## Trabalho e decisões

O tracker canônico é [GitHub Issues](https://github.com/kauanbarateli/Segundo-Cerebro/issues). Consulte [CONTEXT.md](CONTEXT.md), [AGENTS.md](AGENTS.md), [decisões operacionais](docs/implementation/decisoes-operacionais.md) e [T-001](docs/planejamento/13-tickets.md).

Os tokens e temas têm seu [registro de validação T-002](docs/implementation/t002-validacao.md). O [registro de validação de T-001](docs/implementation/t001-validacao.md) reúne revisão, testes, capturas e execuções do CI. A [correspondência dos tickets](docs/implementation/issues.md) liga o planejamento às issues e dependências nativas.

O destino atual é este repositório; nomes e caminhos antigos no planejamento são evidência histórica. `segundo_cerebro` e `novo-segundo-cerebro` são fontes somente de leitura.

Alterações de banco serão migrations versionadas para **execução manual posterior**, conforme [contrato de migrations](migrations/README.md). Não há aplicação automática nem credenciais de produção neste projeto.
