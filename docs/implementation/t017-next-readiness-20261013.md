# Prontidão e encerramento do Next nos testes de Auth — 13/10/2026

Recorte das issues #21, #24 e #37. As duas execuções próprias de `c5a8ffc` falharam na barreira de requisições pendentes. A captura de Admin observou um `continue/resolved` sem terminal de protocolo; Recovery conservou cinco requests pendentes. Esses resultados não identificam a causa das falhas. As evidências originais permanecem em [Admin](evidence/admin-native-c5a8ffc-20261013.json) e [Recovery](evidence/recovery-native-c5a8ffc-20261013.json).

## Alteração revisada

O processo Next agora conserva falha quando recebe `close` antes de uma solicitação própria de parada, inclusive com código de saída zero. A solicitação é marcada antes de enviar o sinal; erros e excesso de saída continuam persistentes. Admin e Recovery reconferem o estado do processo depois da prontidão e antes de iniciar o worker.

Os dois runners passam a exigir HTTP 200 da URL literal `/entrar` e leitura completa do corpo, limitada a 2 MiB, antes de declarar o servidor pronto. O mesmo sinal de 1.000 ms acompanha fetch e reader. O cancelamento registra aborto antes de agir, permanece sob responsabilidade do helper até concluir e sempre recusa prontidão. Apenas o `done` natural do reader, sem aborto, permite prosseguir. O conteúdo não é interpretado, impresso ou armazenado.

Foram preservados o comando `next dev`, ambiente, portas, política `redirect:error`, 120 tentativas e intervalo de 500 ms. A barreira final continua com 15 segundos; requests e inspeções pendentes, incerteza de escrita, parada dos grupos e ausência do namespace continuam impedindo aprovação ou limpeza. Não se aquecem outras rotas, não se cria terminal sintético e não se muda o contrato dos relatórios.

## Validação e revisão

A primeira correção de encerramento passou nos 200 controles offline completos repetidos pela raiz. Com a prontidão integrada, a raiz repetiu **211/211 controles**: 54 do runner Admin, 98 do suporte Admin e 59 de Recovery. Tipos e lint terminaram com saída zero. Os controles de composição que dependem de processos locais foram executados fora do sandbox, sem acessar serviços externos ou perfis privados.

O autor e o peer independente repetiram **20/20 controles focados**, incluindo 11 de prontidão e nove de ciclo do processo, além da sintaxe dos três arquivos. A revisão integral confirmou a alteração restrita de Recovery ao import e ao caller, e a manutenção de loops, sinais, prazo final e limpeza. Hashes do pacote integrado:

| Arquivo | SHA-256 |
| --- | --- |
| `scripts/verification/admin-browser-local-ci.mjs` | `c64e3f9f12a556768522c8840c5562b6ef2a827c2212245bcf91f689b71f079b` |
| `scripts/verification/auth-recovery-local-ci.mjs` | `9dbbe160dcfb61e2b485ddd8d1496f49fcb5acc93286931fdec736f728da047e` |
| `tests/scripts/admin-browser-local-ci.test.mjs` | `0f6ce92338729ed7b77a3c21b75da05f89e1bdedc121283f08a0ece650f202e7` |

Os streams da QA são nativos em memória. Ela não executa fetch real e não comprova socket EOF, hidratação ou HMR. Os hashes declarados pelos relatórios continuam sendo manifestos finitos, sem alegar cobertura de todas as dependências transitivas. A nova publicação exige resultados e capturas próprios; nenhum resultado de `c5a8ffc` recebe aprovação por este patch.

## Próxima observação

Conferir os oito workflows do novo commit e seu deployment. Se Admin ou Recovery falharem, preparar e revisar o coletor vinculado à nova execução antes da leitura única da etapa pertencente ao runner. Preservar código de falha, requests pendentes e veto de limpeza; não reabrir logs privados anteriores nem aumentar o prazo para obter aprovação.
