# Handoff de retomada — Segundo Cérebro — 10/10/2026

**Demanda pausada por solicitação do mantenedor. Não retomar implementação, testes de execução, publicações ou operações remotas sem nova instrução de retomada.** Os agentes encerraram a autoria e salvaram o trabalho parcial. Durante a preparação deste handoff foram realizadas somente consultas de estado, leitura, hashes e documentação; nenhuma issue foi alterada, migration aplicada, captura de log efetuada ou implementação enviada.

Snapshot de referência: **10/10/2026, 22:38:27 UTC / 19:38:27 America/Fortaleza**. Estados do GitHub consultados para este handoff; não são herdados da documentação anterior. [Snapshot estruturado](evidence/handoff-retomada-20261010-snapshot.json) contém estados, run IDs e hashes completos para conferência.

## 1. Entrar no projeto certo

Checkout existente, fora do OneDrive:

```text
C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro
```

Repositório principal: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). Branch `main`; **HEAD e referência local origin/main: e74d4c059c0f60a9847c947ef511b8df672da5fa**. O push SSH dessa revisão foi confirmado antes da pausa.

Últimos commits, sem coautoria:

| SHA | Mensagem | Situação |
| --- | --- | --- |
| e74d4c059c0f60a9847c947ef511b8df672da5fa | test: validar administração e confirmação de exclusão local | Commit e push confirmados; quatro CIs próprios concluídos |
| a5a6eaa7dc9fd9e7781ba221d8ef5a46639d5bd7 | test: exigir prova SQL de ausência no fluxo de imagens | Histórico preservado; Foundation/Storage falharam, Auth passou |
| 940f81ee53fa56cb9aa7428c4993e3be727cb85a | test: ampliar validações de administração, conhecimento e conta | Histórico preservado; Foundation 223/2 E2E, Auth passou; Storage somente status failure |

O agente que assumir precisa deste checkout para recuperar os nove arquivos WIP e os auxiliares privados ignorados. Eles não estão no GitHub. **Não usar reset/clean, não descartar untracked e não recriar o checkout por cima.** Em outra máquina, primeiro transferir somente os arquivos necessários mediante allowlist, sem `.env`, credenciais, raw logs ou material do Cofre.

Antes do próximo trabalho, ler nesta ordem:

1. `AGENTS.md`, `CONTEXT.md`, [decisões operacionais](decisoes-operacionais.md), sobretudo OP-007, OP-010, OP-012 e OP-015.
2. [Índice do planejamento](../planejamento/00-indice.md), [tickets e critérios originais](../planejamento/13-tickets.md), ADRs relevantes.
3. [DS 2.1 e protótipo](../planejamento/14-prototipo-interacoes.md), [design system](../planejamento/04-design-system.md), e a **Impeccable local** em `.agents/skills/impeccable/SKILL.md` antes de trabalho de interface.
4. Este handoff, [guia de pendências](pendencias-atuais-20261010.md) e [histórico de entrega](entrega-mvp-pendencias.md). **O guia/histórico publicados ainda têm a5 como checkpoint vigente; este handoff registra e74 e não reescreve esses snapshots.**

Materiais originais autorizados:

```text
C:\Users\Kauan Sousa Barateli\OneDrive\Documentos\Kauan Barateli\Maestri\Pessoal\Novo  -- Segundo Cerebro
```

Históricos: `git@github.com:kauanbarateli/segundo_cerebro.git` e `git@github.com:kauanbarateli/novo-segundo-cerebro.git`; os checkouts antigos ficam no diretório `work` externo ao repo. Consultar como referência; não executar scripts antigos com credenciais nem transplantar o DS histórico sobre DS 2.1.

## 2. Restrições e autorizações que continuam valendo

| Tema | Orientação de retomada |
| --- | --- |
| Supabase | **Somente o projeto pessoal rishenjoikgmfubmnfiu.** Nunca BlackSheep, Sistema VOE ou credenciais empresariais. |
| Migrations hospedadas | OP-012 vigente: aplicação **manual** pelo mantenedor. Preparar/versionar SQL, conferir efeitos em leitura; não executar schema remoto, reset, seeds ou bootstrap. CI/build/deploy não aplicam migrations remotas. |
| Fixtures | Nunca usar a conta pessoal master como fixture. Ensaios locais usam namespaces descartáveis, donos ordinários, IDs/marcadores exatos e limpeza comprovada. Provas hospedadas não autorizam fixtures SQL integrais sobre a base pessoal. |
| Interface | Skill Impeccable local, DS 2.1, Geist, foco/teclado/contraste/alvos e medidas reais. As duas revisões finitas da comparação Capturar foram concluídas; não inventar terceira rodada de redesenho. |
| Arquitetura | `src/core` puro, adapters para persistência, canais finos, isolamento por Usuário, eventos atômicos. Preservar fronteiras entre módulos. |
| GitHub | Commits, pushes e atualização de issues estão autorizados **na retomada**, após revisão/testes. Mensagens objetivas; nenhuma coautoria em conteúdo enviado. Preservar critérios originais e histórico dos corpos das issues. |
| SSH | A chave exclusiva do Segundo-Cerebro já tem escrita. Preservar todas as demais chaves e configurações, especialmente VOE. Não trocar conta/configuração global para resolver acesso. |
| Credenciais | Não imprimir, pedir pelo chat ou versionar tokens, senhas, cookies, URLs assinadas, kits ou `.env`. Segredos ficam fora de pasta sincronizada. |
| Validação | Diferenciar preparação pura, SQL local, SDK/bytes, navegador local, factories originais, hospedagem e aparelho. Uma prova não certifica automaticamente as demais. |
| Serviços locais | **Não iniciar Next/browser/stack Supabase no Windows.** Node puro/PGlite/Sharp/TypeScript/lint/discovery podem preparar a entrega após retomada. Execução nativa de stack/Chromium: Linux CI, depois de revisão. |
| Pausa | Não criar automação de retomada, novo push ou execução de CI. Os quatro runs já disparados antes da pausa concluíram; não foi necessário cancelá-los. |

O mantenedor adiou expressamente a validação humana autenticada no navegador de produção. **Não pedir novamente senha, login da conta master ou confirmação desse adiamento.** SMTP/Google/aparelhos/backup permanecem dependências próprias, sem ampliar critérios funcionais que não os exigem.

## 3. Estado real dos quatro CIs de e74

Todos: repositório principal, fonte `e74d4c059c0f60a9847c947ef511b8df672da5fa`, evento push, branch main, tentativa **1**.

| CI | Run | Estado consultado | Evidência local |
| --- | --- | --- | --- |
| CI principal / Foundation | [38091004806](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38091004806) | completed / **success**, atualizado 22:26:36 UTC | **Somente estado conferido. Captura própria de contadores/casos ainda não realizada.** |
| Auth local real | [38091004804](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38091004804) | completed / **success** | Captura feita uma única vez; schema4 validado, três casos próprios PASS |
| Captura imagem Storage local real | [38091004887](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38091004887) | completed / **success** | Captura feita uma única vez; schema2 validado, pipeline/objetos/Auth/final SQL PASS |
| Admin backend local real | [38091004802](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38091004802) | completed / **failure**, atualizado 22:23:37 UTC | **Logs não capturados. Causa desconhecida. Collector privado preparado, ainda sem QA própria Root/peer.** |

Não transformar o novo status Foundation success em contagens/casos presumidos. Conhecimento e Cofre têm correções de oráculo publicadas, mas a confirmação nominal das jornadas deste run precisa da captura própria. O failure de Administração também não identifica a causa nem quantas fixtures foram removidas.

### Auth: preservar captura já existente

Arquivos privados ignorados:

- `work/auth-e74d4c0-capture-closed-20261010.json`
- `work/auth-local-ci-persistence-e74d4c0-20261010-status.json`
- `work/auth-local-ci-persistence-e74d4c0-20261010-report.json`
- `work/auth-local-ci-38091004804.log` — **raw privado: não reabrir, imprimir ou publicar**.
- Collector original `work/capture-persistence-auth-ci-20261010.mjs` e wrapper específico `work/capture-auth-e74d4c0-closed-20261010.mjs`.

Report SHA-256: `0df26bd61eec8ae453e27eab3ca2489e6d2654cc2f3d44a0b4e14353d9e20803`.
Status SHA-256: `9452f44d323ea9b6f172fb5fc081c17e2cbb95802783a1cb0b0f7719158c2956`.

Três casos próprios: logout, identidade/persistência/RLS/eventos, troca normal de senha. 17 migrations/1.246 checks e limpezas SDK, namespaces naturais, stack e diretórios confirmados. Identidade/Capturas-Tarefas preserva suas contagens/recibos; usar o consumidor schema4 original para reavaliar a projeção fechada, sem abrir raw ou recapturar. O hash determinístico coincidente com runs anteriores não elimina o vínculo de fonte/status/run nem resolve falhas históricas de transporte.

### Storage: preservar captura própria e alcance

Stem privado:
`work/storage-local-ci-v2-38091004887-attempt1-e74d4c0-20261010-`,
com `claim.json`, `raw.log`, `status.json`, `report.json`, `summary.json`.

| Projeção | SHA-256 |
| --- | --- |
| report | aded13e528d0888e221b5273e84eb8708f28681ec70970be27052999e85dd357 |
| status | 94ea1e0587d44e782e2dd98510db45b4eb39e7798aaace1cd26850b0eb093a02 |
| summary | 393c6470deab0359ca0dc37e3d26338ddc26d6719bb3524083d41e67ed734776 |
| raw, apenas integridade | 6703c51819c1d7fa9a02241b6a17b5e03d5630e2c4057bb616d7c15d6c6154e2 |

Root e peer independente validaram a composição: 54 blobs Git + um marker oficial, schema2, PG17, 17 migrations/1.246 checks. Pipeline 12 estágios: 27 HTTP (10 RPC/10 públicos/7 Storage), PUT assinado sem credencial privilegiada, um Core/commit, duas inspeções SQL, dois eventos/dois recibos. Imagem 1.021 bytes/60×40 → 287 bytes/40×60, bytes medidos no servidor e EXIF removido.

Objetos: quatro HTTP, duas remoções/duas confirmações de ausência e duas inspeções SQL. Auth: 16 requests, duas contas criadas/duas excluídas/duas verificadas. Final domínio/metadados Storage/Auth ausentes, SQL confirmado e execução natural verdadeiros; unknown falso. Namespace/stack/diretórios são provas separadas.

O primeiro GET HTTP400/NoSuchKey/body404 continua **diagnóstico**, condicionado às demais provas; não é convertido isoladamente em HTTP404/ausência. `allDescendantsForceless` e inclusão de contagens de IO pendente continuam false.

Este PASS cobre **capture_image nativo local**. Não certifica upload por tela Next, factory pessoal, avatar ou produção. O peer aprovou o critério original 4 da #22 nesse alcance; ainda falta plano final dos cinco critérios/decisão Root/publicação/readback.

### Administração: próximo diagnóstico autorizado somente após retomada

Entrega privada congelada, autoria de `resume_native_persistence`:

| Arquivo | SHA-256 |
| --- | --- |
| `work/admin-native-e74-capture-plan-20261010.md` | 1f45a3a8290ab3e53b0803b1b6607ff678ba1d0bb718713aa481281a6ea4729e |
| `work/capture-admin-native-e74d4c0-20261010.mjs` | 038b13a0b6bc7c8135bb84673150ae030644cf4b8268f2e19b73085b51cc74b8 |
| `work/test-capture-admin-native-e74d4c0-20261010.mjs` | 9567c0f6822bc52bfb7c3d2bd6d93e9008880f10b828929f0ec5c0eef0144d34 |

Autoria: 21 controles puros, sintaxe e lint aprovados. Root leu collector e teste integralmente, **mas não executou sua própria QA nem obteve peer independente**. Não confundir com os 91 testes das fontes já commitadas.

Na retomada:

1. Conferir os hashes; fazer QA própria e peer. O teste é privado, sem captura: `node --test work/test-capture-admin-native-e74d4c0-20261010.mjs`.
2. Revisar binds fixos: run38091004802/attempt1/workflow380858397/SHA e74/path/nome/evento push; seis pins, 47 blobs Git + 45 dependencies reais. Comparar o fonte Git com o local.
3. Conferir que nenhum destino com stem `work/admin-native-local-ci-38091004802-attempt1-e74d4c0-20261010-` já existe. Claim wx é permanente; não apagar para repetir.
4. Depois da revisão, capturar **uma única vez**, sem abrir/mostrar raw:

```powershell
node work/capture-admin-native-e74d4c0-20261010.mjs --capture e74d4c059c0f60a9847c947ef511b8df672da5fa 38091004802 1
```

5. Ler somente summary/report/status fechados. Fallback REPORT_REFUSED mantém report=null/unknown=null; não adaptar o contrato para inventar progresso.
6. Diagnosticar apenas o estágio comprovado. Se o relatório não oferece causa, preparar reader fechado e limitado, com pins/revisão, sem dump do log.
7. Corrigir fonte/teste se necessário, Root+peer, publicar commit novo e esperar o CI próprio.

Schema1 externo e schema1 interno têm scenarios distintos. Preservar 47+45, quietude/settlement de IO, latches sticky, presença dos conjuntos e limpeza Auth/SQL. Namespace removido nunca substitui confirmação SDK/final SQL. Não atribuir a falha a ACK, bootstrap, psql ou fixture sem evidência.

## 4. Trabalho parcial salvo: Administração no navegador

Agente `resume_review` pausou com **9 dos 11 arquivos novos**, todos untracked, incompletos e não incorporados. Nenhum produto/migration/contrato anterior foi alterado por esse pacote.

Plano privado V2 já revisado por Root e dois peers:
`work/issue24-admin-browser-native-plan-v2-20261010.md`,
SHA `25a342983b1cefe19ae4c4c1eba4456e27af443597086710edebfe7b8b8ea711`.
A revisão do plano **não aprova a implementação parcial**.

| WIP salvo | Bytes | SHA-256 |
| --- | --- | --- |
| scripts/verification/admin-browser-local-ci.mjs | 18641 | 84a1a10708900f2c446089b423f5d9a623c2a937ddefd31e31047a3da8173bc0 |
| playwright.admin-browser-local.config.ts | 982 | 9183efb44e14dfb535f5239bddb8d4a028b0c65698e7dd45195a62192dd97704 |
| tests/e2e-auth-local/admin-browser-local.spec.ts | 15432 | 86986b60c8fbb72b11299ccc6b30b56d87aef140f043b87ce1fb6855303ef7d4 |
| tests/e2e-auth-local/admin-browser-support.mjs | 34958 | 7ae8eacd46f22406da3445933165ef37bb2ba15fce4e0a45e99e10b9d0ae7eb8 |
| tests/e2e-auth-local/admin-browser-support.d.mts | 4855 | 2b7a11a1dcce3328629f7080c7f5fe289a9de9a29214ec111448ec622b41c475 |
| tests/e2e-auth-local/admin-browser-contract.mjs | 9005 | 94ba1bfdedf455d1079f5fe5e215a624cc7ee0066894bc743c82dd2b5f463c95 |
| tests/e2e-auth-local/admin-browser-contract.d.mts | 2991 | da6a49b1b4f3baba88a6329169f54128baec279c381a15d05db78f39e39114e2 |
| tests/scripts/admin-browser.types.mts | 1113 | 0e74c182d0a026e54f2540a64551030684fa69241c5275c3e4ac3d2563835787 |
| .github/workflows/admin-browser-local-ci.yml | 1925 | e01b06897322de6bf19d286a5ee8138fd34c7ed79741ea8e8b1ad40d00f83020 |

**Ainda não existem** `tests/scripts/admin-browser-local-ci.test.mjs` e `tests/scripts/admin-browser-support.test.mjs`. O manifesto ainda inclui seeds desses caminhos ausentes e sua cardinalidade não foi derivada/congelada.

Última validação informada pelo autor: `node --check` de support/runner passou **antes dos últimos ajustes**; TypeScript encontrou quatro erros (reporter:null/helper JS/DTS/narrowing), ajustados mas **não reexecutados**. Zero novos testes puros, discovery, navegador, stack ou SQL desse pacote. Não executar o runner nem publicar o workflow WIP.

Próximo responsável por essa frente:

1. Ler o plano V2 integralmente e o WIP, sem substituir por plano simplificado.
2. Completar os dois testes, conferir diferenças e derivar manifesto real, depois tipos/lint/sintaxe/discovery dos dois casos.
3. Obter Root + peer independente do pacote final. Somente depois stage explícito dos 11 caminhos, commit/push e CI Linux próprio.
4. Avaliar os critérios #24 separadamente; backend nativo e browser não emprestam resultado um ao outro.

Pontos centrais do plano, para não perder a intenção:

- Dois casos/duas stacks PG17 frescas: bloqueio com duas sessões/contextos B e entrada com senha provisória C.
- Original Next/forms/cookies/guards; Core/SDK/SQL canônicos em fixture local. Factories administrativas pessoais e STORAGE_ORIGIN permanecem preservados; não alias/patch de produto para fingir prova de factory.
- Bloqueio: JWT ainda válido, próximo acesso privado de B recusado, sem logout/relogin de B que falsifique efeito do comando. Não prometer apagar HTML já renderizado instantaneamente.
- Senha forçada: 16 páginas privadas + 26 APIs mapeadas, contratos/métodos reais; 503 de factory pessoal não serve como recusa funcional aceita. Calendário automático de /ajuda tem orçamento e significado separados.
- Troca por formulário original, logout global e SQL de sessões/flag/recibo/evento; senha temporária anterior recusada e nova senha entrando com novo SID.
- Limpeza somente após inventário completo, marcadores, SIDs atuais, quietude e terminal conhecido. B já revogado não recebe logout ACK fabricado; Auth DELETE HTTP200{} aceita somente sob o contrato revisado e GET404 independente.
- Limites: 1024 requests de browser, 512 HTTP owned Node, 64 SQL fixos, 360s por caso; não declarar contagem interna de fetch do Next como se tivesse sido medida.
- **Não usar Locator→expect/Frame.expect:** Playwright pode produzir snapshot ARIA com dados pessoais mesmo com reporter nulo. Usar bool/count em RAM e expect.poll de primitivos; catches com enums fechados, sem message/cause, dumps, cookies, screenshot, trace, HAR, vídeo, downloads ou stdio persistido.

## 5. Avatar e checkpoint documental: entregas preparadas

### Avatar — #34

Plano privado de `resume_documentation` congelado:
`work/issue34-avatar-storage-native-plan-20261010.md`,
SHA `404593088c8ad10528d25c105b8c5676c56f0363979a356576ff1f6250a22bc4`, 14.100 bytes.

**Nenhuma fonte Avatar nova existe.** Plano aguarda revisão Root/peer e decisão do responsável para autoria, dentro da implementação já autorizada pelo mantenedor. Não solicitar nova permissão humana apenas por escolha rotineira de implementação.

Propõe dez arquivos novos, um caso Linux SDK/bytes/SQL com dois donos ordinários; reserve(kind=avatar), signed PUT, processor/policy/CoreSettings/Sharp originais, JPEG512/EXIF/pixels independentes, signed read, RLS/foreign, set e remove do perfil. Sourcegraph/contagens/budgets precisam ser derivados para esta entrega: não copiar 27HTTP/55fontes de capture_image.

**avatar.remove remove o vínculo do perfil; não apaga imediatamente o arquivo finalizado.** A purge física segue a política de cleanup posterior. Remoção dos bytes exatos no teardown não é prova de purge automático/cron. Não acrescentar requisito de purge imediato ao literal “Avatar: upload assinado, re-encode, remoção”.

GUI local por factories pessoais/STORAGE_ORIGIN permanece fora do alcance. O literal original não exige essa GUI; Root/peer deverão avaliar a composição concreta, sem herdar aceites de capture_image ou ampliar por SMTP/aparelhos.

### Projeção documental e74

Plano privado congelado:
`work/connected-validation-e74d4c0-checkpoint-plan-20261010.md`,
SHA `297abf88c8a3f14c219b56cc2ac0eaaff3e78fe86bc40fbaf1decb2f48b2b36e`.

Ainda não virou novo checkpoint público. Na retomada, capturar Foundation/Admin, validar suas projeções próprias e então autorar nova evidência e74 + guia + novo prefixo histórico. Preservar literalmente os snapshots a5/940 e seus hashes, contagens, falhas e limitações. O status Storage de 940 permanece somente status; a5 conserva sua falha de confirmação Auth. O PASS e74 não os reclassifica.

## 6. Issues: estado fresco e trabalho restante

A listagem de pausa confirmou **36 issues, 20 encerradas e 16 abertas**. Das abertas, **11 são tickets de execução e cinco são specs/épicos**. Não contar épicos como cinco implementações adicionais.

| Issue aberta | Próximo trabalho concreto | Critério para prosseguir/encerrar |
| --- | --- | --- |
| [#20 — T-013 — Supabase novo + pipeline + esquema de identidade](https://github.com/kauanbarateli/Segundo-Cerebro/issues/20) | 017/reconferência/export oficial; confrontar gates de tipos/no-op/RLS/isolamento com OP-012 | Não reaplicar instalação/bootstrap; freshness hospedada separada de tipos e catálogo locais |
| [#21 — T-014 — Auth completa + CSP em bloqueio + rate-limit](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) | SMTP pessoal, recuperação por e-mail/PKCE/refresh, composição da senha forçada e evidências dos critérios restantes | Login/logout/senha normal têm prova própria; não chamar recuperação por e-mail concluída sem transporte real |
| [#22 — T-015 — Capturar + Tarefas persistentes (troca de adapter)](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22) | Consolidar cinco critérios originais com novo Storage e74 e peer, freshGET/bodyHash/plano final/publicação/readback | **Candidata a encerramento funcional, ainda OPEN.** Não encerrar automaticamente nem ampliar literal4 para exigir GUI/produção |
| [#24 — T-017 — Admin básico com bloqueio correto](https://github.com/kauanbarateli/Segundo-Cerebro/issues/24) | Diagnóstico do failure backend, correção/CI próprio; completar/revisar 11 fontes browser para bloqueio e senha provisória | Só critério4 requireMaster-primeiro publicado. Veto/último master/concorrência/bloqueio/senha provisória precisam provas próprias |
| [#28 — T-021 — Conhecimento real: editor + wiki-links + backlinks + lixeira](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) | Capturar Foundation e74, conferir nominalmente árvore/mover/lixeira e critérios originais | Oráculo corrigido já publicado; novo status verde sozinho não substitui conferência dos casos |
| [#29 — T-022 — Drive real com uploads assinados](https://github.com/kauanbarateli/Segundo-Cerebro/issues/29) | Upload/download assinados, tamanho/MIME/executável, árvore/lixeira/mover, oráculos de rede/credencial, revogação/falha objeto→commit e limpeza | Não herdar pipeline capture_image nem demonstração de uso exibido como prova de bytes Drive |
| [#32 — T-025 — Calendário Google real](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) | Credenciais pessoais, OAuth até duas contas/recusa da terceira; AAD/revogação/paginação/410, janela/visões/filtros e cron autenticado | Sem criar eventos Google; separar contrato local de ciclo real no provedor |
| [#34 — T-027 — Configurações completas](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) | Revisar e implementar plano Avatar; consolidar os outros quatro critérios com provas próprias | Quatro jornadas de preferências/telas em 940 e senha normal Auth conservadas; signed/re-encode/remove do avatar ainda pendente |
| [#35 — T-028 — Hardening de release 1](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Backup agendado fora de sync, restore descartável que destrava Cofre, catálogo readonly hospedado pós017, seis jornadas desktop/iPhone, audit Impeccable final | Teste allowlist de eventos/transações é próprio; não confundir documentação/runbook com backup/restore executado |
| [#36 — Manutenção: resolver aviso transitivo na cadeia de lint](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) | Reauditar e pesquisar correção compatível oficial da cadeia de lint; lock/testes pertinentes | Última auditoria: produção zero alertas, cinco high de desenvolvimento; não downgrade incompatível/remover lint para ocultar |
| [#12 — T-005 — PWA base + portões visuais de CI](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) | Instalação Android/iOS real, offline/atalhos/share-target vigente, portões visuais/audit e acessibilidade | Emulação de viewport e CI não certificam instalação física |
| [#2 — SPEC-01](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#4 — SPEC-03](https://github.com/kauanbarateli/Segundo-Cerebro/issues/4), [#5 — SPEC-04](https://github.com/kauanbarateli/Segundo-Cerebro/issues/5), [#6 — SPEC-05](https://github.com/kauanbarateli/Segundo-Cerebro/issues/6), [#7 — SPEC-06](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) | Consolidar filhos/limites e preencher critérios do épico após provas | Não fechar por simples existência de código nem acrescentar novo escopo ao MVP |

Encerradas e confirmadas na consulta: #1, #3, #8–11, #13–19, #23, #25, #26, #27, #30, #31, #33. Não reabrir indiscriminadamente. Falhas posteriores de harness/relatório têm diagnóstico próprio e não apagam aceites anteriores delimitados.

### #22: plano final pendente, sem nova auditoria visual

Cinco critérios originais, doc13:249–253:

1. Diff das telas ≈ zero + contrato M1 verde contra real. Composto publicado/readback em 21:34:53.983 UTC, revisão finita Root/peer concluída. Fonte M1 3a44b74, 31 casos reais/42 Memória/IDs; comparação visual declara exceções históricas, não pixel zero absoluto.
2. Capturar móvel e ler desktop em dois contextos. Prova própria edfa947, GUI SQL/browser, reload/fechamento do contexto móvel; seams declarados.
3. Conversão idempotente e client_id único **por Usuário**. Persistência Auth própria, replays/recibos/eventos e isolamento; não afirmar unicidade global.
4. Signed write, medida real servidor, EXIF removido. Novo Storage e74 validado por Root e peer independente; alcance nativo local explicitado.
5. RLS plantado aparece como ERRO, não lista vazia. Prova própria edfa947 com SELECT autenticado recusado e erro visível/retry sem escrita.

O corpo atual continua OPEN, updated_at **2026-10-10T21:34:52Z**, mas isso deve ser reconferido na retomada. Antes de publicar: GET fresco, hash/body/version/title, plano fechado dos cinco literais e revisão Root/peer, preservar sufixo histórico byte a byte, PATCH delimitado e readback. Auxiliares privados de publicação #22/#33 anteriores são modelos a reler, não comandos para repetir cegamente.

## 7. SQL e configurações manuais que faltam

**Não executar agora; manter pausa.** Na retomada, conferir se o mantenedor aplicou algo depois deste snapshot antes de indicar novamente a operação.

### Migration 017

001–016 informadas como aplicadas e catálogo hospedado pós016 já aprovado anteriormente. **Não reaplicar.**

Última leitura pessoal bem-sucedida: **10/10/2026 21:15:09.98876 UTC**. Quatro efeitos examinados mostraram 017 ainda ausente: categoria obrigatória, user_id obrigatório preservado, índice monthly_plan ausente, constraint payload_type ausente. Não é um novo catálogo completo.

[Evidência somente leitura](evidence/hosted-017-readonly-211509-20261010.json).
O mantenedor disse que iria aplicar 017; não houve confirmação posterior nem nova verificação durante a pausa.

Arquivos canônicos idênticos:

```text
supabase/migrations/20261010044217_finance_monthly_plan.sql
supabase/sql-editor/installation/017_20261010044217_finance_monthly_plan.sql
SHA-256 a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf
```

Aplicação manual exclusiva no SQL Editor pessoal. Depois: conferir em leitura categoria nula/plano total, user_id NOT NULL, constraint e índice único dono/mês; obter novo export oficial TypeScript do public e seguir [guia de tipos](../operations/database-types.md). Export integrado atual é pós016. Não fabricar tipos “oficiais” ou versões do histórico Supabase.

A UI completa do plano financeiro mensal permanece fase2; a migration corrige o backend previsto, sem antecipar essa UI.

### Dependências externas

- SMTP pessoal e ciclo de recuperação por e-mail: serviço ainda não fornecido; não pedir senha/token no chat.
- Google OAuth pessoal e duas contas de teste autorizadas; scopes, redirects, cifragem e cron conforme runbooks. Não usar Google empresarial nem criar eventos como teste.
- Secrets/configuração dos crons pessoais: ativar somente depois de guards/testes, e conferir execução/registro. Ter arquivo de cron não prova ativação.
- Destino de backup fora de OneDrive e ambiente de restore descartável; kit/senha do Cofre sob controle do mantenedor.
- Android/iPhone reais e agenda do aceite humano. Essa espera não pode ser convertida em horas de desenvolvimento.
- Produção: [alias oficial](https://segundo-cerebro-of.vercel.app), Vercel `segundo-cerebro-of` / `kauanbarateli-projects`. APP_MODE=supabase e APP_URL foram informados; valores secretos não entram no handoff. Deployment/source atual deve ser conferido na retomada, sem presumir que o alias já representa e74.

A limpeza exata dos 19 limitadores autorizados foi reconferida anteriormente com zero candidatos/zero excluídos. **Não repetir exclusão ou ampliar conjunto.**

## 8. Roteiro da primeira sessão de retomada

1. Receber a instrução de retomada; conferir Git HEAD/origin, status e hashes WIP contra snapshot. Separar handoff/docs dos nove WIP; não `git add .`.
2. Reler decisões e critérios. Conferir novos mensagens/estados do mantenedor, incluindo 017, sem reaplicar nada.
3. Distribuir quatro slots: responsável geral/evidência/publicações; Administração backend e peer do browser; autoria browser WIP; plano/Avatar e docs. Revisões cruzadas após congelamento, sem dois autores editando os mesmos arquivos.
4. Prioridade curta: QA própria + peer do collector Admin, captura única/diagnóstico; preparar collector Foundation específico e74 a partir do auxiliar a5, **em novos paths**, preflight/claims e revisão antes da captura única.
5. Foundation e74: `work/capture-foundation-a5a6eaa-20261010.mjs` é template histórico **fixado em a5**. Não executar para e74 nem editar para sobrescrever arquivos antigos. Criar versão e74 com SHA/run/outputs fixos, conferir framing/step/contadores, obter projeção nominal e avaliar Conhecimento/Cofre. Não iniciar rerun desnecessário.
6. Consolidar #22 com as cinco provas e peer; avaliar #28 contra sua prova própria. Publicar/fechar somente após review/readback. Manter #24 aberta até literais demonstrados.
7. Completar os 11 arquivos browser, Root/peer, tipos/lint/manifesto/discovery, commit explícito, push/CI próprio; diagnosticar antes de enviar outra revisão. Não cancelar CI Foundation em curso com push documental sem necessidade; ler concorrência do workflow.
8. Em paralelo após revisão do plano: Avatar e Drive com sourcegraphs/contagens/final SQL independentes; depois Google/SMTP e release conforme disponibilidade.
9. Atualizar checkpoint documental e74 preservando os históricos; guardar metadados, não raw/env/fixtures.
10. Ao concluir, reconferir issues e externos, backup/restore/dispositivos/audit e emitir relatório final real, sem declarar o roadmap futuro inteiro entregue.

### Acesso CLI e checks

Autenticação existente não deve ser sobrescrita. Se o contexto da CLI apontar outra conta, usar token em variável **somente do processo**; não exibir a saída:

```powershell
$env:GH_TOKEN = gh auth token --hostname github.com --user kauanbarateli
$env:GH_HOST = 'github.com'
$env:GODEBUG = 'http2client=0'
```

O push anterior utilizou exclusivamente:

```powershell
$env:GIT_SSH_COMMAND = 'ssh -i "C:/Users/Kauan Sousa Barateli/.ssh/id_ed25519_segundo_cerebro_principal_20261007" -o IdentitiesOnly=yes -o BatchMode=yes'
```

Não emitir push enquanto pausado. Na retomada, stage só de paths revisados, verificar índice, mensagens e checks; não alterar SSH global.

QA já confirmada para os **22 arquivos commitados e74**, distinta do WIP: Root+peer, 91 controles puros, tipos estritos de quatro suítes MTS, lint, scanner e whitespace; preparações originais Admin9/Storage foram revistas integralmente. Esses resultados não validam os novos nove WIP.

Em sandboxes Windows, realpath/Rolldown pode retornar EPERM/GRAPH_REFUSED por permissão local. Após evidência, repetir **o mesmo comando puro** no contexto permitido; não reinterpretar como bug de produto nem iniciar serviços. Para compilação pura podem ser necessários NODE_DISABLE_COMPILE_CACHE=1 e TEMP/TMP no diretório local existente, sem mexer em HOME/CODEX_HOME. Se leitura de arquivo privado criado com permissão restrita falhar, repetir somente a leitura fechada autorizada — **não recapturar o log**.

## 9. Preservação da evidência e privacidade

- Os helpers de captura usam destinos novos e claim/write exclusivas. Arquivo já existente ou claim impedem nova captura. Não apagar, adaptar ou recapturar para obter um resultado melhor.
- Raw logs, arquivos de credenciais, queries privadas e materiais temporários ficam em `work` ignorado. Nunca stage/print/publicar.
- Descrever somente enums fechados, contagens, booleans, hashes e fonte/run/attempt. Não publicar UUIDs, e-mails, SIDs, HMAC, conteúdo pessoal, URLs assinadas ou mensagens brutas de SDK.
- Deadline/IO incerto invalida PASS/ausência/cleanup Auth de maneira sticky; registrar a liquidação real dos IO owned. Processos/namespace removidos são evidência separada, não substituem ACK+GET404+SQL final.
- Manter a5 failure e 940 status-only literais. PASS posterior não torna um histórico failure em PASS.
- CIs de PGlite usam PG18 com seams declarados; não chamá-los PostgreSQL17 nativo. O CI nativo é prova separada.
- Não introduzir novos critérios (hosted50k, SMTP, GUI, iPhone, purge imediato) num literal que não os pede. Registrar gates de release/externos onde o planejamento realmente os exige.

## 10. Estimativa para terminar as issues atuais

**Estimativa de planejamento, não medição ou compromisso de data.** Escopo: todas as issues atuais do **MVP/Fase1**, inclusive revisão, testes, CI, documentação e consolidação dos épicos. A maior parte do produto já tem implementação; o restante combina prova nativa, jornadas incompletas e ativação externa.

| Frente restante | Horas técnicas estimadas |
| --- | --- |
| #20 — 017, tipos oficiais e reconferência após disponibilidade | 1–3 |
| #21 — recuperação/SMTP e composição das validações Auth | 5–10 |
| #22/#28 — evidências finais e aceite das jornadas já preparadas | 2–4 |
| #24 — diagnóstico backend, completar browser, review e CI | 10–18 |
| #29 — Drive e contratos/bytes/árvore/limpeza | 8–14 |
| #32 — Google pessoal, integração real e cron | 6–12 |
| #34 — Avatar nativo, revisão e aceite Configurações | 8–16 |
| #35/#12 — backup/restore, audit, PWA/aparelhos/jornadas | 6–10 |
| #36 — correção compatível de dependências | 1–3 |
| Checkpoints, readbacks e encerramento dos cinco épicos | 2–4 |
| **Base de trabalho** | **49–94** |

Para reservar correções/reexecuções diante dos resultados ainda desconhecidos, usar **60–110 horas técnicas restantes** como faixa de planejamento. Isso equivale aproximadamente a **8–14 dias de 8 horas de um responsável**. Agentes em paralelo podem reduzir o tempo corrido, mas não eliminam revisão, execução de CI ou dependências sequenciais.

**Esperas externas não estão incluídas**: 017/export, SMTP/Google, backup/restore e aparelhos/aceite humano podem alongar o calendário por prazo indeterminado. O principal risco técnico imediato é a falha Admin ainda sem diagnóstico e o pacote browser sem QA final. Novos defeitos relevantes exigem reestimativa após a primeira sessão.

A previsão anterior de 1–2 horas referia-se à rodada curta de correção/validação em andamento; **não era previsão de concluir todas as issues**.

O [roadmap](../planejamento/12-roadmap.md) também descreve Fases2/3/4+ (offline/outbox, push, grafo, análise, API, integrações e horizonte). Elas ainda não estão quebradas em tickets por regra do planejamento e **não estão cobertas por 60–110 horas**. Não antecipá-las nem prometer uma estimativa única para todo esse horizonte.

## 11. O que ficou salvo e o que não foi enviado

Na pausa: zero diff tracked, zero arquivo staged, nove untracked WIP. Este handoff e seu snapshot são novos arquivos documentais locais; **não foram commitados ou enviados**, para não incorporar acidentalmente a implementação incompleta nem iniciar novos workflows/deployment durante a pausa.

Não houve nova migration ou mudança de schema nesta rodada: a única aplicação manual pendente registrada é 017, com reconferência/export depois.

Os três agentes ficaram parados após salvar suas entregas. Nenhum novo serviço Windows foi iniciado nesta rodada; inventário global de processos CIM não estava disponível, portanto não se afirma que serviços previamente abertos pelo mantenedor foram encerrados. Não fechar o navegador/serviço existente nem processos empresariais para “limpar” a pausa.

Conferência documental própria: 11 links locais existentes, 26 arquivos do inventário com tamanho/hash exatos, contagem de issues coerente e dois testes WIP ainda ausentes. Peer independente revisou o handoff/snapshot e as entregas descritas, sem correção factual necessária. Essa conferência não executou os arquivos nem os testes da implementação.

**Ponto de retomada prioritário:** conferir hashes → capturar/diagnosticar Administração com reviews pendentes → captura própria Foundation e74 → fechar os aceites funcionais comprovados → completar Administração browser/Avatar/Drive → integrações pessoais e gates de release.
