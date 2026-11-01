# Qualificação de catálogo e job em memória — não operacional

A fixture foi adaptada e executada com o prune coordenado. O comportamento observado é local e não qualifica o ambiente hospedado.

`qualification-memory.test.mjs` cria **exclusivamente** `new PGlite('memory://')`, confirma a propriedade da instância e não recebe parâmetros para escolher banco, URL, credenciais ou destino. O diretório de trabalho deve ser a raiz do checkout, usada somente para ler arquivos locais com SHA-256 fixo e carregar dependências instaladas. Não abre conexão Supabase, não cria job real e não executa o registro protegido nem remove seu guard. O script lê e confere esse guard e o rollback. A definição de `signup_prune` da candidata fixada é instalada e invocada somente num banco **em memória**, sobre dados sintéticos; tabelas cron e histórico são simulados.

Da raiz do repositório, depois de instalar as dependências já fixadas:

```sh
node --test scripts/verification/front-b-origin-retention-draft/qualification-memory.test.mjs
```

No scratch de revisão, o mesmo teste foi executado sem copiá-lo para o checkout, mantendo como diretório atual a raiz desse checkout. A execução também consulta, sem modificar, a consulta SQL real de saúde em transação read-only e o inventário já versionado de membros de `service_role`. Não assume que o status de inventário seja aprovação de permissões.

Os testes exercitam: função ausente e corpo/owner/STRICT/search_path alterados; acesso indevido por `anon` e por membro de `service_role`; job ausente, inativo, ativo, duplicado, com comando adulterado; histórico de sucesso com comando divergente; ausência de histórico e backlog sintético. A execução direta da função verifica lotes de 500 e 1 para 501 origens vencidas, origem futura preservada e repetição sem efeito. Casos sintéticos verificam a remoção da origem vencida sem apagar cerca, intenção ou prova com sessão nula; indicadores distinguem cercas protegidas do backlog acionável. O bloco de toggle é exercitado apenas com `cron` simulado, em transação revertida, inclusive recusa de comando divergente. Não envolve pg_cron real. Há um papel adicional herdando `service_role` para o qual `function_matches_reviewed_draft` ainda é `true`: o inventário registra `[outro]` e `REVIEW_REQUIRED`, que impede tratar ACL individual como aprovação geral. A fixture não comprova rede isolada, integridade de bibliotecas, locks/conexões concorrentes, tabelas completas, triggers, scheduler ou configuração hospedada.

## Amarração ao destino

O próprio teste prova que nomes `current_user='postgres'` e `current_database()='postgres'` existem também no PGlite em memória. Eles **não identificam** QA ou produção. Nenhuma entrada JSON, flag de ambiente, endereço inferido, valor inserido pela aplicação ou simples confirmação do operador constitui atestado criptográfico de `project_ref` associado à conexão SQL. O harness não tem modo remoto e nenhum resultado se chama `QA aprovado`.

Antes de uma eventual qualificação hospedada, uma ferramenta separada, revisada e autorizada deve obter por API de gerenciamento autenticada os metadados do projeto e de conexão, comparar o `project_ref` explicitamente aprovado, associar a sessão SQL ao endpoint obtido via TLS validado e tratar de forma específica poolers/nomes compartilhados. A prova desse vínculo e do controle de identidade é **pendente**: se não for possível demonstrá-lo, interromper. Não registrar tokens, strings de conexão ou dados pessoais. Em seguida, por transação somente leitura na conexão identificada, revisar ledger/catálogos, PT409, função/ACLs, transitividade de papéis, job e estado de observabilidade. Verificar permissões do leitor e concorrência de DDL; uma leitura pontual não bloqueia alterações privilegiadas nem prova que a função posterior será a mesma.

Registro inativo, verificação pós-commit, ativação e execução são atos distintos com gates próprios. O prune coordenado foi exercitado em memória e instalado em QA pela 028; testes locais não comprovam todas as corridas nem writers hospedados. Não instalar jobs, aplicar SQL ou abrir cadastro com base neste teste. Veja [RUNBOOK-QA.md](RUNBOOK-QA.md).

O job em cinco minutos e a exclusão em lotes não garantem remoção pontual ao fim de 12 meses; existência de sucesso no histórico não demonstra que foram removidas as linhas elegíveis. `DELETE` não prova apagamento imediato em versões MVCC, WAL ou backups. Validar política e alertas antes de qualquer liberação.
