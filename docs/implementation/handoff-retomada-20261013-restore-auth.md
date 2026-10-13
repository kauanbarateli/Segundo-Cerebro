# Handoff de retomada — restore e Auth — 13/10/2026

**Demanda pausada por pedido do responsável, no próximo ponto limpo.** Retomar somente após nova orientação dele. Não existe aceite global do MVP. Este documento substitui o estado operacional dos handoffs anteriores, preservando seu histórico.

## 1. Repositório e estado de trabalho

Principal: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro), branch `main`.

Checkout: `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro`.

Leia `AGENTS.md`, `CONTEXT.md`, planejamento/ADRs relevantes e [decisões operacionais](decisoes-operacionais.md). Para qualquer trabalho visual, leia integralmente a Impeccable local e as referências aplicáveis. Preserve o layout da landing PR #39, suas 31 imagens e a correção dos gates de altura. Não ampliar escopo visual enquanto as melhorias do responsável ainda não foram descritas.

Última implementação de Auth publicada: `8d051d91623f22468b22ae426d9411d71f75c028`. O commit deste checkpoint contém o recorte local de restore revisado e este handoff; conferir `git log`, `git status` e HEAD remoto na retomada. Resultados de `8d051d9` não pertencem automaticamente ao checkpoint posterior.

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

## 6. Divisão de retomada e prompt

Retome em quatro frentes, com arquivos isolados e revisão antes da integração:

1. **Root/conexões:** inspeção autenticada nova, qualificador e restore real; validações hospedadas e coordenação de janela.
2. **Auth/CI:** diagnosticar os três novos failures, corrigir recorte concreto e comprovar grupos/requests/limpeza originais.
3. **Backup/qualificação offline:** capacidade de snapshot, comparadores/tests das classes reais do TOC e desenho do agendamento consistente.
4. **Release/PWA/dependências:** conferir literais #12/#36, preparar seis jornadas e audit Impeccable final sem inventar aceite físico/humano.

Prompt para qualquer agente assumir:

> Retome o Segundo Cérebro pelo `docs/implementation/handoff-retomada-20261013-restore-auth.md`, após confirmar autorização do responsável. Leia AGENTS/CONTEXT/planejamento e os critérios literais das cinco issues abertas. Preserve os cinco WIPs preexistentes e todos os resultados históricos. Comece pelo recorte explicitamente atribuído; use checkout isolado, entregue diff/hashes/testes e peça revisão de Root antes de incorporar. Não usar BlackSheep/VOE/legado como alvo vazio, não reaplicar 001–019, não reabrir artefatos privados antigos e não iniciar importação sem qualificador nativo completo. Registre implementado, validado e pendente separadamente. Commits/pushes e conteúdo GitHub sem coautoria.
