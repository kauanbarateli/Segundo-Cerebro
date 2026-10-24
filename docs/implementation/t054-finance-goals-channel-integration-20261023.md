# Metas — composição de interface, canal browser e rotas

Candidato de implementação inerte de 23/10/2026. Refs #79, #80, #81. Base `25c1de776a8db95cb3b9ff1c5313e2e091dbec2f` da PR #117, preservando suas 26 migrations, catálogo e loaders explícitos. Não altera o FinanceWorkspace nem habilita novas operações.

## Implementado

- Delta exato da interface #116 em `044432e`: 14 arquivos novos, sem transportar sua modificação de Vercel sobre a base mais recente.
- Browser: client concreto, journal em localStorage com Web Locks, dono/epoch/sentinel, intenção completa antes do envio, timeout e validação fechada. Sem fallback em memória ou reenvio automático.
- Confirmação positiva torna a reconfirmação durável antes de remover a pendência; um DELETE com efeito seguido de falha no readback não apaga o aviso necessário na próxima montagem. Depois do sucesso, atualizar/conferir os dados antes de outra operação é um custo conservador desta fatia.
- Servidor: disponibilidade default false, views, prévia somente leitura, execução pelo Core/Store e consulta somente leitura do recibo original. Auth, Entitlement, origem, dono e destino continuam obrigatórios.
- Body do POST: 64 KiB, UTF-8/JSON fechado, 15 segundos, aborto e EOF natural. Respostas limitadas, sem erro SQL ou conteúdo bruto em mensagens.
- Contrato HTTP puro único; erro 400 de validação e detalhe próprio inexistente 200/null coerentes entre os canais. Flag desligada não impede consultar uma tentativa anterior, mas não dispensa autorização.
- Guardas existentes de Vercel preservadas; acrescentadas as branches da UI e desta composição com valor false.

## Validação e proveniência

Os dois pacotes foram revisados de forma cruzada e pelo Root antes da composição. Seus 18 arquivos e o contrato foram conferidos por SHA-256; a UI foi extraída dos blobs Git do SHA revisado. Os 33 destinos eram novos, sem sobreposição ou substituição. Os 26 arquivos canônicos e os 56 paths protegidos permaneceram intactos no transporte. O manifesto público local registra as provas, sem segredos.

Lint focal inicial dos 17 TypeScript novos e verificação de segredos passaram na composição de revisão 044. Root também conferiu os 33 arquivos desta composição por hashes, os 14 blobs Git da UI e as 26 migrations; o lint dos 29 TypeScript/TSX efetivamente compostos passou com zero erros e avisos de regras. A ferramenta informou que a versão React foi inferida porque o worktree não tem instalação própria; dependências foram carregadas da instalação existente, sem instalar pacote. Segredos e diff são conferidos antes do commit. Typecheck, dependências, unidades, SQL e E2E do conjunto serão executados no GitHub, respeitando a máquina de 8 GB. Não se atribui PASS a testes apenas escritos.

As aprovações próprias de #116 e #117 permanecem vinculadas aos seus SHAs; não são herdadas como CI desta branch. Nenhum teste de port em RAM certifica browser durável, corrida de abas, Auth/RLS/CAS hospedado ou aparelho físico.

### Correção após o primeiro CI próprio

O primeiro conjunto original de `fffa378` encerrou com 14 checks aprovados e dois gerais recusados no Typecheck, sem reexecução ou cancelamento. Os 18 diagnósticos de cada geral ocorreram antes de unidades, scripts, build e E2E; esses estágios não recebem aceite nesse SHA. Os envelopes nativos próprios terminaram sem violações, mas não substituem os estágios que não chegaram a executar.

A correção conserva os corpos das funções que sempre lançam erro e usa declarações nomeadas para permitir o narrowing do TypeScript. O parser de recibo explicita no retorno o resultado que seu decoder já validava, sem cast ou relaxamento da validação. O teste de stream passa a rejeitar uma resolução inesperada, preservando as asserções negativas. O lint focal dos quatro arquivos e o diff passaram; Typecheck e regressões pertencem ao novo CI, ainda pendente antes da publicação desta correção.

O conjunto original seguinte, `bafc9f6`, passou Typecheck/lint e encerrou com13 PASS e3 FAIL. Os gerais encontraram dois casos de unidade, antes do segundo fuso/scripts/build/E2E; a falha Auth foi numa guarda sintética anterior ao serviço. O positivo de64KiB contava caracteres em vez dos bytes UTF-8 do nome acentuado: a correção preserva o teto e confere64KiB/64KiB+1. Um resultado malformado de recibo remoto deve virar indisponibilidade503, não erro400 do formulário; `parseGoalReceipt` passa pela mesma fronteira fechada já usada no snapshot. Negativos de owner, formato e versão continuam recusados, sem fallback, commit ou conteúdo privado na resposta.

O fake de Auth aplicava10ms também aos casos que emitem o terminal síncrono, permitindo expirar antes do negativo pretendido. Ele agora conserva o orçamento padrão do observador nesses casos e usa10ms somente no teste deliberado de terminal ausente. O observador e o prazo operacional de15s permanecem intactos. Root executou os10 controles focais de senha antiga em Node24/TypeScript5.9.3, todos aprovados, sem serviço, navegador ou rede. A preparação local teve duas recusas de preflight do vínculo de dependências antes do primeiro teste; não houve repetição de um teste falho. Isso não substitui o CI próprio completo nem aceite de Auth conectado.

Em `eb6d8ac`, os dois gerais aprovaram3.232 unidades em cada fuso e1.963 scripts, mas o portão de camadas recusou quatro imports dos dois helpers em `adapters/http` para `adapters/db`. Esses helpers são composição de servidor, como o `files-http` existente. Foram movidos para `adapters/db`, com ajustes exclusivos de import nas rotas/teste; corpos e limites são preservados e a configuração do portão não muda. Root executou a mesma versão fixada de dependency-cruiser17.4.3 em Node24:535 módulos,2.330 dependências, zero violações. Build e E2E não chegaram a executar nos gerais de `eb6d8ac`; o próximo SHA ainda precisa de CI próprio completo.

## Gates antes de ativar

1. CI próprio do conjunto e revisão de qualquer delta corretivo.
2. Solução terminal completa para tentativas sem recibo. A [proposta separada](t054-finance-goals-terminal-settlement-20261023.md) não é uma implementação e não altera o reconcile V1. Ausência de recibo ou body local continua sem provar rollback.
3. Finalidade própria das imagens, pipeline privado e negativos, sem reintroduzir o Drive.
4. Migrations aditivas revisadas, instalação supervisionada somente no destino pessoal autorizado, catálogo/tipos e aceites reais de isolamento e concorrência. As propostas financeiras continuam DRAFT_ONLY e terminam em rollback.
5. Host real do FinanceWorkspace, lifecycle/logout, duas abas/storage, temas, foco/teclado, imagens, motion reduzido e mobile conforme o protótipo DS 2.1.

Checkout Asaas e Drive continuam excluídos desta execução. Nenhuma variável, conta externa, schema hospedado ou dado pessoal foi alterado por esta fatia. **Merge e deploy de produção permanecem bloqueados.**
