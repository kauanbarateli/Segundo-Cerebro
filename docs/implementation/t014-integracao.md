# T-014 — integração local e pacote SQL Editor

Recorte implementado em 07/10/2026 conforme OP-008: continuar sem conexão Supabase, preparando aplicação manual em projeto pessoal novo. Nenhuma organização, projeto ou credencial da BlackSheep/VOE foi usada. Nenhum SQL foi executado. T-013/T-014 permanecem abertos para os critérios reais de banco/Auth; este relatório não declara o M2 concluído.

## Entrega integrada

- Quatro telas de autenticação seguindo Impeccable e DS 2.1, ações no servidor, recuperação PKCE, troca de senha e retomada de falhas parciais. [Interface](t014-auth-ui.md) e [backend/runbook](t014-auth-backend.md).
- Cookies httpOnly e configuração explícita. Guards por página e operação conferem identidade/sessão, troca obrigatória e Entitlement. O layout envia somente a política de apresentação ao cliente; configurações da demonstração não substituem permissões conectadas. Logout usa POST com origem validada.
- Middleware com CSP em bloqueio, nonce aleatório por resposta e hash calculado sobre o script de tema. Scripts de produção não permitem `unsafe-inline`/`unsafe-eval`. Styles inline continuam necessários aos gráficos e às primitivas existentes. Callback usa `no-referrer`; respostas privadas e de refresh usam `no-store`.
- HTML renderizado por requisição. O único documento no cache PWA continua sendo `/offline`, público, sem consulta Auth ou dados de conta; sua resposta e CSP correspondentes são conservadas juntas pelo service worker. Nenhum HTML privado, RSC, API ou URL assinada entra no cache de runtime.
- Migration complementar de conclusão de senha: RPC restrita ao servidor confirma flag, evento mínimo e recibo juntos, após a alteração Auth e revogação das outras sessões. Não recebe senha/token e não tenta simular transação distribuída. Auth real e falhas entre serviços ainda precisam de validação.
- [Pacote SQL Editor](../../supabase/sql-editor/README.md): duas migrations numeradas, cópias exatas e manifest SHA-256; três asserções e um bootstrap ficam separados. Gerador determinístico e `--check` não abrem conexão nem executam SQL.

Os módulos de negócio continuam com dados de exemplo em memória, inclusive após autenticação futura. A interface informa essa condição. Adapters e persistência de Capturas/Tarefas pertencem ao próximo recorte T-015.

## Revisão dos agentes

Backend, interface e pacote SQL foram distribuídos entre agentes, com revisão independente do SQL, CSP e Auth e integração pela raiz. Antes do fechamento local foram corrigidos: formulários que exigiam nova senha ao retomar conclusão; falha de logout global que já remove a sessão local; perda do aviso de conclusão pendente durante limite/indisponibilidade; reautenticação sem o limite de login; guarda ausente na página Configurações. O servidor permanece a autoridade para todos esses estados.

## Evidência local

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

## Inspeção visual

Uma passagem delimitada nas quatro telas: desktop 1280px/claro e celular 390px/escuro. Oito capturas `test-results/auth-*.png` foram inspecionadas pela raiz. Hierarquia, marca, campos, mensagens, links e seletor de tema permanecem legíveis, sem corte de conteúdo; troca de senha pode rolar com seu conteúdo maior. E2E também verifica 320/768px, alvos de 44px, campos de 16px, teclado, tema, parâmetros e indisponibilidade explícita. As capturas são do modo sem serviço, não de uma sessão real.

## Pendências explícitas

Aplicação manual e provas reais de grants/RLS, concorrência, duas contas, refresh/chunking, SMTP/PKCE, sexta tentativa persistente, revogação entre aparelhos, senha provisória e falhas Auth/RPC. O runbook separa o SQL da configuração Auth/SMTP e das variáveis do servidor. Nenhum teste local com doubles nem CI sem credenciais substitui essas provas. Tipos reais e adapters, personalização persistente e operações administrativas seguem seus tickets. Instalação PWA em aparelhos Android/iOS continua pendente na issue #12.

O resultado do CI do commit publicado será registrado na [issue T-014](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21), com o link da execução, sem fechar os critérios não demonstrados.
