# Restore gerenciado: adaptadores revisados — 13/10/2026

Os adaptadores de lista privada e validação antes de COMMIT foram incorporados após revisão de Root e peer. Root repetiu **18/18 testes** no checkout isolado e **18/18 na Main**, incluindo SQL literal com PGlite. A adaptação para a Main alterou somente dois caminhos relativos do teste; os dois módulos mantêm os bytes congelados. Não há CLI de importação gerenciada habilitada.

A validação utiliza o mesmo processo `psql`, a mesma conexão e a mesma transação do streaming. Exige identidade do operador, retorno de `session_replication_role` para `origin`, catálogo de release e ausência de violações em leituras efetivas das chaves estrangeiras antes de autorizar COMMIT. `convalidated` não substitui a leitura de dados. Os operandos usam os tipos do operador original de cada FK; entradas polimórficas são recusadas. Um frame completo não conclui a escrita pendente: erro do consumidor, duplicação ou timeout continuam vetando COMMIT.

As listas TOC são arquivos novos exclusivos em diretório privado, com ACL vinculada à identidade Windows atual, escrita sincronizada e conferência dos bytes. A remoção se limita às identidades dos arquivos criados e ao diretório vazio próprio, sem operação recursiva. Importar os módulos não inicia processo, conexão ou leitura privada. Os testes não certificam ACL ou execução no serviço hospedado.

Ainda falta vincular a qualificação à leitura nativa do snapshot e do destino, comparar integralmente os objetos de serviço preservados e seus históricos e conferir as permissões de cada entrada selecionada. Os probes nativos de [criação das customizações](restore-custom-ddl-20261013.md) usaram definições simples; não substituem essa comparação. A validação final de Auth, Storage e Cofre restaurados permanece pendente na #35.

## Inspeção do arquivo antes da qualificação

A [primeira chamada](evidence/restore-managed-inspection-first-20261013.json) terminou com timeout, sem fase conhecida. Uma **nova fonte com diagnóstico fechado**, revisada por Root e peer com 18/18 testes próprios, realizou uma chamada distinta e retornou `INSPECTION_NATIVE_FAILED` em `directory_acl`, antes de autenticar o ciphertext ou iniciar o TOC. [Resultado próprio](evidence/restore-managed-inspection-diagnostic-20261013.json). Nenhuma dessas chamadas consultou o destino ou importou dados; o timeout anterior continua sem causa atribuída.

Pins da integração dos adaptadores: módulo `097a6128a8f7a6132331e913a49027f24e975a3bccbd9a7e0ff201caeec03ccd`; SQL `5a0e5db41aecf4f4debd0b81e63ad51d522d1e9e8a2e93dd4288fda0734144ae`; teste adaptado `27ba8a279add53183b0c0e8d24771870b494c4b73471c75d89bcd685e6a684e0`. Os hashes das chamadas nativas ficam nas evidências próprias e não são substituídos por hashes de versões posteriores.

## Ponto de pausa e correção de ACL

O recorte final do inspector protege a DACL somente na pasta nova exclusiva, vazia e de propriedade do WindowsIdentity atual. O ciphertext é verificado sem alterar sua ACL; pais e arquivo original são preservados. Um controle novo em pasta vazia comprovou Allow herdado fora dos atores permitidos; esse controle não identifica retroativamente a causa de uma chamada antiga. Recusas ETIMEDOUT de controles de ACL no limite de 5 s motivaram o subteto de 15 s, dentro do global absoluto de 45 s. Timeout continua sendo falha; EOF e close0 são obrigatórios.

Autor e peer passaram 19/19 próprios. Root passou 19/19 no isolado e 19/19 após integrar na Main, incluindo um controle Windows de ACL apenas sobre pastas e arquivos vazios novos. Nenhum desses controles executa o inspector sobre o archive real. O responsável pediu pausa antes de uma terceira inspeção ou nova importação.

Na publicação, os três arquivos dos adaptadores tiveram somente uma linha final extra removida. Pins revisados e publicados estão separados no [manifesto do checkpoint](evidence/handoff-retomada-20261013-restore-auth-snapshot.json); SQL, helper e lógica não mudaram. O inspector final preserva seus pins `ae2177f1…6454a`/`451df16a…5e5ef`. O [handoff](handoff-retomada-20261013-restore-auth.md) define a próxima inspeção e o qualificador ainda necessário.
