# Encerramento técnico da #41 — transporte offline

A [issue #41](https://github.com/kauanbarateli/Segundo-Cerebro/issues/41) foi encerrada como concluída em 25/10, após Root e revisão independente conferirem seus cinco critérios no código `3403a5aa1901c166e6cfc1206848bfdc1c34957a`. [Comentário de aceite](https://github.com/kauanbarateli/Segundo-Cerebro/issues/41#issuecomment-6404889538).

| Critério da #41 | Evidência |
| --- | --- |
| Primeira falha original imutável | WeakMaps e contexto nominal preservados; suites de inspector/combined e negativos aprovados. |
| Fatos de transporte separados | Callback, finish, stdout/stderr EOF, exit e close continuam independentes; não há terminal inferido de ACK. |
| Negativos e exceção restrita | V2 recusa observações depois de close; ramo EOF só no TOC da origem autenticada. Target/ACL/EPIPE não foram ampliados. Controle de getter exige zero leituras. |
| Fronteiras mantidas | SourceALL/TargetALL/A2, prazos 45s/ACL15s e ausência de autoridade de restore preservados. |
| Entrega revisável | Código, controles Root/peer e limites estão na PR #120; suites próprias de scripts passaram no CI 3403. |

A [nota de correção](restore-source-eof-closed-state-20261025.md) preserva os testes locais próprios e a rejeição da V1. A coorte 3403 encerrou 22 runs/24 jobs SUCCESS; os passos de scripts passaram no [geral push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40234742944) e no [geral PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40234746908). O épico #7 marcou apenas a filha #41 e continua aberto.

Este fechamento aceita a construção offline. Não declara identificada a causa histórica da inspeção 61d03, nem valida uma inspeção Windows ou um restore conectado. Esses critérios pertencem à #42/#35 e continuam abertos. Nenhum perfil, archive, backup ou banco foi acessado para o fecho. A PR #120 segue em rascunho; main, merge e produção permanecem preservados/bloqueados.
