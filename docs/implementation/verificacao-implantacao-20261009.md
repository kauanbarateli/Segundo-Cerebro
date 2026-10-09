# Verificação da implantação — 09/10/2026

O mantenedor informou que cadastrou as variáveis na Vercel e aplicou as nove migrations faltantes no Supabase pessoal. Confirmou também `APP_MODE=supabase` no ambiente Production. O relato foi incorporado ao estado do projeto; não se reaplicou SQL, fez bootstrap ou criou fixture remota.

## Banco pessoal: evidência obtida

Consultas HTTP somente leitura foram feitas exclusivamente em `rishenjoikgmfubmnfiu`, com a configuração local já autorizada, sem exibir chaves ou conteúdo de usuários:

- REST OpenAPI retornou HTTP 200, com 36 definitions e 55 paths RPC; uma entrada é o event trigger `rls_auto_enable`, não uma RPC comum de domínio.
- Tabelas/RPCs dos módulos Financeiro, Conhecimento, Admin, preferências, Projetos/Hábitos, Drive, Busca/Atividade, Cofre e Google estão presentes.
- Revisão independente comparou as 50 RPCs usadas pela aplicação e 186 argumentos: não encontrou diferença de nomes ou formatos SQL entre adapters e metadados observados.
- Os buckets `second-brain-staging` e `second-brain-files` existem e estão privados.
- Auth settings retornou `disable_signup=false`: **cadastro público ainda habilitado**. Esta é uma leitura atual, posterior ao registro de 07/10; fechamento permanece pendente.

Metadados corroboram a instalação informada. Não comprovam bytes/hashes das migrations executadas, histórico de execução, corpos das funções, RLS/grants efetivos, nulabilidade ou comportamento de transações/sessões. Nenhum dado pessoal foi lido como fixture.

O MCP respondeu sem permissão tanto para obter o projeto pessoal quanto para uma consulta explicitamente readonly. Não houve tentativa em outra organização ou extração de credenciais OAuth. Por essa limitação, o catálogo de 1.242 verificações estruturais e a geração oficial de tipos **ainda não foram executados contra o banco hospedado**. O arquivo gerado existente permanece identificado como histórico; contratos planejados não foram rebatizados como geração real.

## Vercel: estado antes do novo deployment

GitHub registrou deployment Production para `5403b70e119564859d516bde61f589ebf39b544c`, concluído, no projeto `segundo-cerebro-of`. Homepage oficial: `https://segundo-cerebro-of.vercel.app`.

O agente verificou HTTP sem login ou bypass:

- Alias público: `/`, `/entrar`, `/tarefas`, `/offline` e manifest HTTP 200. Raiz/Tarefas contêm marcadores explícitos da demonstração; não há redirect Auth. `/entrar` informa autenticação indisponível e desabilita o formulário. `/api/search` e `/api/calendar` retornam 503 `UNAVAILABLE`.
- HTTPS, HSTS, CSP nonce/strict-dynamic/wasm-unsafe-eval, origem Storage restrita ao projeto pessoal, nosniff, DENY e no-store foram observados nas páginas. Isso não comprova a jornada autenticada.
- URL específica do deployment: HTTP 401 por Vercel Deployment Protection em todas as rotas consultadas. Não foi contornada; essa resposta pertence à borda Vercel, não ao Auth do aplicativo.

Com APP_MODE confirmado pelo mantenedor, falta verificar um **novo deployment que incorpore as variáveis**. A atualização versionada deste relatório dispara o fluxo Git→Vercel configurado; seu resultado e o smoke posterior devem ficar registrados nas issues #20/#21/#35. Alterações de variáveis não atingem deployments anteriores, conforme [documentação Vercel](https://vercel.com/docs/environment-variables).

## Novo deployment e diagnóstico

O deployment Production de `1f33380632b227eddb9869778c07e6ab1e70a376` concluiu com status Vercel success em 09/10 às 20:15:40 UTC. O [CI dessa revisão](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37985618234) também concluiu com sucesso.

A conferência do alias às 20:16:46 UTC encontrou HTTP 503 em `/`, `/tarefas`, `/entrar`, `/api/search` e `/api/calendar`, com a mensagem fixa do middleware de Auth. Offline/manifest seguiram HTTP 200. Essa falha ocorre em `readAuthConfiguration()`, antes de criar o SDK ou consultar o banco. É configuração efetiva inválida/ausente, não evidência de falha nas migrations ou de Deployment Protection.

O mantenedor identificou `APP_URL` ausente e informou seu cadastro em Production como `https://segundo-cerebro-of.vercel.app`. A correção necessita outro deployment. O build passa a validar a configuração explícita de modo Supabase com as regras de produção, emitindo somente nomes/regras dos campos inválidos, sem valores. Demo/CI sem credenciais continuam funcionando. O resultado do próximo deployment e seu smoke devem ser registrados na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35); build concluído sozinho não certifica disponibilidade de Auth.

## Continuidade

1. Conferir o próximo SHA/deployment após o cadastro de APP_URL e o alias público. Em modo conectado sem sessão, rota privada deve levar ao login e API deve recusar autenticação; login deve estar disponível. Não assumir sucesso apenas pelo build.
2. Fechar cadastro público no Dashboard pessoal e conferir novamente Auth settings. SMTP/recuperação continuam exigindo provedor e ensaio próprios.
3. Executar `supabase/tests/release-catalog.sql` readonly pelo canal pessoal autorizado; guardar resultado fechado, exigir zero desvios e registrar hashes/versões executados. Não usar fixtures SQL no banco com contas reais.
4. Gerar tipos oficiais do schema instalado via canal pessoal/CLI/Dashboard, confrontar os contratos e revalidar. [Guia Supabase](https://supabase.com/docs/guides/api/rest/generating-types).
5. Prosseguir com jornadas conectadas, Storage, Google/cron, concorrência, backup/restore e dispositivos do [relatório de pendências](entrega-mvp-pendencias.md).

Nenhuma issue foi encerrada somente com o relato de instalação ou introspecção REST. BlackSheep/VOE e suas chaves/configurações foram preservados.
