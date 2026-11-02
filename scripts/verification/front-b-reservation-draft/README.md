# Diagnóstico opt-in de reserva — não integrado ao produto

Não é migration nem autorização de aplicação. O teste lê `scripts/verification/front-b-signup-reservation-draft/candidate-reservation.sql.txt` já versionado no #190, sem criar cópia, e exige SHA-256 exato `18288441c5195279ad3b31bb3cf68ededd914fe0121533f8210fbbb33d843dd7`. A barreira proposital do SQL só é removida em memória após validar bytes, prefixo transacional e opt-in. PGlite é importado apenas após esses gates; nenhum caminho externo/DSN é aceito.

`front-b-reservation-guard.test.mjs` executa somente verificações puras. O wrapper `tests/scripts/front-b-reservation-opt-in.test.mjs` é incluído no glob atual `tests/scripts/*.test.mjs`, mas mostra **SKIP**, não PASS de banco, quando a variável está ausente. Valor presente e diferente de `1` falha antes do PGlite. Com flag `1` e Node 24, o wrapper chama `front-b-reservation-diagnostic.opt-in.mjs`; esse módulo só exporta a função e não se executa ao importar. Nenhuma alteração de workflow é incluída neste patch.

O diagnóstico usa somente `new PGlite()` em memória, fecha a instância no finally e utiliza dados sintéticos. Cobre sequencialmente reserva, reentrada, start único, incerteza, expiração, consentimento/retirada e recusa de ack após bloqueio. Para cada recusa com SQLSTATE 42501 e cada retorno de bloqueio, compara snapshots de usuários, sessões, moderação, configurações, admissões, intenções e reservas. A fixture concede USAGE explícito do schema e exercita acesso real com `SET ROLE`/`RESET ROLE`: anon/authenticated não podem reservar nem ler tabela; service_role pode reservar mas não ler tabela. Essas provas dizem respeito somente aos papéis sintéticos da fixture.

## Proposta de job explícito no workflow existente

Após revisão e publicação em branch própria, propor no `.github/workflows/ci.yml` existente: acrescentar ao `workflow_dispatch` uma entrada booleana `reservation_diagnostic` com default false e criar um **job adicional**, condicionado a `github.event_name == 'workflow_dispatch'`, entrada true e branch de diagnóstico exata revisada. Manter o job Fundação, auditoria, testes e todas as suas condições intactos. O job adicional deve usar checkout do `github.sha` com `persist-credentials: false`, permissões `contents: read`, Node da `.nvmrc`, `npm ci` a partir do lock revisado, nenhum segredo de ambiente e executar somente:

```sh
FRONT_B_RUN_RESERVATION_PGLITE=1 node --test tests/scripts/front-b-reservation-opt-in.test.mjs
```

Conferir HEAD contra `GITHUB_SHA`, os arquivos SQL/guard/runner revisados e a procedência do lock antes do comando. Não inferir isolamento de rede só porque o teste usa PGlite em memória. Se a execução opt-in falhar ou não rodar, não registrar evidência positiva nem alterar o gate Fundação. A comparação de versão do package e lock não qualifica sozinha todos os bytes executáveis; a instalação e o commit devem ser confiáveis. Workflow novo/alteração do existente demanda revisão e as autorizações próprias para publicar.

A fixture é reduzida. O diagnóstico **não prova** concorrência entre sessões, PostgreSQL 17, isolamento de rede, GoTrue, SMTP, sessão real, migrações, ledger, RLS de produção, atomicidade entre banco e Auth ou efeitos tardios de moderação. O draft não implementa finalização nem impede as RPCs antigas. O teste não autoriza aplicação, merge, deploy ou abertura de cadastro.

Estado desta proposta: checagem de sintaxe e guard puro realizados; wrapper sem opt-in registra SKIP. PGlite NÃO foi executado e nenhuma asserção SQL foi observada nesta máquina.
