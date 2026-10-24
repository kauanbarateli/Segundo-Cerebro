# Handoff de retomada — MVP e redesign — 24/10/2026

## Atualização operacional da retomada de 24/10

Execução ativa em quatro frentes. O histórico da pausa foi preservado abaixo; a [validação por candidato](t054-finance-goals-terminal-validation-20261024.md) e a [evidência atual](evidence/current27-integration-verification-20261024.json) registram os avanços posteriores.

- Código pai qualificado: `be37202c80b0454259038a40bb3d12ce54b12fcf`, árvore `61189963f7c38020eb618ea2b844a7599ea49675`;19 workflows/21 jobs originais PASS. A nova coorte de homologação concluiu20 runs SUCCESS por metadados, sem nova leitura de logs.
- Preview ativo: `dpl_89je6CQZtbb6HL92gXbY3PuDokp8`, Sourcebe, branch `codex/homologacao-twry-20261022`. As duas flags FINANCE_GOALS ficam true **somente nessa branch Preview**; preservar os demais ambientes e as14 variáveis já configuradas.
- Homologação pessoal `twrydxsdemaykgvdlpyd`:027 aplicada uma vez, mediante autorização específica. SQL canônico `20261024130000`/SHAf96d7a62…; histórico MCP `20261024160005/m027_finance_mvp_vertical`. V4 do catálogo19b5f158… aprovou2.512 checks/zero desvios no PostgreSQL17.11. Não reaplicar001–027 nem fazer repair para igualar os dois nomes/versionamentos.
- Upload positivo real passou no pai be:1 Meta QA,1 envio finalizado,1 objeto privado,1 evento created,0 reservas; vínculo/proprietário/projeção corretos e imagem192×192 carregada após recarga integral. Dados técnicos permanecem para inspeção; nenhuma limpeza foi executada. Não presumir negativos completos ou aceite móvel/humano.
- O novo pacote CURRENT27 foi transportado ao checkout Root:39 paths revisados, mais pacote SQL Editor gerado; limites/ACK/EOF/cleanup e protocolo1 preservados. Tipos candidatos59546/09af79f6… acrescentam12 RPCs; comparação estrita com CLI027 ainda obrigatória no CI. Controles puros23, inventário visual isolado1+31 recusas e lint43 arquivos passaram; uma fixture Windows foi canonicalizada sem afrouxar o leitor. O próximo SHA precisa dos próprios checks antes de qualquer integração.

**Merge e deploy de produção permanecem bloqueados.** Restore/baseline, negativos conectados, mobile e aceite humano continuam pendentes. Checkout Asaas, cobrança e Drive continuam excluídos; #36 é manutenção posterior. Não operar BlackSheep/VOE/legado nem alterar suas chaves. Não executar schema por CI/build/deploy. Consultar o HEAD real da PR120 antes de retomar, pois este bloco acompanha a preparação do próximo candidato.

## 1. Estado e autorização

**Registro histórico da pausa solicitada pelo mantenedor. A execução foi retomada em24/10; o estado atual está na [validação por candidato](t054-finance-goals-terminal-validation-20261024.md).** As três frentes interromperam autoria, conexões e testes. Esta entrega apenas registra a pausa, preserva pacotes públicos e os publica no GitHub. Nenhum merge, deploy, aplicação de schema, restore ou novo teste de produto faz parte desta publicação. O commit documental usa `[skip ci]` para não iniciar novas execuções durante a pausa; isso não é PASS ou dispensa de checks para os próximos candidatos. Nenhum workflow ou gate foi alterado para esconder falhas.

Repositório principal: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). A superfície de continuidade é a [PR #120, em rascunho](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120). O último código inteiramente qualificado é `70c5dd5d4d13d419941567c4b33d17df21990e5e`, árvore `30609d607f33d1c88ab234480074df4b60b4742e`. O commit que publica este handoff é documental e não é uma nova qualificação de código. Os patches neste diretório não estão aplicados.

Escopo vigente quando retomar:

- MVP operacional, redesign fiel ao protótipo, onboarding facultativo de nove telas e ajustes da landing.
- Checkout Asaas, cobrança, abertura de vendas e Drive estão excluídos desta execução. Não integrar as PRs comerciais #83/#84 para adiantar esse MVP.
- #36 permanece manutenção após o MVP. #44 exige aceite humano; não fechar por inferência.
- Merge e deploy de **produção continuam bloqueados** até os testes, revisão e liberação correspondente. Homologação isolada é o único destino de implantação autorizado.
- Perguntas sem resposta não impedem frentes independentes. Não tratar silêncio como autorização para uma operação dependente.
- Não acessar BlackSheep, VOE ou projetos legados; não trocar suas chaves/configurações. Sem coautoria em commits, PRs ou issues.
- CI/build/deploy não instalam schema. Sem reset, seeds, reexecução de migrations históricas ou exclusão ampla.

Antes de agir, ler `AGENTS.md`, `CONTEXT.md`, ADRs pertinentes (especialmente isolamento, Entitlement/Preferência, eventos, saga de contas e ADR-0011 de Metas), `docs/implementation/decisoes-operacionais.md`, `docs/agents/issue-tracker.md` e os critérios atuais das issues.

## 2. O que passou e o que isso não prova

| Entrega | Evidência confirmada | Limite |
| --- | --- | --- |
| PR #120, código70c5dd5 | 16/16 originais PASS, sem rerun, fail, skip ou cancelamento; cada geral:213 arquivos/3.392 unidades em dois fusos,1.963 scripts e478 E2E; Typecheck/lint/camadas/build/PWA/auditoria zero | Não prova os pacotes N/C2a ainda inertes, fotos conectadas ou produção |
| Nativos históricos de70c | 14 envelopes sem violações;504 blobs próprios sem divergência;63 dependências observadas;26 migrations/1.720 verificações | Os dois envelopes Auth não têm manifesto por arquivo; preservado vínculo por checkout/árvore |
| Onboarding/landing e composição25c1de7 | Preview real isolado, percursos anteriores parcial/completo, retomada e Google; regressão posterior da conclusão com duas conexões sem duplicação | Cada percurso conserva seu SHA; não inventar novo consentimento nem certificar Metas posterior |
| Capturar→Conhecimento em25c | Salvar, recarga, arquivar/restaurar e promoção pela UI; página reabre com documento/título; leitura restrita confirma uma página de origem e um recibo | Consistência privilegiada somente leitura não é teste RLS entre usuários nem falha parcial injetada |
| Restore V8 | Transporte/comparação somente leitura concluídos, arquivo imutável preservado | Baseline recusado; nenhum restore aceito ou executado |
| C2a V1 e N completo | Autoria e revisão estática, patches preservados no GitHub | Código/testes escritos não equivalem à execução ou montagem |

Origens próprias de70c, attempt1: [geral da PR40054519791](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40054519791), job120754414711; [geral de push40054517416](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40054517416), job120754407221. Checkout sintético da PR `504199d37b7eee505608a91853326f95321ba2f5`, mesma árvore do código70c.

[Recibo público do fechamento](handoff-20261024/evidence/70c5dd5-ci-closure.json), SHA-256 `d27c25dbd7a152f0a139aad95b55208483f203c67982d1752e4b1b597f29ed89`. Os logs originais continuam no GitHub e no diretório local de evidências; o índice local geral ainda não foi selado. Não repetir consultas a SHAs encerrados sem necessidade.

Falhas anteriores continuam documentadas em [validação por candidato](t054-finance-goals-terminal-validation-20261024.md):01ae6a7 falhou Typecheck; a560bd1 falhou quatro testes SQL;7e5bad2 passou16/16. Não atribuir retroativamente os PASS às árvores falhas.

## 3. PRs e ordem de composição

A consulta pessoal ao GitHub imediatamente antes da pausa confirmou a PR120 OPEN/draft no SHA70c e26 PRs abertas. Muitas são degraus de uma pilha, não26 entregas independentes que devam ser mergeadas automaticamente.

| PR | Branch/SHA observado | Uso na retomada |
| --- | --- | --- |
| #100 | `codex/redesign-parallel-20261022` /3d86cd8f7e1e97e89990513237a8d4ef792b3249 | Base do redesign, destinada a main; produção bloqueada |
| #101 | `codex/mobile-acceptance-20261022` /629ce070fc63b2c76794d1cafb8e00eff9df178f | Aceite/corte separado, não assume aceite humano posterior |
| #105 | `codex/homologacao-twry-20261022` /85b9712491e8e23fbba85a0504f71d2a13f4e768 | Base de homologação/onboarding |
| #108→#109→#111 | orçamento→séries→browser;111=708cbc642d7f56a2d0102f0ec376ec547b974c2c | Financeiro revisado, propostas SQL inertes |
| #113 | `codex/onboarding-landing-polish-20261023` /d16e1dd350fcea7fc95bb6dcad03f9a8649b05d2 | Landing/onboarding |
| #115→#116 | Core/SQL e UI de Metas;116=044432e72448fc9e702377c3936042999bc86e01 | Já transportados na composição; preservar histórico de falha de115 |
| #117 | `codex/mvp-compose-20261023` /25c1de776a8db95cb3b9ff1c5313e2e091dbec2f | Composição atualmente hospedada no Preview |
| #118 | `codex/mvp-goals-channel-20261023` /b4c4586a7e5a8d2e21ba6ed62e9ca3199325d481 | Canais/browser de Metas,17/17 próprios |
| #119 | `codex/mvp-goals-images-20261023` /dab149caf69878e1f3171e2bfbe3ee8c58a3e9a3 | Exibição de imagens,16/16 próprios; base da120 |
| #120 | `codex/mvp-goals-terminal-20261023` /70c5dd5 antes deste handoff | Última união qualificada; manter draft |
| #102→#103→#107→#110→#112→#114 | restore;114=057ec5b353972d7d09ba7f5787687b6fcb9863ae | Pilha separada, não compor por merge cego com o MVP |
| #106, #89, #90 | predecessores de landing/limite/reservas | Rever se já transportados antes de duplicar código |
| #47 e #45 | planejamento DS/onboarding e handoff histórico | Referências, não substituir a implementação atual |
| #83 e #84 | pré-Auth/acesso comercial | Fora desta execução |

Confirmar refs, diffs e checks na retomada. Se qualquer branch avançar, revisar o delta; os resultados acima continuam vinculados ao SHA original. Não fazer merge em cadeia para contornar conflitos ou promover uma pilha que não foi testada como união.

## 4. Pacote C2a: upload de fotos — próximo bloqueio de código

[Pacote V1](handoff-20261024/upload-c2a-v1/manifest.json), SHA `b2fabf1f6861eb469542bf11c5b831e86d502fd32f5d78f93c5eab1b1356efc3`; [patch completo](handoff-20261024/upload-c2a-v1/changes.patch); [peer](handoff-20261024/reviews/upload-c2a-peer.md).

Nove paths: coordenador, transporte e barreira em `src/lib/files/goal-image-upload*.ts`; três testes correspondentes; capacidade local adicionada ao client concreto; teste dessa capacidade; documento. Client-before é exatamente7e5bad2/blob438b21018fe786f34fd11f199b4c1c33defa7be1/SHA256630ebec71a814a63c7e96977e2d0468a9c5ece66b43fe1e7c00f2802d978e505. O delta do client contém somente import/campo/criação da capacidade, sobre o mesmo journal privado, sem alterar o port financeiro puro.

Implementa retomada de envio por identidade original, transporte limitado, prova nominal própria após finalize e barreira financeira local. Preserva12 M2-S e4 J2. Não implementa retirement, editor, vínculo financeiro ou montagem no Workspace. A V1 permanece **bloqueada**.

**P1 confirmado:** `resume()` pode esperar a lease além do timeout150s. Seu callback tardio entra sem `guard(signal)`, e `finalize()` avalia `executeDomainCommand(...)` antes que `wait()` confira o sinal abortado. Assim, uma operação já recusada ainda pode enviar finalize. A correção V2 **não foi iniciada** quando a pausa chegou.

Retomada mínima autorizada para autoria, após novo pedido de retomada:

1. Guardar signal ao adquirir a lease tardia e imediatamente antes de cada efeito/sender relevante; conferir também os caminhos assíncronos de select/reselect/advance. Não aumentar timeouts nem criar retries.
2. Teste negativo retém lock, ultrapassa o deadline, observa recusa, libera lock e exige zero envios tardios e A integralmente preservada.
3. Alterar somente coordenador, teste correspondente e documento; preservar V1 e criar freezeV2/delta. Qualquer expansão exige nova revisão de escopo.
4. Peer independente, Typecheck/lint/camadas e testes próprios em CI no SHA composto. Não herdar PASS deJ2/70c.
5. Só depois planejar C2b: retirement nominal, prova financeira vinculada ao imageId e integração opcional picker/editor. C2b não tem proposta ou código novo nesta pausa. Ler [contrato B2b2](handoff-20261024/plans/upload-b2b2-contract.md) e [handle financeiro](handoff-20261024/plans/upload-finance-handle.md).

Ausência de recibo não libera intenção; DTO/observe final/localStorage não mintam prova; imagem selecionada não pode virar null silenciosamente; File/hash ficam em RAM. Sem clear/UUID novo automático para escapar de falha. Nenhum arquivo é apagado por retirement local. As fases, limites e negativos adicionais estão no pacote.

## 5. Pacote N: doze confrontos PostgreSQL nativos

[Manifesto completo](handoff-20261024/native-v1/manifest.json), SHA `c1e7383632ddb917f741ff13f3728c1467058f6536da95b6daff87e8ac0e942b`; [patch](handoff-20261024/native-v1/changes.patch); [peer](handoff-20261024/reviews/native-complete-peer.md), SHA250e5375fab1dc73183e6dd803378007d19175d1b2f80726101e52ca4eb96ce5.

Onze paths novos de runner/case/session/SQL/entry/contrato, três testes puros, documento e workflow.26 controles e12 confrontos estão **escritos, não executados**. A extração dos dez Sources já integra70c; não reaplicá-la do WT histórico.

**Dois bloqueios estáticos de composição, ambos sem correção aplicada:**

1. O runner compara o texto integral de `.nvmrc` com `process.versions.node`, mas a fonte70c contém somente `24` (blob a45fd52cc5891570d6299fab38643103c3955474). O workflow seleciona esse major e o processo informa versão completa; a igualdade recusa antes da coleta de fontes. Ajustar a validação à política existente e registrar a versão integral observada, com testes pertinentes; não alterar `.nvmrc` só para acomodar o erro.
2. `GOAL_NATIVE_ENTRY_SOURCES` omite `src/lib/finance-goals-terminal-contract.ts`, que o canonical atual importa/reexporta. Acrescentar explicitamente somente esse módulo puro à allowlist; suas dependências de valor já estão presentes. Não copiar o canonical antigo, ampliar para HTTP/browser/journal ou aceitar um grafo desconhecido.

O [adendo Root](handoff-20261024/reviews/native-root-composition-addendum.md) registra o achado de versão durante o preparo da pausa. O peer anterior fica preservado como fotografia da revisão, sem ser interpretado como aprovação posterior a esse novo achado.

Preservar no Source terminal o pin M1 `7fb8c48baf6a308e46ae5c7eef537670d6008009668a7b90e0a57cfc11d3843c`, e o Source Budget com o LF final revisado. Os manifestos históricos conservam os bytes antigos como história; não repinar a partir de um banco observado.

Compor apenas os11 paths em checkout próprio, fazer o delta explícito da allowlist e revisar o diff. O patch usa prefixo `a/after/`: verificar com `git apply -p2 --check` antes de aplicar. Os testes puros escritos são:

```text
node --test --test-concurrency=1 tests/scripts/finance-goals-terminal-native-contract.test.mjs tests/scripts/finance-goals-terminal-native-session.test.mjs tests/scripts/finance-goals-terminal-native-ci.test.mjs
```

Rodar os controles e o gate no GitHub, não no notebook sob pressão. Publicar o workflow novo dispara originais push/PR: acompanhar seus próprios SHAs, não fazer dispatch/rerun para esconder erro. O workflow tem35min; ações15s, sessão120s e barreira5s permanecem fixos.

O gate usa stack própria Linux/PG17/CLI2.120.0, Auth SDK real e usuários sintéticos, sem Supabase hospedado. CREATE/CONTRIBUTE/RELEASE × commit-first/settle-first/executor antigo/dois settles. OLD_EXECUTOR exige batch coerente pós-fence e23505/NAMESPACE_CLOSED, não CAS stale. Exigir PID/advisory/barreira reais, material completo dos dois usuários, totais/revisões/eventos/quota, replay do mesmo comando, EOF/exit/close originais, ausência de backends/grupos, cleanup SDK/cascatas e stop/inventário próprios. Resultado incerto continua falho mesmo se a stack for destruída. Catálogo001–026/1720 precede companions; não fingir catálogo inalterado depois deles. Nenhum PASS sintético aceita restore ou produção.

## 6. Restore: diagnóstico encerrado, aceite ainda recusado

Issue #35/#42, transporte #41; PR #114. Arquivo imutável criado em23/10, ciphertext SHA256 `624831beabdc2a603a406f2d1b5b1d89a3290e33a8cdaec3af2a4f062224e8b3`,1.196.292 bytes, plaintext1.193.636. Perfil/chave/arquivo privados ficam fora do Git; não copiá-los para a pasta deste handoff. Caminhos e protocolo estão nos handoffs operacionais anteriores e no diretório privado local.

V8, recibo público local SHA256 `72fa09fb476d77bd94be09ba1fb32c401e20a95e592402ff0f9f3047dd846606`:350 pares managed;36 vetores com mesma multiplicidade e ordem diferente;0 definições managed divergentes. Grupo público adicional:8 pares/5 definições diferentes (FUNCTION1, ACL1, DEFAULT ACL3). Histórias Auth82/Storage74 iguais. A2 permanece estrito: `baselineQualified=false`, `remoteMutation=false`, `restoreAccepted=false`. Nenhum restore foi executado.

A inspeção já passou1.229 controles públicos. **Não repetir a inspeção para redescobrir os36, ordenar vetores ou ignorar as cinco definições.** Hash/correlação de identidade não prova equivalência de corpo/ACL; managedContext não cobre automaticamente todas as arestas do unionContext.

[Proposta pública de continuidade](handoff-20261024/plans/restore-baseline-decision.md), SHA49796229c1eac3502cc4c317774e05428db862fe29f2b8a4d04232e0dc83af06. Preparar duas provas independentes: semântica de ordem no produtor/consumidor pinados; proveniência/política de helperRLS+ACL. Só depois decidir preparo de alvo compatível ou novo contrato versionado. A2v1, seus15 reasons e evidências originais ficam intactos. Proposta não autoriza executar restore, ler SQL privado novo ou alterar permissões.

Ensaio_restore `jvwduowyavpaxssogadn` permanece reservado. Não usar antigo projeto legado nem homologação como substituto. Cliente operacional PG18 está em `C:\Program Files\PostgreSQL\18\bin`; pg_dump/pg_restore17 foram bloqueados pelo Windows. Conferir os procedimentos existentes em vez de reinstalar ou contornar a política. Uma futura geração de backup precisa de **nova janela explícita** de quiescência: as janelas antigas expiraram.

## 7. Ambientes, banco e configuração

| Ambiente | Identificação | Estado conhecido e limites |
| --- | --- | --- |
| Produção | `rishenjoikgmfubmnfiu`; domínio `https://www.segundocerebroapp.com.br` | Última fronteira conhecida001–019; não promover020–026 ou propostas financeiras automaticamente; reconferir somente quando retomar o corte supervisionado |
| Homologação | `twrydxsdemaykgvdlpyd` |001–026 instaladas e catálogo1720; cadastro público desativado; conta comum descartável humana; não recriar usuários/migrations por suposição |
| Restore | `jvwduowyavpaxssogadn` | Somente destino reservado ao protocolo de recuperação, baseline ainda recusado |
| Preview publicado | deployment `dpl_7FngsH3qqkw4oQTQHs3HufqHwMDM`; fonte25c1de7 | Não é o código70c/PR120 |

Alias de homologação: [Preview](https://segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app). A Vercel foi conferida READY/targetnull/fonte25c1de7 antes das jornadas. Proteção de autenticação Vercel permanece; não criar bypass ou publicar links de teste protegidos.

Vercel projeto `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, equipe `team_BqlhayzOBFfZT7Rv16j4OeUK`. Branch de homologação `codex/homologacao-twry-20261022`. As variáveis e callbacks são por ambiente. **GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET de Production ainda precisam ser recadastradas pelo mantenedor após os testes**, conforme sua decisão; não mover as de Preview nem inferir valores da conta. Não enviar qualquer valor pelo chat/issues/Git.

`vercel.json` mantém `deploymentEnabled:false` para main e a branch120; preservar. Antes de qualquer Preview futuro, conferir branch/alvo/variáveis/banco exatos. O mesmo cliente Google foi autorizado para homologação com callback adicional; não revogar conexões ou consentimentos de produção na limpeza.

**Migrations pendentes:** nada novo deve ser aplicado a partir desta pausa.001–026 canônicas não devem ser reescritas/reaplicadas na homologação. Budget/B2/Metas/fotos/M1 são propostas DRAFT_ONLY/ROLLBACK: precisam virar migrations novas revisadas, tipos/catálogo, instalação supervisionada em ordem na homologação e aceites reais antes do corte. Não instalar só o fence sem liberação/recuperação correspondente.020–026 e a compatibilidade de021/023 com a aplicação publicada exigem plano de corte próprio, backup e autorização vigente; CI/deploy não fazem isso.

A conexão MCP da homologação estava disponível; produção havia recusado acesso em rodadas anteriores. Na retomada, descobrir ferramentas e conferir `get_project_url` antes de cada operação. Um login OAuth anterior não garante que a conexão atual tenha a mesma autorização. Nenhuma chave é incluída neste material.

## 8. Visual, aceite e issues

Fontes: `.agents/skills/impeccable/SKILL.md` completo e referências aplicáveis; `docs/planejamento/15-aplicacao-layout-codex/`; `docs/planejamento/17-evolucao-prototipo/`; D-033, D-077 e tokens DS2.1. A captura de Metas do protótipo está em `17-evolucao-prototipo/capturas/financeiro-meta.png`. Preservar composição/marca/Geist; não refazer a direção visual aprovada.

Root inspecionou10/36 PNGs próprias de7e, incluindo quatro confirmações320/390 claro/escuro. Encontrou toolbar comprimida em320;70c põe o filtro em sua linha abaixo de350px. **A correção ainda não foi inspecionada em novas PNGs.**

Na retomada, a origem selecionada é apenas PRrun40054519791/job120754414711/attempt1. **Consulta do artefato e download ainda não começaram.** Obter metadados uma vez e extrair as36 PNGs Goals pela allowlist, com streaming/limites/assinatura/dimensões/hashes e proteção de path, sem ZIP inteiro em RAM. Não usar as imagens antigas para aceitar CSS novo, nem screenshots de fixture como aceite hospedado/físico.

Medir contraste claro/escuro e verificar campos16px, alvos44px, foco, teclado, redução de movimento,320/390/intermediárias/desktop e zoom. As instalações já relatadas em iPhone11/A35 e a sincronização do tema não certificam a composição nova inteira.

Mapa de retomada: #71 épico; #72 imagens/avatar; #73 Kanban; #74 Calendário; #75 Capturar; #76 Hábitos; #77 Financeiro; #78 recorrências/limites; #79 Metas; #80 landing/onboarding; #81 integração; #62–65 onboarding; #104 segurança; #44 aceite visual; #12/#2 PWA/fundação; #7 fechamento; #35/#41/#42 restore. Conferir os critérios atuais antes de encerrar. As issues comerciais #50–61/#66–68 continuam fora do escopo, salvo a parcela de onboarding explicitamente autorizada.

## 9. Organização para acelerar sem disputar os8GB

A máquina chegou a41MiB livres de7.916MiB. Agentes de autoria/revisão não significam vários serviços locais. Nada de npm ci/build/Chromium/PostgreSQL/containers concorrentes no notebook. Node24.19.0 foi o runtime local observado; `.nvmrc` seleciona o major24. Vitest local4.1.11 diverge do lock4.1.12 e não certifica testes. TypeScript5.9.3/depcruise17.4.3 e demais versões devem ser conferidos contra o lock, não instalados por conveniência. Use o lock como autoridade.

Quatro frentes totais, com ownership de arquivos e um integrador:

1. **Root/integrador e conexões:** revisão dos pacotes, transporte de blobs, migrations supervisionadas/aceites isolados e PRs; único responsável por escolher o candidato hospedado.
2. **Upload/editor:** C2aV2 primeiro; depois proposta finita C2b e integração opcional. Não editar N ou schema de outra frente.
3. **Nativo/restore público:** corrigir a entrada pura N e qualificar os12 confrontos. Planejamento de baseline pode correr em paralelo, sem operação privada nem relaxamento.
4. **CI/visual:** uma coleta por original, revisão independente e capturas do artefato selecionado; testes pesados no GitHub. Sem autoria simultânea dos arquivos que estiver revisando.

Publicar lotes revisados, acompanhar seus originais até o fim e só então publicar o próximo lote se a concorrência dos workflows cancelar o anterior. Não fazer rerun/cancel ou ampliar timeout para transformar falhas em verde. Diferenciar origem de infra e produto, preservando ambas.

Estimativa comunicada antes da pausa:2–4 dias corridos de execução contínua para prontidão técnica, com26–27/10 como meta e risco de28/10. **É estimativa, não prazo de entrega garantido nem relógio durante a pausa.** Restore é a maior incerteza; produção ainda depende de aceites e das configurações preservadas. Reestimar depois do primeiro resultado próprio N e da correção C2a, sem porcentagem por contagem de issues.

## 10. Primeiro roteiro após o mantenedor retomar

1. Ler este handoff e os pareceres; conferir PR120/ref/estado, artefatos e todos os hashes do pacote. Inventariar worktrees antes de criar outro. Não tocar nos WIPs humanos.
2. Reabrir revisão visual70c e C2aV2 em paralelo com composição N. O bloqueio C2a e os dois de composição N são tarefas de código local, sem esperar por credenciais.
3. Revisar V2/N e executar gates próprios no GitHub. Os controles do pacote N não foram rodados. Portão de dependências é obrigatório para alterações arquiteturais.
4. Só depois fechar retirement/editor e preparar migrations novas/tipos/catálogo da união financeira; não publicar uma composição incompleta no Preview.
5. Validar a união isolada com Auth/Entitlement/RLS/Storage/recarga/duas abas/falhas, replays, mobile e protótipo. Registrar implementado/validado/pendente por SHA.
6. Retomar a decisão do baseline com as duas provas públicas antes de qualquer novo acesso privado. Atualizar #35/#42, sem declarar restore aceito.
7. Atualizar #7/#71/#79/#81 e PRs com evidência. Pedir apenas as decisões realmente externas no fim do preparo concreto. Merge/produção continuam bloqueados até sua liberação correspondente.

Checkout Root preservado, relativo ao diretório da tarefa: `work/Segundo-Cerebro-mvp-goals-terminal-20261023`, branch `codex/mvp-goals-terminal-20261023`. WTs autores: `work/Segundo-Cerebro-goals-terminal-http-20261023` (C2a) e `work/Segundo-Cerebro-goals-terminal-browser-20261023` (N), ambos base histórica01ae e WIPs deliberados. **Não usar git reset/clean ou checkout sobre eles.** A Main humana em `work/Segundo-Cerebro` tem WIPs anteriores preservados; não incorporar por cópia de pasta.

Evidências locais detalhadas: `work/Segundo-Cerebro/work/ci-capture-write-20261021` (EV). Operações privadas ficam em `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations`; não copiá-las, perfis/.env/chaves/archives ou kitCofre para o GitHub. O [pacote público](handoff-20261024/README.md) permite retomar a autoria sem depender desses arquivos privados.

GitHub: usar explicitamente a identidade pessoal `kauanbarateli`; a CLI padrão pode estar na conta VOE. Para push, usar somente a chave SSH exclusiva do repositório, por chamada, preservando config global e demais chaves. Não imprimir tokens. Fazer commits sem coautoria. Confirmar permissões antes de escrever e anexar toda PR criada à conversa.

## 11. Prompts prontos

### Integrador / Frente B

> Ao receber o pedido do mantenedor para retomar, continue o Segundo Cérebro a partir de docs/implementation/handoff-retomada-20261024-mvp-redesign.md na PR120 do repositório kauanbarateli/Segundo-Cerebro. Leia AGENTS/CONTEXT/ADRs, o pacote público e os bloqueios C2a/N; não peça novamente autorização para o trabalho já delineado. Último código qualificado70c5dd5; o commit de pausa é apenas documental. Preserve WIPs e fontes históricas. Divida autoria/revisão sem serviços pesados locais; use GitHub para testes. Conclua C2aV2 e N antes de editor/rollout. Só você coordena conexões/migrations/Preview isolado, sempre conferindo alvo e protocolo. Não normalize A2, reaplique001–026, reabra Asaas/Drive, faça merge ou produção por inferência. Cada SHA precisa de evidência própria; atualize issues distinguindo implementado, validado e pendente.

### Upload / Frente A

> Assuma somente a frente de fotos de Metas #79. Leia o handoff24/10, pacote upload-c2a-v1 e seu peer. A V1 tem P1 de finalize tardio após deadline aguardando lease; V2 não foi iniciada. Corrija guard(signal) na aquisição/efeitos e antes do sender, cobrindo lock→timeout→liberação com zero sends e A intacta. Preserve J2/M2/client-before e produza delta revisável sem runtime pesado local. Não monte Workspace, não faça retire/clear, não altere Core/SQL/factory/port ou chame Supabase. Depois da revisão, proponha C2b por paths e contrato, com prova nominal de vínculo financeiro/retirement e editor opcional. Não considere DTO, observe final ou metadata como confirmação. Entregue branch/PR draft para o integrador revisar, sem merge/deploy.

### Nativo / frente técnica

> Assuma somente o pacote N da #79. Leia o handoff, native-v1/peer e o adendo Root. Componha11 paths sobre o código atual preservando os dez Sources Root7fb/EOF. Corrija a falsa igualdade entre .nvmrc major24 e a versão completa do processo, respeitando a política existente; acrescente a entrada explícita src/lib/finance-goals-terminal-contract.ts à allowlist, sem ampliar runtime desconhecido ou copiar canonical histórico.26 controles e12 confrontos estão escritos, não executados. Qualifique no GitHub a stack descartável local do job, catálogo, SDK/Auth, OLD_EXECUTOR23505 forte, material integral, EOFs/grupos/backends/cleanup. Sem banco hospedado, credenciais ou restore. Entregue SHA/resultados próprios e falhas reais ao integrador; não rerodar/cancelar para ocultar erro.

### Revisão CI e visual

> Assuma revisão independente do handoff24/10 e dos pacotes escolhidos pelo integrador, somente leitura das fontes que outro agente edita. Preservar70c16/16 e coletar originais novos por SHA/árvore/tentativa, sem herdar PASS ou reabrir SHAs encerrados. Para visual70c, apenas runPR40054519791/job120754414711/attempt1 foi selecionado; artefato ainda não consultado/baixado. Extrair36 PNGs com streaming/allowlist/hashes e comparar com o protótipo e temas, especialmente toolbar320px. Nunca chamar fixture de aceite hospedado/físico. Sem runtime pesado local, alteração de workflow para ocultar falha, merge ou deploy.
