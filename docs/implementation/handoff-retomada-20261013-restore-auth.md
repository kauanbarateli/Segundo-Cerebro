# Handoff de retomada — restore e Auth — 13/10/2026

**Demanda pausada por pedido do responsável, no próximo ponto limpo.** Retomar somente após nova orientação dele. Não existe aceite global do MVP. Este documento substitui o estado operacional dos handoffs anteriores, preservando seu histórico.

## 1. Repositório e estado de trabalho

Principal: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro), branch `main`.

Checkout: `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro`.

Leia `AGENTS.md`, `CONTEXT.md`, planejamento/ADRs relevantes e [decisões operacionais](decisoes-operacionais.md). Para qualquer trabalho visual, leia integralmente a Impeccable local e as referências aplicáveis. Preserve o layout da landing PR #39, suas 31 imagens e a correção dos gates de altura. Não ampliar escopo visual enquanto as melhorias do responsável ainda não foram descritas.

Última implementação de Auth publicada: `8d051d91623f22468b22ae426d9411d71f75c028`. O checkpoint técnico de pausa `46e551fb4e71d06efe27e20e3231bcae6870d8a5` contém o recorte local de restore revisado e a primeira versão deste handoff. Este complemento organiza a próxima entrega em duas frentes; conferir `git log`, `git status` e HEAD remoto na retomada. Resultados de `8d051d9` não pertencem automaticamente ao checkpoint posterior.

Alterações preexistentes do responsável **preservadas e fora deste commit**:

- `docs/implementation/prompt-frente-a-construcao-offline.md` modificado;
- `docs/implementation/handoff-retomada-20261010.md` e `handoff-retomada-20261011.md` não versionados;
- `docs/implementation/evidence/handoff-retomada-20261010-snapshot.json` e `handoff-retomada-20261011-snapshot.json` não versionados.

Não executar reset, clean, stash, exclusão ou stage geral. `work/` contém entregas isoladas e fontes de diagnóstico preservadas; não publicar a pasta inteira nem abrir relatórios privados antigos. Os agentes desta retomada encerram no ponto de pausa; não deixar tarefas de implementação em andamento.

## 2. Estado das issues e prazo

Readback próprio confirmou **cinco abertas**, três de execução e dois épicos:

| Issue | Próximo aceite necessário |
|---|---|
| [#35 — T-028](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Restore real completo, owners/grants/dados, Auth/Storage/Cofre restaurados, fecho e limpeza de Admin/Recovery, CI geral, backup agendado consistente e seis jornadas/audit final. |
| [#12 — T-005](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) | Concluir o registro físico de instalação com capturas e o restante dos literais originais. A instalação já foi informada; não pedir repetição do mesmo fato. |
| [#36 — Manutenção](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) | Resolver/reavaliar o limite de versão oficial e suporte da cadeia de lint sem peers forçados, downgrade, regra desativada ou waiver. |
| [#2 — SPEC-01](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) | Depende da #12 e dos aceites próprios. |
| [#7 — SPEC-06](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) | Depende dos filhos e do fecho de release. |

#6 e #34 estão `CLOSED/COMPLETED`, com readback exato e histórico preservado. O responsável confirmou tema desktop → celular. #21/#24/#32/#37 e #4 conservam seus encerramentos; as jornadas globais falhas não foram convertidas em PASS. Drive/#29 permanece `not_planned`, sem apagar dados ou infraestrutura histórica.

**Estimativa: 24–36 horas de trabalho técnico efetivo**, com margem para correções descobertas nos testes:

| Trabalho restante | Faixa |
|---|---:|
| Qualificador do snapshot/baseline, restore e validação de dados/Auth/Storage/Cofre | 8–14 h |
| Diagnóstico/correção dos três workflows falhos e comprovação de fecho/limpeza | 4–7 h |
| Agendamento de backup com janela consistente e recuperação verificável | 3–5 h |
| Seis jornadas, audit final, consolidação dos aceites técnicos | 4–6 h |
| Conferência de dependências e fechamento documental das issues | 1–2 h |

A previsão não é uma data garantida. A versão externa da #36 não tem prazo determinístico; aceite humano, capturas físicas e novas melhorias visuais dependem do responsável e não entram nessas horas. Executar em paralelo os recortes independentes, mas o qualificador e o restore formam o caminho crítico. Não declarar todas as issues concluídas enquanto seus literais estiverem abertos.

## 3. Destinos e credenciais

- Origem pessoal: **`rishenjoikgmfubmnfiu`**. **001–019 aplicadas; nenhuma migration pendente.** Não reaplicar, sem bootstrap/reset/seeds. Novas alterações de schema exigem migration própria e execução supervisionada.
- Alvo isolado autorizado para restore: **`jvwduowyavpaxssogadn`**, Ensaio_restore.
- Legado **`nqxgtnvmzuempxemlaku`** contém dados; não usar como vazio, resetar ou sobrescrever.
- BlackSheep/VOE estão fora do escopo. Preserve SSH/configurações existentes.
- Git/Issues funcionam por SSH exclusivo e `gh` com usuário `kauanbarateli`; nunca imprimir token nem incluir coautoria. Supabase MCP e logs Vercel tiveram recusas de escopo; não entrar em ciclo de reautenticação. As operações nativas por perfil preparado funcionam.

Entradas privadas autorizadas, apenas pelo dispatcher revisado:

- Perfil `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\restore-target-pg18-20261012-v2.xml`: 3.901 bytes, SHA-256 `e2cd837487821dd266d5f87223b5d65c56dd4ce0029cc52fe1dd71644eed740b`.
- Archive `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-12T23-12-50-811Z-be03596d.scbackup`: 942.809 bytes, SHA-256 `18199363331725253953c10dfebb99955315e3eed6676824bd2244cb03af314c`.
- Node: `C:\Program Files\nodejs\node.exe`; PostgreSQL permitido: `C:\Program Files\PostgreSQL\18\bin` (18.4). Ferramentas dump/restore 17 continuam bloqueadas; `psql` 17.11 funcionou. Compatibilidade de importação 18→17 ainda não comprovada.
- PowerShell 7: `C:\Users\Kauan Sousa Barateli\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe`.

Não ler conteúdo de perfil/chave, `.env`, transcript, raw stderr ou capturas privadas antigas. Na execução, manter leases de leitura e conferir os pins de fontes, perfil e archive antes do dispatcher. As permissões do sandbox podem exigir escalada restrita para essa operação já autorizada; o erro de launcher `MXC ... 0x80070020` não é prova de falha de banco. `login:false` estabilizou as chamadas recentes.

A chave independente foi copiada e verificada no pendrive D:, em arquivo novo, **sem senha por escolha expressa do responsável**; dados anteriores foram preservados. Não recopiá-la, lê-la, formatar o pendrive ou pedir KeePass novamente. Ejeção/guarda física não foram confirmadas. [Registro](evidence/backup-key-usb-copy-20261013.json).

## 4. Restore: o que é real e o que falta

Seis importações históricas falharam; suas causas continuam desconhecidas. **Não houve sétima importação.** O full-clean imediato não possui ownership; isso não atribui a causa dos seis runs.

Novas operações nativas distintas no alvo:

1. Catálogos: ator sem troca, BYPASSRLS, 35 tabelas/31 permissões INSERT; não inferir quais quatro faltam a partir da contagem.
2. Supautils: SET LOCAL `replica` → `origin` e ROLLBACK efetivos, apesar da ACL padrão falsa.
3. DDL fixo: função, dois tipos de trigger Auth e duas políticas Storage criados; ROLLBACK e ausência de todos os probes assertados **na mesma conexão**. Definições simples não certificam as definições/ACLs do snapshot.

Fontes e resultados: [capacidades](restore-capacidades-delegadas-20261013.md), [DDL](restore-custom-ddl-20261013.md) e [adaptadores](restore-managed-adapters-20261013.md). Root passou 29/29 no núcleo e 18/18 nos adaptadores na Main. Streaming preserva SQL/COPY, mesma conexão, EOF/close0, validação de catálogo/FKs antes de COMMIT e confirmação real do COMMIT. Nenhuma CLI de importação gerenciada está habilitada; o autorizador ainda precisa de fatos vinculados à origem nativa.

O inspector realizou duas chamadas próprias, não importações: a primeira timeout com fase desconhecida; a segunda, com nova fonte diagnóstica, recusou `directory_acl` **antes** de autenticar o archive ou iniciar o TOC. Resultados ficam em evidências separadas; não atribuir a fase da segunda ao timeout da primeira.

A correção final protege somente o diretório novo exclusivo, vazio e de propriedade do WindowsIdentity atual; arquivo cifrado é verify-only e pais são preservados. Subteto ACL 15 s dentro do global absoluto 45 s, com EOF/close0 exigidos. Autor/peer/Root passaram 19/19 próprios. A correção **não foi executada no archive real antes da pausa**. Pins do pacote congelado: inspector `ae2177f1c18ddbdcceeac38d7ef7fac092f6e763b9c1102ed3a455ade5d6454a`; teste `451df16a656a9faec11f33feb47a13c4bde1ef13be57ab07bd60ed0b8b25e5ef`. Pins de publicação, se diferentes somente por whitespace final, devem ser conferidos no manifesto do checkpoint; pins das chamadas nativas anteriores permanecem históricos.

**Primeira ação conectada após retomar:** revisar/conferir os arquivos publicados e as entradas acima; executar uma única inspeção nova `run-operator.ps1 -Operation restore-inspect` pelo perfil preparado, exigindo apenas a projeção fechada. Se recusar, usar fase/flags dessa chamada nova; não repetir sem diagnóstico ou delta revisável. Não executar um restore só porque a listagem passou.

Depois, construir capacidade opaca de snapshot/lifetime e qualificador bijetivo do baseline de serviço: todas as entradas preservadas, DDL, owners, ACLs, dependências, migrations e dados. Versões/counts não substituem comparação; dados selecionados não podem ser omitidos para contornar permissões. Rechecar alvo vazio/ator no consumidor real e validar Auth/Storage/Cofre após importar. A nota source-only está no checkout `Segundo-Cerebro-review-pr39\work\restore-qualification-plan-20261013.md`; ela é orientação, não implementação ou aceite.

Para backup novo/agendamento, a janela sem escrita de 12/10 **não é reutilizável**. Preparar gate concreto de manutenção/consistência; pedir nova janela quando pronto. Não manter `SC_BACKUP_QUIESCED=YES` como autorização permanente enquanto o responsável testa o produto.

## 5. Auth e CI: próxima investigação

O relay v2 de `8d051d9` preserva referências originais, callbacks terminais, primeira falha, unknown, cleanup e prazo absoluto de 15 s. Root validou 20/20 no candidato e, na Main, **203/203 + 98/98**, em execuções separadas sem skips. Tipos, lint e scanner passaram. [Entrega e limites](auth-next-stop-relay-20261013.md).

Todos os oito workflows de `8d051d9` encerraram: cinco success e três failure **por metadados**, sem nova captura própria:

- CI geral `38475827822`;
- Admin navegador `38475827880`, job `115566140100`;
- Recovery `38475827896`, job `115566140447`.

Recovery nasceu 22:09:29 UTC, job 22:09:33–22:12:22, run atualizado 22:12:23; as duas consultas próprias de metadata retornaram `steps=[]`. Não há intervalo de etapa para liberar o leitor fechado existente. Não atribuir causa, limpeza ou estágios sem prova; não dar fallback ao intervalo global. Preparos novos de leitura ficaram isolados/inertes; não foram executados. Recolher metadados atuais, qualificar o canal e revisar o leitor antes de uma captura única de cada fonte nova. **Não reabrir logs/relatórios/capturas antigos, nem repetir captura do mesmo run/fonte.**

Preparos source-only em `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-review-pr39\work`:

- `capture-adminbrowser-d1-relay-8d051d9-preparacao-20261013.mjs`, SHA-256 `974142e1a9f4b7abfe024d0b85f807d58ad9a76ad64e7be3527242aeca490cb9`;
- `capture-recovery-d1-relay-8d051d9-preparacao-20261013.mjs`, `205a7b8f989c750c3216f82a0aaf2ac1796f802be4bc4822c84763bae98c5248`;
- `test-capture-auth-d1-relay-8d051d9-preparacao-20261013.mjs`, `f3da2af11f60103d1af93855478bb0dd754adf9c54f0ed3e9734135d78380acf`.

Somente o autor passou 8/8 controles RAM e sintaxe; Root/peer/lint desses preparos **ainda pendentes**. Metadata/intervalos nulos recusam antes de qualquer port. Primeiro comando seguro nesse checkout é `node --test work/test-capture-auth-d1-relay-8d051d9-preparacao-20261013.mjs`; isso não libera captura ou comprova resultado nativo. A nota de qualificação tem SHA-256 `0966dd186c2fd9d6d1276fc2ca7bb48dedd7a0c6a52f05067835b5b04859ff33` e permanece apenas proposta.

As capturas funcionais anteriores permanecem próprias: Admin de 749 com oito estágios e três requests pendentes; Recovery com sete estágios e cinco requests pendentes, limpeza zero. Não liberar teardown por kill ACK/frame/PASS parcial. A correção do relay não comprova sozinha EOF nativo.

## 6. Retomada mais rápida em duas frentes

**Divisão solicitada pelo responsável após a pausa:** outra IA assume construção técnica sem conexão real; este agente (Root) assume conexões, integração e revisão. Os quatro assuntos anteriores tornam-se pacotes internos desses dois responsáveis. A atualização deste documento mantém a implementação pausada. Os prompts abaixo podem ser enviados quando o responsável decidir retomar cada frente.

| Responsabilidade | Frente A — outra IA técnica | Frente B — este agente/Root |
|---|---|---|
| Construção | Módulos puros, contratos, fixtures sintéticas, testes locais e roteiros de release. | Adapters nativos, ligação ao inspector/consumer, integrações e correções dependentes do diagnóstico real. |
| Conexões | GitHub para a branch/PR autorizada e documentação pública. Sem Supabase/Vercel/Google reais, perfis ou dados pessoais. | Supabase pessoal, alvo de restore, Vercel, leitores de CI e validações reais pelos canais revisados. |
| Evidência | Registrar exatamente o que foi testado localmente e o que depende de validação externa. | Comprovar origem dos fatos, executar validações conectadas, manter evidências e atualizar aceites nas issues. |
| Entrega | Uma PR pequena ou branch remota por pacote; worktree isolado quando houver acesso ao mesmo computador. | Revisar o SHA entregue, testar o recorte, incorporar e validar a integração antes do próximo pacote dependente. |

### 6.1. Pacotes da Frente A e limites de edição

**A1 — capacidade e lifetime do snapshot (#35), começar aqui.** Criar módulo puro proposto `scripts/operations/restore-managed-snapshot-capability.mjs` e `tests/scripts/restore-managed-snapshot-capability.test.mjs`. Definir capacidade opaca, referências/bindings originais, expiração, descarte e recusa de troca/reuso. Importar o módulo não inicia processo, IO, rede ou banco. Fixtures são sintéticas. Root fará a ligação ao inspector após revisar a PR; booleans fornecidos externamente não podem conceder autorização nativa.

**A2 — comparação do baseline (#35), depois do inventário real.** Criar módulo proposto `scripts/operations/restore-managed-baseline.mjs` e teste correspondente. Comparar as classes efetivamente observadas, preservando bijeção, definições, owners/ACLs, dependências, migrations e dados. Receber interface de entradas vinculadas definida com Root; divergência/entrada desconhecida recusa. Não começar um comparador universal antes do TOC novo. Não substituir comparação por counts/versões, regex que remova SQL ou exclusão de dados para fazer o restore passar.

**A3 — recorte reproduzível de Auth/CI, quando Root identificar a falha.** Root entrega projeção fechada e reproducer público; A corrige apenas os paths explicitamente transferidos para esse pacote. Até esse diagnóstico, pode revisar os preparos source-only e seus contratos offline da seção 5. Não interpretar a metadata `failure` como causa nem repetir runs/capturas para procurar um PASS.

**A4 — tarefas independentes durante a espera.** Preparar roteiro das seis jornadas, matriz de aceites #12/#35 e contrato offline do agendamento consistente. Conferir fontes oficiais para a #36, conservando os limites de suporte. Implementação do agendamento depende do contrato escolhido com Root. Não ampliar escopo para melhorias visuais novas, Drive ou infraestrutura desnecessária.

Os nomes dos módulos A1/A2 são propostas de novos paths; conferir ausência antes de criar. O pacote deve incluir `docs/implementation/frente-a-<pacote>.md` com decisões e limites. Root mantém edição exclusiva de `restore-managed-inspect.mjs`, `restore-managed-plan.mjs`, `restore-managed-stream.mjs`, `restore-managed-native-adapters.mjs`, `restore-managed-validation-sql.mjs`, `restore-target.mjs`, `run-operator.ps1`, readers/capturas reais, workflows e evidências conectadas. Alterar um desses paths na Frente A exige transferência explícita de responsabilidade do pacote; os dois agentes não editam o mesmo arquivo simultaneamente.

Se surgir mudança de schema necessária, combinar o número/escopo da migration com Root antes de criá-la. A pode preparar SQL revisável offline; Root responde pela revisão e aplicação supervisionada. 001–019 e os perfis existentes permanecem preservados.

### 6.2. Pacotes da Frente B e ordem que evita retrabalho

1. Conferir checkpoint/pins e executar a nova inspeção autenticada da seção 4. Entregar a A o inventário permitido de classes/dependências e o contrato de observação, sem dados pessoais, SQL privado, chaves ou conteúdo do archive.
2. Enquanto A constrói A1, qualificar a metadata/leitor dos três failures de CI e identificar a correção concreta. Não esperar o comparador para investigar CI.
3. Reservar revisão assim que A1 chegar; integrar a capacidade ao inspector preservando autenticação completa e finally/lifetime. Definir a interface final de A2 com o inventário real.
4. Enquanto A faz A2, preparar queries/adapters nativos de origem/alvo/ator, vazio, permissões e rechecagem no consumer; preparar a janela do backup quando houver procedimento concreto.
5. Revisar A2 e comprovar a qualificação nativa antes de importar. Executar restore e seus aceites de Auth/Storage/Cofre; uma listagem ou teste sintético não libera essa etapa.
6. Integrar os recortes de CI, comprovar fecho/limpeza pelos observadores originais e executar as jornadas/audit finais. Conciliar issues somente após seus literais, sem fechar épicos antecipadamente.

Dependência crítica: **inspeção/TOC real → classes e interface definidas → comparador offline → qualificação nativa → restore → aceites restaurados**. A1, investigação de CI e roteiros podem avançar em paralelo. A2 não deve depender de uma hipótese sobre o conteúdo privado, e Root não deve repetir importações enquanto A2 está incompleto.

### 6.3. Fluxo por branch remota, PR e worktree

O fluxo preferido é **branch da Frente A → PR para `main` → revisão por Root em worktree próprio → integração → validação conectada**. Worktree isola os arquivos locais; branch/PR transporta e identifica a entrega. Quando a outra IA estiver em outro computador, usar clone próprio e branch remota. Não transferir `.env`, perfis, chave SSH privada, chave de backup ou relatórios privados para ela.

Na retomada, conferir o HEAD atual de `origin/main`, registrar o SHA-base e escolher um caminho novo e branch ainda inexistente. Em Codex, preferir o mecanismo de worktree gerenciado quando disponível. Para uma IA com Git CLI, exemplo de preparação local, substituindo o caminho por diretório novo:

```powershell
git fetch origin
git worktree add -b codex/frente-a-snapshot-v1 '<CAMINHO_ABSOLUTO_NOVO>' origin/main
```

Trabalhar nesse worktree, com `node_modules` próprio e manifesto/lockfile preservados. Não usar junction para as dependências: isso já causou recusas de canonicalização neste projeto. Instalar uma vez pelo procedimento aprovado e reaproveitar enquanto o lockfile não mudar. Root mantém checkout/worktree de operação separado; os cinco WIPs da Main não são movidos nem descartados.

Antes do primeiro push, Root confere os gatilhos existentes: **draft PR não impede CI ou deploy Vercel**. Push/PR neste repositório podem disparar esses canais; seu acompanhamento cabe a Root. A não aplica migrations ou executa fixtures no Supabase pessoal para validar a branch. Não alterar workflow para ocultar failure ou fabricar aprovação.

Exemplo de entrega da A, dentro do checkout atribuído:

```powershell
git add -- '<PATH_1_DO_PACOTE>' '<PATH_2_DO_PACOTE>'
git commit -m 'Implementa capacidade e descarte do snapshot de restore'
git push -u origin codex/frente-a-snapshot-v1
gh pr create --repo kauanbarateli/Segundo-Cerebro --base main --head codex/frente-a-snapshot-v1 --draft --title 'Frente A: capacidade do snapshot de restore' --body-file '<ARQUIVO_LOCAL_DA_DESCRICAO>'
```

Mensagens e descrições sem coautoria. Usar `Refs #35`, sem `Closes/Fixes #35`, pois a PR não conclui sozinha o aceite de release. A descrição precisa conter problema/comportamento, SHA-base/HEAD, paths, comandos/resultados próprios, limitações e próxima validação de Root. Conferir o diff antes de publicar; se não houver autenticação GitHub autorizada para a outra IA, entregar patch público restrito, SHA-base e manifesto de arquivos/hashes para Root, sem compartilhar credenciais.

Root recebe URL/número da PR e SHA-HEAD exato, confere base/diff e revisa em checkout isolado. Pode usar worktree gerenciado do ref da PR ou este exemplo Git, com caminho novo:

```powershell
git fetch origin
git worktree add --detach '<CAMINHO_ABSOLUTO_NOVO_DE_REVISAO>' origin/codex/frente-a-snapshot-v1
```

Conferir que o HEAD obtido é o SHA anunciado antes de testar. Se a PR mudar durante a revisão, os resultados pertencem ao SHA anterior: revisar o delta e revalidar o que mudou. Nunca testar um checkout e incorporar outro diff. Resolver feedback por novos commits na branch atribuída; não fazer force-push em branch compartilhada. Se `main` avançar, alinhar a branch da A com Root e revisar conflitos antes de incorporar.

Após aprovação, incorporar pela PR ou branch de integração de Root, preservando as alterações não relacionadas. Revalidar na combinação final os checks pertinentes; executar validação conectada separadamente. Registrar implementado/validado/pendente e vincular evidência ao SHA realmente executado. Nenhum `PASS` da A é promovido a aceite hospedado. Worktrees novos podem ser arquivados depois que os commits e materiais necessários estiverem preservados.

### 6.4. Regras práticas para reduzir o tempo

- **Uma PR pronta para Root por vez**, com pacote pequeno (preferencialmente 2–6 paths quando o escopo permitir). A pode continuar um roteiro ou pacote independente enquanto Root revisa. Não acumular uma PR enorme ao final de toda a frente.
- Definir contrato, dono dos paths e teste de aceite antes de implementar. Compartilhar somente interfaces/projeções permitidas; evitar dois adapters ou dois diagnósticos para o mesmo problema.
- Priorizar A1/A2 e a origem dos failures. Não gastar o intervalo esperando conexões com refatorações de organização, redesenho ou abstrações que não desbloqueiam um aceite.
- Reusar os oracles/testes existentes; acrescentar regressão quando houver comportamento novo ou bug concreto. Root repete os checks pertinentes à integração. Ampliar/repetir suites somente por mudança, failure ou preocupação ainda não resolvida; não repetir instalação, audit ou captures sem informação nova.
- Registrar resultados por SHA e ambiente. Reaproveitar evidência de um módulo inalterado com limite explícito; não reaproveitar o PASS para a nova combinação, outro banco ou aparelho.
- Preparar documentação das jornadas e pendências externas enquanto os testes reais executam. Encaminhar ao responsável apenas o aceite/configuração que ainda requer sua ação, sem refazer pedidos já atendidos.

**24–36 horas representam esforço técnico total com margem, não tempo de calendário nem um prazo que se divide por dois.** O paralelismo reduz filas de construção/revisão, mas preserva as etapas conectadas em série. Recalibrar o prazo após a inspeção nova, a definição de A2 e a identificação das três falhas de CI. Não prometer redução percentual antes desses resultados; #36 e aceites humanos continuam com os limites da seção 2.

### 6.5. Prompt pronto para enviar à outra IA — Frente A

> Assuma a Frente A técnica do Segundo Cérebro. Leia `docs/implementation/handoff-retomada-20261013-restore-auth.md`, AGENTS.md, CONTEXT.md, planejamento/ADRs e os critérios das issues atribuídas. Comece por A1, a capacidade/lifetime do snapshot, em checkout/worktree próprio e branch nova a partir do HEAD conferido de origin/main. Registre SHA-base e paths exclusivos. Trabalhe em módulos puros novos e testes locais com fixtures sintéticas; Root mantém as conexões e os arquivos operacionais listados na seção 6.1. Não acessar Supabase/Vercel/Google reais, perfis, archive, chaves, `.env` ou capturas privadas; não reaplicar migrations, alterar Drive ou declarar aceite hospedado. A2 só começa depois de Root fornecer o inventário real permitido e a interface revisada. Entregue um pacote pequeno por PR/branch remota, com diff, hashes, comandos/resultados e pendências. Use Refs #35, sem encerrar a issue nem incluir coautoria. Quando entregar, informe URL/número, SHA-base e SHA-HEAD; aguarde revisão para trabalho dependente e avance apenas em pacote independente. A implementação geral permanece pausada até o responsável enviar este prompt autorizando sua frente.

### 6.6. Prompt pronto para este agente — Frente B

> Retome a Frente B do Segundo Cérebro seguindo este handoff. Preserve os cinco WIPs e o checkpoint técnico 46e551f, reconferindo HEAD remoto e pins atuais. Execute primeiro a inspeção autenticada nova, sem importar por simples PASS de listagem; forneça à Frente A inventário permitido e contrato de inputs para o qualificador. Em paralelo, diagnostique por canal revisado os três failures de CI, sem reabrir artefatos privados antigos ou liberar limpeza por ACK/PASS parcial. Assuma integrações, adapters nativos, conexões pessoais e validações de restore/Auth/Storage/Cofre. Quando a outra IA entregar PR/branch/worktree, revise o SHA exato e os critérios, execute os testes pertinentes, integre e valide o comportamento conectado antes de prosseguir com dependentes. Registre os resultados no SHA e ambiente próprios; não promova testes offline a aceite real. Não usar BlackSheep/VOE/legado como vazio, reaplicar 001–019, reintroduzir Drive ou incluir coautoria. Siga a ordem da seção 6.2 e mantenha as issues abertas até concluir os literais; recalibre a previsão pelos novos diagnósticos.
