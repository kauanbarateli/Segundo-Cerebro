# T014 — identidade, RLS e eventos no CI local

Estado: **identidade/RLS/eventos aprovados na execução própria de `20378ef`, junto do agregado completo de três casos**. A primeira prova própria de `ab634e1` permanece abaixo, quando a senha ainda reprovava o agregado. O [mínimo Auth](t014-auth-local-ci.md) e a [troca normal de senha pela GUI](t014-auth-normal-password-ci.md) conservam seus aceites separados. Essa prova GoTrue/DataAPI local não certifica RLS de todos os módulos, banco hospedado ou produção.

## Resultado próprio de 20378ef

A [execução Auth própria 38045796609](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38045796609), no SHA `20378ef4d8f1eab8a550c2dda3d02f9da8ad17bc`, terminou **completed/success**, com agregado schema3 `PASSED`. Os três casos passaram nesta ordem: logout→identity-data-api→password-change. A stack local descartável PG17/GoTrue aplicou 17 migrations e aprovou 1.246 checks de catálogo. Logout e identidade passaram cada um 12 estágios/11 checks, duas fixtures criadas/removidas e três contextos; a identidade repetiu RLS before com 12 operações/dez checks/dois DMLs/quatro recusas SQL, after com quatro operações/cinco checks/uma recusa SQL, e eventos com 12 operações/nove GET/uma RPC/dois DMLs recusados/nove checks, baselines A/B 4 e exatamente um evento novo.

A senha passou **15 estágios e 19 checks**, com duas fixtures criadas/removidas e três contextos: terminal completo da troca, cookies Auth/checkpoint removidos, JWT antigo A2 ainda não expirado recusado, B original intacta, senha antiga recusada sem sessão, novo login GUI e página protegida com sessão nova distinta. A limpeza revogou globalmente a nova A e B; ACK e ausência SDK foram confirmados antes de contabilizar as exclusões. As contagens foram quatro POSTs de login A, um B, uma troca e orçamento de cinco tentativas A; são contadores do ensaio, sem alegar hits observados do provider. Ambos os checkpoints READ ONLY de `auth.users` vazio, saídas naturais/remoção dos três namespaces, descarte da stack e remoção dos diretórios privados passaram. Nenhum latch de escrita permaneceu incerto. A [evidência pública fechada](evidence/auth-local-ci-three-scenarios-passed-20261010.json) conserva as provas separadas, sem dados de conta ou respostas brutas.

A [Foundation própria 38045796599](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38045796599), do mesmo SHA, também terminou **completed/success**: 1.558 testes em UTC e 1.558 em America/Sao_Paulo, 302 testes de scripts mais dois controles separados de scanner, 187 E2E demo, 17 migrations/35 asserções e catálogo local 1.243. A [evidência própria](evidence/foundation-ci-auth-effects-20261010.json) registra suas contagens; não empresta aprovação de outra revisão. Esses PASSs locais não certificam SMTP/PKCE, troca forçada, refresh, RLS de todos os módulos, aparelhos, produção ou aplicação hospedada da 017. As falhas anteriores permanecem como histórico de seus contratos e execuções.

## Resultado real de ab634e1

O [Auth CI 38044510367](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38044510367), no SHA `ab634e1b06a904ef1521cb9dc4dffe734434f3a8`, terminou `failed` no agregado schema3. A stack local real PG17/GoTrue aplicou 17 migrations e aprovou o catálogo 1.246. O mínimo passou 12/11 com duas fixtures criadas/removidas e três contextos. O caso novo de identidade também passou Auth 12/11/2/2/3, suas duas provas auxiliares e saída natural/remoção do namespace. Ambos os checkpoints READ ONLY de `auth.users` vazio foram confirmados.

| Prova própria de identidade | Resultado observado |
| --- | --- |
| RLS before | 12 operações, dois PATCHs diretos/quatro recusas SQL, dez checks aprovados |
| RLS after | Quatro operações, zero DML/uma recusa SQL, cinco checks aprovados usando A revogado e B original |
| Eventos append-only | 12 operações: nove GET, uma RPC legítima, dois DMLs recusados/duas recusas SQL; nove checks aprovados, baselines A/B 4 e exatamente um evento novo |
| Cleanup e namespace | Duas fixtures com ACK/ausência SDK confirmados; saída natural e remoção do namespace; latches RLS/eventos falsos |

A senha falhou em `POST_REQUEST_ABORTED`/`OUTCOME_UNCERTAIN` no primeiro login A: duas fixtures criadas, zero exclusões SDK certificadas, três contextos, A1/B0/PW0. Nenhuma troca foi tentada. Esse primeiro ponto não certifica conclusão de status/navegação ou causa do aborto. Descarte dos namespaces/stack/diretórios foi confirmado separadamente, sem aprovar senha ou sua limpeza individual. A [evidência pública fechada](evidence/auth-local-ci-identity-events-20261010.json) preserva os três casos e suas projeções próprias. A [Foundation própria 38044510305](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38044510305) concluiu success com 1.558 testes em UTC e em America/Sao_Paulo, 279 scripts mais dois controles de scanner separados, 187 E2E demo, 17 migrations/35 asserções e catálogo local 1.243. A [evidência própria](evidence/foundation-ci-identity-events-20261010.json) não herda contagens de outro SHA nem aprova o caso de senha.

## Sequência e relatórios independentes

O [orquestrador](../../scripts/verification/auth-local-ci.mjs) passa a emitir agregado `schemaVersion:3`, com exatamente três casos nesta ordem: `logout`, `identity-data-api`, `password-change`. O dispatcher e a [configuração Playwright](../../playwright.auth-local.config.ts) usam três filenames literais; não há seletor de cenário em ambiente, grep, URL ou valor do report. Cada caso conserva namespace, diretório privado, HOME, HMACs e fixtures próprios. Os specs e reports mínimo v1/senha v2 permanecem intactos.

Entre os casos, dois checkpoints fixos registram `{after,before,confirmed}`: logout→identidade e identidade→senha. Só ficam confirmados depois do PASS completo do caso anterior, limpeza individual, saída natural/remoção do namespace e consulta local READ ONLY de `auth.users` vazio. Isso não declara dados da aplicação ou limitadores pré-login globalmente vazios. Falha de caso/checkpoint impede os próximos; provas aprovadas anteriores ficam congeladas e preservadas. Uma falha da senha não apaga a prova de identidade nem aprova o agregado.

O caso de identidade tem sete campos próprios: `scenario,status,code,report,namespace,identityRls,events`. Os casos mínimo/senha mantêm cinco. Auth, RLS e eventos precisam passar individualmente, sem incerteza, e o namespace/cleanup precisam estar confirmados. Campo extra, schema cruzado, componente ausente/não executado/reprovado, processo falho ou namespace sem saída natural impedem PASS; nenhum check é emprestado de outro caso.

O [contrato puro](../../tests/e2e-auth-local/identity-data-api-contract.mjs) fecha três arquivos auxiliares, selecionados somente pelo cenário interno esperado:

| Arquivo privado do caso | Contrato |
| --- | --- |
| `auth-local-ci-report.json` | Auth schema3/`identity-data-api`, 12 estágios/11 checks, contagens2/2/3; os 31 pontos mínimos mais `IDENTITY_RLS_BEFORE`, `EVENT_APPEND_ONLY`, `IDENTITY_RLS_AFTER` |
| `auth-local-ci-identity-rls-report.json` | Packet schema1/`identity-data-api`; before e after separados, ou `null` quando não executados; latch de escrita obrigatório |
| `auth-local-ci-events-report.json` | Wrapper schema1/`identity-data-api`; report próprio `events-append-only`, ou `null`/não executado; latch de escrita obrigatório |

O leitor limita **cada arquivo a 16KiB**, conferindo arquivo regular, ausência de symlink, realpath exato, `open` sem seguir symlink e leitura limitada antes de decodificar UTF8 fatal/JSON. Cada projeção válida é preservada mesmo se outro arquivo estiver ausente/malformado, com falha explícita do caso. O corpo não escolhe paths/validator, e não existe fallback. Erros de IO/JSON/provider não entram na saída.

## Recorte real executado

O [spec próprio](../../tests/e2e-auth-local/identity-data-api-local.spec.ts) usa A1/A2/B ordinários pela GUI real, com tokens confirmados por GoTrue e `my_access_state`; UUID/sessão/expiração decodificados são apenas binding. Admin SDK local serve somente à criação, verificação/revogação e limpeza das fixtures exatas. As leituras e tentativas de domínio usam publishable+JWT próprio, sem master, seed, concessão ou flag alterada.

1. RLS before: 12 operações, dois PATCHs diretos recusados/quatro recusas SQL, dez checks. Snapshots próprios não vazios precedem foreign0; anônimo e colunas protegidas precisam de negativas reais, com perfil/moderação/acesso intactos.
2. Eventos: 12 operações, nove GET, uma mutação legítima por `update_identity` e dois DMLs negativos. O provisionamento fresh possui quatro eventos próprios `created/api`; a RPC deve acrescentar exatamente um evento `profile/updated/web`, preservando bijeção/metadados anteriores. Selecionar somente sete colunas permitidas. PATCH/DELETE do evento exato exigem403/42501 e releitura intacta; B mantém baseline não vazio e foreign0.
3. Logout global real de A: resposta/políticas/cookies completos, JWT antigo A2 ainda não expirado recusado e B original preservada.
4. RLS after: quatro operações sem DML, uma recusa SQL/cinco checks, usando o mesmo JWT A2 revogado e B original. A não lê seu perfil nem acessa a RPC; B conserva snapshot e acesso ordinário.
5. Cleanup exato: pré-check de marcador/dono, revogação das sessões conhecidas, ACK fechado e ausência404 antes de contar exclusões. Incerteza Auth, RLS ou eventos impede certificar deletes; descarte da infraestrutura é evidência distinta.

São 28 operações DataAPI dos helpers, quatro DMLs diretos negativos e uma mutação legítima. POSTs de RPC de leitura não são mutações de domínio. Transport é finito: origem loopback fixa, redirect recusado, até 15s incluindo body reader e 1MiB, sem retry/default fetch. Perda de resposta mantém latch sticky; uma releitura posterior não resolve uma escrita anterior incerta. A não herda limpeza de uma sessão nova do caso de senha, pois nenhuma troca ou login posterior ocorre neste cenário.

CLI 2.120.0, PG17, imagem Playwright fixada, ambiente limpo, 17 migrations canônicas e catálogo local continuam os mesmos. Não há serviço iniciado neste host Windows, SQL hospedado, mudança de produto/pins, nova migration ou aplicação remota. Traces/HAR/screenshots/vídeo/logs brutos continuam desligados; reports contêm apenas enums, booleans e contagens, sem UUID/email/JWT/SID/senha/patch/conteúdo.

## Validação e limites

Antes da publicação, os 62 controles locais do consumidor passaram, zero fail/skip, incluindo sete novos controles de seleção/provas/leitura. Exercitam schemas/projeções independentes, ausências e recusas, snapshots congelados, falha nos dois checkpoints, retenção de provas anteriores e leitura limitada dos arquivos. TypeScript integral, lint próprio e scanner passaram. Essa suíte usa fakes/artefatos sintéticos e quatro controles anteriores de semântica SQL em PGlite/PG18; não executou Supabase/GoTrue ou SQL hospedado. O primeiro aceite real veio separadamente da execução de `ab634e1`, cujo agregado permaneceu reprovado. A execução própria de `20378ef` repetiu integralmente a prova de identidade e aprovou também a senha, como registrado no checkpoint atual.

Esse aceite não cobre RLS de todos os módulos, produção, refresh/SMTP, concorrência, Atividade/diff de toda escrita, backup ou aparelhos. A [017 manual, reconferência hospedada e novo export oficial](entrega-mvp-pendencias.md#nova-migration-017--aplicação-manual-pendente) continuam separados; não reaplicar 001–016 ou bootstrap. As [pendências de entrega](entrega-mvp-pendencias.md) conservam os critérios originais das issues.
