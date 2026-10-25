# Hábitos — marcação real e desfazer na homologação

**OBSERVADO:** na conta comum descartável existente, a marcação de24/10/2026 no hábito sintético foi salva, persistiu após recarga e foi desfeita pelo controle normal. A segunda recarga preservou o estado desmarcado. O ensaio ocorreu no Source `15cb0c0e9f46d5134ea382cdc5c1aadbce4d219e`, deployment `dpl_37NpngvjHTh8teJw4jxmQTySrD3P`, projeto isolado `twrydxsdemaykgvdlpyd`.

As quatro observações MCP foram somente leitura, com destino conferido, transação repeatable read/read only e rollback. A seleção interna usou duas fixtures sintéticas exatas e cardinalidades1; retornou apenas contagens, booleanos e data civil, sem UUID ou conteúdo pessoal. As duas escritas foram realizadas pelo navegador autenticado, uma marcação e um desfazer.

| Fato persistido | Antes | Marcado | Desfeito | Após recarga |
| --- | ---: | ---: | ---: | ---: |
| Marcações da data | 0 | 1 | 0 | 0 |
| Eventos de criação | 0 | 1 | 1 | 1 |
| Eventos de remoção | 0 | 0 | 1 | 1 |
| Pares criação/remoção com mesma identidade e payload | 0 | 0 | 1 | 1 |
| Recibos habit.mark do dono | 0 | 1 | 2 | 2 |

A Marcação atual coincidiu com seu evento de criação. Após desfazer, ficou um par de eventos com a mesma identidade/payload. Eventos do próprio Hábito permaneceram1 e marcações de outras datas0. O desfazer normal remove só a Marcação; os dois eventos e recibos permanecem. A consulta não fez hash integral do Hábito nem comparação de todos os outros dados; nenhuma ação de criação de Hábito/Usuário foi realizada.

As capturas mostram as métricas após recarga: [marcado](evidence/habit-marked-after-reload-20261024.jpg),1registro/50%/1de2; [desfeito](evidence/habit-undone-after-reload-20261024.jpg),0registros/0%/0de2. O estado do controle de hoje e a data foram observados na árvore acessível, fora do enquadramento dessas imagens. O [recibo completo](evidence/habit-mark-undo-hosted-20261024.json) distingue essas fontes. Um revisor independente abriu os dois JPEG e conferiu os deltas; parecer SHA256 `5258784d940670d5e450be16efd61b784d827ea9f0e188984b68b9a3518e8a2e`.

O aceite é de um percurso de sucesso, numa identidade e no Source15. Sete arquivos relevantes são idênticos ao f54 por revisão estática separada; isso não constitui aceite hospedado do f54. Não houve teste de duas identidades/RLS, replay, concorrência, rollback sob falha, expiração, virada de dia, mudança histórica de cadência ou aparelho físico. SELECT privilegiado não comprova a política do papel autenticado.

Nenhuma migration, reset, seed, DML administrativo, limpeza de eventos, nova autorização Google, merge ou deploy de produção foi executado. Os bloqueios gerais permanecem.
