# Composição candidata da Frente B

Esta branch reúne as candidatas de reconciliação, cadastro, origem, métricas, feedback e atualizações para verificar compatibilidade. Não é aprovação da #140: a Frente A, a promoção do esquema e os percursos reais ainda precisam ser integrados.

## Evidências

- A main remota estava em `bd35288404c493d1b03f7a1a0208f808cc2079a2` em 2026-11-01 UTC. O teste `tests/scripts/front-b-composition.test.mjs` aplica as 27 fontes com hashes conferidos e as três candidatas em PGlite descartável; confirma que feedback de outra pessoa não aparece, que uma pessoa bloqueada é recusada e que a consulta Master contém somente agregados.
- Em `twrydxsdemaykgvdlpyd`, as candidatas de admissão/origem (`e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519`), métricas (`55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f`) e feedback (`736a9113322317e63e676a4554f6f57231becc9d67065c7f95c97572ad0cc9d6`) foram executadas juntas em uma única transação revertida. RLS de feedback estava ativo; `anon` e `authenticated` não executavam suas consultas nem a consulta de métricas, e `service_role` podia executar ambas. Os objetos estavam ausentes após rollback, `source_operation` voltou a `NOT NULL`, o ledger ficou byte a byte igual e o verificador do patch PT409 retornou `ok=true`.
- Na composição local, 96 testes Vitest de cadastro, métricas, feedback e atualizações passaram; os testes SQL individuais e o de composição passaram, assim como TypeScript, camadas e SQL Editor. Ensaios visuais isolados cobriram telas pequenas e grandes e os dois temas; não representam autenticação real nem a shell final.

## Ainda necessário

1. A comparação estrita de tipos da #134 passou em QA e produção usando o motor oficial 0.4.0 sobre um retrato consistente de metadados MCP, sem substituir o contrato nem normalizar o export MCP diferente; ver [evidência e reprodução](reconciliacao-banco-20261031.md). Ainda é necessário tratar o `npm audit` que falha no CI e revisar os demais gates do PR. Backup e recuperação foram registrados para depois em #158 por decisão do usuário.
2. Revisar e promover as candidatas a migrations definitivas com catálogo, tipos, permissão e retenção operacional; validar primeiro no QA adequado. Abertura de cadastro exige SMTP/redirects e templates compartilhados homologados, prova real de confirmação/reenvio em outro dispositivo, proteção contra abuso, recuperação legada, Admin e Storage. A autorização de execução persistente e liberação segue os gates do projeto.
3. A Frente A deve compor os links e navegação de cadastro, métricas, feedback e atualizações, transportar apenas as cinco UTMs permitidas e montar a retirada de consentimento em Configurações. Não substituir arquivos da outra frente sem conciliação.
4. Executar os percursos conectados de #140 com duas contas, Master e moderação: isolamento de dados, retirada e retenção de origem, novo período e troca de conta, sessão revogada, histórico privado de feedback, onboarding pulado, estados de erro e recuperação existente. Conferir os dois temas, acessibilidade, celular e desktop no aplicativo integrado. Testes de componentes isolados e SQL transacional não atendem esses critérios.

## Pré-visualizações automáticas

Ao publicar branches de trabalho, a integração Git da Vercel criou prévias automaticamente; não houve promoção para produção por esta tarefa. A prévia de métricas ainda em compilação foi cancelada. A configuração desta branch desativa prévias automáticas para as branches listadas nela, sem modificar as configurações do projeto Vercel ou alterar prévias já concluídas. A ausência de `PUBLIC_SIGNUP_ENABLED` foi conferida na lista de nomes das variáveis do projeto, sem ler valores; o estado efetivo de qualquer prévia deve ser confirmado antes de utilizá-la.
