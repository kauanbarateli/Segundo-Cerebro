# Handoff de retomada — quatro frentes do MVP

Data:17/10/2026 UTC /16/10 em Fortaleza. Repositório:[kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro). Esta entrega atende ao pedido de publicar pendências completas e todo o trabalho local revisável em **PR Draft**, para retomada posterior. **Não fazer merge nem iniciar execução real automaticamente.**

## 1. Primeiro acesso e revisão da entrega

Main publicado de referência: `61d03c768071e6618136e648fc71c552e3db2043`. Branch da consolidação: `codex/handoff-mvp-20261017`. Conferir o HEAD e a PR no GitHub; os fixes seguintes pertencem à PR, não ao Main enquanto não incorporados. Os números e SHAs finais da PR ficam no seu corpo e no snapshot de publicação.

```powershell
git fetch origin
git log -1 --format=fuller origin/codex/handoff-mvp-20261017
git diff --stat origin/main...origin/codex/handoff-mvp-20261017
```

Usar checkout/worktree isolado a partir do HEAD revisado da branch da PR. Não sobrescrever o checkout antigo ou arquivos locais, aplicar patch de índice antigo, executar reset/clean/stash geral nem fazer force-push. O Review A1 contém fontes já integradas como untracked e arquivos Main ausentes; aplicar seu diff inteiro excluiria código válido. [Inventário físico de apoio](frente-c-restore-review-inventory-20261017.json).

Antes de editar, ler AGENTS.md, CONTEXT.md, planejamento/00-indice.md, os ADRs pertinentes, decisões-operacionais.md e os critérios originais dos pais. Para UI, ler integralmente a Impeccable local e DS2.1/doc14/D-030. Documentos de10/11/13 são históricos; este índice e as decisões humanas posteriores orientam a retomada.

## 2. Issues completas e prompts independentes

| Frente | Issue / finalidade | Material específico | Prompt pronto |
| --- | --- | --- | --- |
| A — construção offline | [#41](https://github.com/kauanbarateli/Segundo-Cerebro/issues/41): transporte SourceTOC/diagnóstico fechado, sem conexão | [Handoff A](handoff-frente-transporte-20261017.md), [fix de contexto](frente-b-combined-first-refusal-context.md) | [Prompt A](prompt-frente-a-retomada-20261017.md) |
| B — Root conectado | [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42): baseline, restore e rotina de backup; depende de A | [Handoff B](handoff-frente-conectada-20261017.md), [backup/baseline](frente-b-backup-baseline-20261017.md) | [Prompt B](prompt-frente-b-retomada-20261017.md) |
| C — Auth/CI | [#43](https://github.com/kauanbarateli/Segundo-Cerebro/issues/43): drain/posse/limpeza; paralelo a A | [Handoff C](handoff-frente-auth-20261017.md), [ActiveClose](browser-active-close-probe.md) | [Prompt C](prompt-frente-c-retomada-20261017.md) |
| D — release | [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44): visual/a11y/PWA/seis jornadas, após design estável | [Handoff D e critérios originais](handoff-frente-release-20261017.md) | [Prompt D](prompt-frente-d-retomada-20261017.md) |

As quatro issues têm estado comprovado, escopo, passos de execução, testes, dependências, critérios e prompt completo no próprio corpo. Os pais #35/#12 e épicos #2/#7 conservam seus aceites; não fechar pais ao concluir só um filho. #36 permanece aberta como manutenção após o MVP, com `pos-mvp`, sem milestone e sem bloquear o aceite, por decisão expressa. [Decisão #36](decisao-36-pos-mvp-20261017.md).

## 3. Estado implementado, validado e pendente

**Já no Main61d03:** comparador A2 puro; parser integral TOC/histórias; namespace nominal separado de inspeção; snapshot nativo target readonly; builder de cobertura SourceALL/TargetALL e comando combinado num processo/45s. Root99/99 do combinado10+builder26+A263, regressões pertinentes/lint5 e dispatcher30/30; nenhuma autoridade de importação gerada.

**Nesta PR, revisado localmente:**

- Inspector preserva o contexto WeakMap do envelope mantendo o primeiro código original. Runtime local48171B/SHA54F54CC6AE942C173158665CEE2F27C284C67F2AD24916716C69FA07F9453589. QA combinado18161B/SHAA0010392D4940C78FAAE4E6535003DB088FA1908255A64E42BA63F9A98F4EEE7. Root12/12+lint2, peer estático aprovado. O fix não foi usado no archive real.
- ActiveClose observa o evento público CDPSession `close` e preserva a promessa original de detach/rejeição, sem retry. Runtime32600B/SHAD50B176078156F0BB9B499A959DE5F4EF40D972F4CC9CA6E57E16FB490BAFE33; QA25537B/SHA3169737D18C555BDAEB8CFB39815B0D575B495E19819CD0BED78811FE155CB94. Root33/33+lint2, peer aprovado. Não modifica os specs Auth reais nem prova que passaram.
- Handoffs/prompts, decisão pós-MVP#36, evidência fechada da falha Source e fontes públicas dos preparos, antes somente locais.

Pins acima descrevem os bytes locais executados; conferir a normalização do Git antes de preparar outro protocolo. Nenhum resultado local é atribuído automaticamente ao merge SHA ou CI.

**Operações reais encerradas:**

| Operação | Resultado e limite |
| --- | --- |
| Backup novo8084 | Uma criação autorizada na nova janela e um verify separado passaram. Arquivo951230B, uma entrada de banco/zero objetos Storage; archive e chave anteriores preservados. Janela encerrada, scheduler Calendário restaurado `true`. [Create](evidence/backup-create-native-8084c39-20261017.json) / [verify](evidence/backup-verify-native-8084c39-20261017.json). |
| Target inventory51495ec | Readonly/RR,395TOC entries,Auth82/Storage74 e dados não históricos vazios naquele snapshot. Não prova igualdade ou estabilidade posterior. [Evidência original](evidence/restore-target-inventory-native-51495ec-20261016.json). |
| Combinado61d03 | Exit1/INSPECTION_INPUT_FAILED/stage source; envelopes internos null na versão antiga. Comparação não concluída. Nenhuma importação. [Evidência fechada](evidence/restore-combined-baseline-native-61d03c7-20261017.json). Não atribuir erro de baixo nível não observado. |
| ActiveClose8084/run38990606937 | Controle passou; candidato INCONCLUSIVE/ORIGINAL_TERMINALS_BEFORE_CLOSE. Fator de close não ocorreu; cleanup da sessão/ações não confirmado. [Projeção original](evidence/browser-active-close-native-8084c39-20261017.json). |
| Auth/Admin/Recovery anteriores | Etapas funcionais e falhas globais conservam suas próprias fontes, descritas no handoff C. Não reabrir raws/capturas ou reclassificar resultado após um fix. |

Metadados61d03 na última consulta: success nos runs Auth local38991430121, Admin backend38991430081, Foundation38991430115, Avatar38991430103 e Captura Storage38991430091; failure em Admin navegador38991430101 e Recovery38991430080; CI geral38991430122 ainda in_progress. Nenhum log dessa rodada foi lido para atribuir causa. Resultados da PR têm SHA próprio e precisam de consulta posterior.

## 4. Próximos passos, nesta ordem

1. Revisar a PR Draft e os fixes/QA pelo HEAD exato. Conferir status dos checks; se mudar código, revisar o delta e repetir somente checks afetados. Não ocultar falhas nem alterar gatilhos para ganhar verde.
2. A conclui o diagnóstico Source original e propõe correção com fixtures negativas, mantendo o contrato EPIPE restrito. C pode trabalhar em paralelo no owner dos specs Auth. Não há benefício em recriar módulos já implementados ou repetir contrastes fechados para procurar PASS.
3. B revisa e integra os contratos de A, prepara um protocolo **novo**, pinado e revisado, e decide a próxima operação readonly. Não executar preparos antigos após trocar SHA; não reutilizar o arquivo/captura CLOSED.
4. B só avança a restore após qualificar baseline completo, ator/vazio/privilégios/customizações, mint e lifetime. Faltam restore transacional, referências antes do COMMIT e Auth/Storage/Cofre restaurados. Não foi feita sétima importação.
5. Concluir agendamento consistente de backup e as verificações de hardening. Não confundir rotina diária do Calendário com rotina de backup.
6. D executa a rodada visual/a11y/PWA e seis jornadas quando o responsável estabilizar o design; mantém os critérios originais e exige aceite humano final. Drive continua fora do MVP e sua nova lógica será planejada separadamente.

## 5. Limites de acesso e dados

Somente fonte pessoal `rishenjoikgmfubmnfiu` e destino de ensaio `jvwduowyavpaxssogadn`. BlackSheep, VOE, seus acessos e legado povoado estão fora do escopo. SSH e gh são autorizações independentes; a conta padrão do gh é do VOE, portanto usar a conta pessoal `kauanbarateli` explicitamente e somente por processo. Não mudar auth/config global ou imprimir tokens.

001–019 estão aplicadas; **nenhuma migration pendente**. Não reaplicar/reset/seeds/bootstrap. Build, deploy, push e CI não aplicam schema remoto. Novas mudanças exigem migrations revisadas e evidência própria.

Perfis, `.env`, chaves, archive, relatórios/capturas privados, credenciais, SQL extraído e kit do Cofre não entram na PR. Os metadados necessários estão no handoff B. A cópia USB existente foi feita conforme escolha expressa do dono; não ler/copiar/recriar sua chave nesta retomada. Nenhum scheduler ficou suspenso e nenhum processo de backup/restore/captura permanece em andamento.

## 6. Recuperação de todo o trabalho local revisável

[Assets públicos com manifest](resume-assets/20261017/README.md) conservam bytes/pins dos preparos e helpers de `work/`, sem conteúdo privado. São históricos/inertes, não uma receita para reexecutar operações fechadas. Os dois documentos Auth anteriormente só no Review foram publicados como **propostas históricas**, não aceites: [diagnóstico801b](auth-801b-next-diagnostic.md) e [proposta de drain](auth-read-drain-correction-proposal.md).

Os cinco WIPs anteriores são incluídos sem alterar seus bytes, atendendo ao pedido atual de publicar o trabalho local: prompt-frente-a-construcao-offline.md, handoffs10/11 e seus dois snapshots. São arquivos históricos. **O bloco do prompt antigo da Frente A já estava vazio localmente; usar os quatro prompts completos novos desta entrega.** Nenhuma exclusão de código/Drive foi trazida do índice antigo do Review.

Os diretórios privados e caches ficam locais. Todos os deltas de código/testes/documentação revisáveis têm cópia nesta branch; não é necessário recuperar um diff integral do clone Review para continuar. O GitHub é a fonte da retomada publicada.

## 7. Execução mais rápida e previsão

Reservar paths: A altera inspector/transportes e sua QA; C altera helpers/specs Auth; B integra e controla operações reais; D concentra UI/aceite após design estável. A e C podem avançar em paralelo, mas esta máquina deve executar **um Node/PS QA/build/native pesado por vez**. Compartilhar resultados por SHA/PR e revisar antes de integrar.

Entregar lotes coerentes, aproveitar fixtures existentes, fazer checks afetados e rodar o conjunto completo no candidato de release. Manter um checkpoint curto no topo das issues; os históricos conservam apenas suas próprias evidências. Não adicionar geração de diagramas, novos frameworks ou harness paralelos sem necessidade demonstrada.

Estimativa comunicada: **12–20 horas técnicas efetivas**, condicional a não aparecerem novas divergências de restore/Auth, mais disponibilidade para aceites humanos. Não garante data. Novas melhorias visuais têm estimativa própria; #36/upstream e Drive não bloqueiam este MVP. Esta publicação não declara o projeto concluído.
