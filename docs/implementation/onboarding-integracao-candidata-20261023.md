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

O SHA `ccb32af` preservou as duas falhas SQL nos gerais. Um ensaio local focal, usando o helper canônico 001–025 em um único PostgreSQL em memória, encontrou um terceiro `CASE` dentro de `IF` e duas subtrações JSONB que também exigiam agrupamento. As condições, comandos e listas permitidas foram mantidos. A instalação passou após essas correções, sem alterar pins, ACLs ou funções históricas.

As asserções então expuseram um problema funcional: duas rodadas criadas na mesma transação recebiam `created_at=now()` idênticos; o desempate por UUID podia selecionar a rodada encerrada no lugar da aberta. O snapshot agora prioriza a única rodada aberta, cuja unicidade já é imposta pelo índice, e usa a data de criação efetiva para o histórico. O negativo força uma rodada encerrada com data posterior e exige a retomada da aberta. DTO e retenção permanecem iguais.

Após revisão independente desses deltas, o helper original e as asserções de catálogo/comportamento passaram localmente, sem instrumentação, em aproximadamente três segundos e com o fixture revertido. Esse PASS é serial e local: os testes reais de Core/adapters, o CI do novo SHA, sessões concorrentes, Auth, OAuth e navegador continuam sendo portões separados. Nenhuma migration foi promovida ou aplicada por esse ensaio.

No SHA `5578f3c`, os originais confirmaram 2.661 testes de unidade em 161 arquivos, em UTC e São Paulo, incluindo os testes SQL antes bloqueados. Os 14 envelopes nativos também passaram. Os gerais reprovaram depois, nos scripts: o coletor legado de arquivos passou a alcançar `src/core/onboarding/reserved-client.ts` pela rota compartilhada de Conhecimento. O grafo original, executado somente sobre AST/arquivos públicos, confirmou exatamente uma adição, nenhuma remoção e 50 dependências inalteradas: 269 fontes em vez de 268.

O contrato numérico e seus tipos foram reconciliados com esse grafo; as regressões mantêm o vínculo de import e rejeitam falta, excesso ou duplicação de fontes. Dois controles locais passaram após revisão do delta. Algoritmo, seeds, permissões, limites, estágios e política de limpeza permanecem iguais. Isso conserva a validação da infraestrutura compartilhada, sem reintroduzir a aba Drive no MVP. O coletor completo com dependências instaladas e as jornadas de navegador ainda precisam passar no próximo CI.

Os originais do SHA `b148951` encerraram com 16 sucessos e duas falhas nos gerais. Unidades, scripts e envelopes nativos passaram; o navegador registrou 405 cenários aprovados e um reprovado. O contexto salvo mostra que o provedor simulado foi aberto, mas o HTML interceptado sem declaração UTF-8 exibiu o texto com codificação incorreta. Isso não demonstra falha do OAuth real do aplicativo.

A correção declara UTF-8 no Content-Type e no documento de teste, conserva a asserção literal do título e acrescenta conferência da URL exata e do charset. Root revisou os dois arquivos, aplicou o patch e executou lint, verificador de segredos e diff sem erros. Quatro CR introduzidos em linhas novas no primeiro pacote foram isolados e removidos pelo Git; a prova independente de igualdade byte a byte e o manifest V2 foram preservados. Nenhuma guarda de aplicação, URL permitida, sessão ou critério de sucesso foi relaxado. A aprovação das jornadas no novo SHA e o aceite Google real continuam pendentes.

## Promoção local da 026 e diagnóstico de Recovery, 23/10

O SHA `e312091101068fcbfa3c61b01411563cd7e7e95d` encerrou com 17 dos 18 checks próprios aprovados. A falha de Recovery ocorreu antes das migrações e dos casos: `PROCESS_UNCONFIRMED`, zero estágios, fixtures e migrations, com namespace/diretórios removidos e sem resultado de escrita incerto. A causa específica ainda não está comprovada. Foi acrescentado somente um diagnóstico passivo de cinco fronteiras anteriores ao banco; os quatro controles puros passaram. Código de resultado, prazos, processos, política de limpeza e finally originais foram preservados. A próxima execução original deverá localizar a fronteira alcançada; o run anterior continua reprovado.

Após os ensaios descartáveis e revisão Root dos hashes e do delta de catálogo, os bytes exatos do candidato foram copiados localmente para `supabase/migrations/20261023061901_onboarding_foundation.sql`: 77.553 bytes, SHA-256 `a7531d52742a1a871ad1fe9b3c7ce3c5552e571ee04c6dfa781a37975c3efc04`. O nome já havia sido reservado pelo CLI oficial. Essa promoção de arquivo não aplica SQL: homologação permanece instalada em001–025 e produção em001–019 até conferência operacional posterior. Não foi instalado Cron nem executado seed.

O catálogo revisado fecha as nove tabelas privadas e os contratos de 29 funções novas ou alteradas. As verificações históricas foram preservadas; somente três pins históricos modificados pelo candidato foram atualizados. O ensaio serial observou 1720 verificações sem desvios, 21 mutações negativas recusadas, normalização CRLF aprovada e zero resíduos de usuários/eventos/recibos/rodadas. A diferença PG17/PG18 em constraints NOT NULL foi limitada à projeção de `contype=n`; os bits exatos `attnotnull` continuam obrigatórios e têm negativo independente. A suíte nova resolve somente o import local exato do helper e delega os demais ao Node; seu bridge não modifica SQL, SDK ou asserções.

Permanecem separados: reconciliação dos inventários nativos a partir dos coletores reais; novo CI no SHA resultante; reconferência dos cinco pins hospedados; aplicação supervisionada somente em `twrydxsdemaykgvdlpyd`; catálogo PG17 e tipos oficiais; Preview conectado, Google, concorrência e mobile. Merge e deploy de produção continuam bloqueados.
