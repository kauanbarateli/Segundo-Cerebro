# Frente B: backup novo e comparação combinada

Checkpoint de 17/10/2026 UTC (16/10 em Fortaleza). Continuidade do handoff de restore/Auth; não constitui aceite de release.

## Backup nativo concluído neste recorte

O responsável confirmou uma nova janela sem alterações. O agendador pessoal do Calendário estava habilitado, com as últimas execuções consultadas encerradas; sua variável foi temporariamente suspensa e restaurada para `true` após a criação. A janela foi liberada ao responsável.

Uma única criação no código `8084c3988b34f8973c72178aab446bdaecffa014` terminou com saída original 0 e os dois EOFs. O novo arquivo cifrado possui 951.230 bytes; contém uma entrada de banco, 950.017 bytes de plaintext e zero objetos Storage. A chave independente existente e os arquivos anteriores foram preservados. [Evidência de criação](evidence/backup-create-native-8084c39-20261017.json).

Uma operação **separada**, somente de leitura local, verificou o arquivo exato sob lease e conferiu seu hash antes/depois. AEAD, ordem, footer, manifesto, EOF e identidade do projeto pessoal passaram, com os mesmos agregados da criação. SHA-256 do arquivo: `21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a`. [Evidência de verificação](evidence/backup-verify-native-8084c39-20261017.json).

Isso certifica este archive e seu transporte de criação/verificação. Não certifica restore, rotina agendada de backup, recuperação de arquivos ou Cofre. O novo histórico de migrations ainda precisa ser observado; não se presume que tenha corrigido a diferença Storage 73/74 do backup anterior.

As preparações locais de criação/verificação foram revisadas por Root e por outro agente. Root executou 67 controles puros da criação e 60 da verificação; os gates falsos permaneceram inertes. Os perfis privados foram consumidos somente pelo dispatcher autorizado, nunca publicados ou impressos.

## Integração somente de observação

O novo comando `restore-inspect-baseline` encadeia, num único processo e prazo de 45 segundos:

1. Autenticação completa do archive, reconferência do ciphertext e TOC/histórias Source.
2. Snapshot nativo read-only/repeatable-read do destino autorizado, catálogo/vazio e TOC de inspeção.
3. Extração das duas histórias do mesmo dump target, com reconferência das contagens do snapshot.
4. Comparações A2 gerenciada e de candidatos públicos existentes, com cobertura total dos metadados target.
5. Reconferência dos handles durante a limpeza assíncrona, descarte, zeragem e fechamento único do scope.

Os recursos nominais permanecem privados e vivos até o fim. O builder mantém SourceALL, todas as dependências e os candidatos extras target; não usa JSON público como autoridade. A seleção Source e B4 original permanecem preservados. `inspectionOnly=true`, `baselineQualified=false` e `restoreAccepted=false` são fixos. Nenhum mint, replay ou importação é alcançável por esse comando.

Root leu as fontes e executou **99/99** controles (10 do fluxo combinado, 26 do builder e 63 do A2), lint dos cinco módulos/testes novos ou alterados e dispatcher **30/30**, com 15 chamadas de argv sintéticas. As suítes existentes de inspector, target baseline/inventory, TOC, plano e história de inspeção passaram; o controle nativo de ACL foi explicitamente excluído desta execução e não recebe novo PASS. A revisão independente por fonte não encontrou bloqueadores. O scanner do Main examinou 1.561 arquivos versionáveis sem divulgar valores.

Detalhes: [política do builder](frente-b-inspected-baseline-observation.md) e [contrato do fluxo combinado](proposta-baseline-combinado-inspecao.md). Estes testes sintéticos não substituem a próxima inspeção nativa única, com nova preparação e pins exatos do commit publicado.

## Diagnóstico Auth observado

A captura única do run [38990606937](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38990606937), SHA `8084c398...`, foi vinculada ao job original e à etapa 7/index 6 de 10, com os 24 campos de metadados reconferidos antes/depois do download. Leitor: 28/28 controles próprios e lint sem warnings, além de revisão independente. O preparo foi ativado somente pelas duas constantes revisadas; a observação está encerrada e não será reutilizada.

O controle finito passou. O caso de close ativo ficou **INCONCLUSIVE / ORIGINAL_TERMINALS_BEFORE_CLOSE**: os terminais originais já indicavam falha e pending zero antes de solicitar close; nenhuma chamada de close ocorreu antes da decisão. A limpeza da sessão e das ações não foi confirmada. Portanto o run permanece failure; não demonstra eficácia do fator de close nem resolve os testes Admin/Recovery. [Projeção nativa sem dados privados](evidence/browser-active-close-native-8084c39-20261017.json).

## Próximos aceites e previsão

O caminho crítico permanece: inspeção combinada nativa, qualificação completa de baseline/ACLs/privilégios, restore transacional e referências, Auth/Storage/Cofre restaurados, correção dos runners Auth, rotina consistente de backup e portões finais de release. Nenhuma sétima importação está autorizada pelos resultados deste checkpoint. Não reaplicar 001–019; nenhuma migration está pendente.

Previsão de trabalho restante: **12–20 horas efetivas**, em aproximadamente **2–4 dias** com frentes paralelas e disponibilidade para os aceites. É uma estimativa, sujeita a novas divergências de restore/Auth. O encerramento integral também depende das jornadas em aparelhos e do aceite humano final; melhorias visuais novas e Drive ficam fora dessa previsão. As cinco issues #35, #12, #36, #2 e #7 permanecem abertas.
