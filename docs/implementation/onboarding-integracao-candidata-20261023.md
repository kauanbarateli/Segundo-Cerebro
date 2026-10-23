# Onboarding — candidato integrado, 23/10/2026

Refs #46, #44, #58, #60. Escopo D-077: nove telas, entrada facultativa e atributos de perfil/projeto. Asaas, abertura de vendas e Drive permanecem fora desta execução. Merge e produção continuam bloqueados.

## Implementado no candidato

O pacote visual foi reconciliado com o planejamento do PR #47, SHA `57a2967f34a11cf985e62827d67179335474f477`. A apresentação real React/Next utiliza os contratos do Núcleo, rascunho versionado, efeitos confirmados por recibos do domínio e APIs privadas. Os manifests de autoria foram preservados antes da integração; cada arquivo foi conferido por tamanho e SHA-256.

A entrada automática existe somente na Home e somente para a coorte explicitamente registrada pela conclusão verificada da saga de criação do Admin. Não se infere novidade pela data ou ausência de um campo. Usuários existentes têm entrada manual em Configurações; links profundos e a precedência de troca/recuperação de senha são preservados. “Fazer depois” na primeira tela registra e pausa uma rodada vazia, sem criar itens nos módulos, evitando oferecer o percurso novamente a cada retorno à Home.

Perfil e contexto de projeto possuem DTOs v2 separados. Intenções incertas conservam o mesmo identificador e corpo mesmo após respostas posteriores 403/409. Emendas revogam ou conciliam a versão anterior dentro da transação; resultados confirmados não são reescritos. O resumo mostra apenas registros preparados, com omissões explícitas. OAuth reutiliza Google somente leitura e duas contas, com classificação e fence verificados novamente no commit após as esperas pelo provedor.

## Banco e ordem de validação

**Nenhuma migration 026 foi aplicada.** A cadeia canônica instalada continua 001–025 apenas na homologação. O nome `20261023061901_onboarding_foundation.sql` foi reservado pelo CLI oficial e seu placeholder foi preservado fora dos arquivos canônicos enquanto o candidato é ensaiado.

As propostas em `proposals/` abortam deliberadamente se executadas diretamente. Um helper novo e fechado compõe foundation, cinco guardas com hashes lidos do catálogo real de homologação e retenção, exclusivamente no PostgreSQL descartável. Ele não altera o carregador 001–025, não aceita transporte externo nem instala Cron. As asserções são separadas e terminam em rollback. Divergência de definição histórica deve reprovar; não se substitui o pin por uma observação local para fazer o teste passar.

Após o ensaio: promover os mesmos bytes revisados para a migration gerada pelo CLI; revisar o catálogo; aplicar supervisionadamente apenas no projeto `twrydxsdemaykgvdlpyd`; gerar os tipos oficiais; atualizar inventários e pacote SQL Editor; executar novamente o CI e só então selecionar um Preview novo. Registro/ativação e medição do pg_cron são etapas operacionais separadas, com job exclusivo e sem chaves HTTP. A janela lógica do rascunho é 720 horas; configuração de job não substitui evidência da remoção física.

## Validação observada e pendências

Revisões independentes do backend, recuperação, atributos e harness foram incorporadas. Lint dos deltas revisados passou após correção de um campo fora do componente compartilhado e de três variáveis usadas apenas como tipo. Um primeiro lote de lint excedeu o heap local de 128 MiB; o lote de 192 MiB concluiu e apontou as três variáveis, depois corrigidas e reconferidas. Isso não é um PASS de compilador ou navegador.

O coletor AST original do Admin derivou 444 fontes, contra 429 anteriores: exatamente 15 adições transitivas e nenhuma remoção, conferidas por peer. O contrato e regressões foram ajustados apenas a essa lista finita; 61 dependências e os gates de execução/limpeza permanecem. Recovery conserva suas 233 fontes. Esses grafos não certificam as nove telas ou as novas APIs por si sós.

Foram preparados testes de Home, Núcleo, adapters e 19 jornadas de navegador do Workspace, incluindo 320/390 px, claro/escuro, teclado, foco, contraste, movimento reduzido, pular/retomar, sete efeitos sequenciais, emendas incertas e troca de usuário. A execução remota no SHA integrado ainda é obrigatória. PGlite e APIs interceptadas não atestam GoTrue, Google, concorrência entre sessões ou dispositivos físicos.

Permanecem: compilador/CI completo; execução dos testes SQL; corridas reais; Cron e retenção; tipos oficiais pós-aplicação; login e persistência pelo Preview; OAuth real e aceites mobile. A configuração Google do Preview foi solicitada e está em reconferência somente de nomes/escopo, sem expor valores. Produção não foi alterada por esta integração.

## Correção após os primeiros originais do CI

No SHA `aecb6e4ed1a7cb13a5797dea6d1e9f2b04f08f48`, os 18 checks próprios encerraram com 16 sucessos e duas falhas nos gerais. Os dois testes SQL (`onboarding-canonical-sql` e `calendar-oauth-sql`) reprovaram a instalação do candidato com `42601`, antes da execução das novas jornadas de navegador. Os 14 envelopes nativos passaram; esse resultado não substitui os testes que não chegaram a executar. Nenhum run antigo foi reclassificado ou repetido para ocultar a falha.

A causa foi reproduzida em um controle PGlite em memória, sem schema do aplicativo ou conexão externa: o `CASE` não agrupado dentro de duas condições `IF` encerrava a leitura da expressão no `THEN` interno. Agrupar a expressão com parênteses compilou; as mesmas listas de campos permitidos foram preservadas. O candidato continua inerte e a cadeia canônica permanece 001–025. Os dois testes SQL reais existentes são a regressão obrigatória no próximo SHA.

O runner Admin também ganhou um diagnóstico fechado de nove etapas do preflight. Ele emite somente um código de etapa, sem caminhos, mensagens de exceção ou valores privados. Não altera portas, isolamento, limites, decisão de recusa ou confirmação de limpeza. Quatro controles puros passaram e o lint dos dois arquivos passou; a eficácia sobre a próxima falha original de infraestrutura ainda está pendente. O Admin do SHA `be6fe5a` continua registrado como falha, sem promoção a PASS pela inclusão deste diagnóstico.
