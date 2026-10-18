# Retomada da Frente B — restore e backup conectados

Issue operacional: [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42). A Frente A/#41 precisa resolver a observabilidade e o transporte SourceTOC antes da próxima inspeção. Ler primeiro o [handoff central](handoff-retomada-20261017.md) e o [prompt B](prompt-frente-b-retomada-20261017.md).

## Ponto limpo e primeira ação

O Main publicado é `61d03c768071e6618136e648fc71c552e3db2043`. O código local seguinte está na PR Draft de retomada; não foi incorporado. A operação combinada61d03 foi encerrada com `INSPECTION_INPUT_FAILED`, fase Source e diagnósticos internos nulos. Nenhuma comparação nativa ou importação passou. A primeira ação é revisar a correção do envelope nominal e a entrega offline de observabilidade, não repetir a operação encerrada.

Fonte pessoal permitida: `rishenjoikgmfubmnfiu`; único destino: `jvwduowyavpaxssogadn` (Ensaio_restore). Não usar o legado povoado `nqxgtnvmzuempxemlaku`, BlackSheep ou Sistema VOE. Não reaplicar migrations001–019, resetar nem executar seeds. Nenhuma migration está pendente neste checkpoint.

## Arquivo novo já criado e verificado

Criação e verify separado em8084 passaram; ver [resumo e evidências](frente-b-backup-baseline-20261017.md). Arquivo autorizado:

```text
C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup
```

Ciphertext951230B, plaintext950017B, SHA-256 `21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a`; uma entrada de banco e zero objetos Storage. Key ID `SC-20261012-001`, sem material de chave neste repositório. O archive antigo e a chave/USB foram preservados. A nova janela humana de17/10 encerrou; a variável `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` foi restaurada para `true`. Não há pausa de agendador a desfazer. Nova criação exige nova janela; verify ou leitura do archive imutável não equivale a criar outro backup.

Perfis privados existentes, jamais publicar/abrir conteúdo bruto:

| Uso | Nome em `SegundoCerebro-Operations/profiles/` | Bytes / SHA-256 |
| --- | --- | --- |
| Criação/verify pessoal | `backup-source-pg18-20261012-v1.xml` | 4206 / `5D9C83138241DBBF3EA94722E46BF4A67EA52B2EF22D72F7F05055BBC214F32C` |
| Destino/inspeção | `restore-target-pg18-20261012-v2.xml` | 3901 / `E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B` |

O Target já recebeu a chave independente durante sua preparação; não fundir/deserializar perfis para investigar. O dispatcher carrega somente o perfil autorizado no filho. PostgreSQL18.4 pg_dump/pg_restore e psql17 são os executáveis qualificados para este recorte; PG17 dump/restore foram bloqueados pelo Windows. Compatibilidade de versão do transporte não certifica restore completo.

## Sequência de execução após retomada explícita

1. Revisar a PR pelo SHA, conferir entregas A/C e o delta. Rodar somente QA pertinente em Node24/PS7, serial por pouca RAM.
2. Preparar novo protocolo Source/input e nova inspeção somente leitura com todos os pins finais. Usar as evidências fechadas e os [fontes arquivados](resume-assets/20261017/README.md), nunca reabrir captures/raws nem executar preparos antigos.
3. Observar SourceAEAD/footer/EOF/recheck→TOC/histórias e snapshot target readonly/RR→TOC/histórias. Comparar DDL, owners, ACLs, dependências e versões completas. Target inventory51495ec tinha Auth82/Storage74; o archive antigo tinha Storage73. Não presumir as histórias do novo archive.
4. Se houver diferença, registrar enum/contagem do objeto/atributo permitido e corrigir a política ou ambiente por causa demonstrada; não ignorar extras, cortar dependências, normalizar SQL ou tolerar ACL pela migration003 sem prova.
5. Qualificar ator, vazio, privilégios, event triggers/customizações e origem/lifetime do snapshot. Só então completar mint único no inspector e consumo no mesmo processo. O builder de observação não autoriza importação.
6. Planejar e revisar o primeiro restore seguinte como operação própria transacional no destino isolado. Conferir referências antes de COMMIT e rollback/ausência em falha. Não executar a sétima importação só por PASS sintético/comparação JSON.
7. Provar Auth, arquivos/imagens autorizados e Cofre restaurados, sem pedir senha mestra/kit pelo chat. O archive observado não tem objetos Storage; fixtures reais adicionais exigem escopo e limpeza próprios.
8. Concluir rotina de backup consistente fora de sincronização e registrar execução/restore. Capturar aceites humanos da interface somente após design estável, conforme Frente D.

Nenhuma operação conectada está em andamento neste handoff. O trabalho solicitado agora termina na publicação das issues e PR Draft. Não fazer merge ou retomar execução real automaticamente.
