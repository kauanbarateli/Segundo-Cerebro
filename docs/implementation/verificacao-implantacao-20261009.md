# Verificação da implantação — 09/10/2026

O mantenedor informou que cadastrou as variáveis na Vercel e aplicou as nove migrations faltantes no Supabase pessoal. Confirmou também `APP_MODE=supabase` no ambiente Production. O relato foi incorporado ao estado do projeto; não se reaplicou SQL, fez bootstrap ou criou fixture remota.

O estado mais recente é o deployment aprovado de `190f5f0`, com as correções adicionais e a configuração Admin preparada. O smoke confirmou login disponível, rotas privadas redirecionando e APIs recusando acesso sem sessão. As verificações abaixo conservam a cronologia dos deployments anteriores, incluindo a correção publishable de Production. Disponibilidade sem sessão não certifica login real, persistência ou aceite operacional.

## Banco pessoal: evidência obtida

Consultas HTTP somente leitura foram feitas exclusivamente em `rishenjoikgmfubmnfiu`, com a configuração local já autorizada, sem exibir chaves ou conteúdo de usuários:

- REST OpenAPI retornou HTTP 200, com 36 definitions e 55 paths RPC; uma entrada é o event trigger `rls_auto_enable`, não uma RPC comum de domínio.
- Tabelas/RPCs dos módulos Financeiro, Conhecimento, Admin, preferências, Projetos/Hábitos, Drive, Busca/Atividade, Cofre e Google estão presentes.
- Revisão independente comparou as 50 RPCs usadas pela aplicação e 186 argumentos: não encontrou diferença de nomes ou formatos SQL entre adapters e metadados observados.
- Os buckets `second-brain-staging` e `second-brain-files` existem e estão privados.
- Auth settings retornou `disable_signup=false`: **cadastro público ainda habilitado**. Esta é uma leitura atual, posterior ao registro de 07/10; fechamento permanece pendente.
- Às 22:32:49 UTC de 09/10, HEAD sem sessão nas 36 tabelas observadas retornou apenas HTTP 401/403, usando a chave publishable pessoal. Nenhuma linha foi solicitada ou retornada, e nenhum SQL foi executado. O relatório privado ignorado é `work/anonymous-rest-verification-20261009.json`.

Metadados corroboram a instalação informada; o HEAD demonstra a recusa de acesso anônimo aos caminhos consultados. Não comprovam bytes/hashes das migrations executadas, histórico de execução, corpos das funções, todas as RLS/grants efetivas, nulabilidade, isolamento entre usuários ou comportamento de transações/sessões. Nenhum dado pessoal foi lido como fixture.

O MCP respondeu sem permissão tanto para obter o projeto pessoal quanto para uma consulta explicitamente readonly. Não houve tentativa em outra organização ou extração de credenciais OAuth. Por essa limitação, o catálogo de 1.242 verificações estruturais e a geração oficial de tipos **ainda não foram executados contra o banco hospedado**. O arquivo gerado existente permanece identificado como histórico; contratos planejados não foram rebatizados como geração real.

## Vercel: estado antes do novo deployment

GitHub registrou deployment Production para `5403b70e119564859d516bde61f589ebf39b544c`, concluído, no projeto `segundo-cerebro-of`. Homepage oficial: `https://segundo-cerebro-of.vercel.app`.

O agente verificou HTTP sem login ou bypass:

- Alias público: `/`, `/entrar`, `/tarefas`, `/offline` e manifest HTTP 200. Raiz/Tarefas contêm marcadores explícitos da demonstração; não há redirect Auth. `/entrar` informa autenticação indisponível e desabilita o formulário. `/api/search` e `/api/calendar` retornam 503 `UNAVAILABLE`.
- HTTPS, HSTS, CSP nonce/strict-dynamic/wasm-unsafe-eval, origem Storage restrita ao projeto pessoal, nosniff, DENY e no-store foram observados nas páginas. Isso não comprova a jornada autenticada.
- URL específica do deployment: HTTP 401 por Vercel Deployment Protection em todas as rotas consultadas. Não foi contornada; essa resposta pertence à borda Vercel, não ao Auth do aplicativo.

Esse recorte precedeu o redeploy que incorporou as variáveis, registrado abaixo. Alterações de variáveis não atingem deployments anteriores, conforme [documentação Vercel](https://vercel.com/docs/environment-variables).

## Novo deployment e diagnóstico

O deployment Production de `1f33380632b227eddb9869778c07e6ab1e70a376` concluiu com status Vercel success em 09/10 às 20:15:40 UTC. O [CI dessa revisão](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37985618234) também concluiu com sucesso.

A conferência do alias às 20:16:46 UTC encontrou HTTP 503 em `/`, `/tarefas`, `/entrar`, `/api/search` e `/api/calendar`, com a mensagem fixa do middleware de Auth. Offline/manifest seguiram HTTP 200. Essa falha ocorre em `readAuthConfiguration()`, antes de criar o SDK ou consultar o banco. É configuração efetiva inválida/ausente, não evidência de falha nas migrations ou de Deployment Protection.

O mantenedor identificou `APP_URL` ausente e informou seu cadastro em Production como `https://segundo-cerebro-of.vercel.app`. O build passou a validar a configuração explícita de modo Supabase com as regras de produção, emitindo somente nomes/regras dos campos inválidos, sem valores. Demo/CI sem credenciais continuam funcionando. O novo prebuild revelou outro campo inválido, conforme diagnóstico resolvido abaixo; build concluído sozinho não certifica disponibilidade de Auth.

## CI aprovado e falha anterior de Production

A correção foi publicada em [093baf5](https://github.com/kauanbarateli/Segundo-Cerebro/commit/093baf58e79eebe02fecb6027243ea37dd9f0100), revisada independentemente e validada com dez regressões novas. TypeScript, lint, build, integridade SQL e scanners locais passaram. O [CI dessa revisão funcional](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37986615792) concluiu com sucesso: 1.427 testes nos dois fusos, 67 testes Node e 168 E2E, além dos demais portões.

O [deployment Production da correção](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/Fukp21HNaZ9613LZDkZfoxf8tdTC) falhou em 09/10 às 20:23:14 UTC. O status público não fornecia o erro específico. Após autorizar e reautorizar a integração Vercel no escopo pessoal, as consultas a logs/deployments continuaram recusadas pela plataforma; não houve contorno da autenticação. O mantenedor forneceu o trecho do Build Logs necessário ao diagnóstico.

Este relatório separa o CI aprovado da revisão funcional e o deployment que falhou. Um commit posterior apenas documental não substitui a prova de disponibilidade. As issues mantêm seus aceites externos e o histórico; migrations informadas como aplicadas não voltam à fila de execução.

## Configuração corrigida no redeploy anterior

O trecho fornecido pelo mantenedor identificou a falha do prebuild, sem valores de chaves:

```json
{"ready":false,"errors":["SUPABASE_PUBLISHABLE_KEY: Formato inválido; exige chave publishable atual."]}
```

O aviso de install scripts não foi a causa indicada pelo prebuild. A chave publishable local foi validada exclusivamente contra o endpoint Auth do projeto pessoal, que respondeu HTTP 200; seu valor não foi exibido, registrado neste relatório ou enviado ao Git. A integração Vercel permitiu corrigir esse campo no ambiente Production do projeto `segundo-cerebro-of`, embora continuasse recusando os logs. Nenhuma chave de BlackSheep/VOE foi consultada ou alterada.

O [redeploy Production](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/G8d25EJg6KkVtATuiSrpbgghum2y), identificado como `dpl_G8d25EJg6KkVtATuiSrpbgghum2y`, publicou a revisão `a3b1a5296a504c758739e2a8facad0b716bcc53b` e recebeu status success no GitHub. O [CI dessa revisão documental](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/37987747165) também concluiu com sucesso. As correções locais subsequentes ainda em revisão não foram incluídas nesse redeploy.

Às **22:30 UTC de 09/10/2026 (19:30 em Fortaleza)**, o smoke HTTP somente leitura no [alias oficial](https://segundo-cerebro-of.vercel.app) confirmou:

| Caminho/verificação | Resultado observado |
| --- | --- |
| `/` e `/tarefas` | HTTP 307 para `/entrar?notice=session-required` no alias oficial |
| `/entrar` | HTTP 200; campos e envio do login habilitados, sem demonstração ou aviso de Auth indisponível |
| `/api/search` | HTTP 401, código fechado `UNAVAILABLE` do aplicativo |
| `/api/calendar` | HTTP 401, código `UNAUTHENTICATED` do aplicativo |
| `/offline` e manifest | HTTP 200; manifest standalone com quatro ícones |
| Headers | HTTPS/HSTS, CSP com nonce/strict-dynamic/wasm, origem pessoal restrita, no-store nas páginas privadas, nosniff e DENY |

Não foram observados HTTP 503 nessa rodada. As recusas 401 das APIs pertencem ao aplicativo, não à Vercel Deployment Protection. O relatório privado ignorado é `work/deploy-smoke-20261009-repaired-publishable.json`.

**O bloqueio de configuração e disponibilidade do login foi resolvido.** Não houve login com conta real, bypass, leitura de dados pessoais, envio de senha, escrita no banco ou reaplicação de migrations. Cookies de uma sessão autenticada, refresh, isolamento entre usuários, SMTP, concorrência, Google e Storage continuam exigindo ensaios próprios.

## Revisão adicional validada localmente

As entregas dos agentes passaram por revisão independente e regressões. Calendário mantém alvos de pelo menos 44px em quatro/oito eventos sobrepostos e cria nota com título editável de até 120 caracteres UTF-16, preservando o contexto completo. Conhecimento permite criar o primeiro Caderno e preserva rascunhos somente em memória da sessão, com descarte no logout, 401 e troca de usuário. Restore encerra o stream em falha precoce de upload e dispõe de inspector privado para conferir senha/kit originais em alvo isolado sem mudar os pins do aplicativo. A revisão encontrou e corrigiu a retenção das metades anteriores do kit ao trocar o pacote.

A rodada local aprovou TypeScript/lint, 1.441 testes nos dois fusos, 78 testes Node, build, camadas, DS/Impeccable, integridade SQL, catálogo PGlite e scanners. A suíte Chromium exercitou 187 casos: 184 passaram; três falharam ao fechar traces porque outra execução limpou os artefatos compartilhados. Os quatro casos Financeiro correspondentes passaram com diretório isolado, e os três casos finais do inspector passaram após o último ajuste. A falha de infraestrutura permaneceu registrada; não se ampliaram timeouts nem alterou a aplicação para mascará-la. O audit de produção retornou zero vulnerabilidades; o audit de desenvolvimento mantém cinco registros high sem patch oficial de braces.

Também foi gerado `ADMIN_COMMAND_SECRET` exclusivo com 48 bytes aleatórios, salvo somente na configuração local ignorada e cadastrado como sensível em Production antes do deployment `190f5f0`. Os segredos Auth existentes não foram alterados. Efeitos administrativos e concorrência ainda não estão certificados.

Não há migrations novas ou SQL remoto executado neste recorte. Os resultados de `093baf5` e `a3b1a52` permanecem atribuídos às suas próprias revisões; validação local não equivale a CI verde ou jornada autenticada em produção.

## Publicação da revisão adicional

O commit [190f5f0](https://github.com/kauanbarateli/Segundo-Cerebro/commit/190f5f05cf47f0a15c3b23f6414bfe70f5a38334) foi enviado para main. O [deployment Vercel](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/HnSDSurqQdFUPTcnJfAQFFShLH3h) recebeu status success no GitHub para esse SHA. Às **22:49:52 UTC (19:49:52 em Fortaleza)**, nova rodada sem sessão no alias confirmou `/entrar` HTTP 200 habilitado, `/` e `/tarefas` HTTP 307 para login, APIs de busca/calendário HTTP 401 da aplicação, offline/manifest HTTP 200 e os headers de proteção. Nenhum HTTP 503 foi observado.

O relatório sanitizado ignorado é `work/deploy-smoke-190f5f0.json`. A consulta HTTP isolada não identifica o SHA do alias: o vínculo de revisão provém do status Vercel dessa revisão. Não houve login, credenciais, bypass, comandos Admin ou escrita remota.

O [CI da revisão](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38001056671) concluiu com sucesso: instalação limpa, audit de produção com zero vulnerabilidades, parser SQL de 59 arquivos sem erros, chain local/catálogo, TypeScript/lint, 1.441 testes em cada fuso, 78 testes Node, camadas/DS/Impeccable, build/scanner e **187/187 E2E Chromium aprovados**. A rodada E2E terminou às 22:53:03 UTC, sem a colisão de artefatos observada no computador local. Resultados e aceites externos permanecem registrados na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35).

## Continuidade

1. Conferir CI, deployment/SHA e smoke da revisão adicional publicada na issue #35. O redeploy anterior já resolveu o erro publishable e comprovou login/guards sem sessão; falta executar jornadas autenticadas e não apenas consultar o build.
2. Fechar cadastro público no Dashboard pessoal e conferir novamente Auth settings. SMTP/recuperação continuam exigindo provedor e ensaio próprios.
3. Executar `supabase/tests/release-catalog.sql` readonly pelo canal pessoal autorizado; guardar resultado fechado, exigir zero desvios e registrar hashes/versões executados. Não usar fixtures SQL no banco com contas reais.
4. Gerar tipos oficiais do schema instalado via canal pessoal/CLI/Dashboard, confrontar os contratos e revalidar. [Guia Supabase](https://supabase.com/docs/guides/api/rest/generating-types).
5. Prosseguir com jornadas conectadas, Storage, Google/cron, concorrência, backup/restore e dispositivos do [relatório de pendências](entrega-mvp-pendencias.md).

Nenhuma issue foi encerrada somente com o relato de instalação ou introspecção REST. BlackSheep/VOE e suas chaves/configurações foram preservados.
