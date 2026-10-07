# T-014 — integração local e pacote SQL Editor

Recorte local implementado em 07/10/2026 conforme OP-008, inicialmente sem conexão e sem execução de SQL. A evidência local abaixo preserva esse momento. Posteriormente, o MCP pessoal `rishenjoikgmfubmnfiu` foi verificado em leitura: PostgreSQL 17.11, Auth sem contas e nenhuma relação de identidade da aplicação. O mantenedor autorizou aplicação supervisionada e asserções com rollback, conforme [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). Nenhuma organização, projeto ou credencial da BlackSheep/VOE foi usada. T-013/T-014 permanecem abertos para os critérios reais; este relatório não declara o M2 concluído.

**Atualização de banco em 07/10/2026:** três migrations aplicadas por MCP e três asserções SQL aprovadas, com rollback e ausência de resíduos confirmados. O [relatório da aplicação](t013-aplicacao-supabase.md) registra versões, hashes, nove tabelas com RLS, Advisors e limites. Naquele momento, configuração Auth/callbacks, credenciais server-only, concorrência e fluxos reais ainda estavam pendentes; as atualizações abaixo registram a evidência posterior. SMTP e recuperação por e-mail foram postergados por OP-010. Fixtures SQL não comprovam login ou envio de e-mail.

**Atualização operacional posterior:** primeiro master confirmado por bootstrap, configuração local aprovada e chave privilegiada validada pela Admin API. Os ensaios usaram `APP_MODE=supabase` no processo; o arquivo local estava inicialmente em `demo`. O e-mail foi confirmado e o master permanece ativo; o fechamento do cadastro público ainda aguardava o mantenedor na última consulta. O [ensaio real de Auth](t014-auth-real.md) aprovou isolamento/revogação via SDK e dez verificações de navegador com contas sintéticas. Não há UUID, e-mail ou chave real versionados neste relatório.

## Entrega integrada

- Quatro telas de autenticação seguindo Impeccable e DS 2.1, ações no servidor, recuperação PKCE, troca de senha e retomada de falhas parciais. [Interface](t014-auth-ui.md) e [backend/runbook](t014-auth-backend.md).
- Cookies httpOnly e configuração explícita. Guards por página e operação conferem identidade/sessão, troca obrigatória e Entitlement. O layout envia somente a política de apresentação ao cliente; configurações da demonstração não substituem permissões conectadas. Logout usa POST com origem validada.
- Middleware com CSP em bloqueio, nonce aleatório por resposta e hash calculado sobre o script de tema. Scripts de produção não permitem `unsafe-inline`/`unsafe-eval`. Styles inline continuam necessários aos gráficos e às primitivas existentes. Callback usa `no-referrer`; respostas privadas e de refresh usam `no-store`.
- HTML renderizado por requisição. O único documento no cache PWA continua sendo `/offline`, público, sem consulta Auth ou dados de conta; sua resposta e CSP correspondentes são conservadas juntas pelo service worker. Nenhum HTML privado, RSC, API ou URL assinada entra no cache de runtime.
- Migration complementar de conclusão de senha: RPC restrita ao servidor confirma flag, evento mínimo e recibo juntos, após a alteração Auth e revogação das outras sessões. Não recebe senha/token e não tenta simular transação distribuída. A troca normal passou no ensaio real; injeção de falhas entre serviços ainda precisa de validação.
- [Pacote SQL Editor](../../supabase/sql-editor/README.md): originalmente duas migrations, agora três com a restrição de EXECUTE do helper RLS; cópias exatas e manifest SHA-256, com três asserções e um bootstrap separados. Gerador determinístico e `--check` não abrem conexão nem executam SQL.

Os módulos de negócio continuam com dados de exemplo em memória, inclusive após autenticação real. A interface informa essa condição. Adapters e persistência de Capturas/Tarefas pertencem ao próximo recorte T-015.

## Revisão dos agentes

Backend, interface e pacote SQL foram distribuídos entre agentes, com revisão independente do SQL, CSP e Auth e integração pela raiz. Antes do fechamento local foram corrigidos: formulários que exigiam nova senha ao retomar conclusão; falha de logout global que já remove a sessão local; perda do aviso de conclusão pendente durante limite/indisponibilidade; reautenticação sem o limite de login; guarda ausente na página Configurações. O servidor permanece a autoridade para todos esses estados.

## Evidência local inicial — histórica

| Portão | Resultado |
|---|---|
| TypeScript e ESLint | Aprovados |
| Unitários/contratos | 713 em UTC e 713 em America/Sao_Paulo; após conversão de um teste para TSX, seus quatro casos passaram novamente |
| Arquitetura | 185 módulos, 603 dependências; inclui recusa de SDK Supabase em componentes |
| Design system | 164 pares de contraste aprovados |
| Impeccable 0.1.6 | Zero registros no relatório completo de `src` |
| Build de produção sem credenciais | Aprovado |
| Playwright integrado | 140 cenários aprovados, com quatro workers; inclui nove cenários Auth e o teste CSP com controle positivo |
| Bundle público | 50 arquivos sem assinaturas de SDK Auth, tokens ou segredos; scanner com controle negativo |
| Audit de produção | Zero vulnerabilidades; pendência de desenvolvimento continua na issue #36 |
| SQL Editor | Integridade aprovada e cinco testes do gerador aprovados |
| Parser SQL | Oito arquivos, incluindo cópias de instalação, sem erro sintático; nenhuma execução |

Verificação HTTP adicional com `APP_MODE=supabase` e todas as variáveis de conexão explicitamente vazias: `/`, `/tarefas`, `/configuracoes`, `/entrar` e `/auth/logout` responderam 503 com CSP/no-store, sem fallback à demonstração. `/offline` continuou público com 200. Em modo demo, callback inválido retornou 303 sem refletir o código e com `no-referrer`; GET de logout retornou 405.

O teste de CSP injeta script sem nonce no documento HTTP e verifica recusa pelo navegador; removendo somente a política no documento de controle, o mesmo script executa. A política válida também preserva tema e interação hidratada sem violações. A inspeção dos bytes das imagens observa o Blob real da prévia, sem uma requisição `fetch(blob:)` estranha ao fluxo da aplicação.

## Verificação após a aplicação do schema

Em 07/10/2026, `npm run check` passou com 727 testes, TypeScript, ESLint, build, camadas, 164 verificações de contraste, gerador do SQL Editor e scanner de 50 bundles. Essa execução atualiza os checks locais sem reatribuir a ela os 140 E2E do registro histórico acima.

O ensaio adicional do limitador obteve cinco permissões, uma recusa e cinco hits conferidos no banco, mas os seis PIDs não tiveram sobreposição de execução. O transporte serializou as chamadas despachadas com `Promise.allSettled`; o verificador corretamente recusou o critério de concorrência. A conclusão é **inconclusiva para concorrência**, que permanece pendente. A limpeza da única chave aleatória foi confirmada, sem fixture Auth nesse ensaio; o [relatório T-013](t013-aplicacao-supabase.md#ensaio-do-limitador-concorrência-inconclusiva) registra os detalhes.

Depois, o [ensaio real de Auth](t014-auth-real.md) passou com dois usuários via SDK e dez verificações do navegador, incluindo entrada, cookies/headers, recusa de administração, troca de senha, revogação de outro contexto, nova entrada, métodos/origem de logout e sexta tentativa bloqueada. A fixture B acumulou cinco hits em 4,13 segundos. Um seletor ambíguo do primeiro ensaio foi corrigido para `auth-feedback`, sem mudar a aplicação. As quatro contas e quatro hashes de login das duas tentativas foram removidos, com ausência confirmada; o master pessoal não foi usado. Esse resultado não prova concorrência simultânea nem HTTPS de produção.

## Inspeção visual

Uma passagem delimitada nas quatro telas: desktop 1280px/claro e celular 390px/escuro. Oito capturas `test-results/auth-*.png` foram inspecionadas pela raiz. Hierarquia, marca, campos, mensagens, links e seletor de tema permanecem legíveis, sem corte de conteúdo; troca de senha pode rolar com seu conteúdo maior. E2E também verifica 320/768px, alvos de 44px, campos de 16px, teclado, tema, parâmetros e indisponibilidade explícita. As capturas são do modo sem serviço, não de uma sessão real.

## Pendências explícitas

Após as provas SQL e o ensaio real de Auth, permanecem: cadastro público fechado; concorrência com sobreposição e sexta tentativa entre instâncias simultâneas; refresh/chunking e HTTPS/CDN; SMTP/PKCE; aparelhos reais; veto/moderação, senha provisória e falhas Auth/RPC. O runbook separa SQL, configuração Auth/SMTP e variáveis do servidor. Doubles e CI sem credenciais não substituem essas provas. Tipos reais foram gerados via MCP e integrados aos clientes Auth do servidor; drift, adapters, persistência de Capturas/Tarefas em T-015 e operações administrativas têm validação própria. Instalação PWA em aparelhos Android/iOS continua pendente na issue #12. T-014 permanece aberta.

O resultado do CI do commit publicado será registrado na [issue T-014](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21), com o link da execução, sem fechar os critérios não demonstrados.
