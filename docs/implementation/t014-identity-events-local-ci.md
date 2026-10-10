# T014 — identidade, RLS e eventos no CI local

Estado: **integração preparada, sem execução real própria do novo cenário**. O [mínimo Auth](t014-auth-local-ci.md) conserva sua prova de login, proteção, logout global e isolamento. A [troca normal de senha pela GUI](t014-auth-normal-password-ci.md) conserva seu resultado e aceite separados. Os controles locais deste recorte não certificam GoTrue/DataAPI reais, RLS hospedado ou produção.

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

O leitor limita **cada arquivo a16KiB**, conferindo arquivo regular, ausência de symlink, realpath exato, `open` sem seguir symlink e leitura limitada antes de decodificar UTF8 fatal/JSON. Cada projeção válida é preservada mesmo se outro arquivo estiver ausente/malformado, com falha explícita do caso. O corpo não escolhe paths/validator, e não existe fallback. Erros de IO/JSON/provider não entram na saída.

## Recorte real previsto

O [spec próprio](../../tests/e2e-auth-local/identity-data-api-local.spec.ts) usa A1/A2/B ordinários pela GUI real, com tokens confirmados por GoTrue e `my_access_state`; UUID/sessão/expiração decodificados são apenas binding. Admin SDK local serve somente à criação, verificação/revogação e limpeza das fixtures exatas. As leituras e tentativas de domínio usam publishable+JWT próprio, sem master, seed, concessão ou flag alterada.

1. RLS before:12 operações, dois PATCHs diretos recusados/quatro recusas SQL, dez checks. Snapshots próprios não vazios precedem foreign0; anônimo e colunas protegidas precisam de negativas reais, com perfil/moderação/acesso intactos.
2. Eventos:12 operações, nove GET, uma mutação legítima por `update_identity` e dois DMLs negativos. O provisionamento fresh possui quatro eventos próprios `created/api`; a RPC deve acrescentar exatamente um evento `profile/updated/web`, preservando bijeção/metadados anteriores. Selecionar somente sete colunas permitidas. PATCH/DELETE do evento exato exigem403/42501 e releitura intacta; B mantém baseline não vazio e foreign0.
3. Logout global real de A: resposta/políticas/cookies completos, JWT antigo A2 ainda não expirado recusado e B original preservada.
4. RLS after:quatro operações sem DML, uma recusa SQL/cinco checks, usando o mesmo JWT A2 revogado e B original. A não lê seu perfil nem acessa a RPC; B conserva snapshot e acesso ordinário.
5. Cleanup exato: pré-check de marcador/dono, revogação das sessões conhecidas, ACK fechado e ausência404 antes de contar exclusões. Incerteza Auth, RLS ou eventos impede certificar deletes; descarte da infraestrutura é evidência distinta.

São28 operações DataAPI dos helpers, quatro DMLs diretos negativos e uma mutação legítima. POSTs de RPC de leitura não são mutações de domínio. Transport é finito: origem loopback fixa, redirect recusado, até15s incluindo body reader e1MiB, sem retry/default fetch. Perda de resposta mantém latch sticky; uma releitura posterior não resolve uma escrita anterior incerta. A não herda limpeza de uma sessão nova do caso de senha, pois nenhuma troca ou login posterior ocorre neste cenário.

CLI2.120.0, PG17, imagem Playwright fixada, ambiente limpo, 17 migrations canônicas e catálogo local continuam os mesmos. Não há serviço iniciado neste host Windows, SQL hospedado, mudança de produto/pins, nova migration ou aplicação remota. Traces/HAR/screenshots/vídeo/logs brutos continuam desligados; reports contêm apenas enums, booleans e contagens, sem UUID/email/JWT/SID/senha/patch/conteúdo.

## Validação e limites

Os62 controles locais do consumidor passaram, zero fail/skip, incluindo sete novos controles de seleção/provas/leitura. Exercitam schemas/projeções independentes, ausências e recusas, snapshots congelados, falha nos dois checkpoints, retenção de provas anteriores e leitura limitada dos arquivos. TypeScript integral, lint próprio e scanner passaram. A suíte usa fakes/artefatos sintéticos e conserva quatro controles anteriores de semântica SQL em PGlite/PG18; não executou Supabase/GoTrue ou SQL hospedado, nem aprovou o cenário real. A execução própria posterior no GitHub e a revisão de seu report serão necessárias para concluir o recorte de identidade/append-only.

Esse aceite não cobre RLS de todos os módulos, produção, refresh/SMTP, concorrência, Atividade/diff de toda escrita, backup ou aparelhos. A [017 manual, reconferência hospedada e novo export oficial](entrega-mvp-pendencias.md#nova-migration-017--aplicação-manual-pendente) continuam separados; não reaplicar001–016 ou bootstrap. As [pendências de entrega](entrega-mvp-pendencias.md) conservam os critérios originais das issues.
