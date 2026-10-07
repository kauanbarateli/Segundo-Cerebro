# Segundo Cérebro

O Segundo Cérebro reúne organização pessoal, tarefas, hábitos, calendário, finanças e conhecimento. A etapa M1 está concluída: no modo demo, os módulos são navegáveis e compartilham exemplos em memória, restaurados ao recarregar. No modo conectado, Capturar e Tarefas já usam persistência da conta; os demais módulos continuam demonstrativos. A base usa Next.js 15, React 19, TypeScript estrito e Tailwind 4. O planejamento original está em [docs/planejamento](docs/planejamento/00-indice.md).

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
| `supabase/migrations` | SQL versionado, com aplicação supervisionada no projeto pessoal conforme OP-009 |
| `supabase/tests` | Asserções de banco separadas da instalação, com rollback em ambiente dedicado |
| `supabase/sql-editor` | Cópias numeradas das migrations com manifest de integridade SHA-256 |

As [primitivas compartilhadas](src/components/ui/README.md) têm demonstrações interativas em `/design-system`. O Início compartilha as consultas de Capturar e Tarefas: dados da conta no modo conectado, exemplos no modo demo. Hábitos, Financeiro e as demais áreas continuam demonstrativos, identificados na interface e separados dos registros persistidos. Drive contém metadados e Cofre é uma maquete sem criptografia ou armazenamento de segredos. A PWA possui verificações automatizadas, com aceite em aparelhos reais ainda pendente na issue #12. M2 continua em andamento.

O [relatório de M1](docs/implementation/t011-t012-integracao.md) registra a revisão dos agentes, evidência visual e CI aprovado com 614 testes em cada fuso e 130 cenários E2E. A [documentação de identidade e Auth](supabase/README.md) reúne os arquivos de banco, as validações executadas e os critérios ainda pendentes.

## Autenticação e SQL Editor

T-014 implementa entrada, recuperação e troca de senha no servidor, cookies httpOnly, guards por página/operação e CSP em bloqueio. Sem configuração, as quatro telas de acesso informam indisponibilidade e não recebem senhas. O modo conectado é explícito: consulte [.env.example](.env.example) e o [runbook de Auth](docs/implementation/t014-auth-backend.md). T-015 liga Capturar e Tarefas ao canal autenticado e ao adapter real, com transação, revisão e recibos idempotentes no servidor.

Quatro migrations foram aplicadas de forma supervisionada ao projeto pessoal. O [relatório de identidade/Auth](docs/implementation/t013-aplicacao-supabase.md) preserva os resultados das três primeiras migrations e asserções com rollback; o [relatório de persistência T-015](docs/implementation/t015-persistencia.md) registra a quarta, `20261007210519_capture_task_transactions.sql`. O [pacote para o SQL Editor](supabase/sql-editor/README.md) continua disponível para revisão, sem aplicação automática por CI/build/deploy. BlackSheep e Sistema VOE não podem ser usados. Configuração Auth e variáveis de ambiente ficam fora do SQL Editor; SMTP e recuperação por e-mail estão postergados.

Categorias e Projetos são referências somente de leitura, sem seed. Anexos de imagem e organização em Conhecimento continuam indisponíveis no modo conectado; upload depende da integração restante de T-015 e Conhecimento pertence a T-021. A integração local passou `npm run check` com 841 testes da aplicação e 29 testes isolados, além dos 140 E2E de regressão. No serviço real, passaram 18 etapas de protocolo e 13 cenários de navegador conectado, com limpeza conferida das contas temporárias. Escopo e limites estão no relatório; T-015 permanece aberta.

A primeira conta possui papel `master` ativo e e-mail confirmado. O [ensaio real de Auth](docs/implementation/t014-auth-real.md) aprovou isolamento e revogação via SDK, além de dez verificações de navegador com contas sintéticas; login, troca de senha, logout e sexta tentativa bloqueada passaram. As quatro contas temporárias das duas tentativas e seus quatro hashes do limitador de login foram removidos, com ausência confirmada; o master permaneceu intocado. Cadastro público fechado, HTTPS/refresh reais, SMTP/PKCE e concorrência simultânea ainda exigem validação. T-014 continua aberta nos critérios não demonstrados; esse ensaio não substitui o aceite de persistência de T-015.

```sh
npm run auth:check
npm run test:auth-env
```

`auth:check` faz somente diagnóstico local: lê o ambiente do processo e, se existir, apenas `.env.local` deste repositório, sem imprimir valores. Confere o projeto pessoal autorizado, origins, formatos das chaves e segredos HMAC. `ready` indica configuração local preparada; `supabaseMode` e `authEnabled` informam separadamente o modo. A verificação também funciona em `demo`, retorna código 1 para falta/invalidade e não altera modo, arquivos ou banco. Código 0 não prova validade das chaves, login ou envio de e-mail. Regras de precedência e limitações estão no [runbook](docs/implementation/t014-auth-backend.md#diagnóstico-local-sem-conexão).

## Trabalho e decisões

O tracker canônico é [GitHub Issues](https://github.com/kauanbarateli/Segundo-Cerebro/issues). Consulte [CONTEXT.md](CONTEXT.md), [AGENTS.md](AGENTS.md), [decisões operacionais](docs/implementation/decisoes-operacionais.md) e [T-001](docs/planejamento/13-tickets.md).

Os tokens e temas têm seu [registro de validação T-002](docs/implementation/t002-validacao.md). O [registro de validação de T-001](docs/implementation/t001-validacao.md) reúne revisão, testes, capturas e execuções do CI. A [correspondência dos tickets](docs/implementation/issues.md) liga o planejamento às issues e dependências nativas.

O destino atual é este repositório; nomes e caminhos antigos no planejamento são evidência histórica. `segundo_cerebro` e `novo-segundo-cerebro` são fontes somente de leitura.

Alterações de banco são migrations versionadas para aplicação supervisionada conforme [OP-009](docs/implementation/decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). Não há aplicação automática; segredos permanecem fora do Git.
