# Segundo Cérebro

Sistema de informações pessoais com Capturar, Tarefas, Conhecimento, Drive, Projetos, Hábitos, Financeiro, Cofre e Calendário Google, reunidos pelo Início, Busca e vínculos. A implementação local do MVP foi concluída em 09/10/2026; implantação e aceites externos continuam pendentes. O [relatório de entrega](docs/implementation/entrega-mvp-pendencias.md) registra o que foi entregue, as evidências locais e os passos manuais para liberar o ambiente real.

Há dois modos: `demo`, padrão, usa exemplos e ports em memória; `supabase` usa canais autenticados e adapters de persistência para os módulos. O Cofre demo executa a mesma criptografia no cliente em memória, descartada ao recarregar. O Calendário conectado exige OAuth Google; o modo conectado não apresenta exemplos como substituto de integração ausente. O mantenedor informou a aplicação das nove migrations novas e o cadastro das variáveis de Production; a [verificação da implantação](docs/implementation/verificacao-implantacao-20261009.md) registra a presença dos objetos por REST e os aceites ainda pendentes.

## Executar localmente

Use Node.js 24, registrado em [.nvmrc](.nvmrc), e npm. A demonstração funciona sem `.env` ou banco.

```sh
git clone https://github.com/kauanbarateli/Segundo-Cerebro.git
cd Segundo-Cerebro
npm ci
npm run dev
```

Abra `http://localhost:3000`. A rota `/design-system` apresenta os fundamentos e componentes DS 2.1 em claro, escuro e sistema. Para executar o build local: `npm run build` e `npm start`. Geist é empacotada localmente.

Quando o processo de build recebe `APP_MODE=supabase`, `prebuild` valida a configuração Auth com as regras de produção, incluindo APP_URL HTTPS. Falhas interrompem o build e informam somente nomes/regras das variáveis; valores não são impressos. O portão usa exclusivamente o ambiente do processo de hosting, sem ler arquivos locais. Demo/CI sem credenciais continuam passando; o diagnóstico local separado é `npm run auth:check`.

O modo conectado usa os nomes de configuração de [.env.example](.env.example), preenchidos somente no ambiente privado do servidor. Consulte primeiro a [sequência manual e os aceites](docs/implementation/entrega-mvp-pendencias.md#aplicação-manual-das-migrations). Nenhuma chave de integração usa `NEXT_PUBLIC_`.

## Validar

```sh
npm run check
npm run test:timezones
npm run check:impeccable
npx playwright install chromium
npm run test:e2e
```

`check` executa TypeScript, lint, Vitest, fronteiras de camadas, design system, integridade do pacote SQL Editor, testes dos scripts, PostgreSQL descartável PGlite, scanner de segredos, build e scanner do bundle de Auth. PGlite usa fixtures locais de Auth/Storage; não acessa Supabase. Playwright usa demonstração em `http://127.0.0.1:3100`; mantenha a porta livre.

O [CI](.github/workflows/ci.yml) inclui esses portões, parsing SQL, testes em UTC/São Paulo, Impeccable e Chromium. CI/build/deploy não aplicam migrations, não criam contas e não executam ensaios remotos. Os resultados do checkpoint atual e seus limites estão no [relatório final](docs/implementation/entrega-mvp-pendencias.md#evidência-local-e-limites). A manutenção da cadeia de lint permanece acompanhada na [issue #36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36).

## Banco e operação

Existem **14 migrations versionadas**. As cinco de 07/10/2026 foram aplicadas no projeto pessoal e permanecem imutáveis. A aplicação manual das nove de 09/10/2026, **006–014**, foi informada pelo mantenedor e corroborada pela presença das tabelas/RPCs por REST e dos dois buckets privados. O [pacote SQL Editor](supabase/sql-editor/README.md) e o [manifest SHA-256](supabase/sql-editor/manifest.json) permitem conferir ordem e bytes; não comprovam hashes executados ou RLS/grants hospedados.

**Não reaplicar 001–014 nem repetir o bootstrap master.** A continuidade é conferir o catálogo readonly e gerar tipos oficiais do schema instalado, exclusivamente no projeto pessoal `rishenjoikgmfubmnfiu`. O MCP atual recusa acesso; os metadados REST conferiram 50 RPCs/186 argumentos usados, sem substituir esses dois aceites. Projetos ou credenciais BlackSheep/Sistema VOE não fazem parte desta aplicação.

O [runbook de backup e restauração](docs/operations/backup-restore-release.md) prepara backup cifrado de DB/Auth/Storage para destino privado fora de sincronização, verificação e restore em projeto pessoal descartável. O primeiro backup agendado, o restore real e o desbloqueio do Cofre restaurado ainda são aceites externos.

## Estrutura

| Pasta | Responsabilidade |
| --- | --- |
| `src/app` | Rotas e composição do canal web |
| `src/core` | Regras e portas de domínio independentes de framework/SDK |
| `src/adapters` | Persistência, integrações e transportes |
| `src/components/ui` | Primitivos visuais compartilhados |
| `src/components/layout` | Moldura, navegação e interfaces transversais |
| `src/components/features` | Interfaces por funcionalidade |
| `src/lib` | Infraestrutura do canal web e composição dos modos |
| `design-system` | Fonte dos tokens DS 2.1, gerador e validação |
| `supabase/migrations` | SQL canônico e versões imutáveis; futuras alterações incrementais |
| `supabase/sql-editor` | Cópias numeradas e manifest de integridade |
| `supabase/tests` | Asserções separadas da instalação; fixtures somente em ambiente dedicado |
| `scripts/operations` | Backup cifrado, restore isolado e catálogo de release |
| `tests` | Contratos, regras e jornadas observáveis |
| `docs/adr` | Decisões de arquitetura |
| `docs/implementation` | Entrega, evidências e pendências |
| `docs/planejamento` | Planejamento aprovado e referências |

## Documentação

- [Entrega do MVP e pendências externas](docs/implementation/entrega-mvp-pendencias.md), [verificação da implantação](docs/implementation/verificacao-implantacao-20261009.md), [decisões operacionais](docs/implementation/decisoes-operacionais.md) e [planejamento](docs/planejamento/00-indice.md).
- [Auditoria Impeccable e validação integrada](docs/implementation/t028-validacao-final.md), [Busca/Configurações](docs/implementation/t026-t027-busca-configuracoes.md).
- [Identidade/Auth](supabase/README.md), [Capturar/Tarefas](docs/implementation/t015-persistencia.md), [journal](docs/implementation/t015-journal.md), [Início/Atividade](docs/implementation/t016-atividade.md) e [Admin](docs/implementation/t017-admin.md).
- [Financeiro](docs/implementation/t018-t020-financeiro.md), [Conhecimento](docs/implementation/t021-conhecimento.md), [Drive/anexos/avatar](docs/implementation/t022-drive-storage.md), [Projetos/Hábitos](docs/implementation/t023-projetos-habitos.md), [Cofre](docs/implementation/t024-cofre-cifrado.md) e [Calendário Google](docs/implementation/t025-calendario-google.md).
- [Validação SQL independente](docs/implementation/validacao-sql-finalizacao.md), [revisão de privacidade e hardening](docs/implementation/revisao-hardening-cofre-monitoramento.md), [backup/restore/release](docs/operations/backup-restore-release.md), [PWA](docs/implementation/t005-pwa.md) e [componentes visuais](src/components/ui/README.md).

Os relatórios de 07/10 registram ensaios históricos de identidade, Auth e Capturar/Tarefas. Eles não certificam o schema ou as interfaces ampliados em 09/10. A [Fase 2+](docs/planejamento/12-roadmap.md) permanece fora desta entrega.
