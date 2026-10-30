# Peer independente — C2a V2

OBSERVADO em24/10/2026 por leitura e hashes. Parecer favorável estático para composição e CI; não encontrei novo bloqueador objetivo na correção examinada. Não executei Node, testes, lint, SQL, rede, serviços ou operação privada; não editei fontes dos autores.

Manifesto: `finance-goals-image-upload-c2a-freeze-v2-20261024/manifest.json`,5258B/SHA256 `e6dd0dda63c24838381d284df406d073a58fb69ddbcca3ac7e174295dcd28973`. Conferi9after/9before/9WT e os4artefatos do manifesto; conferi também os16 arquivos preservados (12M2-S e4J2) no WT autor. O delta é somente coordenador/teste/doc; os seis outros paths C2a são byte-idênticos à V1. O pacote V1 permanece fotografia preservada, sem promoção retroativa.

## Correção do P1

Em `src/lib/files/goal-image-upload.ts:169–173`, o callback de `resume` agora verifica o próprio signal imediatamente após obter a lease e antes de ler A ou selecionar a fase. `attempt` e `advance` exigem esse signal, com reconferência antes/depois de snapshots e antes da escrita local (97–104). Não existe chamada nova desses helpers sem o signal da operação.

`finalize` também recusa na entrada e, na linha159, antes de avaliar a expressão que chama `executeDomainCommand` na160. Isso corrige a ordem anterior em que iniciar o Promise antecedia a checagem de `wait`. O caminho finalizing/ready-unbound continua usando o comando original, sem reserve/observe/PUT à sua frente e sem UUID substituto. O retorno tardio ainda passa pelas guardas antes de avançar ready-unbound e antes da emissão de prova nominal (160–167).

As seleções e reseleções verificam signal ao receber a lease e antes de stage/cache do File (120–143); financeClear verifica o mesmo signal antes de entrar e dentro da transição local (105–108). initializeJournal, digest, reserve, observe e PUT têm guarda explícita antes da avaliação dos respectivos ports (114,147,179–180,184–185,194–199). Uma operação recusada não readmite B, não limpa A nem produz prova por metadata. Os limites continuam150s/25s/20s/65s conforme a V1; não houve extensão para fazer o caso passar.

## Testes escritos

`tests/lib/goal-image-upload.test.ts:37–43` retém a lease real da fixture e drena a fila após liberá-la. Os novos casos109–132 cobrem quatro confrontos: finalizing e ready-unbound liberados após150001ms (zero finalize e zero Storage antes/depois de drenar; A e storage idênticos); seleção expirada (zero stage/UUID); reseleção expirada (resume posterior continua need-file). Eles não se limitam a observar a rejeição externa antes da execução do callback atrasado.

O negativo anterior133–136 continua preservado, com finalize já enviado uma vez antes do timeout: a resposta tardia não minta prova nem apaga A; o teste não afirma rollback ou zero envio retroativo. As demais recusas de owner/dispose/hash/DTO/sender/observação e os testes de transporte/barreira/client continuam presentes. Estes casos estão escritos, não executados neste parecer.

## Hashes dos três deltas

| Path | SHA-256 V2 |
| --- | --- |
| `src/lib/files/goal-image-upload.ts` | `306120f67c624e527603482fb652871cc7ee91104b8e5ce01973853bf3bfdc90` |
| `tests/lib/goal-image-upload.test.ts` | `7d7ecece3300c27a90631a1b6e5a41924ad5e0c7fbd560201b66b29afca5ee14` |
| `docs/implementation/t054-finance-goals-image-upload-coordinator-20261024.md` | `db8e4300fd5a653480587db9265df041354ba902d03478745eca69696fc7f7a7` |

## Limites

O parecer não certifica event loop, timers, TypeScript, Web Locks nativos, journal geral real, Storage ou corrida entre abas. Faltam revisão Root e gates próprios do SHA composto; não herdar PASS de J2/M2/70c. Na composição, preservar o client concreto atual e aplicar somente a capacidade local autorizada sobre o mesmo journal, sem regressão de terminal/EOF.

Continuam fora desta entrega retirement/clear, presenter/editor, Workspace e vínculo financeiro. Não montar o port antes dessas fatias e dos gates E1-A/servidor/host. Nenhuma migration/flag/rota nova, schema hospedado ou promoção de produção é autorizada por este peer.